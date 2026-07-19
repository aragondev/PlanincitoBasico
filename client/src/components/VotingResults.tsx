import type { RoundResults } from "@planincito/shared";
import { cardLabel } from "./PokerCard";

export function VoteDistribution({ results }: { results: RoundResults }) {
  const max = Math.max(...results.distribution.map((entry) => entry.count), 1);

  return (
    <ul className="distribution" aria-label="Distribución de votos">
      {results.distribution.map((entry) => (
        <li key={entry.value} className="distribution__row">
          <span className="distribution__value">{cardLabel(entry.value)}</span>
          <span className="distribution__bar">
            <span
              className="distribution__fill"
              style={{ inlineSize: `${(entry.count / max) * 100}%` }}
            />
          </span>
          <span className="distribution__count">{entry.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function VotingResults({ results }: { results: RoundResults }) {
  const hasNumbers = results.average !== null;

  return (
    <section className="panel" aria-label="Resultados">
      <h2 className="panel__title">Resultados</h2>
      {hasNumbers ? (
        <div className="stats">
          <div className="stat">
            <span className="stat__label">Promedio</span>
            <span className="stat__value">{results.average}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Mediana</span>
            <span className="stat__value">{results.median}</span>
          </div>
          <div className="stat">
            <span className="stat__label">Votos</span>
            <span className="stat__value">{results.totalVotes}</span>
          </div>
        </div>
      ) : (
        <p className="muted">
          No hubo votos numéricos, así que no se calculan promedio ni mediana.
        </p>
      )}
      <VoteDistribution results={results} />
    </section>
  );
}
