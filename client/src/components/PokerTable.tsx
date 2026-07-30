import { useEffect, useRef, useState } from "react";
import type {
  PublicParticipant,
  PublicRoomState,
  RoundResults,
  Throwable,
} from "@planincito/shared";
import { cardLabel } from "./PokerCard";
import { EyeIcon } from "./Icon";
import { ThrowMenu } from "./ThrowMenu";
import { ResultsSummary } from "./VotingResults";

/** Margen antes de atenuar a alguien que se acaba de desconectar. */
const OFFLINE_DELAY_MS = 6000;

/**
 * Un móvil que bloquea la pantalla corta el WebSocket y vuelve en segundos.
 * Atenuar al instante hacía parpadear cartas de gente que seguía en la
 * reunión, así que la marca de "desconectado" espera a que sea de verdad.
 */
function useSettledOffline(connected: boolean): boolean {
  const [offline, setOffline] = useState(!connected);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (connected) {
      setOffline(false);
      return undefined;
    }
    timer.current = setTimeout(() => setOffline(true), OFFLINE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [connected]);

  return offline;
}

/**
 * Asiento: carta boca abajo mientras se vota y volteo 3D al revelar.
 * El alias va debajo de la carta, como en una mesa real.
 */
function Seat({
  participant,
  revealed,
  isMe,
  onThrow,
}: {
  participant: PublicParticipant;
  revealed: boolean;
  isMe: boolean;
  onThrow: (participantId: string, item: Throwable) => void;
}) {
  const { alias, role, connected, hasVoted, vote, participantId } = participant;
  const [menuOpen, setMenuOpen] = useState(false);
  const offline = useSettledOffline(connected);
  // En escritorio el menú se abre al pasar el ratón, así que el clic sólo
  // debe abrirlo donde no hay puntero fino; si no, hacía falta pulsar dos veces.
  const hoverCapable =
    typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  if (role === "spectator") {
    return (
      <li className={`seat${offline ? " seat--offline" : ""}`}>
        <span
          className="seat__card seat__card--spectator"
          data-seat={participantId}
          aria-label="Espectador"
        >
          <EyeIcon className="seat__eye" />
        </span>
        <span className={`seat__alias${isMe ? " seat__alias--me" : ""}`}>{alias}</span>
      </li>
    );
  }

  // El volteo sólo ocurre cuando hay carta que mostrar.
  const flipped = revealed && vote !== undefined;
  // Sólo tiene sentido apurar a otra persona que aún no votó.
  const canThrow = !isMe && !hasVoted && !revealed;

  return (
    <li
      className={`seat${offline ? " seat--offline" : ""}`}
      title={offline ? `${alias} perdió la conexión` : undefined}
      // El puntero lo abre; cerrarlo es cosa del clic fuera, no de apartar
      // el ratón: si no, elegir un objeto obligaba a un clic previo.
      onMouseEnter={() => hoverCapable && canThrow && setMenuOpen(true)}
    >
      <div className="seat__slot">
        {canThrow ? (
          <button
            type="button"
            className={`seat__card seat__card--target${hasVoted ? " seat__card--voted" : ""}`}
            data-seat={participantId}
            aria-label={`Lanzar algo a ${alias}, que aún no ha votado`}
            aria-expanded={menuOpen}
            onClick={(event) => {
              event.stopPropagation();
              if (!hoverCapable) setMenuOpen((open) => !open);
              else setMenuOpen(true);
            }}
          >
            <span className="seat__face seat__face--back" />
          </button>
        ) : (
          <div
            className={`seat__card${hasVoted ? " seat__card--voted" : ""}${
              flipped ? " seat__card--flipped" : ""
            }`}
            data-seat={participantId}
            aria-label={
              revealed
                ? `${alias}: ${vote ? cardLabel(vote) : "sin voto"}`
                : `${alias}: ${hasVoted ? "ya votó" : "pendiente"}`
            }
          >
            <span className="seat__face seat__face--back" />
            <span
              className="seat__face seat__face--front"
              data-value={vote !== undefined ? cardLabel(vote) : ""}
            >
              {vote !== undefined ? cardLabel(vote) : ""}
            </span>
          </div>
        )}

        {menuOpen && canThrow && (
          <ThrowMenu
            alias={alias}
            onPick={(item) => {
              onThrow(participantId, item);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
      <span className={`seat__alias${isMe ? " seat__alias--me" : ""}`}>{alias}</span>
    </li>
  );
}

type Props = {
  state: PublicRoomState;
  myId: string | null;
  isFacilitator: boolean;
  onReveal: () => void;
  onRestart: () => void;
  onThrow: (participantId: string, item: Throwable) => void;
  /** Segundos que faltan para revelar, o `null` si no hay cuenta atrás. */
  countdown: number | null;
  /** Resumen que se muestra en la mesa una vez reveladas las cartas. */
  results: RoundResults | null;
};

export function PokerTable({
  state,
  myId,
  isFacilitator,
  onReveal,
  onRestart,
  onThrow,
  countdown,
  results,
}: Props) {
  const revealed = state.status === "revealed";
  const others = state.participants.filter((p) => p.participantId !== myId);
  const me = state.participants.find((p) => p.participantId === myId);

  // Los demás se reparten arriba y abajo; yo siempre ocupo el asiento inferior.
  const top = others.filter((_, index) => index % 2 === 0);
  const bottom = others.filter((_, index) => index % 2 === 1);

  const players = state.participants.filter((p) => p.role !== "spectator");
  const voted = players.filter((p) => p.hasVoted).length;
  const anyVote = voted > 0;

  return (
    <section className="table" aria-label="Mesa">
      <ul className="table__row">
        {top.map((participant) => (
          <Seat
            key={participant.participantId}
            participant={participant}
            revealed={revealed}
            isMe={false}
            onThrow={onThrow}
          />
        ))}
      </ul>

      <div className="table__surface">
        {countdown !== null ? (
          <p
            key={countdown}
            className="table__countdown"
            role="status"
            aria-label={`Revelando en ${countdown}`}
          >
            {countdown}
          </p>
        ) : (
          <>
            {results && <ResultsSummary results={results} />}
            {isFacilitator ? (
              revealed ? (
                <button type="button" className="primary" onClick={onRestart}>
                  Nueva ronda
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  onClick={onReveal}
                  disabled={!anyVote}
                  title={anyVote ? undefined : "Nadie ha votado todavía"}
                >
                  Revelar cartas
                </button>
              )
            ) : (
              <p className="table__status" aria-live="polite">
                {revealed
                  ? "Cartas reveladas"
                  : anyVote
                    ? `Votación en curso · ${voted} de ${players.length}`
                    : "Votación en curso"}
              </p>
            )}
          </>
        )}
      </div>

      <ul className="table__row">
        {bottom.map((participant) => (
          <Seat
            key={participant.participantId}
            participant={participant}
            revealed={revealed}
            isMe={false}
            onThrow={onThrow}
          />
        ))}
        {me && (
          <Seat
            key={me.participantId}
            participant={me}
            revealed={revealed}
            isMe
            onThrow={onThrow}
          />
        )}
      </ul>
    </section>
  );
}
