import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@planincito/shared";
import type { PublicRoomState, SessionCredentials } from "@planincito/shared";

/** Socket falso con la superficie que usa el hook, para dirigir los eventos. */
class FakeSocket {
  connected = false;
  readonly emitted: { event: string; payload?: unknown }[] = [];
  private handlers = new Map<string, ((payload?: unknown) => void)[]>();

  on(event: string, handler: (payload?: unknown) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  off() {
    return this;
  }

  removeAllListeners() {
    this.handlers.clear();
    return this;
  }

  emit(event: string, payload?: unknown) {
    this.emitted.push({ event, payload });
    return true;
  }

  /**
   * El socket real no conecta en la misma vuelta del bucle de eventos. Con un
   * `connect` sincrónico el hook nunca pasaba por el estado de arranque, así
   * que la prueba no habría visto ese comportamiento.
   */
  connect() {
    void Promise.resolve().then(() => {
      this.connected = true;
      this.fire("connect");
    });
    return this;
  }

  disconnect() {
    this.connected = false;
    return this;
  }

  /** Simula un mensaje del servidor. */
  fire(event: string, payload?: unknown) {
    for (const handler of this.handlers.get(event) ?? []) handler(payload);
  }

  lastEmit(event: string) {
    return [...this.emitted].reverse().find((item) => item.event === event);
  }
}

let socket: FakeSocket;

vi.mock("../src/socket/client", () => ({
  createSocket: () => socket,
}));

// Se importa después del mock para que el hook reciba el socket falso.
const { useRoom } = await import("../src/hooks/useRoom");

const credentials: SessionCredentials = {
  roomCode: "ABC123",
  participantId: "participante-1",
  reconnectionToken: "token-de-prueba-1234",
};

function stateWith(overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    code: "ABC123",
    topic: "",
    status: "voting",
    round: 1,
    facilitatorId: credentials.participantId,
    participants: [
      {
        participantId: credentials.participantId,
        alias: "Ana",
        role: "player",
        connected: true,
        hasVoted: false,
      },
    ],
    results: null,
    maxParticipants: 8,
    ...overrides,
  };
}

/** Deja el hook dentro de una sala, como tras crearla. */
async function enterRoom() {
  const hook = renderHook(() => useRoom());
  await act(async () => {
    hook.result.current.createRoom("Ana");
  });
  await act(async () => {
    socket.fire(SERVER_EVENTS.ROOM_CREATED, { credentials, state: stateWith() });
  });
  return hook;
}

beforeEach(() => {
  socket = new FakeSocket();
});

describe("votar", () => {
  it("elegir una carta la envía y la marca como propia", async () => {
    const hook = await enterRoom();

    await act(async () => {
      hook.result.current.vote("8");
    });

    expect(hook.result.current.myVote).toBe("8");
    expect(socket.lastEmit(CLIENT_EVENTS.VOTE_SUBMIT)?.payload).toEqual({
      value: "8",
    });
  });

  it("elegir la misma carta la retira", async () => {
    const hook = await enterRoom();

    await act(async () => {
      hook.result.current.vote("8");
    });
    await act(async () => {
      hook.result.current.vote("8");
    });

    expect(hook.result.current.myVote).toBeUndefined();
    expect(socket.lastEmit(CLIENT_EVENTS.VOTE_RETRACT)).toBeDefined();
  });

  it("elegir otra carta la cambia sin retirarla", async () => {
    const hook = await enterRoom();

    await act(async () => {
      hook.result.current.vote("5");
    });
    await act(async () => {
      hook.result.current.vote("13");
    });

    expect(hook.result.current.myVote).toBe("13");
    expect(socket.lastEmit(CLIENT_EVENTS.VOTE_SUBMIT)?.payload).toEqual({
      value: "13",
    });
  });
});

describe("sesión", () => {
  it("guarda las credenciales para poder volver tras cerrar la pestaña", async () => {
    await enterRoom();
    // `localStorage`, no `sessionStorage`: éste se borra al cerrar la pestaña.
    expect(JSON.parse(localStorage.getItem("planincito:session")!)).toEqual(
      credentials,
    );
  });

  it("al arrancar con sesión guardada intenta reconectar", async () => {
    localStorage.setItem("planincito:session", JSON.stringify(credentials));

    const hook = renderHook(() => useRoom());
    expect(hook.result.current.booting).toBe(true);

    await waitFor(() => {
      expect(socket.lastEmit(CLIENT_EVENTS.ROOM_RECONNECT)?.payload).toEqual(
        credentials,
      );
    });
  });

  it("recupera la carta que el servidor devuelve al reconectar", async () => {
    localStorage.setItem("planincito:session", JSON.stringify(credentials));
    const hook = renderHook(() => useRoom());

    await act(async () => {
      socket.fire(SERVER_EVENTS.ROOM_STATE, {
        credentials,
        state: stateWith(),
        yourVote: "21",
      });
    });

    expect(hook.result.current.myVote).toBe("21");
    expect(hook.result.current.booting).toBe(false);
  });

  it("una sala inexistente limpia la sesión y avisa", async () => {
    localStorage.setItem("planincito:session", JSON.stringify(credentials));
    const hook = renderHook(() => useRoom());
    // El error llega como respuesta al reconnect, o sea ya conectados.
    await waitFor(() => {
      expect(socket.lastEmit(CLIENT_EVENTS.ROOM_RECONNECT)).toBeDefined();
    });

    await act(async () => {
      socket.fire(SERVER_EVENTS.ROOM_ERROR, {
        code: "ROOM_NOT_FOUND",
        message: "La sala ya no existe.",
      });
    });

    expect(hook.result.current.status).toBe("room-gone");
    expect(localStorage.getItem("planincito:session")).toBeNull();
  });

  it("recuerda el último alias usado", async () => {
    const hook = renderHook(() => useRoom());
    await act(async () => {
      hook.result.current.createRoom("  Arturo  ");
    });
    expect(localStorage.getItem("planincito:alias")).toBe("Arturo");
  });
});

describe("cuenta atrás al revelar", () => {
  it("revelar anuncia la cuenta y revela al terminar", async () => {
    const hook = await enterRoom();
    vi.useFakeTimers();
    try {
      act(() => {
        hook.result.current.reveal();
      });

      expect(socket.lastEmit(CLIENT_EVENTS.REVEAL_COUNTDOWN)?.payload).toEqual({
        seconds: 3,
      });
      // Antes de que pase el tiempo, nada de revelar.
      expect(socket.lastEmit(CLIENT_EVENTS.VOTES_REVEAL)).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // El aviso de cuenta atrás llega también al facilitador y en su día
      // cancelaba este mismo temporizador; debe seguir disparándose.
      expect(socket.lastEmit(CLIENT_EVENTS.VOTES_REVEAL)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("el aviso del servidor descuenta 3, 2, 1 y termina", async () => {
    vi.useFakeTimers();
    try {
      const hook = renderHook(() => useRoom());
      act(() => {
        socket.fire(SERVER_EVENTS.COUNTDOWN_STARTED, { seconds: 3 });
      });
      expect(hook.result.current.countdown).toBe(3);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(hook.result.current.countdown).toBe(2);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(hook.result.current.countdown).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("historial", () => {
  it("llega completo al entrar y crece ronda a ronda sin duplicar", async () => {
    const hook = renderHook(() => useRoom());
    const entry = (round: number) => ({
      round,
      topic: `Historia ${round}`,
      results: {
        average: 8,
        median: 8,
        distribution: [{ value: "8" as const, count: 1 }],
        totalVotes: 1,
      },
      votes: [{ alias: "Ana", vote: "8" as const }],
      revealedAt: 1,
    });

    await act(async () => {
      socket.fire(SERVER_EVENTS.ROOM_CREATED, {
        credentials,
        state: stateWith(),
        history: [entry(2), entry(1)],
      });
    });
    expect(hook.result.current.history).toHaveLength(2);

    await act(async () => {
      socket.fire(SERVER_EVENTS.VOTES_REVEALED, {
        state: stateWith({ status: "revealed", round: 3 }),
        entry: entry(3),
      });
    });
    expect(hook.result.current.history.map((h) => h.round)).toEqual([3, 2, 1]);

    // Revelar dos veces la misma ronda no debe duplicarla.
    await act(async () => {
      socket.fire(SERVER_EVENTS.VOTES_REVEALED, {
        state: stateWith({ status: "revealed", round: 3 }),
        entry: entry(3),
      });
    });
    expect(hook.result.current.history).toHaveLength(3);
  });
});

describe("frase de acceso", () => {
  it("un rechazo al crear pide la frase y no la deja guardada", async () => {
    localStorage.setItem("planincito:access", "frase-vieja");
    const hook = renderHook(() => useRoom());
    await act(async () => {
      hook.result.current.createRoom("Ana");
    });

    await act(async () => {
      socket.fire(SERVER_EVENTS.ROOM_ERROR, {
        code: "UNAUTHORIZED",
        message: "Necesitas la frase de acceso para crear una sala.",
      });
    });

    expect(hook.result.current.status).toBe("unauthorized");
    expect(localStorage.getItem("planincito:access")).toBeNull();
  });

  it("la frase sólo se guarda cuando la sala llega a crearse", async () => {
    const hook = renderHook(() => useRoom());
    await act(async () => {
      hook.result.current.createRoom("Ana");
    });

    await act(async () => {
      hook.result.current.submitAccessSecret("DISMAC");
    });
    // Enviada pero aún sin validar: no debe persistirse todavía.
    expect(localStorage.getItem("planincito:access")).toBeNull();

    await act(async () => {
      socket.fire(SERVER_EVENTS.ROOM_CREATED, { credentials, state: stateWith() });
    });
    expect(localStorage.getItem("planincito:access")).toBe("DISMAC");
  });
});
