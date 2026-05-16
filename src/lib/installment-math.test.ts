import { describe, expect, it } from "vitest";
import { splitAmountCents } from "./installment-math";

describe("splitAmountCents", () => {
  it("divide igualmente quando o total é múltiplo do count", () => {
    expect(splitAmountCents(10000, 4)).toEqual([2500, 2500, 2500, 2500]);
  });

  it("absorve resto na última parcela", () => {
    const parts = splitAmountCents(10001, 4);
    expect(parts).toHaveLength(4);
    expect(parts.slice(0, 3)).toEqual([2500, 2500, 2500]);
    expect(parts[3]).toBe(2501);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10001);
  });

  it("garante que a soma é igual ao total para vários cenários", () => {
    const cases: Array<[number, number]> = [
      [1000_00, 7],
      [1234_56, 12],
      [999_99, 5],
      [3, 3],
      [1, 1],
      [100_00, 60],
    ];
    for (const [total, count] of cases) {
      const parts = splitAmountCents(total, count);
      expect(parts).toHaveLength(count);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("retorna [] para count <= 0", () => {
    expect(splitAmountCents(1000, 0)).toEqual([]);
  });
});
