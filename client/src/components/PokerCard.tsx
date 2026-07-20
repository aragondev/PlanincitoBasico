import type { CardValue } from "@planincito/shared";

/** Etiqueta visible de una carta; `coffee` se dibuja como taza. */
export function cardLabel(value: CardValue): string {
  return value === "coffee" ? "☕" : value;
}

export function cardAriaLabel(value: CardValue): string {
  if (value === "coffee") return "Pausa";
  if (value === "?") return "Sin estimación";
  return `${value} puntos`;
}
