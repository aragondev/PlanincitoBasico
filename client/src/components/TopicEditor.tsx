import { useEffect, useState } from "react";
import { LIMITS } from "@planincito/shared";

type Props = {
  topic: string;
  canEdit: boolean;
  onChange: (topic: string) => void;
};

export function TopicEditor({ topic, canEdit, onChange }: Props) {
  const [draft, setDraft] = useState(topic);
  const [editing, setEditing] = useState(false);

  // Si otro facilitador cambia el tema, seguimos el estado del servidor.
  useEffect(() => {
    if (!editing) setDraft(topic);
  }, [topic, editing]);

  if (!canEdit) {
    return (
      <section className="topic" aria-label="Tema actual">
        <h2 className="topic__label">Tema</h2>
        <p className={topic ? "topic__value" : "topic__value muted"}>
          {topic || "Sin tema definido"}
        </p>
      </section>
    );
  }

  return (
    <section className="topic" aria-label="Tema actual">
      <h2 className="topic__label">
        <label htmlFor="topic-input">Tema</label>
      </h2>
      <form
        className="topic__form"
        onSubmit={(event) => {
          event.preventDefault();
          setEditing(false);
          onChange(draft.trim());
        }}
      >
        <input
          id="topic-input"
          type="text"
          value={draft}
          maxLength={LIMITS.MAX_TOPIC_LENGTH}
          placeholder="Historia o tarea a estimar"
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="secondary" disabled={draft.trim() === topic}>
          Guardar
        </button>
      </form>
    </section>
  );
}
