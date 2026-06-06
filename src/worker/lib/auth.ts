import type { Env } from "../types";

export function requireAdmin(request: Request, env: Env): Response | null {
  const token = env.ADMIN_TOKEN;
  if (!token) {
    return Response.json({ ok: false, message: "Admin not configured. Set ADMIN_TOKEN secret." }, { status: 503 });
  }
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${token}`) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  return null;
}
