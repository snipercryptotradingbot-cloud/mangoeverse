export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function error(message: string, status = 400): Response {
  return json({ ok: false, message }, status);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function encodeReferralCode(phone: string): string {
  const digits = normalizePhone(phone);
  return btoa(digits).replace(/=/g, "").slice(0, 12);
}

export function sweetnessLevel(points: number): number {
  if (points >= 1000) return 4;
  if (points >= 500) return 3;
  if (points >= 250) return 2;
  return 1;
}

export function deliveryDiscount(points: number): number {
  if (points >= 500) return 200;
  if (points >= 250) return 100;
  return 0;
}

export function corsHeaders(origin?: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function withCors(response: Response, origin?: string | null): Response {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export const CACHE_PRODUCTS_KEY = "products:v1";
export const CACHE_TTL = 300;
