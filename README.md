# Planincito

Planning Poker temporal y en tiempo real para equipos de hasta 8 personas.
Sin cuentas, sin base de datos y sin historial: una sala vive en memoria
mientras haya participantes y se elimina 60 segundos después de quedar vacía.

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
| `EMPTY_ROOM_GRACE_MS`               | `60000`     | Margen antes de eliminar una sala vacía.        |
| `DISCONNECTED_PARTICIPANT_GRACE_MS` | `60000`     | Margen de reconexión de un participante.        |
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

El repositorio incluye [`render.yaml`](render.yaml). Si prefieres configurarlo a
mano en el panel:

```text
Root directory:     (raíz del repositorio)
Build command:      npm ci && npm run build:server
Start command:      npm start --workspace server
Health check path:  /health
```

> El plan original preveía `Root directory: server`, pero el backend importa el
> paquete `shared/`, que vive fuera de esa carpeta. Construir desde la raíz del
> monorepo es lo que hace que `npm ci` resuelva el workspace; `tsup` empaqueta
> `shared` dentro de `dist/server.js`, así que en producción sigue siendo un solo
> archivo sin dependencias del workspace.

Configura `CLIENT_ORIGIN` con la URL exacta de GitHub Pages,
por ejemplo `https://usuario.github.io`.

### Frontend en GitHub Pages

1. En **Settings → Pages**, elige *GitHub Actions* como origen.
2. En **Settings → Secrets and variables → Actions → Variables**, crea
   `VITE_SOCKET_URL` con la URL del servicio de Render.
3. Haz push a `main`: el workflow
   [`deploy-pages.yml`](.github/workflows/deploy-pages.yml) publica el sitio.

El enlace de invitación usa hash para no depender de reescrituras del servidor:

```text
https://aragondev.github.io/PlanincitoBasico/#/room/ABC123
```

## Acceso restringido

El sitio publicado es accesible para cualquiera, pero sin la frase compartida no
se puede abrir la conexión con el backend y la aplicación no sirve de nada.

Define `ROOM_ACCESS_SECRET` en Render con una frase larga y compártela con el
equipo. Se pide una sola vez por navegador y queda en `localStorage`.

```bash
ROOM_ACCESS_SECRET="una-frase-larga-y-dificil-de-adivinar"
```

La comprobación ocurre en el handshake de Socket.IO, antes de cualquier handler,
así que un cliente sin la frase no puede crear ni entrar a salas. Los intentos
fallidos se limitan por IP (`ACCESS_MAX_ATTEMPTS` en `ACCESS_ATTEMPT_WINDOW_MS`)
para que una frase corta no se pueda adivinar por fuerza bruta.

Si dejas la variable vacía —lo habitual en desarrollo local— no hay restricción.

**Qué protege y qué no.** Es una clave compartida, no autenticación por persona:
cualquiera que la reciba puede pasarla a otro, y no hay forma de revocar el
acceso a una sola persona salvo cambiando la frase para todos. Suficiente para
mantener afuera a desconocidos; insuficiente si necesitas saber quién entró.

## Limitaciones conocidas

- **Reinicios de Render eliminan las salas.** Viven en memoria; es una decisión
  del alcance sin persistencia. Antes de cerrar, el servidor avisa a los clientes
  con `server:restarting` y estos ofrecen crear una sala nueva.
- **Arranque en frío.** Tras 15 minutos sin tráfico, Render suspende el servicio.
  El frontend muestra `Iniciando servidor…` y reintenta con espera progresiva
  (1 s → 2 s → 4 s → 8 s → máx. 15 s) en lugar de mostrar un error definitivo.
- **Una sola instancia.** El estado en `Map` no se sincroniza. Escalar a varias
  instancias exigiría mover el estado a Redis o equivalente.
