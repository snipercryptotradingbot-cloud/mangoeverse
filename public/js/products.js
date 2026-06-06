export const PRODUCTS = [];
export let FEATURED_DROP = null;

export const CURRENCY = "PKR";

export function formatPrice(amount) {
  return `Rs. ${Number(amount).toLocaleString("en-PK")}`;
}

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

export function setProducts(products) {
  PRODUCTS.length = 0;
  PRODUCTS.push(...products);
  FEATURED_DROP = products.find((p) => p.featured) ?? products[1] ?? products[0] ?? null;
}

export const MANGO_SVG = `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="32" cy="36" rx="22" ry="24" fill="#F5A623"/>
  <ellipse cx="28" cy="32" rx="8" ry="10" fill="#FFD93D" opacity="0.6"/>
  <path d="M32 12 C34 8 38 6 42 8 C40 10 36 12 32 14 Z" fill="#2D6A4F"/>
  <path d="M42 8 C44 6 48 8 46 12 C44 10 42 9 42 8 Z" fill="#40916C"/>
</svg>`;

export async function fetchProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  if (data.ok && data.products?.length) {
    setProducts(data.products);
    return data.products;
  }
  return loadFallbackProducts();
}

function loadFallbackProducts() {
  const fallback = [
    { id: "sindhri", name: "Sindhri", slug: "sindhri", weight: "5kg box", price: 4500, description: "Large, oval Sindhri mangoes with a honey-sweet flavor and minimal fiber.", stock: 42, featured: false },
    { id: "chaunsa", name: "Chaunsa", slug: "chaunsa", weight: "5kg box", price: 5200, description: "The king of mangoes — intensely aromatic Chaunsa with rich, saffron-hued flesh.", stock: 18, featured: true, dropNumber: 7 },
    { id: "anwar-ratol", name: "Anwar Ratol", slug: "anwar-ratol", weight: "5kg box", price: 5800, description: "Petite, ultra-sweet Anwar Ratol — a connoisseur favorite from Punjab.", stock: 24, featured: false },
    { id: "langra", name: "Langra", slug: "langra", weight: "5kg box", price: 4800, description: "Green-skinned Langra with tangy-sweet balance and silky texture.", stock: 30, featured: false },
    { id: "dussehri", name: "Dussehri", slug: "dussehri", weight: "5kg box", price: 4200, description: "Classic Dussehri — fragrant, fiber-free, and perfect for sharing.", stock: 36, featured: false },
  ];
  setProducts(fallback);
  return fallback;
}
