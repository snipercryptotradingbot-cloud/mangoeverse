export const META_PIXEL_ID = "YOUR_PIXEL_ID";
export const CAPI_ENDPOINT = "/api/meta/capi";
export const CURRENCY = "PKR";

let pixelLoaded = false;

export function initPixel() {
  if (pixelLoaded || META_PIXEL_ID === "YOUR_PIXEL_ID") return;
  pixelLoaded = true;

  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", META_PIXEL_ID);
  window.fbq("track", "PageView");
}

function generateEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function sendCAPI(eventName, customData, eventId) {
  const payload = JSON.stringify({
    event_name: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    custom_data: customData,
    action_source: "website",
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(CAPI_ENDPOINT, new Blob([payload], { type: "application/json" }));
  } else {
    fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
}

export function trackEvent(eventName, params = {}) {
  const eventId = generateEventId();
  const customData = { currency: CURRENCY, ...params };

  if (typeof window.fbq === "function" && META_PIXEL_ID !== "YOUR_PIXEL_ID") {
    window.fbq("track", eventName, customData, { eventID: eventId });
  }

  sendCAPI(eventName, customData, eventId);

  if (META_PIXEL_ID === "YOUR_PIXEL_ID") {
    console.debug("[Mangoeverse Tracking]", eventName, customData);
  }
}

export function trackViewContent(product) {
  trackEvent("ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price,
    contents: [{ id: product.id, quantity: 1, item_price: product.price }],
  });
}

export function trackAddToCart(product, quantity = 1) {
  trackEvent("AddToCart", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price * quantity,
    num_items: quantity,
    contents: [{ id: product.id, quantity, item_price: product.price }],
  });
}

export function trackInitiateCheckout(cartItems, total) {
  trackEvent("InitiateCheckout", {
    content_ids: cartItems.map((i) => i.id),
    value: total,
    num_items: cartItems.reduce((s, i) => s + i.quantity, 0),
    contents: cartItems.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      item_price: i.price,
    })),
  });
}

export function trackPurchase(cartItems, total, orderId) {
  trackEvent("Purchase", {
    content_ids: cartItems.map((i) => i.id),
    value: total,
    num_items: cartItems.reduce((s, i) => s + i.quantity, 0),
    order_id: orderId,
    contents: cartItems.map((i) => ({
      id: i.id,
      quantity: i.quantity,
      item_price: i.price,
    })),
  });
}

export function trackPageViewContent() {
  trackEvent("ViewContent", {
    content_name: "Mangoeverse Store",
    content_type: "product_group",
    value: 5200,
  });
}
