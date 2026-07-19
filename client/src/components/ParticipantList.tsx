import type { ParticipantRole, PublicParticipant } from "@planincito/shared";
import { cardLabel } from "./PokerCard";

type ItemProps = {
  participant: PublicParticipant;
  isMe: boolean;
  revealed: boolean;
  canManage: boolean;
  onKick: (participantId: string) => void;
  onChangeRole: (
    participantId: string,
    role: Exclude<ParticipantRole, "facilitator">,
  ) => void;
  onTransfer: (participantId: string) => void;
};

const ROLE_LABEL: Record<ParticipantRole, string> = {
  facilitator: "Facilitador",
  player: "Jugador",
  spectator: "Espectador",
};

export function ParticipantItem({
  participant,
  isMe,
  revealed,
  canManage,
  onKick,
  onChangeRole,
  onTransfer,
}: ItemProps) {
  const { alias, role, connected, hasVoted, vote, participantId } = participant;

  return (
    <li className={`participant${connected ? "" : " participant--offline"}`}>
      <div className="participant__main">
        <span className="participant__alias">
          {alias}
          {isMe && <span className="participant__tag">tú</span>}
        </span>
        <span className="participant__role">{ROLE_LABEL[role]}</span>
      </div>

      <div className="participant__vote">
        {!connected && <span className="participant__offline">desconectado</span>}
        {role !== "spectator" &&
          (revealed && vote !== undefined ? (
            <span className="participant__card">{cardLabel(vote)}</span>
          ) : (
            <span
              className={`participant__status${hasVoted ? " participant__status--voted" : ""}`}
            >
              {hasVoted ? "Votó" : "Pendiente"}
            </span>
          ))}
      </div>

      {canManage && !isMe && (
        <div className="participant__actions">
          <button type="button" onClick={() => onTransfer(participantId)}>
            Hacer facilitador
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeRole(participantId, role === "spectator" ? "player" : "spectator")
            }
          >
            {role === "spectator" ? "Hacer jugador" : "Hacer espectador"}
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => onKick(participantId)}
          >
            Expulsar
          </button>
        </div>
      )}
    </li>
  );
}

type ListProps = Omit<ItemProps, "participant" | "isMe"> & {
  participants: PublicParticipant[];
  myId: string | null;
  maxParticipants: number;
};

export function ParticipantList({
  participants,
  myId,
  maxParticipants,
  ...itemProps
}: ListProps) {
  return (
    <section className="panel" aria-label="Participantes">
      <h2 className="panel__title">
        Participantes
        <span className="panel__count">
          {participants.length}/{maxParticipants}
        </span>
      </h2>
      <ul className="participants">
        {participants.map((participant) => (
          <ParticipantItem
            key={participant.participantId}
            participant={participant}
            isMe={participant.participantId === myId}
            {...itemProps}
          />
        ))}
      </ul>
    </section>
  );
}
