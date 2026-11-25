import secrets
import tempfile
import unittest
from pathlib import Path

from server import create_app


class RegistryTest(unittest.TestCase):
    def setUp(self):
        work = tempfile.TemporaryDirectory()
        self.addCleanup(work.cleanup)
        self.path = Path(work.name) / "registry.sqlite3"
        self.app = create_app(self.path, private_setup=True)
        self.admin = self.app.test_client()
        self.public = self.app.test_client()
        self.headers = {"X-ISRP-Request": "1"}
        self.password = secrets.token_urlsafe(24)
        self.record = {"nickname": "Test_Lawyer", "license": "LAW-TEST-08",
                       "faction": "bar", "role": "Адвокат", "status": "active",
                       "issuedAt": "2026-01-01", "expiresAt": "2090-01-01"}

    def setup_admin(self):
        result = self.admin.post("/api/setup", json={"password": self.password}, headers=self.headers)
        self.assertEqual(result.status_code, 200)

    def test_creation_persistence_changes_and_duplicates(self):
        self.setup_admin()
        saved = self.admin.post("/api/records", json=self.record, headers=self.headers)
        self.assertEqual(saved.status_code, 201)
        record = saved.json
        duplicate = {**self.record, "license": "law-test-08"}
        self.assertEqual(self.admin.post("/api/records", json=duplicate, headers=self.headers).status_code, 409)
        restarted = create_app(self.path).test_client()
        self.assertIn(record, restarted.get("/api/registry").json["records"])
        url = "/api/records/" + record["id"]
        record["status"] = "revoked"
        self.assertEqual(self.admin.put(url, json=record, headers=self.headers).status_code, 200)
        self.assertEqual(self.admin.put(url, json=record, headers=self.headers).status_code, 409)
        updated = next(r for r in self.public.get("/api/registry").json["records"] if r["id"] == record["id"])
        self.assertEqual(updated["status"], "revoked")
        self.assertFalse(updated["demo"])

    def test_access_and_session_lifecycle(self):
        public_server = create_app(self.path).test_client()
        def post(client, route, data):
            return client.post("/api/" + route, json=data, headers=self.headers).status_code
        self.assertEqual(post(public_server, "setup", {"password": self.password}), 403)
        self.assertEqual(post(self.public, "records", self.record), 401)
        self.setup_admin()
        self.assertEqual(post(self.public, "setup", {"password": self.password}), 409)
        self.assertEqual(self.admin.post("/api/records", json=self.record).status_code, 403)
        self.assertEqual(post(self.admin, "logout", {}), 200)
        self.assertFalse(self.admin.get("/api/session").json["authenticated"])
        self.assertEqual(post(self.admin, "records", self.record), 401)
        self.assertEqual(post(self.admin, "login", {"password": self.password}), 200)
        self.assertTrue(self.admin.get("/api/session").json["authenticated"])

    def test_validation_and_demo_preservation(self):
        self.setup_admin()
        for change in ({"role": "Судья"}, {"expiresAt": "2020-01-01"},
                       {"issuedAt": "2026-02-31"}, {"nickname": "  "}, {"status": "unknown"}):
            result = self.admin.post("/api/records", json={**self.record, **change}, headers=self.headers)
            self.assertEqual(result.status_code, 400)
        demo = self.public.get("/api/registry").json["records"][0]
        modified = self.admin.put("/api/records/" + demo["id"], json={**demo, "demo": False}, headers=self.headers)
        self.assertTrue(modified.json["demo"])
