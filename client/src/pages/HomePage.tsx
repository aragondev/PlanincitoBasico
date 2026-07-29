import { useState } from "react";
import { LIMITS } from "@planincito/shared";
import { ConnectionStatus } from "../components/ConnectionStatus";
import type { ConnectionStatus as Status } from "../hooks/useRoom";

type Props = {
  status: Status;
  busy: boolean;
  onCreate: (alias: string, asSpectator: boolean) => void;
  onJoin: (code: string, alias: string) => void;
};

/**
 * Un solo alias para las dos acciones: antes había un campo por formulario y
 * una nota pidiendo repetirlo, que sobra si el dato se pide una vez.
 */
export function HomePage({ status, busy, onCreate, onJoin }: Props) {
  const [alias, setAlias] = useState("");
  const [code, setCode] = useState("");
  const [asSpectator, setAsSpectator] = useState(false);

  const trimmedAlias = alias.trim();
  const normalizedCode = code.trim().toUpperCase();
  const codeReady = normalizedCode.length === LIMITS.ROOM_CODE_LENGTH;

  return (
    <main className="home">
      <h1 className="home__title">Planincito</h1>

      <div className="panel home__card">
        <label htmlFor="alias">Tu alias</label>
        <input
          id="alias"
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
          Entrar como espectador
        </label>

        <button
          type="button"
          className="primary home__cta"
          disabled={!trimmedAlias || busy}
          onClick={() => onCreate(trimmedAlias, asSpectator)}
        >
          Crear sala
        </button>

        <p className="home__divider">
          <span>o entra con un código</span>
        </p>

        <form
          className="home__join"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin(normalizedCode, trimmedAlias);
          }}
        >
          <input
            type="text"
            value={code}
            maxLength={LIMITS.ROOM_CODE_LENGTH}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABC123"
            aria-label="Código de la sala"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button
            type="submit"
            className="secondary"
            disabled={!trimmedAlias || !codeReady || busy}
          >
            Entrar
          </button>
        </form>
      </div>

      {status !== "idle" && status !== "connected" && (
        <ConnectionStatus status={status} />
      )}
    </main>
  );
}
