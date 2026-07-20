import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type CardValue,
  type ParticipantRole,
  type PublicRoomState,
  type RoomError,
  type SessionCredentials,
} from "@planincito/shared";
import {
  TOO_MANY_ATTEMPTS,
  UNAUTHORIZED,
  createSocket,
  type AppSocket,
} from "../socket/client";
import {
  clearAccessSecret,
  persistAccessSecret,
  stageAccessSecret,
} from "../socket/accessSecret";
import { clearSession, loadSession, saveSession } from "../socket/session";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "starting-server"
  | "reconnecting"
  | "connected"
  | "room-gone"
  | "unauthorized"
  | "locked";

type Intent =
  | { type: "create"; alias: string }
  | { type: "join"; code: string; alias: string; asSpectator: boolean }
  | { type: "reconnect"; credentials: SessionCredentials };

/** Tras este tiempo sin conectar asumimos que Render está despertando (§3.2). */
const COLD_START_MS = 4000;

export type RoomApi = {
  status: ConnectionStatus;
  state: PublicRoomState | null;
  credentials: SessionCredentials | null;
  error: RoomError | null;
  notice: string | null;
  accessRejected: boolean;
  resuming: boolean;
  myId: string | null;
  isFacilitator: boolean;
  myVote: CardValue | undefined;
  createRoom: (alias: string) => void;
  joinRoom: (code: string, alias: string, asSpectator?: boolean) => void;
  leaveRoom: () => void;
  vote: (value: CardValue) => void;
  reveal: () => void;
  restartRound: (topic?: string) => void;
  setTopic: (topic: string) => void;
  kick: (participantId: string) => void;
  changeRole: (participantId: string, role: Exclude<ParticipantRole, "facilitator">) => void;
  transferFacilitator: (participantId: string) => void;
  dismissError: () => void;
  submitAccessSecret: (secret: string) => void;
  reset: () => void;
};

export function useRoom(): RoomApi {
  const socketRef = useRef<AppSocket | null>(null);
  const intentRef = useRef<Intent | null>(null);
  const coldStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [credentials, setCredentials] = useState<SessionCredentials | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<CardValue | undefined>(undefined);
  /** `true` cuando el servidor rechazó la frase que acabamos de enviar. */
  const [accessRejected, setAccessRejected] = useState(false);
  const triedSecretRef = useRef(false);
  /**
   * Hay una sesión guardada que aún estamos recuperando. Evita que al
   * recargar aparezca un instante la pantalla de "entrar a la sala".
   */
  const [resuming, setResuming] = useState(() => loadSession() !== null);

  if (socketRef.current === null) socketRef.current = createSocket();
  const socket = socketRef.current;

  const armColdStartTimer = useCallback(() => {
    if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
    coldStartTimer.current = setTimeout(() => {
      setStatus((current) =>
        current === "connecting" || current === "reconnecting"
          ? "starting-server"
          : current,
      );
    }, COLD_START_MS);
  }, []);

  const dispatchIntent = useCallback(() => {
    const intent = intentRef.current;
    if (!intent || !socket) return;
    if (intent.type === "create") {
      socket.emit(CLIENT_EVENTS.ROOM_CREATE, { alias: intent.alias });
    } else if (intent.type === "join") {
      socket.emit(CLIENT_EVENTS.ROOM_JOIN, {
        code: intent.code,
        alias: intent.alias,
        asSpectator: intent.asSpectator,
      });
    } else {
      socket.emit(CLIENT_EVENTS.ROOM_RECONNECT, intent.credentials);
    }
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const onConnect = () => {
      if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
      // El servidor aceptó el handshake: recién ahora la frase es válida.
      persistAccessSecret();
      setAccessRejected(false);
      triedSecretRef.current = false;
      setStatus("connected");
      setNotice(null);
      dispatchIntent();
    };

    const onDisconnect = (reason: string) => {
      if (reason === "io client disconnect") return;
      setStatus("reconnecting");
      armColdStartTimer();
    };

    const onConnectError = (cause: Error) => {
      // Una frase incorrecta no se arregla reintentando: paramos y la pedimos.
      if (cause.message === UNAUTHORIZED || cause.message === TOO_MANY_ATTEMPTS) {
        if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
        socket.disconnect();
        // Sólo es "frase incorrecta" si veníamos de enviar una; la primera
        // vez simplemente aún no la habíamos pedido.
        // Una frase inválida no debe quedar guardada de sesiones anteriores.
        clearAccessSecret();
        setResuming(false);
        if (triedSecretRef.current) setAccessRejected(true);
        setStatus(cause.message === UNAUTHORIZED ? "unauthorized" : "locked");
        return;
      }
      setStatus((current) => (current === "connected" ? "reconnecting" : current));
      armColdStartTimer();
    };

    const onEntered = (payload: {
      credentials?: SessionCredentials;
      state: PublicRoomState;
    }) => {
      setResuming(false);
      setState(payload.state);
      setStatus("connected");
      if (payload.credentials) {
        setCredentials(payload.credentials);
        saveSession(payload.credentials);
        intentRef.current = { type: "reconnect", credentials: payload.credentials };
      }
    };

    const onState = (payload: { state: PublicRoomState }) => setState(payload.state);

    const onError = (payload: RoomError) => {
      setResuming(false);
      setError(payload);
      if (
        payload.code === "ROOM_NOT_FOUND" ||
        payload.code === "RECONNECTION_FAILED"
      ) {
        clearSession();
        intentRef.current = null;
        setCredentials(null);
        setState(null);
        setStatus("room-gone");
      }
    };

    const onClosed = (payload: { reason: string }) => {
      clearSession();
      intentRef.current = null;
      setCredentials(null);
      setState(null);
      setNotice(payload.reason);
      setStatus("room-gone");
    };

    const onRestarting = (payload: { message: string }) => setNotice(payload.message);

    const onRoundRestarted = (payload: { state: PublicRoomState }) => {
      setMyVote(undefined);
      setState(payload.state);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on(SERVER_EVENTS.ROOM_CREATED, onEntered);
    socket.on(SERVER_EVENTS.ROOM_STATE, onEntered);
    socket.on(SERVER_EVENTS.PARTICIPANT_JOINED, onState);
    socket.on(SERVER_EVENTS.PARTICIPANT_LEFT, onState);
    socket.on(SERVER_EVENTS.PARTICIPANT_UPDATED, onState);
    socket.on(SERVER_EVENTS.VOTES_REVEALED, onState);
    socket.on(SERVER_EVENTS.FACILITATOR_CHANGED, onState);
    socket.on(SERVER_EVENTS.ROUND_RESTARTED, onRoundRestarted);
    socket.on(SERVER_EVENTS.ROOM_ERROR, onError);
    socket.on(SERVER_EVENTS.ROOM_CLOSED, onClosed);
    socket.on(SERVER_EVENTS.SERVER_RESTARTING, onRestarting);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (coldStartTimer.current) clearTimeout(coldStartTimer.current);
    };
  }, [socket, dispatchIntent, armColdStartTimer]);

  const start = useCallback(
    (intent: Intent) => {
      intentRef.current = intent;
      setError(null);
      if (socket.connected) {
        setStatus("connected");
        dispatchIntent();
        return;
      }
      setStatus("connecting");
      armColdStartTimer();
      socket.connect();
    },
    [socket, dispatchIntent, armColdStartTimer],
  );

  /** Reanuda automáticamente la sesión guardada al recargar la pestaña. */
  useEffect(() => {
    const saved = loadSession();
    if (saved) start({ type: "reconnect", credentials: saved });
    // Sólo en el montaje inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(
    <E extends keyof typeof CLIENT_EVENTS>(
      event: (typeof CLIENT_EVENTS)[E],
      payload?: unknown,
    ) => {
      if (!socket.connected) {
        setError({
          code: "INVALID_PAYLOAD",
          message: "Sin conexión con el servidor. Reintentando…",
        });
        return;
      }
      (socket.emit as (name: string, data?: unknown) => void)(event, payload);
    },
    [socket],
  );

  /** Guarda la frase compartida y reintenta la acción que quedó pendiente. */
  const submitAccessSecret = useCallback(
    (secret: string) => {
      stageAccessSecret(secret);
      triedSecretRef.current = true;
      setAccessRejected(false);
      setError(null);
      setStatus("connecting");
      armColdStartTimer();
      socket.connect();
    },
    [socket, armColdStartTimer],
  );

  const myId = credentials?.participantId ?? null;
  const isFacilitator = Boolean(myId && state && state.facilitatorId === myId);
  // Tras reconectar no conocemos la carta local; al revelar la recuperamos del estado.
  const effectiveVote =
    myVote ??
    state?.participants.find((participant) => participant.participantId === myId)?.vote;

  const reset = useCallback(() => {
    clearSession();
    setAccessRejected(false);
    setResuming(false);
    intentRef.current = null;
    setState(null);
    setCredentials(null);
    setMyVote(undefined);
    setError(null);
    setNotice(null);
    setStatus("idle");
  }, []);

  return useMemo<RoomApi>(
    () => ({
      status,
      state,
      credentials,
      error,
      notice,
      accessRejected,
      resuming,
      myId,
      isFacilitator,
      myVote: effectiveVote,
      createRoom: (alias) => start({ type: "create", alias }),
      joinRoom: (code, alias, asSpectator = false) =>
        start({ type: "join", code, alias, asSpectator }),
      leaveRoom: () => {
        emit(CLIENT_EVENTS.ROOM_LEAVE);
        reset();
      },
      vote: (value) => {
        setMyVote(value);
        emit(CLIENT_EVENTS.VOTE_SUBMIT, { value });
      },
      reveal: () => emit(CLIENT_EVENTS.VOTES_REVEAL),
      restartRound: (topic) => emit(CLIENT_EVENTS.ROUND_RESTART, { topic }),
      setTopic: (topic) => emit(CLIENT_EVENTS.TOPIC_UPDATE, { topic }),
      kick: (participantId) =>
        emit(CLIENT_EVENTS.PARTICIPANT_KICK, { participantId }),
      changeRole: (participantId, role) =>
        emit(CLIENT_EVENTS.PARTICIPANT_CHANGE_ROLE, { participantId, role }),
      transferFacilitator: (participantId) =>
        emit(CLIENT_EVENTS.FACILITATOR_TRANSFER, { participantId }),
      dismissError: () => setError(null),
      submitAccessSecret,
      reset,
    }),
    [
      status, state, credentials, error, notice, accessRejected, resuming,
      myId, isFacilitator,
      effectiveVote, start, emit, submitAccessSecret, reset,
    ],
  );
}
