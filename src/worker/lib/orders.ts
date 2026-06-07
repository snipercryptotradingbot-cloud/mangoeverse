import type { Env, CreateOrderInput } from "../types";
import { deliveryDiscount, normalizePhone } from "./utils";
import { addPoints, convertReferral, incrementLifetimeValue, upsertCustomer, findCustomerByPhone } from "./customers";
import { invalidateProductCache } from "./products";
import type { NotificationMessage } from "../types";

const DELIVERY_FEE = 200;
const ORDER_POINTS = 100;

export async function createOrder(env: Env, input: CreateOrderInput, ctx: ExecutionContext) {
  const phone = normalizePhone(input.phone);
  if (!phone || phone.length < 10) throw new Error("Invalid phone number");
  if (!input.items?.length) throw new Error("Cart is empty");

  const customer = await upsertCustomer(env, phone, input.name, input.referralCode);
  if (!customer) throw new Error("Could not create customer");

  const discount = deliveryDiscount(customer.points);
  let subtotal = 0;
  const lineItems: { productId: string; quantity: number; unitPrice: number; name: string }[] = [];

  for (const item of input.items) {
    const product = await env.DB.prepare(
      "SELECT id, name, price, stock FROM products WHERE id = ? AND active = 1"
    ).bind(item.id).first<{ id: string; name: string; price: number; stock: number }>();

    if (!product) throw new Error(`Product not found: ${item.id}`);
    if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

    const unitPrice = item.price ?? product.price;
    subtotal += unitPrice * item.quantity;
    lineItems.push({ productId: product.id, quantity: item.quantity, unitPrice, name: product.name });
  }

  const total = Math.max(0, subtotal + DELIVERY_FEE - discount);
  const orderId = `MV-${Date.now()}`;

  const statements = [
    env.DB.prepare(
      `INSERT INTO orders (id, customer_phone, subtotal, delivery_fee, discount, total, name, address, city)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(orderId, phone, subtotal, DELIVERY_FEE, discount, total, input.name, input.address, input.city),
    ...lineItems.map((li) =>
      env.DB.prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
      ).bind(orderId, li.productId, li.quantity, li.unitPrice)
    ),
    ...lineItems.map((li) =>
      env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(li.quantity, li.productId)
    ),
  ];

  await env.DB.batch(statements);

  await addPoints(env, phone, ORDER_POINTS, "order", `Order ${orderId}`);
  await incrementLifetimeValue(env, phone, total);

  const orderCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM orders WHERE customer_phone = ?"
  ).bind(phone).first<{ count: number }>();

  if (orderCount?.count === 1) {
    await convertReferral(env, phone);
  }

  await invalidateProductCache(env);

  const notifyMsg: NotificationMessage = {
    type: "order_confirmation",
    phone,
    orderId,
    message: `Order ${orderId} confirmed. Total: Rs. ${total.toLocaleString()}`,
  };
  ctx.waitUntil(env.NOTIFY.send(notifyMsg));

  for (const li of lineItems) {
    const stock = await env.DB.prepare("SELECT stock FROM products WHERE id = ?").bind(li.productId).first<{ stock: number }>();
    if (stock && stock.stock <= 10) {
      ctx.waitUntil(
        env.NOTIFY.send({
          type: "stock_alert",
          productId: li.productId,
          message: `${li.name} low stock: ${stock.stock} remaining`,
        } satisfies NotificationMessage)
      );
    }
  }

  const finalCustomer = await findCustomerByPhone(env, phone);
  return {
    ok: true,
    order: {
      id: orderId,
      total,
      subtotal,
      discount,
      deliveryFee: DELIVERY_FEE,
      status: "pending",
    },
    customer: finalCustomer,
    pointsEarned: ORDER_POINTS,
  };
}

export async function listOrders(env: Env, status?: string) {
  const query = status
    ? "SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC"
    : "SELECT * FROM orders ORDER BY created_at DESC";
  const stmt = status
    ? env.DB.prepare(query).bind(status)
    : env.DB.prepare(query);
  const { results } = await stmt.all();
  return results;
}

export async function getOrderWithItems(env: Env, orderId: string) {
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
  if (!order) return null;
  const { results: items } = await env.DB.prepare(
    `SELECT oi.*, p.name as product_name FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`
  ).bind(orderId).all();
  return { ...order, items };
}

export async function updateOrderStatus(env: Env, orderId: string, status: string) {
  const valid = ["pending", "packed", "shipped", "delivered"];
  if (!valid.includes(status)) throw new Error("Invalid status");
  await env.DB.prepare(
    "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, orderId).run();
  return getOrderWithItems(env, orderId);
}

export async function getDashboardMetrics(env: Env) {
  const [revenue, orders, customers, referrals] = await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders").first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM orders").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM customers").first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM referrals WHERE converted = 1").first<{ count: number }>(),
  ]);

  const byStatus = await env.DB.prepare(
    "SELECT status, COUNT(*) as count FROM orders GROUP BY status"
  ).all<{ status: string; count: number }>();

  const statusMap: Record<string, number> = {};
  for (const row of byStatus.results) statusMap[row.status] = row.count;

  const recentOrders = await listOrders(env);

  return {
    revenue: revenue?.total ?? 0,
    orders: orders?.count ?? 0,
    customers: customers?.count ?? 0,
    referralConversions: referrals?.count ?? 0,
    ordersByStatus: statusMap,
    conversionRate: orders?.count ? ((referrals?.count ?? 0) / (orders?.count ?? 1)) * 100 : 0,
    recentOrders: recentOrders.slice(0, 5),
  };
}
