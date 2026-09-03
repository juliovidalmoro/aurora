import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

/**
 * Servidor MCP mínimo para validar el protocolo de extremo a extremo.
 * Expone una única herramienta de prueba (`crear_tarea`) sin lógica real:
 * ni base de datos, ni red, ni integración con nada externo todavía.
 */
function buildServer(): McpServer {
  const server = new McpServer({ name: 'secretaria-mcp', version: '0.1.0' });

  server.registerTool(
    'crear_tarea',
    {
      title: 'Crear tarea (prueba)',
      description:
        'Herramienta de prueba: simula la creación de una tarea devolviendo un texto de confirmación. Sin persistencia real.',
      inputSchema: z.object({
        titulo: z.string().describe('Título de la tarea a crear'),
      }),
    },
    async ({ titulo }) => {
      return {
        content: [{ type: 'text', text: `Tarea de prueba creada: ${titulo}` }],
      };
    },
  );

  return server;
}

const handle = serveStdio(buildServer);

console.error('secretaria-mcp: servidor MCP escuchando en stdio');

process.on('SIGINT', () => {
  void handle.close().then(() => process.exit(0));
});
