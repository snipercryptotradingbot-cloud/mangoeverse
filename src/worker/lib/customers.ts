import type { Env, CustomerRow } from "../types";
import { encodeReferralCode, normalizePhone, sweetnessLevel } from "./utils";

export function mapCustomer(row: CustomerRow) {
  return {
    phone: row.phone,
    name: row.name,
    points: row.sweetness_points,
    level: row.sweetness_level,
    referralCode: row.referral_code,
    referralCount: row.referral_count,
    lifetimeValue: row.lifetime_value,
  };
}

export async function findCustomerByPhone(env: Env, phone: string) {
  const normalized = normalizePhone(phone);
  const row = await env.DB.prepare("SELECT * FROM customers WHERE phone = ?").bind(normalized).first<CustomerRow>();
  return row ? mapCustomer(row) : null;
}

export async function findCustomerByReferralCode(env: Env, code: string) {
  const row = await env.DB.prepare("SELECT * FROM customers WHERE referral_code = ?").bind(code).first<CustomerRow>();
  return row ? mapCustomer(row) : null;
}

export async function upsertCustomer(
  env: Env,
  phone: string,
  name: string,
  referredByCode?: string | null
) {
  const normalized = normalizePhone(phone);
  const referralCode = encodeReferralCode(normalized);

  let referredByPhone: string | null = null;
  if (referredByCode) {
    const referrer = await findCustomerByReferralCode(env, referredByCode);
    if (referrer && referrer.phone !== normalized) {
      referredByPhone = referrer.phone;
    }
  }

  const existing = await env.DB.prepare("SELECT * FROM customers WHERE phone = ?").bind(normalized).first<CustomerRow>();

  if (existing) {
    await env.DB.prepare("UPDATE customers SET name = ?, updated_at = datetime('now') WHERE phone = ?")
      .bind(name, normalized)
      .run();
    return findCustomerByPhone(env, normalized);
  }

  await env.DB.prepare(
    `INSERT INTO customers (phone, name, referral_code, referred_by, sweetness_points, sweetness_level)
     VALUES (?, ?, ?, ?, 0, 1)`
  ).bind(normalized, name, referralCode, referredByPhone).run();

  if (referredByPhone) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO referrals (referrer_phone, referred_phone) VALUES (?, ?)"
    ).bind(referredByPhone, normalized).run();
  }

  return findCustomerByPhone(env, normalized);
}

export async function addPoints(env: Env, phone: string, points: number, type: string, description: string) {
  const normalized = normalizePhone(phone);
  const customer = await env.DB.prepare("SELECT sweetness_points FROM customers WHERE phone = ?").bind(normalized).first<{ sweetness_points: number }>();
  if (!customer) return null;

  const newPoints = customer.sweetness_points + points;
  const level = sweetnessLevel(newPoints);

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE customers SET sweetness_points = ?, sweetness_level = ?, updated_at = datetime('now') WHERE phone = ?"
    ).bind(newPoints, level, normalized),
    env.DB.prepare(
      "INSERT INTO rewards_log (customer_phone, type, points, description) VALUES (?, ?, ?, ?)"
    ).bind(normalized, type, points, description),
  ]);

  return findCustomerByPhone(env, normalized);
}

export async function incrementLifetimeValue(env: Env, phone: string, amount: number) {
  const normalized = normalizePhone(phone);
  await env.DB.prepare(
    "UPDATE customers SET lifetime_value = lifetime_value + ?, updated_at = datetime('now') WHERE phone = ?"
  ).bind(amount, normalized).run();
}

export async function convertReferral(env: Env, referredPhone: string) {
  const normalized = normalizePhone(referredPhone);
  const referral = await env.DB.prepare(
    "SELECT referrer_phone FROM referrals WHERE referred_phone = ? AND converted = 0"
  ).bind(normalized).first<{ referrer_phone: string }>();

  if (!referral) return;

  await env.DB.batch([
    env.DB.prepare("UPDATE referrals SET converted = 1 WHERE referred_phone = ?").bind(normalized),
    env.DB.prepare(
      "UPDATE customers SET referral_count = referral_count + 1, updated_at = datetime('now') WHERE phone = ?"
    ).bind(referral.referrer_phone),
  ]);

  await addPoints(env, referral.referrer_phone, 100, "referral", "Friend completed first order");
}

export async function listCustomers(env: Env, limit = 50) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM customers ORDER BY lifetime_value DESC LIMIT ?"
  ).bind(limit).all<CustomerRow>();
  return results.map(mapCustomer);
}

export async function getTopReferrers(env: Env, limit = 10) {
  const { results } = await env.DB.prepare(
    `SELECT c.phone, c.name, c.referral_code, c.referral_count, c.sweetness_points,
            (SELECT COUNT(*) FROM referrals r WHERE r.referrer_phone = c.phone AND r.converted = 1) as conversions
     FROM customers c
     WHERE c.referral_count > 0
     ORDER BY c.referral_count DESC
     LIMIT ?`
  ).bind(limit).all<{
    phone: string;
    name: string | null;
    referral_code: string;
    referral_count: number;
    sweetness_points: number;
    conversions: number;
  }>();
  return results;
}
