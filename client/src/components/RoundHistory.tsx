import { useState } from "react";
import type { RoundHistoryEntry } from "@planincito/shared";
import { cardLabel } from "./PokerCard";

function Entry({ entry }: { entry: RoundHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const { results } = entry;

  return (
    <li className="history__item">
      <button
        type="button"
        className="history__summary"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="history__round">Ronda {entry.round}</span>
        <span className="history__topic">
          {entry.topic || <span className="muted">Sin tema</span>}
        </span>
        <span className="history__figures">
          {results.average !== null ? (
            <>
              <strong>{results.average}</strong>
              <span className="muted"> prom.</span>
            </>
          ) : (
            <span className="muted">sin números</span>
          )}
        </span>
        <span className="history__chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="history__detail">
          {results.average !== null && (
            <p className="muted">
              Promedio {results.average} · Mediana {results.median} ·{" "}
              {results.totalVotes} votos
            </p>
          )}
          <ul className="history__votes">
            {entry.votes.map((vote) => (
              <li key={vote.alias}>
                <span className="history__alias">{vote.alias}</span>
                <span className="history__card">{cardLabel(vote.vote)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** Rondas ya reveladas. Vive con la sala: al cerrarse, desaparece. */
export function RoundHistory({ history }: { history: RoundHistoryEntry[] }) {
  if (history.length === 0) return null;

  return (
    <section className="panel" aria-label="Historial de rondas">
      <h2 className="panel__title">
        Historial
        <span className="panel__count">
          {history.length} {history.length === 1 ? "ronda" : "rondas"}
        </span>
      </h2>
      <p className="muted">
        Sólo durante esta sesión: si la sala se cierra, el historial se pierde.
      </p>
      <ul className="history">
        {history.map((entry) => (
          <Entry key={entry.round} entry={entry} />
        ))}
      </ul>
    </section>
  );
}
