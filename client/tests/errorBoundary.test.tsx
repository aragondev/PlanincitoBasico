import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

function Explota(): never {
  throw new Error("fallo de ejemplo");
}

describe("ErrorBoundary", () => {
  it("muestra una salida en vez de dejar la página en blanco", () => {
    // React registra el error en consola aunque se capture; se silencia.
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Explota />
        </ErrorBoundary>,
      );

      expect(screen.getByText("Algo se rompió")).toBeDefined();
      expect(screen.getByRole("button", { name: "Recargar" })).toBeDefined();
      // El detalle técnico ayuda a informar del fallo sin abrir la consola.
      expect(screen.getByText("fallo de ejemplo")).toBeDefined();
    } finally {
      consola.mockRestore();
    }
  });

  it("no estorba cuando no hay error", () => {
    render(
      <ErrorBoundary>
        <p>contenido normal</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("contenido normal")).toBeDefined();
  });

  it("permite descartar la sesión si el fallo viene de un estado corrupto", () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("planincito:session", "{}");
    try {
      render(
        <ErrorBoundary>
          <Explota />
        </ErrorBoundary>,
      );
      expect(
        screen.getByRole("button", { name: /empezar de cero/i }),
      ).toBeDefined();
    } finally {
      consola.mockRestore();
    }
  });
});
