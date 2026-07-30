
import type { ParticipantRole, PublicParticipant } from "@planincito/shared";
import { Drawer } from "./Drawer";
import { UsersIcon } from "./Icon";
import { cardLabel } from "./PokerCard";

type ItemProps = {
  participant: PublicParticipant;
  isMe: boolean;
  isFacilitator: boolean;
  revealed: boolean;
  canManage: boolean;
  onKick: (participantId: string) => void;
  onChangeRole: (participantId: string, role: ParticipantRole) => void;
  onTransfer: (participantId: string) => void;
};

const ROLE_LABEL: Record<ParticipantRole, string> = {
  player: "Jugador",
  spectator: "Espectador",
};

export function ParticipantItem({
  participant,
  isMe,
  isFacilitator,
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
        <span className="participant__role">
          {isFacilitator ? `Facilitador · ${ROLE_LABEL[role]}` : ROLE_LABEL[role]}
        </span>
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
          {!isFacilitator && (
            <button type="button" onClick={() => onTransfer(participantId)}>
              Hacer facilitador
            </button>
          )}
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

type ListProps = Omit<ItemProps, "participant" | "isMe" | "isFacilitator"> & {
  participants: PublicParticipant[];
  myId: string | null;
  facilitatorId: string;
  maxParticipants: number;
};

/**
 * Panel lateral, igual que el historial: la sala debe mostrar la mesa y el
 * mazo, no listas que obliguen a desplazarse y saquen el tablero de la vista.
 */
export function ParticipantList({
  participants,
  myId,
  facilitatorId,
  maxParticipants,
  ...itemProps
}: ListProps) {
  return (
    <Drawer
      title="Participantes"
      icon={<UsersIcon />}
      badge={`${participants.length}/${maxParticipants}`}
    >
      <ul className="participants">
        {participants.map((participant) => (
          <ParticipantItem
            key={participant.participantId}
            participant={participant}
            isMe={participant.participantId === myId}
            isFacilitator={participant.participantId === facilitatorId}
            {...itemProps}
          />
        ))}
      </ul>
    </Drawer>
  );
}
