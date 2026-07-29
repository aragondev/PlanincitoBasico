import { useEffect, useState } from "react";
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

/** Resumen de una línea para la propia mesa: lo que se mira al revelar. */
export function ResultsSummary({ results }: { results: RoundResults }) {
  if (results.average === null) {
    return <p className="table__figures">Sin votos numéricos</p>;
  }
  return (
    <p className="table__figures">
      <strong>{results.average}</strong> promedio
      <span aria-hidden="true"> · </span>
      <strong>{results.median}</strong> mediana
    </p>
  );
}

/**
 * El detalle vive en un panel lateral, como el historial y los participantes:
 * en la sala sólo se ve la mesa y el mazo.
 */
export function VotingResults({ results }: { results: RoundResults }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="md-button--text drawer__toggle"
        aria-label="Resultados"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">📊</span>
        <span className="drawer__toggle-label">Resultados</span>
      </button>

      {open && (
        <div
          className="drawer__scrim"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Resultados de la ronda"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer__header">
              <h2>Resultados</h2>
              <button
                type="button"
                className="md-icon-button"
                aria-label="Cerrar resultados"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>

            {results.average !== null ? (
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
                No hubo votos numéricos, así que no se calculan promedio ni
                mediana.
              </p>
            )}

            <VoteDistribution results={results} />
          </aside>
        </div>
      )}
    </>
  );
}
