import type { Env } from "../types";
import { error, json, parseJson } from "../lib/utils";
import { requireAdmin } from "../lib/auth";
import {
  getDashboardMetrics,
  listOrders,
  updateOrderStatus,
  getOrderWithItems,
} from "../lib/orders";
import {
  getProducts,
  updateProduct,
  uploadProductImage,
  getLowStockProducts,
} from "../lib/products";
import { listCustomers, getTopReferrers, findCustomerByPhone } from "../lib/customers";

export async function handleAdminApi(
  request: Request,
  url: URL,
  env: Env
): Promise<Response | null> {
  if (!url.pathname.startsWith("/api/admin/")) return null;

  const authError = requireAdmin(request, env);
  if (authError) return authError;

  if (url.pathname === "/api/admin/dashboard" && request.method === "GET") {
    const metrics = await getDashboardMetrics(env);
    return json({ ok: true, metrics });
  }

  if (url.pathname === "/api/admin/orders" && request.method === "GET") {
    const status = url.searchParams.get("status") ?? undefined;
    const orders = await listOrders(env, status);
    return json({ ok: true, orders });
  }

  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (orderMatch) {
    const orderId = orderMatch[1];

    if (request.method === "GET") {
      const order = await getOrderWithItems(env, orderId);
      if (!order) return error("Order not found", 404);
      return json({ ok: true, order });
    }

    if (request.method === "PATCH") {
      const body = await parseJson<{ status: string }>(request);
      if (!body?.status) return error("status required");
      try {
        const order = await updateOrderStatus(env, orderId, body.status);
        return json({ ok: true, order });
      } catch (e) {
        return error(e instanceof Error ? e.message : "Update failed");
      }
    }
  }

  if (url.pathname === "/api/admin/products" && request.method === "GET") {
    const products = await getProducts(env, true);
    const lowStock = await getLowStockProducts(env);
    return json({ ok: true, products, lowStock });
  }

  const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (productMatch && request.method === "PATCH") {
    const id = productMatch[1];
    const body = await parseJson<Record<string, unknown>>(request);
    if (!body) return error("Invalid JSON");
    const product = await updateProduct(env, id, body as Parameters<typeof updateProduct>[2]);
    if (!product) return error("Product not found", 404);
    return json({ ok: true, product });
  }

  const imageMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)\/image$/);
  if (imageMatch && request.method === "POST") {
    const id = imageMatch[1];
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return error("image file required");
    try {
      const key = await uploadProductImage(env, id, file);
      if (!key) return error("Product not found", 404);
      return json({ ok: true, imageKey: key, imageUrl: `/api/images/${key}` });
    } catch (e) {
      return error(e instanceof Error ? e.message : "Image upload failed", 500);
    }
  }

  if (url.pathname === "/api/admin/referrals" && request.method === "GET") {
    const ambassadors = await getTopReferrers(env);
    const { results } = await env.DB.prepare(
      `SELECT r.*, c.name as referrer_name, c2.name as referred_name
       FROM referrals r
       JOIN customers c ON c.phone = r.referrer_phone
       LEFT JOIN customers c2 ON c2.phone = r.referred_phone
       ORDER BY r.created_at DESC LIMIT 50`
    ).all();
    return json({ ok: true, ambassadors, referrals: results });
  }

  if (url.pathname === "/api/admin/customers" && request.method === "GET") {
    const customers = await listCustomers(env);
    return json({ ok: true, customers });
  }

  const customerMatch = url.pathname.match(/^\/api\/admin\/customers\/([^/]+)$/);
  if (customerMatch && request.method === "GET") {
    const phone = decodeURIComponent(customerMatch[1]);
    const customer = await findCustomerByPhone(env, phone);
    if (!customer) return error("Customer not found", 404);

    const { results: orders } = await env.DB.prepare(
      "SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC"
    ).bind(phone.replace(/\D/g, "")).all();

    const { results: rewards } = await env.DB.prepare(
      "SELECT * FROM rewards_log WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 20"
    ).bind(phone.replace(/\D/g, "")).all();

    return json({ ok: true, customer, orders: results, rewards });
  }

  return error("Not found", 404);
}
