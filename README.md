# aurora-mcp

Servidor MCP (Model Context Protocol) en TypeScript/Node.js con gestión de
tareas persistida en SQLite (vía `better-sqlite3`) y envío de mensajes de
Telegram (vía `grammY`).

Usa el SDK oficial v2 del protocolo (`@modelcontextprotocol/server`), con
transporte **stdio** — pensado solo para uso local, lanzando el servidor
como proceso hijo desde un cliente MCP (Claude Desktop, el MCP Inspector,
etc.). Sin transporte HTTP todavía.

## Persistencia

Las tareas se guardan en un archivo SQLite local: `data/tareas.db` (fuera
de control de versiones — se crea automáticamente en el primer arranque si
no existe).

### ¿Por qué `better-sqlite3` y no `node:sqlite`?

Node 22 incluye el módulo nativo `node:sqlite`, pero al cargarlo emite:

```
ExperimentalWarning: SQLite is an experimental feature and might change at any time
```

Sigue siendo experimental (verificado en tiempo de ejecución en esta
versión de Node), así que para esta primera funcionalidad real se usa
`better-sqlite3`: una librería madura, de API síncrona (sin
callbacks/promesas, más simple para lógica de negocio corta como esta) y
ampliamente usada en producción.

### Tabla `tareas`

```sql
CREATE TABLE tareas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_limite TEXT,                              -- ISO 8601, opcional
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'hecha')),
  creada_en TEXT NOT NULL                         -- ISO 8601, automático
);
```

## Herramientas expuestas

### `crear_tarea`

- **Parámetros**: `titulo` (string, requerido), `descripcion` (string,
  opcional), `fecha_limite` (string ISO 8601, opcional)
- **Efecto**: inserta la tarea con `estado = 'pendiente'` y
  `creada_en` = fecha/hora actual
- **Devuelve**: texto de confirmación con el id creado, p. ej.
  `Tarea creada (id 3): "Comprar leche"`

### `listar_tareas`

- **Parámetros**: `solo_pendientes` (boolean, opcional) — si es `true`,
  excluye las tareas en estado `hecha`
- **Devuelve**: la lista de tareas (JSON), ordenadas por `fecha_limite`
  ascendente (las que no tienen fecha límite van al final) y, a igualdad
  de fecha, por `creada_en`

### `completar_tarea`

- **Parámetros**: `id` (number, requerido)
- **Efecto**: cambia el `estado` de esa tarea a `'hecha'`
- **Devuelve**: confirmación, o un error claro (`isError: true`) si no
  existe ninguna tarea con ese id — nunca falla en silencio

## Telegram

Los mensajes se envían con [grammY](https://grammy.dev) (SDK oficial de la
comunidad más activamente mantenido para el Bot API de Telegram: última
versión publicada hace apenas unos días frente a las últimas versiones
mucho más antiguas de alternativas como `telegraf`, verificado en el
registro de npm antes de elegir).

### Configuración (`.env`)

1. Copia `.env.example` a `.env`:

   ```bash
   cp .env.example .env
   ```

2. Crea un bot con [@BotFather](https://t.me/BotFather) en Telegram y copia
   el token que te da a `TELEGRAM_BOT_TOKEN` en `.env`.

3. Arranca el servidor (`npm run dev`) y, desde tu cliente MCP, llama al
   tool `obtener_chat_id_pendiente`. Si aún no devuelve nada, escríbele
   **cualquier mensaje** al bot desde tu Telegram y vuelve a llamar al
   tool: te devolverá tu `chat_id`.

4. Pega ese `chat_id` en `TELEGRAM_CHAT_ID` en `.env` y reinicia el
   servidor. A partir de aquí ya puedes usar `enviar_telegram`.

`.env` nunca se sube al repositorio (está en `.gitignore`) — solo
`.env.example`, que se mantiene vacío como plantilla.

### Herramientas de Telegram

#### `obtener_chat_id_pendiente`

Herramienta **temporal**, solo para la configuración inicial (no forma
parte de la funcionalidad definitiva). Sin parámetros. Devuelve el
`chat_id` del último mensaje que le ha llegado al bot, o un aviso de que
aún no ha llegado ninguno.

#### `enviar_telegram`

- **Parámetros**: `mensaje` (string, requerido)
- **Efecto**: envía ese texto al chat de `TELEGRAM_CHAT_ID`
- **Devuelve**: confirmación, o un error claro (`isError: true`) si falta
  `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` en `.env` o si falla el envío —
  nunca falla en silencio ni tira abajo el resto del servidor (los tools
  de tareas siguen funcionando igual aunque Telegram no esté configurado)

## Requisitos

- Node.js ≥ 20

## Instalación

```bash
npm install
cp .env.example .env   # y rellena TELEGRAM_BOT_TOKEN (ver sección Telegram)
```

## Ejecución en local

Modo desarrollo (TypeScript directo, sin compilar):

```bash
npm run dev
```

O compilando primero a JavaScript:

```bash
npm run build
npm start
```

El proceso escribe únicamente en `stderr` un mensaje de arranque
(`aurora-mcp: servidor MCP escuchando en stdio`); `stdout` queda
reservado para los mensajes JSON-RPC del protocolo, así que no debe
lanzarse suelto en una terminal esperando ver algo en pantalla: hace
falta un cliente MCP hablando por stdin/stdout.

## Probarlo con el MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

(o `npx @modelcontextprotocol/inspector npx tsx src/index.ts` para probar
directamente sobre TypeScript sin compilar antes).

Esto abre una UI web donde se puede, en orden:

1. Llamar a `crear_tarea` un par de veces (con distintos `titulo` y
   `fecha_limite`) y comprobar que cada respuesta trae un id.
2. Llamar a `listar_tareas` con `solo_pendientes: true` y comprobar que
   aparecen las tareas creadas, ordenadas por `fecha_limite`.
3. Llamar a `completar_tarea` con el `id` de una de ellas y comprobar la
   confirmación (y que con un `id` inexistente devuelve un error claro).
4. Volver a llamar a `listar_tareas` con `solo_pendientes: true` y
   comprobar que la tarea completada ya no aparece.
5. (Con `.env` configurado) Llamar a `enviar_telegram` con un `mensaje` de
   prueba y comprobar en tu Telegram que ha llegado.

## Configurarlo en un cliente MCP (p. ej. Claude Desktop)

```json
{
  "mcpServers": {
    "aurora-mcp": {
      "command": "node",
      "args": ["/ruta/absoluta/a/aurora-mcp/dist/index.js"]
    }
  }
}
```

(Requiere haber ejecutado antes `npm run build`.)

## Flujo de contribución

Los cambios se desarrollan en una rama a partir de `main` y se integran vía
Pull Request (revisión + merge), en lugar de hacer push directo a `main`.
