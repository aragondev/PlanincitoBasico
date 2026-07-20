import type { PublicParticipant, PublicRoomState } from "@planincito/shared";
import { cardLabel } from "./PokerCard";

/**
 * Asiento: carta boca abajo mientras se vota y volteo 3D al revelar.
 * El alias va debajo de la carta, como en una mesa real.
 */
function Seat({
  participant,
  revealed,
  isMe,
}: {
  participant: PublicParticipant;
  revealed: boolean;
  isMe: boolean;
}) {
  const { alias, role, connected, hasVoted, vote } = participant;

  if (role === "spectator") {
    return (
      <li className={`seat${connected ? "" : " seat--offline"}`}>
        <span className="seat__card seat__card--spectator" aria-label="Espectador">
          👁
        </span>
        <span className={`seat__alias${isMe ? " seat__alias--me" : ""}`}>{alias}</span>
      </li>
    );
  }

  // El volteo sólo ocurre cuando hay carta que mostrar.
  const flipped = revealed && vote !== undefined;

  return (
    <li className={`seat${connected ? "" : " seat--offline"}`}>
      <div
        className={`seat__card${hasVoted ? " seat__card--voted" : ""}${
          flipped ? " seat__card--flipped" : ""
        }`}
        aria-label={
          revealed
            ? `${alias}: ${vote ? cardLabel(vote) : "sin voto"}`
            : `${alias}: ${hasVoted ? "ya votó" : "pendiente"}`
        }
      >
        <span className="seat__face seat__face--back" />
        <span className="seat__face seat__face--front">
          {vote !== undefined ? cardLabel(vote) : ""}
        </span>
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
};

export function PokerTable({
  state,
  myId,
  isFacilitator,
  onReveal,
  onRestart,
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
          />
        ))}
      </ul>

      <div className="table__surface">
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
      </div>

      <ul className="table__row">
        {bottom.map((participant) => (
          <Seat
            key={participant.participantId}
            participant={participant}
            revealed={revealed}
            isMe={false}
          />
        ))}
        {me && (
          <Seat key={me.participantId} participant={me} revealed={revealed} isMe />
        )}
      </ul>
    </section>
  );
}
