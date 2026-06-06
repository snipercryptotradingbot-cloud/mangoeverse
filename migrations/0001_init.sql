-- Mangoeverse D1 migration v1
-- Applied automatically via wrangler d1 migrations

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  sweetness_points INTEGER NOT NULL DEFAULT 0,
  sweetness_level INTEGER NOT NULL DEFAULT 1,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  referral_count INTEGER NOT NULL DEFAULT 0,
  lifetime_value REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  weight TEXT NOT NULL DEFAULT '5kg box',
  price REAL NOT NULL,
  description TEXT,
  image_key TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  drop_number INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'packed', 'shipped', 'delivered')),
  subtotal REAL NOT NULL,
  delivery_fee REAL NOT NULL DEFAULT 300,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_phone) REFERENCES customers(phone)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_phone TEXT NOT NULL,
  referred_phone TEXT NOT NULL,
  converted INTEGER NOT NULL DEFAULT 0,
  reward_claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (referrer_phone) REFERENCES customers(phone),
  UNIQUE(referred_phone)
);

CREATE TABLE IF NOT EXISTS rewards_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_phone TEXT NOT NULL,
  type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_phone) REFERENCES customers(phone)
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_phone);

INSERT OR IGNORE INTO products (id, name, slug, weight, price, description, stock, featured, drop_number) VALUES
  ('sindhri', 'Sindhri', 'sindhri', '5kg box', 4500, 'Large, oval Sindhri mangoes with honey-sweet flavor.', 42, 0, NULL),
  ('chaunsa', 'Chaunsa', 'chaunsa', '5kg box', 5200, 'The king of mangoes — intensely aromatic Chaunsa.', 18, 1, 7),
  ('anwar-ratol', 'Anwar Ratol', 'anwar-ratol', '5kg box', 5800, 'Petite, ultra-sweet Anwar Ratol from Punjab.', 24, 0, NULL),
  ('langra', 'Langra', 'langra', '5kg box', 4800, 'Green-skinned Langra with tangy-sweet balance.', 30, 0, NULL),
  ('dussehri', 'Dussehri', 'dussehri', '5kg box', 4200, 'Classic Dussehri — fragrant and fiber-free.', 36, 0, NULL);
