"""ISRP registry server. Run with Python 3.10 or later."""
import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from datetime import date
from uuid import uuid4

from flask import Flask, abort, g, jsonify, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).resolve().parent
SEED = json.loads((ROOT / "data/licenses.json").read_text(encoding="utf-8"))
FIELDS = ("nickname", "faction", "role", "license", "issuedAt", "expiresAt", "status")
ROLES = {f["id"]: f["roles"] for f in SEED["factions"]}
PUBLIC_FILES = {"index.html", "app.js", "admin.js", "styles.css", "portal.css",
                "data/licenses.json", "data/documents.json"}
COOKIE = "isrp_session"


def validate_record(payload):
    values = {}
    for field in FIELDS:
        value = payload.get(field)
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 80:
            abort(400, "Заполните все поля (до 80 символов).")
        values[field] = value.strip()
    if values["role"] not in ROLES.get(values["faction"], ()):
        abort(400, "Выберите роль из списка выбранной организации.")
    if values["status"] not in {"active", "expired", "revoked"}:
        abort(400, "Выберите статус из списка.")
    for key in ("issuedAt", "expiresAt"):
        try:
            if date.fromisoformat(values[key]).isoformat() != values[key]:
                raise ValueError
        except ValueError:
            abort(400, "Проверьте формат даты.")
    if values["issuedAt"] > values["expiresAt"]:
        abort(400, "Дата окончания должна быть не раньше даты выдачи.")
    return values


def validate_password(password):
    return isinstance(password, str) and 12 <= len(password) <= 256


def connect(path):
    connection = sqlite3.connect(path, timeout=8)
    connection.row_factory = sqlite3.Row
    return connection


def initialize(path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    db = connect(path)
    try:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS records (
                id TEXT PRIMARY KEY, license_key TEXT UNIQUE NOT NULL, data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS failures (client TEXT NOT NULL, at INTEGER NOT NULL);
        """)
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT 1 FROM settings WHERE key='updatedAt'").fetchone():
            for row in SEED["records"]:
                row = {**row, "revision": 1}
                db.execute("INSERT INTO records VALUES (?, ?, ?)",
                           (row["id"], row["license"].casefold(), json.dumps(row)))
            db.execute("INSERT INTO settings VALUES ('updatedAt', ?)", (SEED["updatedAt"],))
        db.commit()
    finally:
        db.close()


def create_app(path, *, private_setup=False, secure_cookie=True):
    initialize(path)
    app = Flask(__name__, static_folder=None)
    app.config["MAX_CONTENT_LENGTH"] = 8192

    def db():
        if "db" not in g:
            g.db = connect(path)
        return g.db

    @app.teardown_appcontext
    def close_db(_error):
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    def setting(key):
        row = db().execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row[0] if row else None

    def token_hash(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def authenticated():
        digest = token_hash(request.cookies.get(COOKIE, ""))
        return bool(db().execute("SELECT 1 FROM sessions WHERE token=? AND expires>?",
                                 (digest, time.time())).fetchone())

    def signed_in_response():
        token = secrets.token_urlsafe(32)
        db().execute("DELETE FROM sessions WHERE expires<=?", (time.time(),))
        db().execute("INSERT INTO sessions VALUES (?, ?)", (token_hash(token), time.time() + 8*3600))
        db().commit()
        response = jsonify(authenticated=True)
        response.set_cookie(COOKIE, token, httponly=True, secure=secure_cookie,
                            samesite="Lax", max_age=8*3600, path="/")
        return response

    @app.before_request
    def protect_writes():
        if request.method in {"POST", "PUT"}:
            # Same-origin fetch must opt in. Cross-origin clients cannot set this
            # header from a browser without a successful CORS preflight.
            if not request.is_json or request.headers.get("X-ISRP-Request") != "1":
                abort(403, "Обновите страницу и повторите действие.")
            if not isinstance(request.get_json(silent=True), dict):
                abort(400, "Неверный формат запроса.")

    @app.after_request
    def headers(response):
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.errorhandler(400)
    @app.errorhandler(401)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(409)
    @app.errorhandler(413)
    @app.errorhandler(429)
    def problem(error):
        return jsonify(error=error.description), error.code

    @app.get("/api/registry")
    def registry():
        db().execute("BEGIN")
        rows = db().execute("SELECT data FROM records ORDER BY rowid DESC")
        return jsonify(factions=SEED["factions"], notice=SEED["notice"],
                       updatedAt=setting("updatedAt"), records=[json.loads(row[0]) for row in rows])

    @app.get("/api/session")
    def session_state():
        configured = bool(setting("password"))
        return jsonify(authenticated=authenticated(), configured=configured,
                       canSetup=not configured and private_setup)

    @app.post("/api/setup")
    def setup():
        if not private_setup:
            abort(403, "Первичная настройка доступна владельцу сервера.")
        password = request.json.get("password")
        if not validate_password(password):
            abort(400, "Используйте пароль длиной от 12 до 256 символов.")
        db().execute("BEGIN IMMEDIATE")
        if setting("password"):
            abort(409, "Пароль уже создан. Откройте форму входа.")
        db().execute("INSERT INTO settings VALUES ('password', ?)", (generate_password_hash(password),))
        return signed_in_response()

    @app.post("/api/login")
    def login():
        password = request.json.get("password")
        stored = setting("password")
        if not stored:
            abort(403, "Владелец сервера ещё не настроил вход.")
        client = request.remote_addr or "unknown"
        db().execute("BEGIN IMMEDIATE")
        db().execute("DELETE FROM failures WHERE at < ?", (time.time()-300,))
        failures = db().execute("SELECT count(*) FROM failures WHERE client=?", (client,)).fetchone()[0]
        if failures >= 12:
            abort(429, "Слишком много попыток. Повторите вход через пять минут.")
        if not validate_password(password) or not check_password_hash(stored, password):
            db().execute("INSERT INTO failures VALUES (?, ?)", (client, int(time.time())))
            db().commit()
            abort(401, "Неверный пароль.")
        db().execute("DELETE FROM failures WHERE client=?", (client,))
        return signed_in_response()

    @app.post("/api/logout")
    def logout():
        db().execute("DELETE FROM sessions WHERE token=?",
                     (token_hash(request.cookies.get(COOKIE, "")),))
        db().commit()
        response = jsonify(authenticated=False)
        response.delete_cookie(COOKIE, path="/")
        return response

    @app.post("/api/records")
    @app.put("/api/records/<record_id>")
    def save_record(record_id=None):
        db().execute("BEGIN IMMEDIATE")
        if not authenticated():
            abort(401, "Войдите в панель управления.")
        values = validate_record(request.json)
        previous = {}
        if record_id:
            row = db().execute("SELECT data FROM records WHERE id=?", (record_id,)).fetchone()
            if not row:
                abort(404, "Запись не найдена.")
            previous = json.loads(row[0])
            if request.json.get("revision") != previous["revision"]:
                abort(409, "Запись уже изменена. Откройте её заново.")
        record = {**values, "id": record_id or "ISRP-" + uuid4().hex.upper(),
                  "demo": previous.get("demo", False), "revision": previous.get("revision", 0) + 1}
        try:
            db().execute("""
                INSERT INTO records VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET
                license_key=excluded.license_key, data=excluded.data
            """, (record["id"], record["license"].casefold(), json.dumps(record)))
        except sqlite3.IntegrityError:
            abort(409, "Такой номер лицензии уже используется.")
        db().execute("UPDATE settings SET value=? WHERE key='updatedAt'", (date.today().isoformat(),))
        db().commit()
        return jsonify(record), 200 if record_id else 201

    @app.get("/")
    @app.get("/<path:asset>")
    def static_asset(asset="index.html"):
        if asset.startswith("media/"):
            return send_from_directory(ROOT / "media", asset.removeprefix("media/"))
        if asset not in PUBLIC_FILES:
            abort(404)
        return send_from_directory(ROOT, asset)

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["serve", "set-password"], nargs="?", default="serve")
    parser.add_argument("--db", type=Path, default=Path(os.environ.get("ISRP_DB",
                        str(Path.home() / ".local/share/isrp/registry.sqlite3"))))
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--private-setup", action="store_true",
                        help="Only behind a session-owner access gate. Allows first password setup.")
    parser.add_argument("--local-http", action="store_true", help="Allow cookies over local HTTP.")
    args = parser.parse_args()
    if args.command == "set-password":
        password = getpass.getpass("Новый пароль администратора (12–256 символов): ")
        if not validate_password(password) or password != getpass.getpass("Повторите пароль: "):
            parser.error("Пароль не подходит или не совпадает.")
        initialize(args.db)
        with connect(args.db) as database:
            database.execute("INSERT OR REPLACE INTO settings VALUES ('password', ?)",
                             (generate_password_hash(password),))
            database.execute("DELETE FROM sessions")
    else:
        from waitress import serve
        serve(create_app(args.db, private_setup=args.private_setup, secure_cookie=not args.local_http),
              host=args.host, port=args.port, max_request_body_size=16384)
