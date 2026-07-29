import { useEffect, useRef, useState } from "react";
import { LIMITS } from "@planincito/shared";

type Props = {
  topic: string;
  canEdit: boolean;
  onChange: (topic: string) => void;
};

/**
 * El tema vive en el encabezado, no en una fila propia: el protagonismo es
 * de la mesa y del mazo. Sólo se convierte en campo mientras se edita.
 */
export function TopicEditor({ topic, canEdit, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(topic);
  }, [topic, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const value = draft.trim();
    if (value !== topic) onChange(value);
  };

  if (editing) {
    return (
      <form
        className="topic topic--editing"
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={LIMITS.MAX_TOPIC_LENGTH}
          placeholder="¿Qué estamos estimando?"
          aria-label="Tema de la ronda"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setDraft(topic);
              setEditing(false);
            }
          }}
        />
      </form>
    );
  }

  if (!canEdit) {
    return (
      <p className={`topic${topic ? "" : " topic--empty"}`}>
        {topic || "Sin tema"}
      </p>
    );
  }

  return (
    <button
      type="button"
      className={`topic topic--button${topic ? "" : " topic--empty"}`}
      title="Editar el tema"
      onClick={() => setEditing(true)}
    >
      {topic || "Añadir tema"}
    </button>
  );
}
