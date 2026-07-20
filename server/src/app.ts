import { createServer, type Server as HttpServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { SERVER_EVENTS } from "@planincito/shared";
import { config as defaultConfig, type Config } from "./config.js";
import { RoomStore } from "./rooms/roomStore.js";
import { AccessGate } from "./socket/accessGate.js";
import { registerSocketHandlers, type AppServer } from "./socket/handlers.js";

export type App = {
  httpServer: HttpServer;
  io: AppServer;
  store: RoomStore;
  shutdown: (reason: string) => Promise<void>;
};

export function createApp(config: Config = defaultConfig): App {
  let ready = true;

  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: config.clientOrigin === "*" ? true : config.clientOrigin,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/ready", (_req, res) => {
    res.status(ready ? 200 : 503).json({ ready, rooms: store.size });
  });

  const httpServer = createServer(app);

  const io: AppServer = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin === "*" ? true : config.clientOrigin,
    },
    maxHttpBufferSize: config.maxEventPayloadBytes * 4,
    // El heartbeat propio de Socket.IO basta como actividad para Render (§3.2).
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  const store = new RoomStore({
    maxActiveRooms: config.maxActiveRooms,
    maxParticipantsPerRoom: config.maxParticipantsPerRoom,
    emptyRoomGraceMs: config.emptyRoomGraceMs,
    disconnectedParticipantGraceMs: config.disconnectedParticipantGraceMs,
  });

  // La frase sólo protege la creación de salas: entrar a una existente ya
  // requiere conocer su código.
  const accessGate = new AccessGate({
    secret: config.roomAccessSecret,
    maxAttempts: config.accessMaxAttempts,
    windowMs: config.accessAttemptWindowMs,
  });
  registerSocketHandlers(io, store, config, accessGate);

  // Un único barrido de mantenimiento para todo el proceso (§3.6).
  const cleanup = setInterval(() => store.sweep(), config.cleanupIntervalMs);
  cleanup.unref();

  let shuttingDown = false;
  const shutdown = async (reason: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    ready = false;
    clearInterval(cleanup);
    store.stopAcceptingNewRooms();

    io.emit(SERVER_EVENTS.SERVER_RESTARTING, {
      message: "El servidor se está reiniciando. Reconectaremos en unos segundos.",
    });
    console.info(`[server] cerrando: ${reason}`);

    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, config.shutdownGraceMs);
      void io.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    store.clear();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      // Sin esto, las conexiones keep-alive retrasan el cierre hasta el timeout.
      httpServer.closeAllConnections();
    });
  };

  return { httpServer, io, store, shutdown };
}
