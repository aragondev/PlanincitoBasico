import type { PublicRoomState } from "@planincito/shared";
import { cardLabel } from "./PokerCard";

export function PokerTable({ state }: { state: PublicRoomState }) {
  const players = state.participants.filter(
    (participant) => participant.role !== "spectator",
  );
  const revealed = state.status === "revealed";
  const voted = players.filter((participant) => participant.hasVoted).length;

  return (
    <section className="table" aria-label="Mesa">
      <div className="table__surface">
        <p className="table__summary" aria-live="polite">
          {revealed
            ? "Cartas reveladas"
            : `${voted} de ${players.length} ya votaron`}
        </p>
      </div>
      <ul className="table__seats">
        {players.map((participant) => (
          <li
            key={participant.participantId}
            className={`seat${participant.connected ? "" : " seat--offline"}`}
          >
            <span
              className={`seat__card${participant.hasVoted ? " seat__card--filled" : ""}${
                revealed ? " seat__card--revealed" : ""
              }`}
            >
              {revealed && participant.vote !== undefined
                ? cardLabel(participant.vote)
                : ""}
            </span>
            <span className="seat__alias">{participant.alias}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
