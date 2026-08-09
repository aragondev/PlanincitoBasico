import type { Server, Socket } from "socket.io";

/** Render va detrás de proxy: la IP real llega en `x-forwarded-for`. */
function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return raw?.split(",")[0]?.trim() || socket.handshake.address;
}

/**
 * Tope de conexiones simultáneas por IP. Sin él, un solo cliente podía abrir
 * cientos de sockets sin conocer siquiera la frase de acceso —la puerta sólo
 * protege crear salas—, y en una instancia con 0.1 CPU eso basta para
 * tumbarla. No hace falta mala intención: un bucle de reconexión mal hecho
 * produce el mismo efecto.
 *
 * El equipo comparte la IP pública de su red, así que el tope se cuenta en
 * salas llenas, no en personas: con el valor por defecto caben varias.
 */
export function registerConnectionLimit(io: Server, max: number): void {
  if (max <= 0) return;

  const perIp = new Map<string, number>();

  io.use((socket, next) => {
    const ip = clientIp(socket);
    const current = perIp.get(ip) ?? 0;

    if (current >= max) {
      next(new Error("TOO_MANY_CONNECTIONS"));
      return;
    }

    perIp.set(ip, current + 1);
    socket.once("disconnect", () => {
      const left = (perIp.get(ip) ?? 1) - 1;
      // Se borra la entrada al llegar a cero: el mapa no debe crecer sin fin.
      if (left <= 0) perIp.delete(ip);
      else perIp.set(ip, left);
    });

    next();
  });
}
