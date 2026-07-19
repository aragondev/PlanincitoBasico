import { CardDeck } from "../components/CardDeck";
import { ConfirmationDialog, useConfirmation } from "../components/Feedback";
import { FacilitatorControls } from "../components/FacilitatorControls";
import { ParticipantList } from "../components/ParticipantList";
import { PokerTable } from "../components/PokerTable";
import { RoomHeader } from "../components/RoomHeader";
import { TopicEditor } from "../components/TopicEditor";
import { VotingResults } from "../components/VotingResults";
import type { RoomApi } from "../hooks/useRoom";

export function RoomPage({ room }: { room: RoomApi }) {
  const { state, myId, isFacilitator } = room;
  const kickTarget = useConfirmation<string>();

  if (!state) return null;

  const me = state.participants.find(
    (participant) => participant.participantId === myId,
  );
  const isSpectator = me?.role === "spectator";
  const revealed = state.status === "revealed";

  const deckHint = isSpectator
    ? "Estás como espectador: puedes seguir la ronda pero no votar."
    : revealed
      ? "Ronda revelada. Espera a que el facilitador inicie otra."
      : "Puedes cambiar tu carta hasta que se revelen los votos.";

  return (
    <div className="room">
      <RoomHeader
        code={state.code}
        round={state.round}
        status={room.status}
        onLeave={room.leaveRoom}
      />

      <TopicEditor
        topic={state.topic}
        canEdit={isFacilitator}
        onChange={room.setTopic}
      />

      <div className="room__body">
        <ParticipantList
          participants={state.participants}
          myId={myId}
          maxParticipants={state.maxParticipants}
          revealed={revealed}
          canManage={isFacilitator}
          onKick={kickTarget.ask}
          onChangeRole={room.changeRole}
          onTransfer={room.transferFacilitator}
        />

        <div className="room__center">
          {revealed && state.results ? (
            <VotingResults results={state.results} />
          ) : (
            <PokerTable state={state} />
          )}
        </div>
      </div>

      <CardDeck
        selected={room.myVote}
        disabled={isSpectator || revealed}
        hint={deckHint}
        onSelect={room.vote}
      />

      {isFacilitator && (
        <FacilitatorControls
          state={state}
          onReveal={room.reveal}
          onRestart={() => room.restartRound()}
        />
      )}

      {kickTarget.pending && (
        <ConfirmationDialog
          question={`¿Expulsar a ${
            state.participants.find(
              (participant) => participant.participantId === kickTarget.pending,
            )?.alias ?? "este participante"
          }?`}
          confirmLabel="Expulsar"
          onConfirm={() => {
            room.kick(kickTarget.pending!);
            kickTarget.clear();
          }}
          onCancel={kickTarget.clear}
        />
      )}
    </div>
  );
}
