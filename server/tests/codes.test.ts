import { describe, expect, it } from "vitest";
import { LIMITS, ROOM_CODE_ALPHABET } from "@planincito/shared";
import { generateRoomCode } from "../src/rooms/codes.js";

describe("generateRoomCode", () => {
  it("respeta longitud y alfabeto sin caracteres ambiguos", () => {
    for (let index = 0; index < 200; index += 1) {
      const code = generateRoomCode(() => false);
      expect(code).toHaveLength(LIMITS.ROOM_CODE_LENGTH);
      for (const char of code) expect(ROOM_CODE_ALPHABET).toContain(char);
    }
  });

  it("genera códigos distintos en volumen", () => {
    const codes = new Set<string>();
    for (let index = 0; index < 1000; index += 1) {
      codes.add(generateRoomCode(() => false));
    }
    // Con 32^6 combinaciones, 1000 códigos deberían ser prácticamente únicos.
    expect(codes.size).toBeGreaterThan(995);
  });

  it("reintenta cuando el código ya está ocupado", () => {
    let calls = 0;
    const code = generateRoomCode(() => {
      calls += 1;
      return calls <= 3;
    });
    expect(calls).toBe(4);
    expect(code).toHaveLength(LIMITS.ROOM_CODE_LENGTH);
  });

  it("falla si no encuentra un código libre", () => {
    expect(() => generateRoomCode(() => true, 5)).toThrow();
  });
});
