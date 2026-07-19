import type { ConnectionStatus as Status } from "../hooks/useRoom";

const LABELS: Record<Status, string> = {
  idle: "Sin conectar",
  connecting: "Conectando…",
  "starting-server": "Iniciando servidor…",
  reconnecting: "Reconectando…",
  connected: "Conectado",
  "room-gone": "La sala ya no existe",
  unauthorized: "Frase de acceso requerida",
  locked: "Acceso bloqueado temporalmente",
};

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <p className={`connection connection--${status}`} role="status" aria-live="polite">
      <span className="connection__dot" aria-hidden="true" />
      {LABELS[status]}
      {status === "starting-server" && (
        <span className="connection__hint">
          El plan gratuito de Render tarda unos segundos en despertar.
        </span>
      )}
    </p>
  );
}
