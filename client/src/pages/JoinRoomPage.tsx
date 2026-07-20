import { useState } from "react";
import { LIMITS } from "@planincito/shared";
import { ConnectionStatus } from "../components/ConnectionStatus";
import type { ConnectionStatus as Status } from "../hooks/useRoom";

type Props = {
  code: string;
  status: Status;
  busy: boolean;
  errorMessage: string | null;
  onJoin: (alias: string, asSpectator: boolean) => void;
  onBack: () => void;
};

export function JoinRoomPage({
  code,
  status,
  busy,
  errorMessage,
  onJoin,
  onBack,
}: Props) {
  const [alias, setAlias] = useState("");
  const [asSpectator, setAsSpectator] = useState(false);
  const trimmed = alias.trim();

  return (
    <main className="join">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          onJoin(trimmed, asSpectator);
        }}
      >
        <h1 className="panel__title">
          Entrar a la sala <strong>{code}</strong>
        </h1>

        <label htmlFor="join-alias">Tu alias</label>
        <input
          id="join-alias"
          type="text"
          value={alias}
          maxLength={LIMITS.MAX_ALIAS_LENGTH}
          autoComplete="nickname"
          autoFocus
          placeholder="Ana"
          onChange={(event) => setAlias(event.target.value)}
        />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={asSpectator}
            onChange={(event) => setAsSpectator(event.target.checked)}
          />
          Entrar como espectador (no vota)
        </label>

        <button type="submit" className="primary" disabled={!trimmed || busy}>
          Entrar
        </button>

        {errorMessage && <p className="error">{errorMessage}</p>}
        {status !== "idle" && <ConnectionStatus status={status} />}

        <button type="button" className="ghost" onClick={onBack}>
          Volver al inicio
        </button>
      </form>
    </main>
  );
}
