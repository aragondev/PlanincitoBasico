import { useEffect, useState, type ReactNode } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { CloseIcon } from "./Icon";

type Props = {
  /** Texto del botón y título del panel. */
  title: string;
  icon: ReactNode;
  /** Contador junto al icono; se omite si no aplica. */
  badge?: ReactNode;
  /** Nota breve bajo el encabezado. */
  note?: string;
  children: ReactNode;
};

/**
 * Panel lateral con su botón. Historial, participantes y resultados repetían
 * esta misma envoltura —estado, Escape, retención de foco, velo y encabezado—,
 * así que vive en un solo sitio y cada panel aporta sólo su contenido.
 */
export function Drawer({ title, icon, badge, note, children }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useFocusTrap<HTMLElement>(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="md-button--text drawer__toggle"
        // El texto se oculta en móvil, así que el nombre accesible va aquí.
        aria-label={title}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {icon}
        <span className="drawer__toggle-label">{title}</span>
        {badge !== undefined && <span className="drawer__badge">{badge}</span>}
      </button>

      {open && (
        <div
          className="drawer__scrim"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <aside
            ref={panelRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="drawer__header">
              <h2>{title}</h2>
              <button
                type="button"
                className="md-icon-button"
                aria-label={`Cerrar ${title.toLowerCase()}`}
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </header>

            {note && <p className="muted drawer__note">{note}</p>}
            {children}
          </aside>
        </div>
      )}
    </>
  );
}
