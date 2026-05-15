/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast";

function Trigger({
  payload,
}: {
  payload: { tone?: "success" | "error" | "info"; title: string; description?: string; durationMs?: number };
}) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.push(payload)}>
      go
    </button>
  );
}

describe("ToastProvider / useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("useToast lança erro fora do Provider", () => {
    function Bad() {
      useToast();
      return null;
    }
    const original = console.error;
    console.error = () => {};
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    console.error = original;
  });

  it("push exibe toast e remove após o timeout", () => {
    render(
      <ToastProvider>
        <Trigger payload={{ title: "Salvo!", durationMs: 1000 }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByText("Salvo!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("Salvo!")).not.toBeInTheDocument();
  });

  it("renderiza description quando fornecido", () => {
    render(
      <ToastProvider>
        <Trigger payload={{ title: "Ops", description: "Algo falhou", tone: "error", durationMs: 5000 }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.getByText("Algo falhou")).toBeInTheDocument();
  });

  it("clicar no X dispensa o toast imediatamente", () => {
    render(
      <ToastProvider>
        <Trigger payload={{ title: "Mensagem", durationMs: 100_000 }} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByText("Mensagem")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Mensagem")).not.toBeInTheDocument();
  });

  it("múltiplos toasts empilham", () => {
    function Multi() {
      const t = useToast();
      return (
        <>
          <button type="button" onClick={() => t.success("Primeiro")}>a</button>
          <button type="button" onClick={() => t.error("Segundo")}>b</button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Multi />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "b" }));
    expect(screen.getByText("Primeiro")).toBeInTheDocument();
    expect(screen.getByText("Segundo")).toBeInTheDocument();
  });
});
