# Planincito

Planning Poker

## Arquitectura

```text
GitHub Pages
└── Frontend React + Vite
          ↕ WebSocket seguro (WSS)
Render Free Web Service
└── Node.js + Express + Socket.IO
          └── Estado temporal en memoria (Map)
```

## Estructura

```text
client/   Frontend React + Vite
server/   Backend Node.js + Express + Socket.IO
shared/   Tipos y nombres de eventos compartidos
```

## Requisitos

Node.js 18.18 o superior.

## Instalación

```bash
npm install
```

Copia los archivos de ejemplo de variables de entorno:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Para desarrollo local, en `client/.env` usa `VITE_SOCKET_URL=http://localhost:3000`.

## Ejecución

```bash
npm run dev                    # backend y frontend a la vez
npm run dev --workspace server # sólo backend  (http://localhost:3000)
npm run dev --workspace client # sólo frontend (http://localhost:5173)
```

## Pruebas

```bash
npm test
```

Cubre generación de códigos, límites de sala, mecánica de votación, promedio y
mediana, transferencia de facilitador, limpieza de memoria y un conjunto de
pruebas de integración con clientes Socket.IO reales.

## Variables de entorno

### Backend

| Variable                            | Por defecto | Descripción                                     |
| ----------------------------------- | ----------- | ----------------------------------------------- |
| `PORT`                              | `3000`      | Puerto de escucha (Render lo asigna).           |
| `CLIENT_ORIGIN`                     | `*`         | Origen exacto del frontend, separado por comas. |
| `ROOM_ACCESS_SECRET`                | vacío       | Frase compartida. Vacía = acceso libre.         |
| `ACCESS_MAX_ATTEMPTS`               | `10`        | Intentos fallidos por IP antes de bloquear.     |
| `ACCESS_ATTEMPT_WINDOW_MS`          | `600000`    | Duración del bloqueo por fuerza bruta.          |
| `MAX_ACTIVE_ROOMS`                  | `25`        | Salas simultáneas permitidas.                   |
| `MAX_PARTICIPANTS_PER_ROOM`         | `8`         | Personas por sala.                              |
| `EMPTY_ROOM_GRACE_MS`               | `3600000`   | Margen antes de eliminar una sala sin nadie conectado. |
| `LONE_PARTICIPANT_GRACE_MS`         | `300000`    | Margen si la sala tiene una sola persona desconectada. |
| `MAX_ROUND_HISTORY`                 | `50`        | Rondas guardadas por sala en el historial.      |
| `DISCONNECTED_PARTICIPANT_GRACE_MS` | `3600000`   | Margen de reconexión de un participante.        |
| `MAX_EVENT_PAYLOAD_BYTES`           | `4096`      | Tamaño máximo por evento.                       |
| `RATE_LIMIT_MAX_EVENTS`             | `60`        | Eventos por socket dentro de la ventana.        |
| `RATE_LIMIT_WINDOW_MS`              | `5000`      | Duración de la ventana del límite.              |
| `CLEANUP_INTERVAL_MS`               | `15000`     | Frecuencia del barrido de limpieza.             |

### Frontend

| Variable          | Descripción                                            |
| ----------------- | ------------------------------------------------------ |
| `VITE_SOCKET_URL` | URL del backend en Render.                             |
| `VITE_BASE_PATH`  | Ruta base en GitHub Pages, `/NombreDelRepositorio/`.    |

## Despliegue

### Backend en Render Free

## Inactividad y reconexión

Un móvil con la pantalla bloqueada, o una pestaña en segundo plano, cierra el
WebSocket a los pocos segundos. Para que eso no expulse a nadie de una reunión
en curso, los márgenes son amplios:

- **Una hora** para volver a una sala donde quedan más personas
  (`DISCONNECTED_PARTICIPANT_GRACE_MS` y `EMPTY_ROOM_GRACE_MS`).
- **Cinco minutos** si la sala tiene una sola persona y está desconectada
  (`LONE_PARTICIPANT_GRACE_MS`): nadie más la está esperando, así que no tiene
  sentido reservar memoria una hora.

Salir con el botón *Salir* es inmediato y no espera ningún margen.

## Tema claro y oscuro

Arranca siguiendo la preferencia del sistema y se cambia con el botón del
encabezado. La elección se recuerda en el navegador; mientras no se elija a
mano, la aplicación sigue los cambios del sistema.

## Roles

Ser **facilitador** es independiente de jugar o mirar. Quien crea la sala puede
marcar *espectador* desde el inicio y seguir revelando y reiniciando rondas.

Cualquiera puede pasar a espectador y volver a jugar desde la barra inferior,
sin pedir permiso a nadie. Pasar a espectador retira el voto de la ronda en
curso. El facilitador, además, puede cambiar el rol de otras personas.

## Lanzar objetos

Mientras alguien no haya votado, su carta se puede pulsar (o basta pasar el
ratón en escritorio) para lanzarle un avioncito de papel, una bola de papel,
un tomate, una piedra o una flecha.

Los objetos entran en andanada desde ambos laterales y convergen en la carta
del destinatario: los tomates se aplastan al impactar, las flechas se clavan y
el resto rebota y queda a los pies de la carta. Lo ven todos los de la sala.

Es un gesto puramente visual: no toca el estado de la sala ni queda registrado.
El servidor sólo comprueba que la persona siga dentro, no sea espectador y no
haya votado todavía.

## Historial de rondas

Cada ronda revelada queda registrada con su tema, sus estadísticas y la carta de
cada participante. Se consulta desde el botón *Historial* del encabezado, que
abre un panel lateral —igual que *Participantes*—: así no ocupan sitio en la
sala ni obligan a desplazarse perdiendo de vista la mesa. Lo ven todos, no sólo el facilitador, y el alias se
conserva aunque esa persona se haya ido.

**Dura lo que dura la sala.** Vive en el mismo `Map` en memoria: si la sala se
cierra por quedar vacía, o si Render reinicia el servicio, el historial se pierde
con ella. No hay persistencia, en línea con el alcance del proyecto.

Se guardan como máximo `MAX_ROUND_HISTORY` rondas (50 por defecto); al superarlo
se descartan las más antiguas para que la memoria no crezca sin límite.
