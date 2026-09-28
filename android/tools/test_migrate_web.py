import hashlib
import io
import json
from pathlib import Path
import sqlite3
import struct
import tempfile
import unittest
import zipfile

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

import migrate_web as migration
import portable_v2


class MigrationTest(unittest.TestCase):
    def test_portable_v2_keeps_all_web_tables_and_orphan_uploads(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            uploads = root / "uploads"
            uploads.mkdir()
            (uploads / "unused.pdf").write_bytes(b"unreferenced document")
            database = root / "web.db"
            connection = sqlite3.connect(database)
            connection.execute("CREATE TABLE User (id TEXT PRIMARY KEY, password TEXT)")
            connection.execute("INSERT INTO User VALUES ('u1', 'hash')")
            connection.execute("CREATE TABLE AiGeneration (id TEXT PRIMARY KEY, resource TEXT)")
            connection.execute("INSERT INTO AiGeneration VALUES ('a1', 'text')")
            connection.commit()
            connection.close()
            snapshot = migration.snapshot_sqlite(database)
            try:
                tables, present = migration.read_sqlite(snapshot)
                records, files, settings, audits, blobs, _, event = migration.convert(tables, uploads, "sqlite", False)
                target = root / "backup.wfpbackup"
                manifest = portable_v2.write_portable(target, "correct horse battery", snapshot, uploads,
                    records, files, settings, audits, blobs, event, present)
                self.assertEqual(1, manifest["webTables"]["User"])
                self.assertEqual(1, manifest["webTables"]["AiGeneration"])
                self.assertEqual(1, len(manifest["uploads"]))
                encrypted = target.read_bytes()
                rounds = struct.unpack(">I", encrypted[8:12])[0]
                key = hashlib.pbkdf2_hmac("sha256", b"correct horse battery", encrypted[12:28], rounds, 32)
                decryptor = Cipher(algorithms.AES(key), modes.GCM(encrypted[28:40], encrypted[-16:])).decryptor()
                decryptor.authenticate_additional_data(encrypted[:40])
                plain = decryptor.update(encrypted[40:-16]) + decryptor.finalize()
                with zipfile.ZipFile(io.BytesIO(plain)) as archive:
                    self.assertEqual(b"unreferenced document", archive.read("uploads/unused.pdf"))
                    sqlite_copy = root / "restored.db"
                    sqlite_copy.write_bytes(archive.read("web.sqlite"))
                    restored = sqlite3.connect(sqlite_copy)
                    try:
                        self.assertEqual("hash", restored.execute("SELECT password FROM User").fetchone()[0])
                        self.assertEqual("text", restored.execute("SELECT resource FROM AiGeneration").fetchone()[0])
                    finally:
                        restored.close()
            finally:
                snapshot.unlink()

    def test_sqlite_attachment_and_encrypted_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = root / "web.db"
            uploads = root / "uploads"
            (uploads / "vendor" / "v1").mkdir(parents=True)
            data = b"contract example"
            (uploads / "vendor" / "v1" / "contract.pdf").write_bytes(data)
            connection = sqlite3.connect(database)
            connection.execute("CREATE TABLE Vendor (id TEXT PRIMARY KEY, name TEXT, category TEXT)")
            connection.execute("INSERT INTO Vendor VALUES ('v1', 'Buffet', 'Food')")
            connection.execute("CREATE TABLE Attachment (id TEXT PRIMARY KEY, vendorId TEXT, filename TEXT, mimeType TEXT, size INT, storagePath TEXT, sha256Full TEXT)")
            connection.execute("INSERT INTO Attachment VALUES (?, ?, ?, ?, ?, ?, ?)",
                               ("a1", "v1", "contract.pdf", "application/pdf", len(data), "vendor/v1/contract.pdf", hashlib.sha256(data).hexdigest()))
            connection.execute("CREATE TABLE EventSettings (id TEXT PRIMARY KEY, currency TEXT, defaultLocale TEXT)")
            connection.execute("INSERT INTO EventSettings VALUES ('singleton', 'BRL', 'pt-BR')")
            connection.commit()
            connection.close()
            snapshot = migration.snapshot_sqlite(database)
            try:
                tables, _ = migration.read_sqlite(snapshot)
            finally:
                snapshot.unlink()
            records, files, settings, audits, blobs, report, event = migration.convert(tables, uploads, "sqlite", False)
            self.assertEqual(1, len(records))
            self.assertEqual(1, len(files))
            self.assertEqual(data, blobs["a1"])
            output = root / "converted.wfpbackup"
            migration.write_backup(output, "correct horse battery", records, files, settings, audits, blobs, event)
            encrypted = output.read_bytes()
            self.assertEqual(b"WFPBAK01", encrypted[:8])
            rounds = struct.unpack(">I", encrypted[8:12])[0]
            key = hashlib.pbkdf2_hmac("sha256", b"correct horse battery", encrypted[12:28], rounds, 32)
            decryptor = Cipher(algorithms.AES(key), modes.GCM(encrypted[28:40], encrypted[-16:])).decryptor()
            decryptor.authenticate_additional_data(encrypted[:40])
            plain = decryptor.update(encrypted[40:-16]) + decryptor.finalize()
            with zipfile.ZipFile(io.BytesIO(plain)) as archive:
                self.assertEqual(data, archive.read("blobs/a1"))
                self.assertEqual(1, json.loads(archive.read("manifest.json"))["files"])

    def test_json_v3_rejects_bad_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "web.json"
            source.write_text(json.dumps({"payload": {"version": 3, "exportedAt": "2026-01-01T00:00:00Z"},
                                          "checksum": {"algorithm": "sha256", "value": "0" * 64}}))
            with self.assertRaisesRegex(ValueError, "Checksum"):
                migration.read_web_json(source)

    def test_json_v3_accepts_web_checksum_and_reports_omissions(self):
        payload = {"version": 3, "budgetItems": [{"id": "b1", "title": "Bolo",
                   "estimatedValue": 1000.25, "actualValue": 1120.1}],
                   "users": [{"id": "u1", "password": "secret"}], "tiny": 1e-7}
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "web.json"
            source.write_text(json.dumps({"payload": payload, "checksum": {"algorithm": "sha256",
                "value": "a08c15c78eccc487be912e2ab503e5310ffd19144c80f9af5a099bc28a214cbd"}}))
            tables = migration.read_web_json(source)
            records, _, _, _, _, report, _ = migration.convert(tables, None, "json", False)
            self.assertEqual(1, report["omitted"]["users"])
            self.assertEqual(112010, records[0]["amountCents"])

    def test_missing_attachment_reports_failure(self):
        tables = {"Vendor": [{"id": "v1", "name": "Buffet"}],
                  "Attachment": [{"id": "a1", "vendorId": "v1", "storagePath": "gone.pdf"}]}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(migration.ConversionError) as raised:
                migration.convert(tables, Path(directory), "sqlite", False)
            self.assertEqual("ausente", raised.exception.report["missingFiles"][0]["reason"])

    def test_budget_preserves_estimate_and_actual_separately(self):
        tables = {"BudgetItem": [{"id": "b1", "title": "Buffet", "estimatedValue": 1000.25,
                                   "actualValue": 1120.10}], "User": [{"id": "u1"}]}
        records, _, _, _, _, report, _ = migration.convert(tables, None, "sqlite", False)
        self.assertEqual(100025, records[0]["estimatedCents"])
        self.assertEqual(112010, records[0]["amountCents"])
        self.assertEqual(1, report["omitted"]["users"])

    def test_event_date_becomes_calendar_day(self):
        tables = {"EventSettings": [{"id": "singleton", "eventDate": "2027-05-16T00:00:00.000Z"}]}
        _, _, settings, _, _, _, _ = migration.convert(tables, None, "sqlite", False)
        self.assertEqual("2027-05-16", {item["key"]: item["value"] for item in settings}["eventDate"])


if __name__ == "__main__":
    unittest.main()
