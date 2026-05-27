/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePagination } from "./pagination";

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("usePagination", () => {
  it("fatia a primeira página e calcula from/to/total", () => {
    const { result } = renderHook(() => usePagination(items(45), 20));
    expect(result.current.total).toBe(45);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(1);
    expect(result.current.from).toBe(1);
    expect(result.current.to).toBe(20);
    expect(result.current.pageItems).toEqual(items(20));
  });

  it("avança de página e fatia o intervalo correto", () => {
    const { result } = renderHook(() => usePagination(items(45), 20));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    expect(result.current.from).toBe(41);
    expect(result.current.to).toBe(45);
    expect(result.current.pageItems).toEqual([41, 42, 43, 44, 45]);
  });

  it("faz clamp da página para o range válido quando a lista encolhe", () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: number[] }) => usePagination(data, 20),
      { initialProps: { data: items(60) } },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ data: items(10) });
    expect(result.current.totalPages).toBe(1);
    expect(result.current.page).toBe(1);
    expect(result.current.pageItems).toEqual(items(10));
  });

  it("trata lista vazia com totalPages=1 e from=0", () => {
    const { result } = renderHook(() => usePagination<number>([], 20));
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(0);
    expect(result.current.pageItems).toEqual([]);
  });
});
