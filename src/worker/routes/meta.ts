import type { Env } from "../types";
import { error, json, parseJson } from "../lib/utils";

interface CapiPayload {
  event_name: string;
  event_id: string;
  event_time: number;
  custom_data?: Record<string, unknown>;
  action_source?: string;
  user_data?: Record<string, unknown>;
}

export async function handleMetaCapi(
  request: Request,
  env: Env
): Promise<Response | null> {
  if (urlPath(request) !== "/api/meta/capi" || request.method !== "POST") return null;

  const pixelId = env.META_PIXEL_ID;
  const token = env.META_CAPI_ACCESS_TOKEN;

  const body = await parseJson<CapiPayload>(request);
  if (!body?.event_name) return error("event_name required");

  if (!pixelId || !token || pixelId === "YOUR_PIXEL_ID") {
    return json({ ok: true, queued: false, message: "CAPI not configured — event logged only" });
  }

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: body.event_time || Math.floor(Date.now() / 1000),
        event_id: body.event_id,
        action_source: body.action_source || "website",
        user_data: body.user_data || {},
        custom_data: body.custom_data || {},
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const result = await res.json();
  if (!res.ok) {
    return json({ ok: false, message: "CAPI error", meta: result }, 502);
  }

  return json({ ok: true, meta: result });
}

function urlPath(request: Request) {
  return new URL(request.url).pathname;
}
