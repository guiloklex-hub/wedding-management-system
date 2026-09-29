import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertWebContractCoverage, projectWeb } from "./portable-projection";

describe("projeção de contratos e anexos", () => {
  it("preserva cada contrato, suas cláusulas e todas as versões de PDF ligadas ao contrato", async () => {
    const uploads = await fs.mkdtemp(path.join(tmpdir(), "wfp-contracts-"));
    try {
      await fs.writeFile(path.join(uploads, "contract-1.pdf"), "%PDF-1.4 primeiro");
      await fs.writeFile(path.join(uploads, "contract-2.pdf"), "%PDF-1.4 segundo");
      const projected = await projectWeb({
        Vendor: [{ id: "vendor-1", name: "Fornecedor", status: "CONTRACTED" }],
        Contract: [
          { id: "contract-1", vendorId: "vendor-1", title: "Contrato A", version: 2,
            paymentTerms: "Entrada e saldo", cancellationPolicy: "Aviso prévio", status: "SIGNED_PHYSICAL" },
          { id: "contract-2", vendorId: "vendor-1", title: "Contrato B", version: 1, status: "DRAFT" },
        ],
        Attachment: [
          { id: "pdf-1", ownerType: "CONTRACT", ownerId: "contract-1", vendorId: "vendor-1",
            contractId: null, kind: "CONTRACT", filename: "contract-1.pdf", storagePath: "contract-1.pdf",
            deletedAt: "2025-01-01T00:00:00.000Z", version: 1 },
          { id: "pdf-2", ownerType: "CONTRACT", ownerId: "contract-2", vendorId: "vendor-1",
            contractId: "contract-2", kind: "CONTRACT", filename: "contract-2.pdf", storagePath: "contract-2.pdf",
            version: 2 },
        ],
      }, uploads);
      expect(projected.records.filter((record) => record.kind === "contract")).toHaveLength(2);
      expect(JSON.parse(projected.records.find((record) => record.id === "contract-1")!.extraJson))
        .toMatchObject({ paymentTerms: "Entrada e saldo", cancellationPolicy: "Aviso prévio", version: 2 });
      expect(projected.files.map((file) => [file.id, file.recordId])).toEqual([
        ["pdf-1", "contract-1"], ["pdf-2", "contract-2"],
      ]);
      expect(projected.files[0].deletedAt).not.toBeNull();
      expect(projected.files.map((file) => file.version)).toEqual([1, 2]);
      const uploadsInventory = Object.fromEntries(projected.files.map((file) =>
        [file.fileName, { sha256: file.sha256, size: file.byteSize }]));
      const contracts = [
        { id: "contract-1", vendorId: "vendor-1" }, { id: "contract-2", vendorId: "vendor-1" },
      ];
      const attachments = [
        { id: "pdf-1", ownerType: "CONTRACT", ownerId: "contract-1", vendorId: "vendor-1", storagePath: "contract-1.pdf", version: 1 },
        { id: "pdf-2", ownerType: "CONTRACT", ownerId: "contract-2", vendorId: "vendor-1", storagePath: "contract-2.pdf", version: 2 },
      ];
      expect(() => assertWebContractCoverage(contracts, attachments, projected.records, projected.files, uploadsInventory)).not.toThrow();
      expect(() => assertWebContractCoverage(contracts, attachments, projected.records.slice(0, -1), projected.files, uploadsInventory))
        .toThrow("Contrato ausente");
      expect(() => assertWebContractCoverage(contracts, attachments, projected.records, projected.files.slice(1), uploadsInventory))
        .toThrow("Anexo ausente");
    } finally {
      await fs.rm(uploads, { recursive: true, force: true });
    }
  });
});
