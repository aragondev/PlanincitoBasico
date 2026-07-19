import { describe, expect, it } from "vitest";
import type { CardValue } from "@planincito/shared";
import { computeResults } from "../src/rooms/results.js";

describe("computeResults", () => {
  it("calcula promedio y mediana con número impar de votos", () => {
    const results = computeResults(["1", "3", "8"] as CardValue[]);
    expect(results.average).toBe(4);
    expect(results.median).toBe(3);
    expect(results.totalVotes).toBe(3);
  });

  it("promedia los dos centrales con número par de votos", () => {
    const results = computeResults(["1", "2", "3", "8"] as CardValue[]);
    expect(results.median).toBe(2.5);
    expect(results.average).toBe(3.5);
  });

  it("ignora ? y ☕ en promedio y mediana", () => {
    const results = computeResults(["5", "?", "coffee", "13"] as CardValue[]);
    expect(results.average).toBe(9);
    expect(results.median).toBe(9);
    expect(results.totalVotes).toBe(4);
  });

  it("no muestra promedio ni mediana sin votos numéricos", () => {
    const results = computeResults(["?", "coffee", "?"] as CardValue[]);
    expect(results.average).toBeNull();
    expect(results.median).toBeNull();
    expect(results.distribution).toEqual([
      { value: "?", count: 2 },
      { value: "coffee", count: 1 },
    ]);
  });

  it("devuelve valores nulos y distribución vacía sin votos", () => {
    expect(computeResults([])).toEqual({
      average: null,
      median: null,
      distribution: [],
      totalVotes: 0,
    });
  });
});
