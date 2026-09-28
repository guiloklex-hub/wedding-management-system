#!/usr/bin/env python3
"""Gera fixture sintética v2 para os testes instrumentados Android."""

import hashlib
import json
from pathlib import Path
import sqlite3
import struct
import sys
import tempfile
import zipfile

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import migrate_web
import portable_v2


PASSWORD = "fixture-password-v2"
UPLOAD = b"%PDF-1.4\n% Synthetic contract fixture\n%%EOF\n"


def main(output: Path):
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        database = work / "web.sqlite"
        connection = sqlite3.connect(database)
        try:
            connection.executescript("""
                PRAGMA foreign_keys=ON;
                CREATE TABLE EventSettings (id TEXT PRIMARY KEY, invitationFilePath TEXT,
                    saveTheDateFilePath TEXT, currency TEXT, defaultLocale TEXT);
                CREATE TABLE Vendor (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
                    status TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER);
                CREATE TABLE Guest (id TEXT PRIMARY KEY, name TEXT NOT NULL, rsvpToken TEXT NOT NULL,
                    rsvpStatus TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, deletedAt INTEGER);
                CREATE TABLE Attachment (id TEXT PRIMARY KEY, ownerType TEXT, ownerId TEXT,
                    vendorId TEXT REFERENCES Vendor(id), storagePath TEXT NOT NULL, filename TEXT,
                    mimeType TEXT, size INTEGER, sha256Full TEXT, createdAt INTEGER, deletedAt INTEGER);
                INSERT INTO EventSettings VALUES ('singleton',NULL,NULL,'BRL','pt-BR');
                INSERT INTO Vendor VALUES ('vendor-1','Ateliê de teste','DECORATION','CONTRACTED',1700000000000,1700000000000,NULL);
                INSERT INTO Guest VALUES ('guest-1','Convidada de teste','synthetic-token','CONFIRMED',1700000000000,1700000000000,NULL);
            """)
            digest = hashlib.sha256(UPLOAD).hexdigest()
            connection.execute("INSERT INTO Attachment VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                               ("file-1", "VENDOR", "vendor-1", "vendor-1", "documents/contract.pdf",
                                "contract.pdf", "application/pdf", len(UPLOAD), digest, 1700000000000, None))
            connection.commit()
        finally:
            connection.close()
        base = dict(subtitle="", amountCents=None, estimatedCents=None, date=None,
                    parentId=None, guestGroupId=None, seatingTableId=None, plusOnesAllowed=0,
                    plusOnesConfirmed=0, phone="", email="", notes="", extraJson="{}",
                    createdAt=1700000000000, updatedAt=1700000000000, deletedAt=None)
        records = [
            dict(base, id="vendor-1", kind="vendor", title="Ateliê de teste", status="CONTRACTED"),
            dict(base, id="guest-1", kind="guest", title="Convidada de teste", status="CONFIRMED"),
        ]
        files = [dict(id="file-1", recordId="vendor-1", kind="CONTRACT", fileName="contract.pdf",
                      mimeType="application/pdf", byteSize=len(UPLOAD), sha256=digest,
                      createdAt=1700000000000, deletedAt=None)]
        web = database.read_bytes()
        check = sqlite3.connect(database)
        try:
            fingerprint = portable_v2.schema_hash(check)
        finally:
            check.close()
        counts = {"EventSettings": 1, "Vendor": 1, "Guest": 1, "Attachment": 1}
        manifest = dict(format="wfp-portable", version=2, origin="web", lineageId="fixture-lineage",
                        generation=1, exportedAt=1700000000000, records=2, files=1,
                        hashes={"file-1": digest}, locale="pt-BR", currency="BRL",
                        webTables=counts, uploads={"documents/contract.pdf": {"sha256": digest, "size": len(UPLOAD)}},
                        schemas={"web": fingerprint, "android": 2},
                        webDatabase={"sha256": hashlib.sha256(web).hexdigest(), "size": len(web)})
        plain = work / "payload.zip"
        with zipfile.ZipFile(plain, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
            def add(name: str, value: bytes):
                entry = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, value)

            for name, value in (("manifest.json", manifest), ("records.json", records),
                                ("baseline.json", records), ("files.json", files),
                                ("settings.json", [{"key": "currency", "value": "BRL"}]),
                                ("audit.json", [])):
                add(name, json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())
            add("web.sqlite", web)
            add("blobs/file-1", UPLOAD)
            add("uploads/documents/contract.pdf", UPLOAD)
        salt = bytes(range(16))
        nonce = bytes(range(12))
        header = migrate_web.MAGIC + struct.pack(">I", migrate_web.ROUNDS) + salt + nonce
        key = hashlib.pbkdf2_hmac("sha256", PASSWORD.encode(), salt, migrate_web.ROUNDS, 32)
        output.write_bytes(header + AESGCM(key).encrypt(nonce, plain.read_bytes(), header))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
