import { useState } from "react";

type Props = {
  /** `true` cuando el servidor bloqueó la IP por demasiados intentos. */
  locked: boolean;
  /** `true` cuando la frase enviada fue rechazada. */
  rejected: boolean;
  busy: boolean;
  onSubmit: (secret: string) => void;
};

export function AccessGatePage({ locked, rejected, busy, onSubmit }: Props) {
  // Campo vacío a propósito: si hubiera una frase válida guardada nunca
  // veríamos esta pantalla, así que rellenarlo sólo mostraría una errónea.
  const [secret, setSecret] = useState("");
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
          disabled={locked}
          onChange={(event) => setSecret(event.target.value)}
        />

        {locked ? (
          <p className="error">
            Demasiados intentos fallidos desde esta conexión. Espera unos minutos
            antes de volver a probar.
          </p>
        ) : (
          <>
            {rejected && (
              <p className="error">
                La frase no es correcta. Revísala y vuelve a intentarlo.
              </p>
            )}
            <button type="submit" className="primary" disabled={!trimmed || busy}>
              {busy ? "Comprobando…" : "Entrar"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
