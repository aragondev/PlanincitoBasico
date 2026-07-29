import { useEffect, useState } from "react";
import { hasConsensus } from "@planincito/shared";
import { CardDeck } from "../components/CardDeck";
import { Celebration } from "../components/Celebration";
import { ConfirmationDialog, useConfirmation } from "../components/Feedback";
import { ParticipantList } from "../components/ParticipantList";
import { PokerTable } from "../components/PokerTable";
import { RoomHeader } from "../components/RoomHeader";
import { RoundHistory } from "../components/RoundHistory";
import { TopicEditor } from "../components/TopicEditor";
import { VotingResults } from "../components/VotingResults";
import type { RoomApi } from "../hooks/useRoom";

export function RoomPage({ room }: { room: RoomApi }) {
  const { state, myId, isFacilitator } = room;
  const kickTarget = useConfirmation<string>();
  const [celebrating, setCelebrating] = useState(false);

  const consensusKey =
    state && state.status === "revealed" && hasConsensus(state.results)
      ? `${state.code}:${state.round}`
      : null;

  // Una tanda de cohetes por ronda con consenso; al cambiar de ronda (o al
  // dejar de haberlo) se corta, para no festejar sobre la ronda siguiente.
  useEffect(() => {
    setCelebrating(consensusKey !== null);
  }, [consensusKey]);

  if (!state) return null;

  const me = state.participants.find(
    (participant) => participant.participantId === myId,
  );
  const isSpectator = me?.role === "spectator";
  const revealed = state.status === "revealed";

  const roleHint = isSpectator
    ? "Estás en modo espectador."
    : "Estás jugando esta ronda.";

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

      <main className="room__stage">
        <PokerTable
          state={state}
          myId={myId}
          isFacilitator={isFacilitator}
          onReveal={room.reveal}
          onRestart={() => room.restartRound()}
        />

        {revealed && state.results && <VotingResults results={state.results} />}

        <RoundHistory history={state.history} />

        {/* La gestión de participantes sólo le sirve al facilitador: los demás
            ya ven a todos en la mesa. */}
        {isFacilitator && (
          <ParticipantList
            participants={state.participants}
            myId={myId}
            facilitatorId={state.facilitatorId}
            maxParticipants={state.maxParticipants}
            revealed={revealed}
            canManage
            onKick={kickTarget.ask}
            onChangeRole={room.changeRole}
            onTransfer={room.transferFacilitator}
          />
        )}
      </main>

      <div className="dock">
        <section className="rolebar">
          <span className="rolebar__text">{roleHint}</span>
          <button
            type="button"
            className="ghost"
            onClick={() => room.setOwnRole(isSpectator ? "player" : "spectator")}
          >
            {isSpectator ? "Volver a jugar" : "Pasar a espectador"}
          </button>
        </section>

        {!isSpectator && (
          <CardDeck
            selected={room.myVote}
            disabled={revealed}
            hint={deckHint}
            onSelect={room.vote}
          />
        )}
      </div>

      {celebrating && <Celebration onDone={() => setCelebrating(false)} />}

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
