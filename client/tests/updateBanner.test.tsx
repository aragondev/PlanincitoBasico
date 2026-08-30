import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/** Socket mínimo: la portada no necesita más que no reventar al montarse. */
const socket = {
  connected: false,
  on: () => socket,
  off: () => socket,
  removeAllListeners: () => socket,
  emit: () => true,
  connect: () => socket,
  disconnect: () => socket,
};

vi.mock("../src/socket/client", () => ({ createSocket: () => socket }));
vi.mock("../src/hooks/useAppUpdate", () => ({
  useAppUpdate: () => ({ updateAvailable: true, reload: () => {} }),
}));

const { App } = await import("../src/App");

describe("aviso de versión nueva", () => {
  /**
   * La portada es donde más se espera —mientras entra la gente a la sala— y
   * era la única vista que no pintaba el aviso, así que en la práctica no
   * llegaba a verse nunca.
   */
  it("se ve también en la portada, no sólo dentro de la sala", () => {
    render(<App />);

    expect(screen.getByLabelText("Tu alias")).toBeDefined();
    expect(screen.getByText("Hay una versión nueva de Planincito.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Actualizar" })).toBeDefined();
  });
});
