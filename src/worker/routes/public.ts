import type { Env } from "../types";
import { error, json, parseJson, withCors } from "../lib/utils";
import { getProducts } from "../lib/products";
import { findCustomerByPhone, findCustomerByReferralCode } from "../lib/customers";
import { createOrder } from "../lib/orders";
import type { CreateOrderInput } from "../types";

export async function handlePublicApi(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const origin = request.headers.get("Origin");

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }), origin);
  }

  if (url.pathname === "/api/products" && request.method === "GET") {
    const products = await getProducts(env);
    return withCors(json({ ok: true, products }), origin);
  }

  if (url.pathname.startsWith("/api/customers/") && request.method === "GET") {
    const phone = decodeURIComponent(url.pathname.replace("/api/customers/", ""));
    const customer = await findCustomerByPhone(env, phone);
    if (!customer) return withCors(error("Customer not found", 404), origin);
    return withCors(json({ ok: true, customer }), origin);
  }

  if (url.pathname.startsWith("/api/referral/") && request.method === "GET") {
    const code = url.pathname.replace("/api/referral/", "");
    const customer = await findCustomerByReferralCode(env, code);
    if (!customer) return withCors(error("Invalid referral code", 404), origin);
    return withCors(json({ ok: true, referralCode: code, referrer: { name: customer.name } }), origin);
  }

  if (url.pathname === "/api/orders" && request.method === "POST") {
    const body = await parseJson<CreateOrderInput & { items: CreateOrderInput["items"] }>(request);
    if (!body) return withCors(error("Invalid JSON"), origin);

    try {
      const result = await createOrder(env, body, ctx);
      return withCors(json(result), origin);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Order failed";
      return withCors(error(message, 400), origin);
    }
  }

  if (url.pathname.startsWith("/api/images/") && request.method === "GET") {
    if (!env.IMAGES) return withCors(error("Image storage not configured", 503), origin);
    const key = url.pathname.replace("/api/images/", "");
    const object = await env.IMAGES.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(object.body, { headers });
  }

  return null;
}
