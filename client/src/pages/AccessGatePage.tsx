import { useState } from "react";
import { loadAccessSecret } from "../socket/accessSecret";

type Props = {
  /** `true` cuando el servidor bloqueó la IP por demasiados intentos. */
  locked: boolean;
  onSubmit: (secret: string) => void;
};

export function AccessGatePage({ locked, onSubmit }: Props) {
  const [secret, setSecret] = useState(() => loadAccessSecret());
  const trimmed = secret.trim();

  return (
    <main className="join">
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(trimmed);
        }}
      >
        <h1 className="panel__title">Frase de acceso</h1>
        <p className="muted">
          Esta instancia es privada. Pide la frase compartida a quien organiza la
          sesión.
        </p>

        <label htmlFor="access-secret">Frase</label>
        <input
          id="access-secret"
          type="password"
          value={secret}
          autoComplete="current-password"
          autoFocus
          onChange={(event) => setSecret(event.target.value)}
        />

        {locked ? (
          <p className="error">
            Demasiados intentos fallidos desde esta conexión. Espera unos minutos
            antes de volver a probar.
          </p>
        ) : (
          <button type="submit" className="primary" disabled={!trimmed}>
            Entrar
          </button>
        )}
      </form>
    </main>
  );
}
