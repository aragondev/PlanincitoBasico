import { useEffect, useState, type ReactNode } from "react";
import { inviteLinkFor } from "../hooks/useHashRoute";
import { ConnectionStatus } from "./ConnectionStatus";
import { CheckIcon, ExitIcon, LinkIcon, MoonIcon, SunIcon } from "./Icon";
import { RoundHistory } from "./RoundHistory";
import { TopicEditor } from "./TopicEditor";
import type { RoundHistoryEntry } from "@planincito/shared";
import type { ConnectionStatus as Status } from "../hooks/useRoom";
import type { Theme } from "../hooks/useTheme";

export function CopyInviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    const link = inviteLinkFor(code);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Safari sin permiso de portapapeles: mostramos el enlace para copiarlo a mano.
      window.prompt("Copia el enlace de invitación:", link);
    }
  };

  return (
    <button
      type="button"
      className="md-button--text drawer__toggle"
      aria-label="Copiar enlace de invitación"
      title="Copiar enlace de invitación"
      onClick={() => void copy()}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
      <span className="drawer__toggle-label">
        {copied ? "¡Copiado!" : "Invitar"}
      </span>
    </button>
  );
}

type Props = {
  code: string;
  round: number;
  status: Status;
  topic: string;
  canEditTopic: boolean;
  onTopicChange: (topic: string) => void;
  onLeave: () => void;
  history: RoundHistoryEntry[];
  /** Paneles inyectados para no acoplar el encabezado a la sala. */
  participants: ReactNode;
  results: ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
};

export function RoomHeader({
  code,
  round,
  status,
  topic,
  canEditTopic,
  onTopicChange,
  onLeave,
  history,
  participants,
  results,
  theme,
  onToggleTheme,
}: Props) {
  return (
    <header className="room-header">
      <div className="room-header__identity">
        <h1 className="room-header__code">
          <strong>{code}</strong>
        </h1>
        <span className="room-header__round">Ronda {round}</span>
        {/* El tema vive aquí para no robarle una fila entera a la mesa. */}
        <TopicEditor topic={topic} canEdit={canEditTopic} onChange={onTopicChange} />
      </div>
      <div className="room-header__actions">
        <ConnectionStatus status={status} />
        {results}
        {participants}
        <RoundHistory history={history} />
        <CopyInviteLink code={code} />
        <button
          type="button"
          className="md-icon-button"
          aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <button
          type="button"
          className="md-icon-button"
          aria-label="Salir de la sala"
          title="Salir"
          onClick={onLeave}
        >
          <ExitIcon />
        </button>
      </div>
    </header>
  );
}
