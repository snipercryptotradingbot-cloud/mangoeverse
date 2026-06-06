export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CACHE: KVNamespace;
  NOTIFY: Queue;
  IMAGES?: R2Bucket;
  ADMIN_TOKEN?: string;
  META_CAPI_ACCESS_TOKEN?: string;
  META_PIXEL_ID?: string;
}

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  weight: string;
  price: number;
  description: string | null;
  image_key: string | null;
  stock: number;
  featured: number;
  drop_number: number | null;
  active: number;
}

export interface CustomerRow {
  phone: string;
  name: string | null;
  sweetness_points: number;
  sweetness_level: number;
  referral_code: string;
  referred_by: string | null;
  referral_count: number;
  lifetime_value: number;
}

export interface OrderRow {
  id: string;
  customer_phone: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  name: string;
  address: string;
  city: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemInput {
  id: string;
  quantity: number;
  price?: number;
}

export interface CreateOrderInput {
  name: string;
  phone: string;
  address: string;
  city: string;
  items: OrderItemInput[];
  referralCode?: string;
  eventId?: string;
}

export interface NotificationMessage {
  type: "order_confirmation" | "stock_alert" | "restock_notify";
  phone?: string;
  orderId?: string;
  productId?: string;
  message?: string;
}
