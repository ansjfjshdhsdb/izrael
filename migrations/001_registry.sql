CREATE TABLE IF NOT EXISTS licenses (
  id_key TEXT PRIMARY KEY,
  license_key TEXT NOT NULL UNIQUE,
  record TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS document_edits (
  item_key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- Preserve the three clearly labelled examples from the original public registry.
INSERT OR IGNORE INTO licenses (id_key, license_key, record) VALUES ('isrp-demo-001', 'sbs-demo-001', '{"id": "ISRP-DEMO-001", "nickname": "Demo_SBS", "faction": "sbs", "role": "Сотрудник СБС", "license": "SBS-DEMO-001", "issuedAt": "2026-01-01", "expiresAt": "2027-01-01", "status": "active", "demo": true}');
INSERT OR IGNORE INTO licenses (id_key, license_key, record) VALUES ('isrp-demo-002', 'court-demo-002', '{"id": "ISRP-DEMO-002", "nickname": "Demo_Judge", "faction": "court", "role": "Судья", "license": "COURT-DEMO-002", "issuedAt": "2026-01-01", "expiresAt": "2027-01-01", "status": "active", "demo": true}');
INSERT OR IGNORE INTO licenses (id_key, license_key, record) VALUES ('isrp-demo-003', 'nps-demo-003', '{"id": "ISRP-DEMO-003", "nickname": "Demo_NPS", "faction": "nps", "role": "Сотрудник НПС", "license": "NPS-DEMO-003", "issuedAt": "2025-01-01", "expiresAt": "2025-12-31", "status": "expired", "demo": true}');
