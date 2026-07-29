import { useEffect, useRef, useState } from "react";
import { hasConsensus } from "@planincito/shared";
import { CardDeck } from "../components/CardDeck";
import { Celebration } from "../components/Celebration";
import { ConfirmationDialog, useConfirmation } from "../components/Feedback";
import { ParticipantList } from "../components/ParticipantList";
import { PokerTable } from "../components/PokerTable";
import { RoomHeader } from "../components/RoomHeader";
import { ThrowFlight } from "../components/ThrowFlight";
import { VotingResults } from "../components/VotingResults";
import type { RoomApi } from "../hooks/useRoom";
import type { Theme } from "../hooks/useTheme";

export function RoomPage({
  room,
  theme,
  onToggleTheme,
  onLeave,
}: {
  room: RoomApi;
  theme: Theme;
  onToggleTheme: () => void;
  onLeave: () => void;
}) {
  const { state, myId, isFacilitator } = room;
  const kickTarget = useConfirmation<string>();
  const [celebrating, setCelebrating] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  /**
   * El bloque inferior es fijo y su altura cambia (espectador sin mazo, mazo
   * en dos líneas…). Se mide y se publica como variable CSS para reservar
   * exactamente ese hueco, en vez de un valor fijo que acaba tapando cosas.
   */
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? dock.offsetHeight;
      document.documentElement.style.setProperty("--dock-height", `${height}px`);
    });
    observer.observe(dock);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--dock-height");
    };
  }, []);

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
        topic={state.topic}
        canEditTopic={isFacilitator}
        onTopicChange={room.setTopic}
        onLeave={onLeave}
        history={state.history}
        participants={
          <ParticipantList
            participants={state.participants}
            myId={myId}
            facilitatorId={state.facilitatorId}
            maxParticipants={state.maxParticipants}
            revealed={revealed}
            canManage={isFacilitator}
            onKick={kickTarget.ask}
            onChangeRole={room.changeRole}
            onTransfer={room.transferFacilitator}
          />
        }
        results={
          revealed && state.results ? (
            <VotingResults results={state.results} />
          ) : null
        }
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <main className="room__stage">
        <PokerTable
          state={state}
          myId={myId}
          isFacilitator={isFacilitator}
          onReveal={room.reveal}
          onRestart={() => room.restartRound()}
          onThrow={room.throwItem}
          countdown={room.countdown}
          results={revealed ? state.results : null}
        />


      </main>

      <div className="dock" ref={dockRef}>
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

      {room.flights.map((flight) => (
        <ThrowFlight key={flight.id} flight={flight} onDone={room.endFlight} />
      ))}

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
