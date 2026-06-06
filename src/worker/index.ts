import type { Env } from "./types";
import { error, json } from "./lib/utils";
import { handlePublicApi } from "./routes/public";
import { handleAdminApi } from "./routes/admin";
import { handleMetaCapi } from "./routes/meta";
import { processNotificationBatch } from "./queue";
import type { NotificationMessage } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const handlers = [
        () => handlePublicApi(request, url, env, ctx),
        () => handleAdminApi(request, url, env),
        () => handleMetaCapi(request, env),
      ];

      for (const handler of handlers) {
        const response = await handler();
        if (response) return response;
      }

      return error("Not found", 404);
    }

    return env.ASSETS.fetch(request);
  },

  async queue(batch: MessageBatch<NotificationMessage>, env: Env): Promise<void> {
    await processNotificationBatch(batch, env);
  },
};

export type { Env };
