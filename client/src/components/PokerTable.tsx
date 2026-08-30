import { useEffect, useRef, useState } from "react";
import type {
  PublicParticipant,
  PublicRoomState,
  Reaction,
  RoundResults,
  Throwable,
} from "@planincito/shared";
import { cardLabel } from "./PokerCard";
import { EyeIcon } from "./Icon";
import { SeatMenu, type SeatReaction } from "./SeatMenu";
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
 * El alias va debajo de la carta, como en una mesa real. La carta siempre es
 * un botón: abre el menú del asiento, desde donde se reacciona con un
 * emoticón y, si esa persona sigue sin votar, se le lanza algo.
 */
function Seat({
  participant,
  revealed,
  isMe,
  reactions,
  onThrow,
  onReact,
}: {
  participant: PublicParticipant;
  revealed: boolean;
  isMe: boolean;
  reactions: SeatReaction[];
  onThrow: (participantId: string, item: Throwable) => void;
  onReact: (participantId: string, emoji: Reaction) => void;
}) {
  const { alias, role, connected, hasVoted, vote, participantId } = participant;
  const [menuOpen, setMenuOpen] = useState(false);
  const offline = useSettledOffline(connected);
  // En escritorio el menú de lanzar se abre al pasar el ratón, así que el clic
  // sólo debe abrirlo donde no hay puntero fino; si no, hacía falta pulsar dos
  // veces. Reaccionar sí exige clic en todas partes: abrir un menú cada vez
  // que el ratón cruza la mesa sería insoportable.
  const hoverCapable =
    typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  const spectator = role === "spectator";
  // Sólo tiene sentido apurar a otra persona que aún no votó.
  const canThrow = !spectator && !isMe && !hasVoted && !revealed;
  // El volteo sólo ocurre cuando hay carta que mostrar.
  const flipped = revealed && vote !== undefined;

  const situation = spectator
    ? "espectador"
    : revealed
      ? vote !== undefined
        ? cardLabel(vote)
        : "sin voto"
      : hasVoted
        ? "ya votó"
        : "pendiente";

  return (
    <li
      className={`seat${offline ? " seat--offline" : ""}`}
      title={offline ? `${alias} perdió la conexión` : undefined}
      // El puntero lo abre; cerrarlo es cosa del clic fuera, no de apartar
      // el ratón: si no, elegir un objeto obligaba a un clic previo.
      onMouseEnter={() => hoverCapable && canThrow && setMenuOpen(true)}
    >
      <div className="seat__slot">
        <button
          type="button"
          className={`seat__card seat__card--pick${
            spectator ? " seat__card--spectator" : ""
          }${hasVoted ? " seat__card--voted" : ""}${
            flipped ? " seat__card--flipped" : ""
          }`}
          data-seat={participantId}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`${alias}: ${situation}. Reaccionar${
            canThrow ? " o lanzarle algo" : ""
          }`}
          onClick={(event) => {
            event.stopPropagation();
            if (!hoverCapable || !canThrow) setMenuOpen((open) => !open);
            else setMenuOpen(true);
          }}
        >
          {spectator ? (
            <EyeIcon className="seat__eye" />
          ) : (
            <>
              <span className="seat__face seat__face--back" />
              <span
                className="seat__face seat__face--front"
                data-value={vote !== undefined ? cardLabel(vote) : ""}
              >
                {vote !== undefined ? cardLabel(vote) : ""}
              </span>
            </>
          )}
        </button>

        {reactions.length > 0 && (
          <span className="seat__reactions" aria-hidden="true">
            {reactions.map((reaction) => (
              <span key={reaction.id} className="seat__reaction">
                {reaction.emoji}
              </span>
            ))}
          </span>
        )}

        {menuOpen && (
          <SeatMenu
            alias={alias}
            canThrow={canThrow}
            onReact={(emoji) => {
              onReact(participantId, emoji);
              setMenuOpen(false);
            }}
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
  onReact: (participantId: string, emoji: Reaction) => void;
  /** Emoticones vivos ahora mismo, de cualquier asiento de la mesa. */
  reactions: SeatReaction[];
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
  onReact,
  reactions,
  countdown,
  results,
}: Props) {
  const revealed = state.status === "revealed";
  const reactionsFor = (participantId: string) =>
    reactions.filter((reaction) => reaction.toId === participantId);
  const others = state.participants.filter((p) => p.participantId !== myId);
  const me = state.participants.find((p) => p.participantId === myId);

  // Los demás se reparten arriba y abajo; yo siempre ocupo el asiento inferior.
  const top = others.filter((_, index) => index % 2 === 0);
  const bottom = others.filter((_, index) => index % 2 === 1);

  const players = state.participants.filter((p) => p.role !== "spectator");
  const voted = players.filter((p) => p.hasVoted).length;
  const anyVote = voted > 0;
  // Estimar en solitario no compara nada: el servidor exige un mínimo.
  const enoughPlayers = players.length >= state.minPlayersToReveal;
  // Y nadie que siga en la mesa puede quedarse a medias: revelar destaparía a
  // quien todavía está pensando. Los desconectados no cuentan, o una señal
  // perdida dejaría la ronda bloqueada. El servidor comprueba lo mismo.
  const pending = players.filter((p) => p.connected && !p.hasVoted).length;
  const canReveal = enoughPlayers && pending === 0;

  return (
    <section className="table" aria-label="Mesa">
      <ul className="table__row">
        {top.map((participant) => (
          <Seat
            key={participant.participantId}
            participant={participant}
            revealed={revealed}
            isMe={false}
            reactions={reactionsFor(participant.participantId)}
            onThrow={onThrow}
            onReact={onReact}
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
                  disabled={!canReveal}
                  // Con una sola persona el botón apagado se explica solo; lo
                  // que no se deduce a simple vista es a cuánta gente se espera.
                  title={
                    enoughPlayers && pending > 0
                      ? pending === 1
                        ? "Falta una persona por elegir carta"
                        : `Faltan ${pending} personas por elegir carta`
                      : undefined
                  }
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
            reactions={reactionsFor(participant.participantId)}
            onThrow={onThrow}
            onReact={onReact}
          />
        ))}
        {me && (
          <Seat
            key={me.participantId}
            participant={me}
            revealed={revealed}
            isMe
            reactions={reactionsFor(me.participantId)}
            onThrow={onThrow}
            onReact={onReact}
          />
        )}
      </ul>
    </section>
  );
}
