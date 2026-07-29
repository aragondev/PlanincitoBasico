import { useEffect, useState } from "react";
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
        <span className="history__round">#{entry.round}</span>
        <span className="history__topic">
          {entry.topic || <span className="muted">Sin tema</span>}
        </span>
        <span className="history__figures">
          {results.average !== null ? (
            <strong>{results.average}</strong>
          ) : (
            <span className="muted">—</span>
          )}
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

/**
 * Historial en panel lateral: no ocupa sitio en la sala ni obliga a
 * desplazarse perdiendo de vista la mesa. Vive con la sala y muere con ella.
 */
export function RoundHistory({ history }: { history: RoundHistoryEntry[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (history.length === 0) return null;

  return (
    <>
      <button
        type="button"
        className="md-button--text drawer__toggle"
        aria-label="Historial"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">🕘</span>
        <span className="drawer__toggle-label">Historial</span>
        <span className="drawer__badge">{history.length}</span>
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
            aria-label="Historial de rondas"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer__header">
              <h2>Historial</h2>
              <button
                type="button"
                className="md-icon-button"
                aria-label="Cerrar historial"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </header>

            <p className="muted drawer__note">
              Sólo durante esta sesión: si la sala se cierra, se pierde.
            </p>

            <ul className="history">
              {history.map((entry) => (
                <Entry key={entry.round} entry={entry} />
              ))}
            </ul>
          </aside>
        </div>
      )}
    </>
  );
}
