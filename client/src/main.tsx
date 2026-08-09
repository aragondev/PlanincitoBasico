import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("No se encontró el contenedor #root");

// Sin StrictMode: su doble montaje en desarrollo duplicaría la entrada a la sala.
createRoot(container).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
