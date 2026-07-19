import { useState } from "react";
import { LIMITS } from "@planincito/shared";
import { ConnectionStatus } from "../components/ConnectionStatus";
import type { ConnectionStatus as Status } from "../hooks/useRoom";

type Props = {
  status: Status;
  busy: boolean;
  onCreate: (alias: string) => void;
  onJoin: (code: string, alias: string) => void;
};

export function HomePage({ status, busy, onCreate, onJoin }: Props) {
  const [alias, setAlias] = useState("");
  const [code, setCode] = useState("");

  const trimmedAlias = alias.trim();
  const normalizedCode = code.trim().toUpperCase();

  return (
    <main className="home">
      <section className="home__intro">
        <h1>Planincito</h1>
      </section>

      <div className="home__cards">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(trimmedAlias);
          }}
        >
          <h2 className="panel__title">Crear una sala</h2>
          <label htmlFor="alias">Tu alias</label>
          <input
            id="alias"
            type="text"
            value={alias}
            maxLength={LIMITS.MAX_ALIAS_LENGTH}
            autoComplete="nickname"
            placeholder="Ana"
            onChange={(event) => setAlias(event.target.value)}
          />
          <button type="submit" className="primary" disabled={!trimmedAlias || busy}>
            Crear sala
          </button>
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin(normalizedCode, trimmedAlias);
          }}
        >
          <h2 className="panel__title">Entrar con un código</h2>
          <label htmlFor="code">Código de la sala</label>
          <input
            id="code"
            type="text"
            value={code}
            maxLength={LIMITS.ROOM_CODE_LENGTH}
            inputMode="text"
            autoCapitalize="characters"
            placeholder="ABC123"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <button
            type="submit"
            className="secondary"
            disabled={
              !trimmedAlias || normalizedCode.length !== LIMITS.ROOM_CODE_LENGTH || busy
            }
          >
            Entrar
          </button>
          <p className="muted">Usa el mismo alias del formulario anterior.</p>
        </form>
      </div>

      {status !== "idle" && <ConnectionStatus status={status} />}
    </main>
  );
}
