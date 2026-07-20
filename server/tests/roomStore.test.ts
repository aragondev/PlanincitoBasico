import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoomStore } from "../src/rooms/roomStore.js";

const GRACE = 60_000;

let clock = 1_000_000;
const now = () => clock;

function createStore(overrides: Partial<ConstructorParameters<typeof RoomStore>[0]> = {}) {
  return new RoomStore({
    maxActiveRooms: 25,
    maxParticipantsPerRoom: 8,
    emptyRoomGraceMs: GRACE,
    disconnectedParticipantGraceMs: GRACE,
    now,
    ...overrides,
  });
}

beforeEach(() => {
  clock = 1_000_000;
});

describe("creación y acceso", () => {
  it("el creador recibe el rol de facilitador", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    expect(participant.role).toBe("facilitator");
    expect(room.facilitatorId).toBe(participant.id);
    expect(room.status).toBe("voting");
    expect(room.round).toBe(1);
  });

  it("localiza la sala por código sin recorrer todas", () => {
    const store = createStore();
    const { room } = store.createRoom("Ana");
    expect(store.getRoomByCode(room.code)?.id).toBe(room.id);
    expect(store.getRoomByCode("ZZZZZZ")).toBeUndefined();
  });

  it("aplica el límite de 8 participantes y rechaza al noveno", () => {
    const store = createStore();
    const { room } = store.createRoom("Ana");
    for (let index = 0; index < 7; index += 1) {
      store.joinRoom(room.code, `Jugador ${index}`);
    }
    expect(room.participants.size).toBe(8);
    expect(() => store.joinRoom(room.code, "Noveno")).toThrowError(/llena/i);
  });

  it("aplica el límite de salas activas", () => {
    const store = createStore({ maxActiveRooms: 2 });
    store.createRoom("A");
    store.createRoom("B");
    expect(() => store.createRoom("C")).toThrowError(/salas disponibles/i);
  });

  it("diferencia alias repetidos en lugar de bloquear el acceso", () => {
    const store = createStore();
    const { room } = store.createRoom("Ana");
    expect(store.joinRoom(room.code, "Ana").participant.alias).toBe("Ana (2)");
    expect(store.joinRoom(room.code, "Ana").participant.alias).toBe("Ana (3)");
  });

  it("rechaza entrar a una sala inexistente", () => {
    expect(() => createStore().joinRoom("ABCDEF", "Ana")).toThrowError(/ya no existe/i);
  });
});

describe("votación", () => {
  it("permite seleccionar y cambiar la carta mientras la ronda esté abierta", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.submitVote(room.code, participant.id, "5");
    store.submitVote(room.code, participant.id, "8");
    expect(room.votes.get(participant.id)).toBe("8");
  });

  it("no deja votar a un espectador", () => {
    const store = createStore();
    const { room } = store.createRoom("Ana");
    const spectator = store.joinRoom(room.code, "Bea", true).participant;
    expect(() => store.submitVote(room.code, spectator.id, "5")).toThrowError(
      /espectadores/i,
    );
  });

  it("no deja votar después de revelar", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.reveal(room.code, participant.id);
    expect(() => store.submitVote(room.code, participant.id, "3")).toThrowError(
      /revelada/i,
    );
  });

  it("solo el facilitador revela o reinicia", () => {
    const store = createStore();
    const { room } = store.createRoom("Ana");
    const other = store.joinRoom(room.code, "Bea").participant;
    expect(() => store.reveal(room.code, other.id)).toThrowError(/facilitador/i);
    expect(() => store.restartRound(room.code, other.id)).toThrowError(/facilitador/i);
  });

  it("la nueva ronda borra votos, vuelve a votando y avanza el contador", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.submitVote(room.code, participant.id, "5");
    store.reveal(room.code, participant.id);
    store.restartRound(room.code, participant.id);
    expect(room.votes.size).toBe(0);
    expect(room.status).toBe("voting");
    expect(room.round).toBe(2);
  });

  it("la nueva ronda conserva el tema salvo que se envíe uno nuevo", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.setTopic(room.code, participant.id, "Historia 12");
    store.restartRound(room.code, participant.id);
    expect(room.topic).toBe("Historia 12");
    store.restartRound(room.code, participant.id, "Historia 13");
    expect(room.topic).toBe("Historia 13");
  });
});

describe("estado público", () => {
  it("oculta los valores antes de revelar y los muestra después", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.submitVote(room.code, participant.id, "5");

    const hidden = store.buildPublicState(room).participants[0]!;
    expect(hidden.hasVoted).toBe(true);
    expect(hidden.vote).toBeUndefined();
    expect(store.buildPublicState(room).results).toBeNull();

    store.reveal(room.code, participant.id);
    const shown = store.buildPublicState(room).participants[0]!;
    expect(shown.vote).toBe("5");
    expect(store.buildPublicState(room).results?.average).toBe(5);
  });

  it("nunca expone el token de reconexión", () => {
    const store = createStore();
    const { room } = store.createRoom("Ana");
    const serialized = JSON.stringify(store.buildPublicState(room));
    expect(serialized).not.toContain(
      room.participants.values().next().value!.token,
    );
  });
});

describe("facilitador y desconexiones", () => {
  it("conserva el rol del facilitador mientras dure el margen de reconexión", () => {
    const store = createStore();
    const { room, participant: ana } = store.createRoom("Ana");
    store.joinRoom(room.code, "Bea");

    store.markDisconnected(room.code, ana.id);
    clock += GRACE - 1;
    store.sweep();

    expect(room.facilitatorId).toBe(ana.id);
  });

  it("transfiere el rol al jugador conectado más antiguo al expirar el margen", () => {
    const store = createStore();
    const { room, participant: ana } = store.createRoom("Ana");
    clock += 10;
    const bea = store.joinRoom(room.code, "Bea").participant;
    clock += 10;
    store.joinRoom(room.code, "Caro");

    store.markDisconnected(room.code, ana.id);
    clock += GRACE;
    store.sweep();

    expect(room.facilitatorId).toBe(bea.id);
    expect(room.participants.get(bea.id)?.role).toBe("facilitator");
    expect(room.participants.has(ana.id)).toBe(false);
  });

  it("si solo quedan espectadores, el más antiguo recibe el rol", () => {
    const store = createStore();
    const { room, participant: ana } = store.createRoom("Ana");
    clock += 10;
    const spectator = store.joinRoom(room.code, "Bea", true).participant;

    store.markDisconnected(room.code, ana.id);
    clock += GRACE;
    store.sweep();

    expect(room.facilitatorId).toBe(spectator.id);
  });

  it("la transferencia manual degrada al facilitador anterior a jugador", () => {
    const store = createStore();
    const { room, participant: ana } = store.createRoom("Ana");
    const bea = store.joinRoom(room.code, "Bea").participant;
    store.transferFacilitator(room.code, ana.id, bea.id);
    expect(room.facilitatorId).toBe(bea.id);
    expect(room.participants.get(ana.id)?.role).toBe("player");
  });

  it("una reconexión dentro del margen recupera lugar, rol y voto", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.joinRoom(room.code, "Bea");
    store.submitVote(room.code, participant.id, "8");

    store.markDisconnected(room.code, participant.id);
    clock += GRACE - 1;
    store.sweep();

    const recovered = store.reconnect(room.code, participant.id, participant.token);
    expect(recovered.participant.connected).toBe(true);
    expect(room.votes.get(participant.id)).toBe("8");
  });

  it("rechaza la reconexión con token incorrecto", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    expect(() => store.reconnect(room.code, participant.id, "token-falso")).toThrowError(
      /recuperar tu lugar/i,
    );
  });

  it("elimina al participante desconectado pasado el margen", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    const bea = store.joinRoom(room.code, "Bea").participant;

    store.markDisconnected(room.code, bea.id);
    clock += GRACE;
    store.sweep();

    expect(room.participants.has(bea.id)).toBe(false);
    expect(room.participants.has(participant.id)).toBe(true);
  });

  it("expulsar elimina al participante y su voto", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    const bea = store.joinRoom(room.code, "Bea").participant;
    store.submitVote(room.code, bea.id, "3");

    store.kick(room.code, participant.id, bea.id);
    expect(room.participants.has(bea.id)).toBe(false);
    expect(room.votes.has(bea.id)).toBe(false);
  });
});

describe("historial de rondas", () => {
  it("guarda cada ronda revelada con tema, resultados y votos", () => {
    const store = createStore();
    const { room, participant: ana } = store.createRoom("Ana");
    const bea = store.joinRoom(room.code, "Bea").participant;

    store.setTopic(room.code, ana.id, "Historia 1");
    store.submitVote(room.code, ana.id, "3");
    store.submitVote(room.code, bea.id, "5");
    store.reveal(room.code, ana.id);

    expect(room.history).toHaveLength(1);
    const entrada = room.history[0]!;
    expect(entrada.round).toBe(1);
    expect(entrada.topic).toBe("Historia 1");
    expect(entrada.results.average).toBe(4);
    expect(entrada.votes).toEqual([
      { alias: "Ana", vote: "3" },
      { alias: "Bea", vote: "5" },
    ]);
  });

  it("acumula rondas con la más reciente primero", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");

    for (const carta of ["1", "2", "3"] as const) {
      store.submitVote(room.code, participant.id, carta);
      store.reveal(room.code, participant.id);
      store.restartRound(room.code, participant.id);
    }

    expect(room.history.map((h) => h.round)).toEqual([3, 2, 1]);
    expect(room.history[0]!.results.average).toBe(3);
  });

  it("revelar dos veces la misma ronda no duplica la entrada", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.submitVote(room.code, participant.id, "5");
    store.reveal(room.code, participant.id);
    store.reveal(room.code, participant.id);
    expect(room.history).toHaveLength(1);
  });

  it("conserva el alias aunque el participante se haya ido", () => {
    const store = createStore();
    const { room, participant: ana } = store.createRoom("Ana");
    const bea = store.joinRoom(room.code, "Bea").participant;
    store.submitVote(room.code, bea.id, "8");
    store.reveal(room.code, ana.id);

    store.kick(room.code, ana.id, bea.id);
    expect(room.participants.has(bea.id)).toBe(false);
    expect(room.history[0]!.votes).toEqual([{ alias: "Bea", vote: "8" }]);
  });

  it("el historial no crece más allá del tope configurado", () => {
    const store = createStore({ maxRoundHistory: 3 });
    const { room, participant } = store.createRoom("Ana");

    for (let i = 0; i < 10; i += 1) {
      store.submitVote(room.code, participant.id, "5");
      store.reveal(room.code, participant.id);
      store.restartRound(room.code, participant.id);
    }

    expect(room.history).toHaveLength(3);
    expect(room.history.map((h) => h.round)).toEqual([10, 9, 8]);
  });

  it("el estado público incluye el historial", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.submitVote(room.code, participant.id, "13");
    store.reveal(room.code, participant.id);
    expect(store.buildPublicState(room).history).toHaveLength(1);
  });

  it("una ronda sin votos numéricos queda registrada sin promedio", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.submitVote(room.code, participant.id, "coffee");
    store.reveal(room.code, participant.id);
    expect(room.history[0]!.results.average).toBeNull();
    expect(room.history[0]!.votes).toEqual([{ alias: "Ana", vote: "coffee" }]);
  });
});

describe("limpieza de salas", () => {
  it("mantiene la sala si alguien vuelve dentro del margen", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    store.markDisconnected(room.code, participant.id);

    clock += GRACE - 1;
    store.sweep();
    store.reconnect(room.code, participant.id, participant.token);

    clock += GRACE * 2;
    store.sweep();
    expect(store.getRoomByCode(room.code)).toBeDefined();
  });

  it("elimina la sala vacía pasado el margen y libera el índice por código", () => {
    const store = createStore();
    const { room, participant } = store.createRoom("Ana");
    const closed = vi.fn();
    store.on("room-closed", closed);

    store.markDisconnected(room.code, participant.id);
    clock += GRACE;
    store.sweep();

    expect(store.getRoomByCode(room.code)).toBeUndefined();
    expect(store.size).toBe(0);
    expect(closed).toHaveBeenCalledOnce();
  });

  it("la memoria vuelve a cero tras crear y destruir salas repetidamente", () => {
    const store = createStore();
    const salas: { history: unknown[] }[] = [];
    for (let cycle = 0; cycle < 200; cycle += 1) {
      const { room, participant } = store.createRoom("Ana");
      salas.push(room);
      store.joinRoom(room.code, "Bea");
      store.submitVote(room.code, participant.id, "5");
      store.reveal(room.code, participant.id);
      for (const id of [...room.participants.keys()]) {
        store.markDisconnected(room.code, id);
      }
      clock += GRACE;
      store.sweep();
    }
    expect(store.size).toBe(0);
    // El historial también debe liberarse al cerrar la sala (§3.6).
    expect(salas.every((room) => room.history.length === 0)).toBe(true);
  });

  it("deja de aceptar salas nuevas durante el cierre", () => {
    const store = createStore();
    store.stopAcceptingNewRooms();
    expect(() => store.createRoom("Ana")).toThrowError(/reiniciando/i);
  });
});
