import type { Env, NotificationMessage } from "../types";

export async function processNotificationBatch(
  batch: MessageBatch<NotificationMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await handleNotification(message.body, env);
      message.ack();
    } catch (e) {
      console.error("Notification failed:", e);
      message.retry();
    }
  }
}

async function handleNotification(msg: NotificationMessage, env: Env): Promise<void> {
  const logKey = `notify:${msg.type}:${Date.now()}`;
  await env.CACHE.put(logKey, JSON.stringify({ ...msg, processedAt: new Date().toISOString() }), {
    expirationTtl: 86400 * 7,
  });

  switch (msg.type) {
    case "order_confirmation":
      console.log(`[NOTIFY] Order confirmation → ${msg.phone}: ${msg.message}`);
      break;
    case "stock_alert":
      console.log(`[NOTIFY] Stock alert → ${msg.productId}: ${msg.message}`);
      break;
    case "restock_notify":
      console.log(`[NOTIFY] Restock → ${msg.message}`);
      break;
  }

  // Phase 2 extension: integrate Twilio/WhatsApp/email provider here
  // await sendWhatsApp(env, msg.phone, msg.message);
}
