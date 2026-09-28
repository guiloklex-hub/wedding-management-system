#!/usr/bin/env python3
"""Exporta uma cópia completa do SQLite web e uploads para .wfpbackup v2."""

import argparse
import getpass
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import struct
import sys
import tempfile
import uuid
import zipfile

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

import migrate_web


def file_hash(file):
    digest = hashlib.sha256()
    with file.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def schema_hash(database):
    rows = database.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name")
    return hashlib.sha256("\n".join(f"{kind}\t{name}\t{sql}" for kind, name, sql in rows).encode()).hexdigest()


def inventory_uploads(root):
    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError("Diretório uploads/ não encontrado")
    result = {}
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Link simbólico dentro de uploads/: {path.relative_to(root)}")
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if not relative or any(part in ("", ".", "..") for part in Path(relative).parts):
            raise ValueError(f"Caminho inseguro em uploads/: {relative}")
        digest = hashlib.sha256()
        size = 0
        with path.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
                size += len(chunk)
        result[relative] = {"sha256": digest.hexdigest(), "size": size}
    return result


def write_portable(output, password, snapshot, uploads, records, files, settings, audits, blobs, event, tables):
    upload_inventory = inventory_uploads(uploads)
    table_counts = {}
    database = sqlite3.connect(f"file:{Path(snapshot).resolve()}?mode=ro", uri=True)
    fingerprint = None
    try:
        if database.execute("PRAGMA quick_check").fetchone()[0] != "ok":
            raise ValueError("SQLite inválido")
        if database.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("Relações inválidas no SQLite")
        fingerprint = schema_hash(database)
        for name in tables:
            if name.startswith("sqlite_"):
                continue
            table_counts[name] = database.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
    finally:
        database.close()
    hashes = {item["id"]: item["sha256"] for item in files}
    manifest = {
        "format": "wfp-portable", "version": 2, "origin": "web",
        "lineageId": str(uuid.uuid4()), "generation": 1,
        "exportedAt": int(migrate_web.dt.datetime.now(migrate_web.dt.timezone.utc).timestamp() * 1000),
        "records": len(records), "files": len(files), "hashes": hashes,
        "locale": event.get("defaultLocale") or "pt-BR", "currency": event.get("currency") or "BRL",
        "webTables": table_counts, "uploads": upload_inventory,
        "schemas": {"web": fingerprint, "android": 2},
        "webDatabase": {"sha256": file_hash(Path(snapshot)),
                        "size": Path(snapshot).stat().st_size},
    }
    with tempfile.TemporaryDirectory() as temporary_dir:
        temporary = Path(temporary_dir)
        plain = temporary / "payload.zip"
        with zipfile.ZipFile(plain, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as archive:
            for name, contents in (
                ("manifest.json", manifest), ("records.json", records),
                ("baseline.json", records), ("files.json", files),
                ("settings.json", settings), ("audit.json", audits),
            ):
                archive.writestr(name, migrate_web.compact(contents).encode("utf-8"))
            archive.write(snapshot, "web.sqlite")
            for identifier, contents in blobs.items():
                if isinstance(contents, Path):
                    archive.write(contents, "blobs/" + identifier)
                else:
                    archive.writestr("blobs/" + identifier, contents)
            for relative in upload_inventory:
                archive.write(Path(uploads) / relative, "uploads/" + relative)
        with zipfile.ZipFile(plain) as check:
            corrupt = check.testzip()
            if corrupt:
                raise ValueError(f"ZIP gerado com erro: {corrupt}")
        if inventory_uploads(uploads) != upload_inventory:
            raise ValueError("uploads/ mudou durante a exportação; tente novamente sem edições")
        salt, nonce = os.urandom(16), os.urandom(12)
        header = migrate_web.MAGIC + struct.pack(">I", migrate_web.ROUNDS) + salt + nonce
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, migrate_web.ROUNDS, 32)
        cipher = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
        cipher.authenticate_additional_data(header)
        encrypted = temporary / "output.wfpbackup"
        with plain.open("rb") as source, encrypted.open("wb") as target:
            target.write(header)
            while chunk := source.read(1024 * 1024):
                target.write(cipher.update(chunk))
            target.write(cipher.finalize())
            target.write(cipher.tag)
        with encrypted.open("rb") as source:
            actual_header = source.read(40)
            source.seek(-16, os.SEEK_END)
            tag = source.read(16)
            decipher = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
            decipher.authenticate_additional_data(actual_header)
            source.seek(40)
            remaining = encrypted.stat().st_size - 56
            digest = hashlib.sha256()
            while remaining:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise ValueError("Backup cifrado truncado")
                digest.update(decipher.update(chunk))
                remaining -= len(chunk)
            digest.update(decipher.finalize())
            if actual_header != header or digest.hexdigest() != file_hash(plain):
                raise ValueError("Backup cifrado não passou na verificação")
        shutil.move(encrypted, output)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", type=Path, required=True)
    parser.add_argument("--uploads", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Arquivo de saída já existe")
    snapshot = migrate_web.snapshot_sqlite(args.sqlite)
    report = {"source": "sqlite", "format": "wfp-portable", "version": 2, "omissions": []}
    try:
        tables, present = migrate_web.read_sqlite(snapshot)
        records, files, settings, audits, blobs, conversion, event = migrate_web.convert(
            tables, args.uploads, "sqlite", False, stream_blobs=True)
        report["tables"] = present
        report["converted"] = conversion["converted"]
        report["missingFiles"] = conversion["missingFiles"]
        report["brokenRelations"] = conversion["brokenRelations"]
        password = getpass.getpass("Senha nova (mínimo 12 caracteres): ")
        if len(password) < 12 or password != getpass.getpass("Repita a senha: "):
            raise ValueError("Senha curta ou confirmação diferente")
        manifest = write_portable(args.output, password, snapshot, args.uploads,
                                  records, files, settings, audits, blobs, event, present)
        report["webTables"] = manifest["webTables"]
        report["uploads"] = len(manifest["uploads"])
        report["output"] = str(args.output)
        print(f"Backup completo: {len(records)} registros móveis, {len(files)} anexos e {len(manifest['uploads'])} arquivos web")
    except Exception as error:
        report["error"] = str(error)
        print(f"Erro: {error}", file=sys.stderr)
        raise
    finally:
        snapshot.unlink(missing_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
