/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("não renderiza quando open=false", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Excluir?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza título e descrição quando open=true", () => {
    render(
      <ConfirmDialog
        open
        title="Excluir convidado?"
        description="Esta ação não pode ser desfeita."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Excluir convidado?")).toBeInTheDocument();
    expect(screen.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();
  });

  it("usa labels customizados", () => {
    render(
      <ConfirmDialog
        open
        title="t"
        confirmLabel="Apagar tudo"
        cancelLabel="Voltar"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Apagar tudo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
  });

  it("dispara onConfirm ao clicar em confirmar", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("dispara onCancel ao clicar em cancelar", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("dispara onCancel ao apertar ESC", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("não fecha com ESC quando busy=true", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="t"
        busy
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("desabilita botões quando busy=true e mostra 'Aguarde...'", () => {
    render(
      <ConfirmDialog
        open
        title="t"
        busy
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Aguarde..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
