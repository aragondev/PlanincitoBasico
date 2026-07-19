import type { PublicRoomState } from "@planincito/shared";

type Props = {
  state: PublicRoomState;
  onReveal: () => void;
  onRestart: () => void;
};

export function FacilitatorControls({ state, onReveal, onRestart }: Props) {
  const revealed = state.status === "revealed";
  const anyVote = state.participants.some((participant) => participant.hasVoted);

  return (
    <section className="controls" aria-label="Controles del facilitador">
      {!revealed ? (
        <button
          type="button"
          className="primary"
          onClick={onReveal}
          disabled={!anyVote}
          title={anyVote ? undefined : "Nadie ha votado todavía"}
        >
          Revelar votos
        </button>
      ) : (
        <button type="button" className="primary" onClick={onRestart}>
          Nueva ronda
        </button>
      )}
    </section>
  );
}
