# aurora-mcp

Servidor MCP (Model Context Protocol) mínimo, en TypeScript/Node.js, para
validar el protocolo de extremo a extremo antes de construir nada más
complejo (sin base de datos, sin HTTP, sin integraciones todavía).

Usa el SDK oficial v2 del protocolo (`@modelcontextprotocol/server`), con
transporte **stdio** — pensado solo para pruebas locales, lanzando el
servidor como proceso hijo desde un cliente MCP (Claude Desktop, el MCP
Inspector, etc.).

## Herramienta expuesta

Únicamente `crear_tarea`:

- **Parámetro**: `titulo` (string)
- **Devuelve**: el texto `Tarea de prueba creada: <titulo>`

No hay persistencia real ni lógica de negocio: es solo para comprobar que
el handshake y las llamadas a herramientas funcionan.

## Requisitos

- Node.js ≥ 20

## Instalación

```bash
npm install
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
lanzarse sueltos en una terminal esperando ver algo en pantalla: hace
falta un cliente MCP hablando por stdin/stdout.

## Probarlo con el MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

(o `npx @modelcontextprotocol/inspector npx tsx src/index.ts` para probar
directamente sobre TypeScript sin compilar antes).

Esto abre una UI web donde se puede:

1. Ver la herramienta `crear_tarea` en la lista de herramientas.
2. Invocarla con un `titulo` de prueba.
3. Comprobar que la respuesta es `Tarea de prueba creada: <titulo>`.

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
