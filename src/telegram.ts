import { Bot } from 'grammy';

/**
 * Integración con Telegram (grammY). Se activa solo si TELEGRAM_BOT_TOKEN
 * está configurado en el entorno; si no, los tools de Telegram devuelven un
 * error claro en vez de romper el resto del servidor (los tools de tareas
 * siguen funcionando igualmente).
 */
const token = process.env.TELEGRAM_BOT_TOKEN;

let bot: Bot | null = null;

/**
 * chat_id del último mensaje que le ha escrito alguien al bot. Solo se usa
 * para la configuración inicial (obtener_chat_id_pendiente); vive en
 * memoria, no se persiste.
 */
let lastChatId: number | null = null;

if (token) {
  bot = new Bot(token);

  bot.on('message', (ctx) => {
    lastChatId = ctx.chat.id;
    console.error(`aurora-mcp: mensaje de Telegram recibido, chat_id=${ctx.chat.id}`);
  });

  bot.start({
    onStart: () => {
      console.error('aurora-mcp: bot de Telegram escuchando actualizaciones (polling)');
    },
  }).catch((err) => {
    console.error('aurora-mcp: error al iniciar el bot de Telegram:', err);
  });
} else {
  console.error(
    'aurora-mcp: TELEGRAM_BOT_TOKEN no configurado (.env) — los tools de Telegram devolverán error hasta que se configure',
  );
}

export function getLastChatId(): number | null {
  return lastChatId;
}

export async function sendTelegramMessage(mensaje: string): Promise<void> {
  if (!bot) {
    throw new Error('TELEGRAM_BOT_TOKEN no está configurado en .env');
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    throw new Error(
      'TELEGRAM_CHAT_ID no está configurado en .env (usa el tool obtener_chat_id_pendiente para obtenerlo)',
    );
  }

  await bot.api.sendMessage(chatId, mensaje);
}
