import { useState } from "react";
import type { RoundHistoryEntry } from "@planincito/shared";
import { Drawer } from "./Drawer";
import { HistoryIcon } from "./Icon";
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
  if (history.length === 0) return null;

  return (
    <Drawer
      title="Historial"
      icon={<HistoryIcon />}
      badge={history.length}
      note="Sólo durante esta sesión: si la sala se cierra, se pierde."
    >
      <ul className="history">
        {history.map((entry) => (
          <Entry key={entry.round} entry={entry} />
        ))}
      </ul>
    </Drawer>
  );
}
