export function syncCustomerFromApi(apiCustomer) {
  if (!apiCustomer) return null;
  const customer = {
    phone: apiCustomer.phone,
    name: apiCustomer.name || "",
    points: apiCustomer.points ?? 0,
    referralCount: apiCustomer.referralCount ?? 0,
    referralCode: apiCustomer.referralCode,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
  return customer;
}

export async function fetchCustomerByPhone(phone) {
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return null;
  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(normalized)}`);
    if (!res.ok) return getCustomer();
    const data = await res.json();
    if (data.ok && data.customer) return syncCustomerFromApi(data.customer);
  } catch {}
  return getCustomer();
}

const STORAGE_KEY = "mangoeverse_customer";
const ORDERS_KEY = "mangoeverse_orders";

const LEVELS = [
  { level: 1, name: "Seedling", min: 0, max: 250 },
  { level: 2, name: "Ripe", min: 250, max: 500 },
  { level: 3, name: "Golden", min: 500, max: 1000 },
  { level: 4, name: "Legend", min: 1000, max: 2000 },
];

const REFERRAL_LEVELS = [
  { level: 1, invites: 1, reward: "100 Sweetness Points", points: 100 },
  { level: 2, invites: 3, reward: "Free Delivery", points: 0 },
  { level: 3, invites: 5, reward: "500 Sweetness Points", points: 500 },
  { level: 4, invites: 10, reward: "1kg Mango Box", points: 0 },
];

export function getCustomer() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveCustomer(phone, name) {
  const existing = getCustomer();
  const customer = {
    phone,
    name: name || existing?.name || "",
    points: existing?.points ?? 0,
    referralCount: existing?.referralCount ?? 0,
    referralCode: encodeReferralCode(phone),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
  return customer;
}

export function addPoints(amount) {
  const customer = getCustomer();
  if (!customer) return null;
  customer.points = (customer.points || 0) + amount;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customer));
  return customer;
}

export function getLevelInfo(points) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) {
      return {
        ...LEVELS[i],
        next: LEVELS[i + 1] || null,
        progress: LEVELS[i + 1]
          ? ((points - LEVELS[i].min) / (LEVELS[i + 1].min - LEVELS[i].min)) * 100
          : 100,
        pointsInLevel: points - LEVELS[i].min,
        pointsToNext: LEVELS[i + 1] ? LEVELS[i + 1].min - points : 0,
      };
    }
  }
  return { ...LEVELS[0], progress: 0, pointsInLevel: points, pointsToNext: LEVELS[0].max };
}

export function getReferralProgress(count) {
  let current = REFERRAL_LEVELS[0];
  for (const level of REFERRAL_LEVELS) {
    if (count >= level.invites) current = level;
  }
  const nextLevel = REFERRAL_LEVELS.find((l) => count < l.invites);
  return {
    levels: REFERRAL_LEVELS,
    count,
    currentLevel: current.level,
    nextLevel,
    progress: nextLevel ? (count / nextLevel.invites) * 100 : 100,
    progressLabel: nextLevel ? `${count}/${nextLevel.invites}` : `${count}/${REFERRAL_LEVELS[REFERRAL_LEVELS.length - 1].invites}`,
  };
}

export function encodeReferralCode(phone) {
  return btoa(phone.replace(/\D/g, "")).replace(/=/g, "").slice(0, 12);
}

export function getReferralLink(phone) {
  const customer = getCustomer();
  const code = customer?.referralCode || encodeReferralCode(phone);
  const base = window.location.origin + window.location.pathname;
  return `${base}?ref=${code}`;
}

export function getStoredReferralCode() {
  return localStorage.getItem("mangoeverse_referred_by");
}

export function captureReferralFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  if (ref) {
    localStorage.setItem("mangoeverse_referred_by", ref);
  }
  return ref;
}

export function saveOrder(order) {
  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
  orders.push(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function getDeliveryDiscount(points) {
  if (points >= 500) return 200;
  if (points >= 250) return 100;
  return 0;
}

export { REFERRAL_LEVELS, LEVELS };
