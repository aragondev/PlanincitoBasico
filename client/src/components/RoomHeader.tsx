import { useEffect, useState } from "react";
import { inviteLinkFor } from "../hooks/useHashRoute";
import { ConnectionStatus } from "./ConnectionStatus";
import { TopicEditor } from "./TopicEditor";
import type { ConnectionStatus as Status } from "../hooks/useRoom";

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
    <button type="button" className="secondary" onClick={() => void copy()}>
      {copied ? "¡Enlace copiado!" : "Copiar enlace"}
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
};

export function RoomHeader({
  code,
  round,
  status,
  topic,
  canEditTopic,
  onTopicChange,
  onLeave,
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
        <CopyInviteLink code={code} />
        <button type="button" className="ghost" onClick={onLeave}>
          Salir
        </button>
      </div>
    </header>
  );
}
