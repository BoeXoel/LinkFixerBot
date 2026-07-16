import { handleMessage } from './handle-message.js';

/**
 * Dispatch a Telegram Update object.
 * @param {object} update
 * @param {object} ctx
 */
export async function handleUpdate(update, ctx) {
  if (!update) return;

  // Prefer message; also handle channel posts with text links if needed later
  const message = update.message || update.edited_message;
  if (message) {
    await handleMessage(message, ctx);
  }
}
