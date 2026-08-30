import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";

const renderYaml = readFileSync(
  fileURLToPath(new URL("../../render.yaml", import.meta.url)),
  "utf8",
);

/** Valor de una variable de entorno declarada en el blueprint. */
function declared(key: string): string | null {
  const match = new RegExp(
    `- key: ${key}\\s*\\n\\s*value: ([^\\s#]+)`,
    "m",
  ).exec(renderYaml);
  return match?.[1] ?? null;
}

/**
 * Lo declarado en `render.yaml` sobrescribe el valor por defecto del código,
 * así que un descuido al cambiar uno de los dos sólo se nota en producción:
 * pasó con los márgenes de inactividad, que quedaron en 60 s mientras el
 * código ya usaba una hora, y expulsaba a la gente de las salas.
 */
describe("render.yaml y config.ts no deben divergir", () => {
  const pares: [string, number][] = [
    ["MAX_ACTIVE_ROOMS", config.maxActiveRooms],
    ["MAX_PARTICIPANTS_PER_ROOM", config.maxParticipantsPerRoom],
    ["MAX_CONNECTIONS_PER_IP", config.maxConnectionsPerIp],
    ["EMPTY_ROOM_GRACE_MS", config.emptyRoomGraceMs],
    ["DISCONNECTED_PARTICIPANT_GRACE_MS", config.disconnectedParticipantGraceMs],
    ["LONE_PARTICIPANT_GRACE_MS", config.loneParticipantGraceMs],
    ["MIN_PLAYERS_TO_REVEAL", config.minPlayersToReveal],
    ["MAX_ROUND_HISTORY", config.maxRoundHistory],
  ];

  for (const [key, esperado] of pares) {
    it(`${key} coincide con el valor por defecto`, () => {
      const valor = declared(key);
      expect(valor, `${key} no está declarada en render.yaml`).not.toBeNull();
      expect(Number(valor)).toBe(esperado);
    });
  }

  /**
   * Quien prueba solo y deja la pestaña en segundo plano pierde el WebSocket
   * en segundos; con márgenes cortos, al volver la sala ya no existía. Que
   * nadie lo baje sin darse cuenta de lo que arrastra.
   */
  it("una sala de una sola persona aguanta al menos un cuarto de hora", () => {
    expect(config.loneParticipantGraceMs).toBeGreaterThanOrEqual(900_000);
  });
});
