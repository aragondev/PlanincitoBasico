import { useRef, useState } from "react";
import { LIMITS } from "@planincito/shared";
import { ConnectionStatus } from "../components/ConnectionStatus";
import type { ConnectionStatus as Status } from "../hooks/useRoom";

type Props = {
  status: Status;
  busy: boolean;
  /** Hay una frase de acceso recordada de una visita anterior. */
  secretStored: boolean;
  onForgetSecret: () => void;
  onCreate: (alias: string, asSpectator: boolean) => void;
  onJoin: (code: string, alias: string) => void;
};

/**
 * Un solo alias para las dos acciones: antes había un campo por formulario y
 * una nota pidiendo repetirlo, que sobra si el dato se pide una vez.
 */
export function HomePage({
  status,
  busy,
  secretStored,
  onForgetSecret,
  onCreate,
  onJoin,
}: Props) {
  const [alias, setAlias] = useState("");
  const [code, setCode] = useState("");
  const [asSpectator, setAsSpectator] = useState(false);
  const [aliasMissing, setAliasMissing] = useState(false);
  const aliasRef = useRef<HTMLInputElement>(null);

  const trimmedAlias = alias.trim();
  const normalizedCode = code.trim().toUpperCase();
  const codeReady = normalizedCode.length === LIMITS.ROOM_CODE_LENGTH;

  /**
   * Un botón apagado sin explicación deja al usuario mirando un código bien
   * escrito sin saber que le falta el alias. Se deja pulsable y se señala.
   */
  const withAlias = (action: () => void) => () => {
    if (!trimmedAlias) {
      setAliasMissing(true);
      aliasRef.current?.focus();
      return;
    }
    setAliasMissing(false);
    action();
  };

  return (
    <main className="home">
      <h1 className="home__title">Planincito</h1>

      <div className="panel home__card">
        <label htmlFor="alias">Tu alias</label>
        <input
          ref={aliasRef}
          id="alias"
          type="text"
          value={alias}
          maxLength={LIMITS.MAX_ALIAS_LENGTH}
          autoComplete="nickname"
          autoFocus
          placeholder="Ana"
          aria-invalid={aliasMissing}
          aria-describedby={aliasMissing ? "alias-error" : undefined}
          onChange={(event) => {
            setAlias(event.target.value);
            if (event.target.value.trim()) setAliasMissing(false);
          }}
        />

        {aliasMissing && (
          <p className="error" id="alias-error">
            Escribe tu alias para continuar.
          </p>
        )}

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
          disabled={busy}
          onClick={withAlias(() => onCreate(trimmedAlias, asSpectator))}
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
            withAlias(() => onJoin(normalizedCode, trimmedAlias))();
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
            disabled={!codeReady || busy}
          >
            Entrar
          </button>
        </form>
      </div>

      {secretStored && (
        <p className="home__secret">
          Frase de acceso recordada en este navegador.{" "}
          <button type="button" className="md-button--text" onClick={onForgetSecret}>
            Olvidar
          </button>
        </p>
      )}

      {status !== "idle" && status !== "connected" && (
        <ConnectionStatus status={status} />
      )}
    </main>
  );
}
