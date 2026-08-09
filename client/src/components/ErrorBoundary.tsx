import { Component, type ErrorInfo, type ReactNode } from "react";
import { clearSession } from "../socket/session";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Red de seguridad ante un fallo de render. Sin ella React desmonta el árbol
 * entero y queda una página en blanco, sin explicación ni forma de salir.
 *
 * Sigue siendo una clase porque los hooks no pueden capturar estos errores.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[planincito] error de render", error, info.componentStack);
  }

  private readonly recargar = () => {
    window.location.reload();
  };

  /** Descarta la sesión por si el fallo viene de un estado guardado corrupto. */
  private readonly empezarDeCero = () => {
    clearSession();
    window.location.hash = "";
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="join">
        <div className="panel">
          <h1 className="panel__title">Algo se rompió</h1>
          <p className="muted">
            La aplicación encontró un error inesperado. Tu sala sigue en el
            servidor: al recargar deberías volver a tu sitio.
          </p>

          <button type="button" className="primary" onClick={this.recargar}>
            Recargar
          </button>
          <button type="button" className="ghost" onClick={this.empezarDeCero}>
            Salir de la sala y empezar de cero
          </button>

          <details className="error-details">
            <summary>Detalle técnico</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </main>
    );
  }
}
