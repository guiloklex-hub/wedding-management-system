import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { inspectPortable } from "./portable-inspect";

const fixture = path.resolve("android/app/src/androidTest/assets/portable-v2-fixture.wfpbackup");
const incompleteFixture = path.resolve("android/app/src/androidTest/assets/portable-v2-missing-contract.wfpbackup");

describe("pacote portátil gerado em Python", () => {
  it("valida o mesmo v2 usado pelo Android", async () => {
    const preview = await inspectPortable(fixture, "fixture-password-v2", async ({ preview }) => preview);
    expect(preview.blockers).toEqual([]);
    expect(preview.manifest).toMatchObject({ version: 2, origin: "web", records: 4, files: 2 });
    expect(preview.uploadCount).toBe(2);
    expect(preview.webTables).toMatchObject({ Vendor: 1, Guest: 1, Contract: 2, Attachment: 2 });
  });

  it("recusa senha errada e qualquer alteração no ciphertext", async () => {
    await expect(inspectPortable(fixture, "wrong-password", async ({ preview }) => preview)).rejects.toThrow();
    const directory = await fs.mkdtemp(path.join(tmpdir(), "wfp-tamper-"));
    try {
      const bytes = await fs.readFile(fixture);
      bytes[Math.floor(bytes.length / 2)] ^= 1;
      const changed = path.join(directory, "changed.wfpbackup");
      await fs.writeFile(changed, bytes);
      await expect(inspectPortable(changed, "fixture-password-v2", async ({ preview }) => preview)).rejects.toThrow();
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });

  it("recusa pacote cifrado íntegro que omite um contrato da representação móvel", async () => {
    await expect(inspectPortable(incompleteFixture, "fixture-password-v2", async ({ preview }) => preview))
      .rejects.toThrow("Contrato ausente");
  });
});
