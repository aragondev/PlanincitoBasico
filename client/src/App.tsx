import { useEffect } from "react";
import { Toast } from "./components/Feedback";
import {
  navigateHome,
  navigateToRoom,
  useRoomCodeFromHash,
} from "./hooks/useHashRoute";
import { useRoom } from "./hooks/useRoom";
import { AccessGatePage } from "./pages/AccessGatePage";
import { HomePage } from "./pages/HomePage";
import { JoinRoomPage } from "./pages/JoinRoomPage";
import { RoomPage } from "./pages/RoomPage";

export function App() {
  const room = useRoom();
  const hashCode = useRoomCodeFromHash();

  // Mantiene la URL alineada con la sala activa para que el enlace sea compartible.
  useEffect(() => {
    if (room.state && room.state.code !== hashCode) navigateToRoom(room.state.code);
  }, [room.state, hashCode]);

  const busy = room.status === "connecting" || room.status === "starting-server";

  const feedback = (
    <Toast
      message={room.error?.message ?? room.notice}
      tone={room.error ? "error" : "info"}
      onDismiss={room.dismissError}
    />
  );

  // La puerta de acceso tiene prioridad: sin frase válida no hay socket.
  if (room.status === "unauthorized" || room.status === "locked") {
    return (
      <>
        <AccessGatePage
          locked={room.status === "locked"}
          rejected={room.accessRejected}
          busy={busy}
          onSubmit={room.submitAccessSecret}
        />
        {feedback}
      </>
    );
  }

  if (room.state) {
    return (
      <>
        <RoomPage room={room} />
        {feedback}
      </>
    );
  }

  if (hashCode) {
    return (
      <>
        <JoinRoomPage
          code={hashCode}
          status={room.status}
          busy={busy}
          errorMessage={
            room.status === "room-gone"
              ? "La sala ya no existe. Puedes crear una nueva."
              : (room.error?.message ?? null)
          }
          onJoin={(alias) => room.joinRoom(hashCode, alias)}
          onBack={() => {
            room.reset();
            navigateHome();
          }}
        />
        {feedback}
      </>
    );
  }

  return (
    <>
      <HomePage
        status={room.status}
        busy={busy}
        onCreate={room.createRoom}
        onJoin={(code, alias) => {
          // No cambiamos la URL aquí: si el código es inválido o la sala no
          // existe, el usuario debe quedarse en el inicio con el aviso de error.
          // El `useEffect` de arriba sincroniza la URL sólo cuando se entra.
          room.joinRoom(code, alias);
        }}
      />
      {feedback}
    </>
  );
}
