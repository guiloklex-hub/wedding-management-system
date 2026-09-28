#!/usr/bin/env python3
"""Converte SQLite + uploads ou JSON v2/v3 do web em .wfpbackup Android."""

import argparse
import datetime as dt
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
import zipfile
from decimal import Decimal, ROUND_HALF_UP

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b"WFPBAK01"
ROUNDS = 600_000
TABLES = {
    "Vendor": ("vendor", "name", None, "status", None, None),
    "Venue": ("venue", "name", "baseRate", None, "visitedAt", None),
    "BudgetItem": ("budget", "title", "estimatedValue", None, None, "vendorId"),
    "Payment": ("payment", "notes", "amount", "status", "dueDate", "vendorId"),
    "Income": ("income", "title", "amount", "status", "expectedDate", None),
    "Asset": ("asset", "title", "amount", None, "date", "goalId"),
    "SavingsGoal": ("goal", "name", "targetAmount", None, "targetDate", None),
    "Task": ("task", "title", None, "status", "deadline", "vendorId"),
    "Guest": ("guest", "name", None, "rsvpStatus", None, None),
    "GuestGroup": ("group", "name", None, None, None, None),
    "GuestTag": ("tag", "name", None, None, None, None),
    "Gift": ("gift", "description", "amount", "status", "receivedAt", "guestId"),
    "Honeymoon": ("honeymoon", "destination", "budget", None, "startDate", None),
    "HoneymoonItem": ("honeymoon_item", "title", "amount", "status", "startAt", "honeymoonId"),
    "TrousseauItem": ("trousseau", "title", "actualPrice", "status", None, None),
    "SeatingTable": ("table", "name", "capacity", None, None, None),
    "Contract": ("contract", "title", "totalValue", "status", "signedAt", "vendorId"),
    "VendorContact": ("contact", "name", None, None, None, "vendorId"),
    "VendorNote": ("vendor_note", "body", None, "kind", None, "vendorId"),
    "VenueChecklistItem": ("venue_check", "label", None, None, None, "venueId"),
}
JSON_TABLES = {
    "vendors": "Vendor", "venues": "Venue", "budgetItems": "BudgetItem",
    "payments": "Payment", "incomes": "Income", "assets": "Asset",
    "savingsGoals": "SavingsGoal", "tasks": "Task", "guests": "Guest",
    "guestGroups": "GuestGroup", "guestTags": "GuestTag", "gifts": "Gift",
    "honeymoon": "Honeymoon", "honeymoonItems": "HoneymoonItem",
    "trousseauItems": "TrousseauItem", "seatingTables": "SeatingTable",
    "contracts": "Contract", "vendorContacts": "VendorContact",
    "vendorNotes": "VendorNote", "venueChecklistItems": "VenueChecklistItem",
    "attachments": "Attachment", "auditLogs": "AuditLog",
    "users": "User", "notificationLogs": "NotificationLog",
}
SECRET_FIELDS = {
    "password", "twoFactorSecret", "twoFactorBackupCodes", "rsvpToken",
    "rsvpPin", "tokenHash", "uploadedById", "userId", "invitationRsvpUrl",
}


class ConversionError(ValueError):
    def __init__(self, message, report):
        super().__init__(message)
        self.report = report


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def js_canonical(value):
    if isinstance(value, dict):
        return "{" + ",".join(compact(key) + ":" + js_canonical(value[key]) for key in sorted(value)) + "}"
    if isinstance(value, list):
        return "[" + ",".join(js_canonical(item) for item in value) + "]"
    if isinstance(value, Decimal):
        if value == 0:
            return "0"
        normalized = value.normalize()
        if abs(value) < Decimal("0.000001") or abs(value) >= Decimal("1e21"):
            coefficient, exponent = format(normalized, "e").split("e")
            return coefficient + "e" + ("+" if int(exponent) >= 0 else "") + str(int(exponent))
        return format(normalized, "f")
    return compact(value)


def millis(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float, Decimal)):
        number = int(value)
        return number if abs(number) > 100_000_000_000 else number * 1000
    if isinstance(value, str):
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone.utc)
        return int(parsed.timestamp() * 1000)
    raise ValueError(f"Data inválida: {value!r}")


def day(value):
    stamp = millis(value)
    return dt.datetime.fromtimestamp(stamp / 1000, dt.timezone.utc).date().isoformat() if stamp is not None else None


def cents(value):
    if value is None:
        return None
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def snapshot_sqlite(path):
    temp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    temp.close()
    source = sqlite3.connect(f"file:{Path(path).resolve()}?mode=ro", uri=True)
    target = sqlite3.connect(temp.name)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    return Path(temp.name)


def resolve_upload(root, storage_path):
    relative = Path(str(storage_path or ""))
    if relative.parts and relative.parts[0] == "uploads":
        relative = Path(*relative.parts[1:])
    base = Path(root).resolve()
    path = (base / relative).resolve()
    if not path.is_relative_to(base) or path == base:
        raise ValueError(f"Caminho inseguro: {storage_path}")
    return path


def read_sqlite(path):
    database = sqlite3.connect(path)
    database.row_factory = sqlite3.Row
    try:
        existing = {row[0] for row in database.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        result = {}
        for table in set(TABLES) | {"Attachment", "EventSettings", "AuditLog", "GuestTagOnGuest",
                                      "Broadcast", "BroadcastRecipient", "User", "NotificationLog", "AiGeneration"}:
            result[table] = [dict(row) for row in database.execute(f'SELECT * FROM "{table}"')] if table in existing else []
        return result, sorted(existing)
    finally:
        database.close()


def read_web_json(path):
    raw = json.loads(Path(path).read_text(encoding="utf-8"), parse_float=Decimal)
    payload = raw.get("payload", raw)
    if payload.get("version") not in (2, 3):
        raise ValueError("Somente JSON web v2/v3 é aceito")
    checksum = raw.get("checksum")
    if payload["version"] == 3:
        if not checksum or checksum.get("algorithm") != "sha256":
            raise ValueError("Backup v3 sem checksum SHA-256")
        digest = hashlib.sha256(js_canonical(payload).encode("utf-8")).hexdigest()
        if digest != checksum.get("value"):
            raise ValueError("Checksum v3 inválido")
    tables = {name: [] for name in TABLES}
    for json_name, table_name in JSON_TABLES.items():
        rows = payload.get(json_name)
        tables[table_name] = rows if isinstance(rows, list) else ([rows] if rows else [])
    tables["EventSettings"] = [payload["eventSettings"]] if payload.get("eventSettings") else []
    tables["GuestTagOnGuest"] = []
    tables["BroadcastRecipient"] = []
    return tables


def convert(tables, uploads, source_type, allow_missing, stream_blobs=False):
    now = int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000)
    report = {"source": source_type, "converted": {}, "omitted": {}, "warnings": [], "missingFiles": [], "brokenRelations": []}
    records = []
    settings = []
    audits = []
    files = []
    blobs = {}
    for table, (kind, title_key, amount_key, status_key, date_key, parent_key) in TABLES.items():
        rows = tables.get(table, [])
        for row in rows:
            identifier = str(row["id"])
            title = str(row.get(title_key) or (f"Pagamento {identifier}" if kind == "payment" else kind))[:160]
            amount = row.get("actualValue") if kind == "budget" else (row.get(amount_key) if amount_key else None)
            extra = {key: value for key, value in row.items() if key not in SECRET_FIELDS and key != "id"}
            record = {
                "id": identifier, "kind": kind, "title": title, "subtitle": str(row.get("category") or row.get("source") or ""),
                "amountCents": int(amount) if kind == "table" and amount is not None else cents(amount),
                "estimatedCents": cents(row.get("estimatedValue") if kind == "budget" else row.get("estimatedPrice")),
                "date": day(row.get("receivedAt") or row.get(date_key)) if kind == "income" else (day(row.get(date_key)) if date_key else None),
                "status": str(row.get(status_key) or "") if status_key else (("DONE" if row.get("checked") else "TODO") if kind == "venue_check" else ""),
                "parentId": str(row[parent_key]) if parent_key and row.get(parent_key) else None,
                "guestGroupId": str(row["groupId"]) if kind == "guest" and row.get("groupId") else None,
                "seatingTableId": str(row["tableId"]) if kind == "guest" and row.get("tableId") else None,
                "plusOnesAllowed": int(row.get("plusOnesAllowed") or 0) if kind == "guest" else 0,
                "plusOnesConfirmed": int(row.get("plusOnesConfirmed") or 0) if kind == "guest" else 0,
                "phone": str(row.get("phone") or row.get("contactPhone") or ""),
                "email": str(row.get("email") or row.get("contactEmail") or ""),
                "notes": str(row.get("notes") or row.get("description") or ""), "extraJson": compact(extra),
                "createdAt": millis(row.get("createdAt")) or now,
                "updatedAt": millis(row.get("updatedAt")) or now,
                "deletedAt": millis(row.get("deletedAt")),
            }
            records.append(record)
        report["converted"][table] = len(rows)
    settings_row = (tables.get("EventSettings") or [{}])[0]
    report["converted"]["EventSettings"] = len(tables.get("EventSettings", []))
    for key, value in settings_row.items():
        if key not in SECRET_FIELDS and key not in {"id", "aiEnabled", "rsvpReminderEnabled", "rsvpReminderDays"} and value is not None:
            settings.append({"key": key, "value": day(value) if key == "eventDate" else str(value)})
    for kind, message_key, path_key in (("invitation", "invitationMessage", "invitationFilePath"),
                                        ("save_the_date", "saveTheDateMessage", "saveTheDateFilePath")):
        if settings_row.get(message_key) or settings_row.get(path_key):
            records.append({"id": "web-" + kind + "-template", "kind": kind,
                            "title": "Convite" if kind == "invitation" else "Save the Date", "subtitle": "",
                            "amountCents": None, "estimatedCents": None, "date": None, "status": "DRAFT",
                            "parentId": None, "guestGroupId": None, "seatingTableId": None,
                            "plusOnesAllowed": 0, "plusOnesConfirmed": 0, "phone": "", "email": "",
                            "notes": str(settings_row.get(message_key) or ""), "extraJson": "{}",
                            "createdAt": now, "updatedAt": now, "deletedAt": None})
    tag_links = tables.get("GuestTagOnGuest", [])
    if tag_links:
        by_guest = {}
        for link in tag_links:
            by_guest.setdefault(link["guestId"], []).append(link["tagId"])
        for record in records:
            if record["kind"] == "guest" and record["id"] in by_guest:
                extra = json.loads(record["extraJson"])
                extra["tagIds"] = by_guest[record["id"]]
                record["extraJson"] = compact(extra)
    for row in tables.get("AuditLog", []):
        audits.append({"id": str(row["id"]), "recordId": None, "action": str(row.get("action") or "WEB"),
                       "at": millis(row.get("createdAt")) or now, "details": str(row.get("payload") or "")})
    for row in tables.get("BroadcastRecipient", []):
        audits.append({"id": "broadcast-" + str(row["id"]), "recordId": None,
                       "action": "INVITE_" + str(row.get("status") or "UNKNOWN"),
                       "at": millis(row.get("sentAt") or row.get("createdAt")) or now,
                       "details": compact({"name": row.get("name"), "channel": row.get("channelUsed")})})

    ids = {record["id"] for record in records}
    if len(ids) != len(records):
        raise ValueError("IDs repetidos entre as entidades web")
    for record in records:
        for key in ("parentId", "guestGroupId", "seatingTableId"):
            if record[key] and record[key] not in ids:
                report["brokenRelations"].append({"id": record["id"], "field": key, "target": record[key]})
    for row in tables.get("Attachment", []):
        file_id = str(row["id"])
        related = row.get("contractId") or row.get("vendorId") or row.get("venueId") or row.get("ownerId")
        if related not in ids:
            report["brokenRelations"].append({"id": file_id, "field": "recordId", "target": related})
            related = None
        if not uploads:
            report["missingFiles"].append({"id": file_id, "path": row.get("storagePath"), "reason": "JSON sem arquivos"})
            continue
        relative = Path(str(row.get("storagePath") or ""))
        path = resolve_upload(uploads, row.get("storagePath"))
        if not path.is_file():
            report["missingFiles"].append({"id": file_id, "path": str(relative), "reason": "ausente"})
            continue
        if stream_blobs:
            hasher = hashlib.sha256()
            size = 0
            with path.open("rb") as source:
                while chunk := source.read(1024 * 1024):
                    hasher.update(chunk)
                    size += len(chunk)
            digest = hasher.hexdigest()
        else:
            data = path.read_bytes()
            size = len(data)
            digest = hashlib.sha256(data).hexdigest()
        if row.get("sha256Full") and digest != row["sha256Full"]:
            report["missingFiles"].append({"id": file_id, "path": str(relative), "reason": "hash divergente"})
            continue
        if row.get("size") is not None and size != int(row["size"]):
            report["missingFiles"].append({"id": file_id, "path": str(relative), "reason": "tamanho divergente"})
            continue
        if not stream_blobs and size > 20_000_000:
            report["missingFiles"].append({"id": file_id, "path": str(relative), "reason": "maior que 20 MB"})
            continue
        files.append({"id": file_id, "recordId": related, "kind": str(row.get("kind") or "OTHER"),
                      "fileName": str(row.get("filename") or path.name), "mimeType": str(row.get("mimeType") or "application/octet-stream"),
                      "byteSize": size, "sha256": digest, "createdAt": millis(row.get("createdAt")) or now,
                      "deletedAt": millis(row.get("deletedAt"))})
        blobs[file_id] = path if stream_blobs else data
    for field, path_key, name_key, mime_key in (
        ("invitation", "invitationFilePath", "invitationFileName", "invitationFileMime"),
        ("save_the_date", "saveTheDateFilePath", "saveTheDateFileName", "saveTheDateFileMime"),
    ):
        if settings_row.get(path_key):
            path = resolve_upload(uploads, settings_row[path_key]) if uploads else None
            if path and path.is_file():
                if stream_blobs:
                    hasher = hashlib.sha256()
                    size = 0
                    with path.open("rb") as source:
                        while chunk := source.read(1024 * 1024):
                            hasher.update(chunk)
                            size += len(chunk)
                    digest = hasher.hexdigest()
                else:
                    data = path.read_bytes()
                    size = len(data)
                    digest = hashlib.sha256(data).hexdigest()
                identifier = "art-" + field
                files.append({"id": identifier, "recordId": "web-" + field + "-template", "kind": field,
                              "fileName": str(settings_row.get(name_key) or path.name),
                              "mimeType": str(settings_row.get(mime_key) or "application/octet-stream"),
                              "byteSize": size, "sha256": digest,
                              "createdAt": now, "deletedAt": None})
                blobs[identifier] = path if stream_blobs else data
            else:
                report["missingFiles"].append({"id": field, "path": settings_row[path_key], "reason": "arte ausente"})
    report["converted"]["AttachmentFiles"] = len(files)
    report["omitted"] = {"users": len(tables.get("User", [])), "tokensAndCredentials": "excluídos",
                         "notificationLogs": len(tables.get("NotificationLog", [])),
                         "aiGenerations": len(tables.get("AiGeneration", [])),
                         "broadcasts": len(tables.get("Broadcast", []))}
    if source_type == "json":
        report["warnings"].append("JSON web não contém os arquivos de anexos nem as tabelas de tags e histórico de disparos.")
    report["warnings"].append("Links públicos antigos de RSVP param de funcionar ao desligar o servidor web.")
    if report["brokenRelations"]:
        raise ConversionError(f"{len(report['brokenRelations'])} relações inválidas; consulte o relatório", report)
    if report["missingFiles"] and not allow_missing and source_type == "sqlite":
        raise ConversionError(f"{len(report['missingFiles'])} arquivos ausentes ou alterados; consulte o relatório", report)
    return records, files, settings, audits, blobs, report, settings_row


def write_backup(path, password, records, files, settings, audits, blobs, event):
    if sum(len(contents) for contents in blobs.values()) > 190_000_000:
        raise ValueError("Arquivos excedem o limite de 190 MB da migração")
    manifest = {"format": "wfp-android", "version": 1, "exportedAt": int(dt.datetime.now(dt.timezone.utc).timestamp() * 1000),
                "records": len(records), "files": len(files), "hashes": {item["id"]: item["sha256"] for item in files},
                "locale": event.get("defaultLocale") or "pt-BR", "currency": event.get("currency") or "BRL"}
    with tempfile.TemporaryDirectory() as temp_dir:
        plain_path = Path(temp_dir) / "payload.zip"
        with zipfile.ZipFile(plain_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, contents in (("records.json", records), ("files.json", files), ("settings.json", settings),
                                   ("audit.json", audits), ("manifest.json", manifest)):
                archive.writestr(name, compact(contents).encode("utf-8"))
            for identifier, contents in blobs.items():
                archive.writestr("blobs/" + identifier, contents)
        if plain_path.stat().st_size > 210_000_000:
            raise ValueError("Backup excede o limite do aplicativo")
        salt, nonce = os.urandom(16), os.urandom(12)
        header = MAGIC + struct.pack(">I", ROUNDS) + salt + nonce
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ROUNDS, 32)
        cipher = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
        cipher.authenticate_additional_data(header)
        temporary_output = Path(temp_dir) / "encrypted.wfpbackup"
        with plain_path.open("rb") as plain, temporary_output.open("wb") as output:
            output.write(header)
            while chunk := plain.read(65536):
                output.write(cipher.update(chunk))
            output.write(cipher.finalize())
            output.write(cipher.tag)
        shutil.move(temporary_output, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--sqlite", type=Path, help="banco SQLite original")
    source.add_argument("--json", type=Path, help="backup JSON web v2/v3")
    parser.add_argument("--uploads", type=Path, help="diretório uploads/ original")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--allow-missing-files", action="store_true")
    args = parser.parse_args()
    if args.sqlite and not args.uploads:
        parser.error("--sqlite requer --uploads")
    if args.output.exists():
        parser.error("arquivo de saída já existe")
    if args.sqlite:
        snapshot = snapshot_sqlite(args.sqlite)
        try:
            tables, present = read_sqlite(snapshot)
        finally:
            snapshot.unlink(missing_ok=True)
        source_type = "sqlite"
    else:
        tables = read_web_json(args.json)
        present = []
        source_type = "json"
    report = {"source": source_type, "sqliteTables": present}
    try:
        records, files, settings, audits, blobs, report, event = convert(tables, args.uploads, source_type, args.allow_missing_files)
        report["sqliteTables"] = present
        secret = getpass.getpass("Senha nova do backup (mínimo 12 caracteres): ")
        if len(secret) < 12 or secret != getpass.getpass("Repita a senha: "):
            raise ValueError("Senha curta ou confirmação diferente")
        write_backup(args.output, secret, records, files, settings, audits, blobs, event)
        report["output"] = str(args.output)
        print(f"Convertidos {len(records)} registros e {len(files)} arquivos para {args.output}")
    except Exception as error:
        if isinstance(error, ConversionError):
            report = error.report
            report["sqliteTables"] = present
        report["error"] = str(error)
        print(f"Erro: {error}", file=sys.stderr)
        raise
    finally:
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


if __name__ == "__main__":
    main()
