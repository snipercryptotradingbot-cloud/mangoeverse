import type { Env, ProductRow } from "../types";
import { CACHE_PRODUCTS_KEY, CACHE_TTL } from "./utils";

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    weight: row.weight,
    price: row.price,
    description: row.description ?? "",
    stock: row.stock,
    featured: row.featured === 1,
    dropNumber: row.drop_number,
    imageUrl: row.image_key ? `/api/images/${row.image_key}` : null,
  };
}

export async function getProducts(env: Env, bypassCache = false) {
  if (!bypassCache) {
    const cached = await env.CACHE.get(CACHE_PRODUCTS_KEY, "json");
    if (cached) return cached as ReturnType<typeof mapProduct>[];
  }

  const { results } = await env.DB.prepare(
    "SELECT * FROM products WHERE active = 1 ORDER BY featured DESC, name ASC"
  ).all<ProductRow>();

  const products = results.map(mapProduct);
  await env.CACHE.put(CACHE_PRODUCTS_KEY, JSON.stringify(products), { expirationTtl: CACHE_TTL });
  return products;
}

export async function invalidateProductCache(env: Env) {
  await env.CACHE.delete(CACHE_PRODUCTS_KEY);
}

export async function getProductById(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<ProductRow>();
  return row ? mapProduct(row) : null;
}

export async function updateProduct(
  env: Env,
  id: string,
  data: Partial<{ price: number; stock: number; description: string; featured: number; drop_number: number | null; active: number }>
) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.price !== undefined) { fields.push("price = ?"); values.push(data.price); }
  if (data.stock !== undefined) { fields.push("stock = ?"); values.push(data.stock); }
  if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
  if (data.featured !== undefined) { fields.push("featured = ?"); values.push(data.featured); }
  if (data.drop_number !== undefined) { fields.push("drop_number = ?"); values.push(data.drop_number); }
  if (data.active !== undefined) { fields.push("active = ?"); values.push(data.active); }

  if (fields.length === 0) return null;

  values.push(id);
  await env.DB.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  await invalidateProductCache(env);
  return getProductById(env, id);
}

export async function uploadProductImage(env: Env, id: string, file: File): Promise<string | null> {
  if (!env.IMAGES) throw new Error("R2 not configured — enable R2 in Cloudflare Dashboard");
  const product = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(id).first();
  if (!product) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
  const key = `products/${id}.${ext}`;
  await env.IMAGES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "image/webp" },
  });
  await env.DB.prepare("UPDATE products SET image_key = ? WHERE id = ?").bind(key, id).run();
  await invalidateProductCache(env);
  return key;
}

export async function getLowStockProducts(env: Env, threshold = 10) {
  const { results } = await env.DB.prepare(
    "SELECT id, name, stock FROM products WHERE active = 1 AND stock <= ? ORDER BY stock ASC"
  ).bind(threshold).all<{ id: string; name: string; stock: number }>();
  return results;
}
