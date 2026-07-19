import {
  NON_NUMERIC_CARDS,
  type CardValue,
  type RoundResults,
  type VoteDistributionEntry,
} from "@planincito/shared";

function isNumeric(value: CardValue): boolean {
  return !NON_NUMERIC_CARDS.includes(value);
}

function median(sorted: number[]): number {
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Promedio y mediana ignoran `?` y `☕`. Si no hay votos numéricos,
 * ambos quedan en `null` y sólo se muestra la distribución (§5.4).
 */
export function computeResults(votes: Iterable<CardValue>): RoundResults {
  const counts = new Map<CardValue, number>();
  const numbers: number[] = [];
  let totalVotes = 0;

  for (const vote of votes) {
    totalVotes += 1;
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
    if (isNumeric(vote)) numbers.push(Number(vote));
  }

  const distribution: VoteDistributionEntry[] = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  if (numbers.length === 0) {
    return { average: null, median: null, distribution, totalVotes };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, value) => acc + value, 0);

  return {
    average: round2(sum / sorted.length),
    median: round2(median(sorted)),
    distribution,
    totalVotes,
  };
}
