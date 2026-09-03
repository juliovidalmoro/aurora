import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { db, type Tarea } from './db.js';
import { getLastChatId, sendTelegramMessage } from './telegram.js';

/**
 * Servidor MCP de gestión de tareas (persistidas en SQLite) y envío de
 * notificaciones por Telegram. Expone crear_tarea, listar_tareas,
 * completar_tarea, obtener_chat_id_pendiente y enviar_telegram.
 */
function buildServer(): McpServer {
  const server = new McpServer({ name: 'aurora-mcp', version: '0.2.0' });

  const insertTarea = db.prepare(
    `INSERT INTO tareas (titulo, descripcion, fecha_limite, estado, creada_en)
     VALUES (@titulo, @descripcion, @fecha_limite, 'pendiente', @creada_en)`,
  );

  const listarTodas = db.prepare<[], Tarea>(
    `SELECT * FROM tareas
     ORDER BY (fecha_limite IS NULL) ASC, fecha_limite ASC, creada_en ASC`,
  );

  const listarPendientes = db.prepare<[], Tarea>(
    `SELECT * FROM tareas
     WHERE estado = 'pendiente'
     ORDER BY (fecha_limite IS NULL) ASC, fecha_limite ASC, creada_en ASC`,
  );

  const completarTarea = db.prepare(
    `UPDATE tareas SET estado = 'hecha' WHERE id = ?`,
  );

  server.registerTool(
    'crear_tarea',
    {
      title: 'Crear tarea',
      description: 'Crea una nueva tarea pendiente y la persiste en SQLite.',
      inputSchema: z.object({
        titulo: z.string().min(1).describe('Título de la tarea'),
        descripcion: z.string().optional().describe('Descripción opcional de la tarea'),
        fecha_limite: z
          .string()
          .optional()
          .describe('Fecha límite opcional en formato ISO 8601 (p. ej. 2026-09-10)'),
      }),
    },
    async ({ titulo, descripcion, fecha_limite }) => {
      const creada_en = new Date().toISOString();
      const result = insertTarea.run({
        titulo,
        descripcion: descripcion ?? null,
        fecha_limite: fecha_limite ?? null,
        creada_en,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Tarea creada (id ${result.lastInsertRowid}): "${titulo}"`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'listar_tareas',
    {
      title: 'Listar tareas',
      description:
        'Lista las tareas guardadas, ordenadas por fecha límite y luego por fecha de creación.',
      inputSchema: z.object({
        solo_pendientes: z
          .boolean()
          .optional()
          .describe('Si es true, devuelve solo las tareas pendientes (excluye las hechas)'),
      }),
    },
    async ({ solo_pendientes }) => {
      const tareas = solo_pendientes ? listarPendientes.all() : listarTodas.all();

      if (tareas.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: solo_pendientes ? 'No hay tareas pendientes.' : 'No hay tareas registradas.',
            },
          ],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(tareas, null, 2) }],
      };
    },
  );

  server.registerTool(
    'completar_tarea',
    {
      title: 'Completar tarea',
      description: "Marca una tarea existente como 'hecha' por su id.",
      inputSchema: z.object({
        id: z.number().int().describe('id de la tarea a completar'),
      }),
    },
    async ({ id }) => {
      const result = completarTarea.run(id);

      if (result.changes === 0) {
        return {
          content: [{ type: 'text', text: `No existe ninguna tarea con id ${id}.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Tarea ${id} marcada como hecha.` }],
      };
    },
  );

  server.registerTool(
    'obtener_chat_id_pendiente',
    {
      title: 'Obtener chat_id pendiente de Telegram',
      description:
        'Herramienta temporal de configuración (no definitiva): devuelve el chat_id del último ' +
        'mensaje que le ha llegado al bot de Telegram. Escríbele cualquier mensaje al bot desde ' +
        'Telegram y luego llama a este tool para consultarlo.',
      inputSchema: z.object({}),
    },
    async () => {
      const chatId = getLastChatId();

      if (chatId === null) {
        return {
          content: [
            {
              type: 'text',
              text:
                'Todavía no ha llegado ningún mensaje al bot. Escríbele cualquier cosa desde ' +
                'Telegram y vuelve a llamar a este tool.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `chat_id: ${chatId}. Guárdalo como TELEGRAM_CHAT_ID en tu .env.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'enviar_telegram',
    {
      title: 'Enviar mensaje de Telegram',
      description: 'Envía un mensaje de texto al chat de Telegram configurado (TELEGRAM_CHAT_ID).',
      inputSchema: z.object({
        mensaje: z.string().min(1).describe('Texto del mensaje a enviar'),
      }),
    },
    async ({ mensaje }) => {
      try {
        await sendTelegramMessage(mensaje);
        return {
          content: [{ type: 'text', text: 'Mensaje enviado a Telegram.' }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `No se pudo enviar el mensaje: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

const handle = serveStdio(buildServer);

console.error('aurora-mcp: servidor MCP escuchando en stdio');

process.on('SIGINT', () => {
  void handle.close().then(() => process.exit(0));
});
