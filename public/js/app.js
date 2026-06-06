import { PRODUCTS, FEATURED_DROP, formatPrice, getProduct, MANGO_SVG, fetchProducts } from "./products.js";
import {
  initPixel,
  trackPageViewContent,
  trackViewContent,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
} from "./tracking.js";
import {
  getCustomer,
  saveCustomer,
  addPoints,
  getLevelInfo,
  getReferralProgress,
  getReferralLink,
  captureReferralFromUrl,
  getStoredReferralCode,
  saveOrder,
  getDeliveryDiscount,
  syncCustomerFromApi,
  fetchCustomerByPhone,
} from "./sweetness.js";

const state = {
  cart: [],
  activeSheet: null,
  sheetProduct: null,
  sheetQty: 1,
  view: "cart",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const overlay = $("#overlay");
const cartDrawer = $("#cart-drawer");
const productSheet = $("#product-sheet");
const profileSheet = $("#profile-sheet");
const successOverlay = $("#success-overlay");
const cartBadge = $("#cart-badge");
const cartBtn = $("#cart-btn");
const cartItemsEl = $("#cart-items");
const cartSummaryEl = $("#cart-summary");
const checkoutForm = $("#checkout-form");
const dropCountdownEl = $("#drop-countdown");

function init() {
  captureReferralFromUrl();
  initPixel();
  trackPageViewContent();
  bindEvents();
  initScrollReveal();
  initParallax();
  initDropCountdown();
  loadCartFromStorage();
  bootstrap();
}

async function bootstrap() {
  await fetchProducts();
  renderShop();
  renderFeaturedDrop();
  updateClubUI();
  updateReferralUI();
  updateProfileUI();
  const customer = getCustomer();
  if (customer?.phone) await fetchCustomerByPhone(customer.phone);
  updateClubUI();
  updateReferralUI();
  updateProfileUI();
}

function bindEvents() {
  cartBtn?.addEventListener("click", () => openDrawer("cart"));
  $("#profile-btn")?.addEventListener("click", async () => {
    const customer = getCustomer();
    if (customer?.phone) await fetchCustomerByPhone(customer.phone);
    updateProfileUI();
    updateClubUI();
    updateReferralUI();
    openDrawer("profile");
  });
  overlay?.addEventListener("click", closeAllDrawers);
  $$(".drawer-close").forEach((btn) => btn.addEventListener("click", closeAllDrawers));

  $("#hero-drop-cta")?.addEventListener("click", (e) => {
    e.preventDefault();
    triggerDropAnimation(() => {
      addFeaturedToCart();
      openDrawer("cart");
    });
  });

  $("#hero-club-cta")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#club")?.scrollIntoView({ behavior: "smooth" });
  });

  $("#drop-add-btn")?.addEventListener("click", () => {
    addFeaturedToCart(true);
  });

  $("#cart-checkout-btn")?.addEventListener("click", () => {
    if (state.cart.length === 0) return;
    const total = getCartTotal();
    trackInitiateCheckout(state.cart, total);
    showCheckoutView();
  });

  $("#checkout-back")?.addEventListener("click", showCartView);

  checkoutForm?.addEventListener("submit", handleCheckoutSubmit);

  $("#sheet-add-btn")?.addEventListener("click", () => {
    if (state.sheetProduct) {
      addToCart(state.sheetProduct, state.sheetQty, true);
      closeAllDrawers();
    }
  });

  $("#sheet-qty-minus")?.addEventListener("click", () => {
    if (state.sheetQty > 1) {
      state.sheetQty--;
      $("#sheet-qty-value").textContent = state.sheetQty;
    }
  });

  $("#sheet-qty-plus")?.addEventListener("click", () => {
    state.sheetQty++;
    $("#sheet-qty-value").textContent = state.sheetQty;
  });

  $("#copy-referral")?.addEventListener("click", copyReferralLink);
  $("#success-close")?.addEventListener("click", () => {
    successOverlay?.classList.remove("open");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllDrawers();
  });
}

function renderShop() {
  const container = $("#shop-scroll");
  if (!container) return;

  container.innerHTML = PRODUCTS.map(
    (p) => `
    <article class="product-card reveal" data-id="${p.id}">
      <div class="product-image" data-variety="${p.slug}">${MANGO_SVG}</div>
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-weight">${p.weight}</p>
        <div class="product-footer">
          <data class="product-price" value="${p.price}">${formatPrice(p.price)}</data>
          <button class="btn-quick-add" data-quick-add="${p.id}" type="button">Quick Add</button>
        </div>
      </div>
    </article>
  `
  ).join("");

  container.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-quick-add]")) return;
      openProductSheet(card.dataset.id);
    });
  });

  container.querySelectorAll("[data-quick-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const product = getProduct(btn.dataset.quickAdd);
      if (product) addToCart(product, 1, true, e.target);
    });
  });
}

function renderFeaturedDrop() {
  const drop = FEATURED_DROP;
  if (!drop) return;
  const nameEl = $("#drop-name");
  const priceEl = $("#drop-price");
  const stockEl = $("#drop-stock");
  if (nameEl) nameEl.textContent = `${drop.name.toUpperCase()} DROP #${String(drop.dropNumber ?? 1).padStart(2, "0")}`;
  if (priceEl) priceEl.textContent = formatPrice(drop.price);
  if (stockEl) stockEl.textContent = `${drop.stock} boxes left`;
}

function initDropCountdown() {
  if (!dropCountdownEl) return;
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  function tick() {
    const diff = end - Date.now();
    if (diff <= 0) {
      dropCountdownEl.textContent = "Drop ends soon";
      return;
    }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    dropCountdownEl.textContent = `Drop ends in ${h}h ${m}m`;
    requestAnimationFrame(() => setTimeout(tick, 60000));
  }
  tick();
}

function addFeaturedToCart(animate) {
  addToCart(FEATURED_DROP, 1, animate);
}

function addToCart(product, qty = 1, animate = false, sourceEl) {
  const existing = state.cart.find((i) => i.id === product.id);
  if (existing) {
    existing.quantity += qty;
  } else {
    state.cart.push({ ...product, quantity: qty });
  }

  persistCart();
  renderCart();
  updateCartBadge();

  trackAddToCart(product, qty);

  if (animate && sourceEl && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flyToCart(sourceEl);
  } else if (animate) {
    cartBadge?.classList.add("pulse");
    setTimeout(() => cartBadge?.classList.remove("pulse"), 400);
  }
}

function flyToCart(sourceEl) {
  const rect = sourceEl.getBoundingClientRect();
  const cartRect = cartBtn.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "flying-mango";
  el.innerHTML = MANGO_SVG;
  el.style.left = `${rect.left + rect.width / 2 - 16}px`;
  el.style.top = `${rect.top + rect.height / 2 - 16}px`;
  document.body.appendChild(el);

  const start = performance.now();
  const duration = 400;
  const sx = rect.left + rect.width / 2;
  const sy = rect.top + rect.height / 2;
  const ex = cartRect.left + cartRect.width / 2;
  const ey = cartRect.top + cartRect.height / 2;

  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const cx = sx + (ex - sx) * ease;
    const cy = sy + (ey - sy) * ease - Math.sin(t * Math.PI) * 60;
    el.style.left = `${cx - 16}px`;
    el.style.top = `${cy - 16}px`;
    el.style.opacity = String(1 - t * 0.5);
    el.style.transform = `scale(${1 - t * 0.5})`;
    if (t < 1) requestAnimationFrame(frame);
    else {
      el.remove();
      cartBadge?.classList.add("pulse");
      setTimeout(() => cartBadge?.classList.remove("pulse"), 400);
    }
  }
  requestAnimationFrame(frame);
}

function removeFromCart(id) {
  state.cart = state.cart.filter((i) => i.id !== id);
  persistCart();
  renderCart();
  updateCartBadge();
}

function updateQty(id, delta) {
  const item = state.cart.find((i) => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) removeFromCart(id);
  else {
    persistCart();
    renderCart();
    updateCartBadge();
  }
}

function getCartSubtotal() {
  return state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function getCartTotal() {
  const customer = getCustomer();
  const discount = customer ? getDeliveryDiscount(customer.points) : 0;
  return Math.max(0, getCartSubtotal() + 300 - discount);
}

function renderCart() {
  if (!cartItemsEl) return;

  if (state.cart.length === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty"><p>Your basket is empty</p><p style="margin-top:0.5rem;font-size:0.875rem">Add some premium mangoes 🥭</p></div>`;
    cartSummaryEl.innerHTML = "";
    $("#cart-checkout-btn")?.setAttribute("disabled", "");
    return;
  }

  $("#cart-checkout-btn")?.removeAttribute("disabled");

  cartItemsEl.innerHTML = state.cart
    .map(
      (item) => `
    <div class="cart-item" data-cart-id="${item.id}">
      <div class="cart-item-image product-image" data-variety="${item.slug}">${MANGO_SVG}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${item.weight}</div>
        <div class="cart-item-actions">
          <button class="qty-btn" data-qty-minus="${item.id}" type="button" aria-label="Decrease">−</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" data-qty-plus="${item.id}" type="button" aria-label="Increase">+</button>
          <span class="cart-item-price">${formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  cartItemsEl.querySelectorAll("[data-qty-minus]").forEach((btn) => {
    btn.addEventListener("click", () => updateQty(btn.dataset.qtyMinus, -1));
  });
  cartItemsEl.querySelectorAll("[data-qty-plus]").forEach((btn) => {
    btn.addEventListener("click", () => updateQty(btn.dataset.qtyPlus, 1));
  });

  const customer = getCustomer();
  const discount = customer ? getDeliveryDiscount(customer.points) : 0;

  cartSummaryEl.innerHTML = `
    <div class="cart-summary">
      <div class="cart-row"><span>Subtotal</span><span>${formatPrice(getCartSubtotal())}</span></div>
      <div class="cart-row"><span>Delivery</span><span>Rs. 300</span></div>
      ${discount > 0 ? `<div class="cart-row cart-reward"><span>Sweetness reward</span><span>−${formatPrice(discount)}</span></div>` : ""}
      <div class="cart-row total"><span>Total</span><span>${formatPrice(getCartTotal())}</span></div>
    </div>
  `;
}

function updateCartBadge() {
  const count = state.cart.reduce((s, i) => s + i.quantity, 0);
  if (cartBadge) {
    cartBadge.textContent = count;
    cartBadge.classList.toggle("visible", count > 0);
  }
}

function persistCart() {
  localStorage.setItem("mangoeverse_cart", JSON.stringify(state.cart));
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem("mangoeverse_cart");
    if (saved) state.cart = JSON.parse(saved);
  } catch {}
  renderCart();
  updateCartBadge();
}

function openDrawer(type) {
  closeAllDrawers(false);
  overlay?.classList.add("open");
  document.body.style.overflow = "hidden";

  if (type === "cart") {
    state.view = "cart";
    showCartView();
    cartDrawer?.classList.add("open");
  } else if (type === "profile") {
    updateProfileUI();
    profileSheet?.classList.add("open");
  }
}

function openProductSheet(id) {
  const product = getProduct(id);
  if (!product) return;

  state.sheetProduct = product;
  state.sheetQty = 1;
  trackViewContent(product);

  $("#sheet-product-name").textContent = product.name;
  $("#sheet-product-desc").textContent = product.description;
  $("#sheet-product-price").textContent = formatPrice(product.price);
  $("#sheet-qty-value").textContent = "1";

  const imgEl = $("#sheet-product-image");
  if (imgEl) {
    imgEl.dataset.variety = product.slug;
    imgEl.innerHTML = MANGO_SVG;
  }

  closeAllDrawers(false);
  overlay?.classList.add("open");
  productSheet?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeAllDrawers(clearOverlay = true) {
  cartDrawer?.classList.remove("open");
  productSheet?.classList.remove("open");
  profileSheet?.classList.remove("open");
  if (clearOverlay) {
    overlay?.classList.remove("open");
    document.body.style.overflow = "";
  }
}

function showCartView() {
  state.view = "cart";
  const cartView = $("#cart-view");
  const checkoutView = $("#checkout-view");
  const cartFooter = $("#cart-footer");
  if (cartView) cartView.style.display = "";
  if (checkoutView) checkoutView.style.display = "none";
  if (cartFooter) cartFooter.style.display = "";
  $("#drawer-title").textContent = "Your Basket";
  renderCart();
}

function showCheckoutView() {
  state.view = "checkout";
  const cartView = $("#cart-view");
  const checkoutView = $("#checkout-view");
  const cartFooter = $("#cart-footer");
  if (cartView) cartView.style.display = "none";
  if (checkoutView) checkoutView.style.display = "";
  if (cartFooter) cartFooter.style.display = "none";
  $("#drawer-title").textContent = "Checkout";
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const address = form.address.value.trim();
  const city = form.city.value.trim();

  if (!name || !phone || !address || !city || state.cart.length === 0) return;

  const submitBtn = form.querySelector('[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const referralCode = getStoredReferralCode();
  const payload = {
    name,
    phone,
    address,
    city,
    referralCode: referralCode || undefined,
    items: state.cart.map((i) => ({ id: i.id, quantity: i.quantity, price: i.price })),
  };

  let orderId = `MV-${Date.now()}`;
  let total = getCartTotal();
  let pointsEarned = 100;

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      orderId = data.order.id;
      total = data.order.total;
      pointsEarned = data.pointsEarned ?? 100;
      if (data.customer) syncCustomerFromApi(data.customer);
      else {
        saveCustomer(phone, name);
        addPoints(pointsEarned);
      }
    } else {
      throw new Error(data.message || "Order failed");
    }
  } catch (err) {
    saveCustomer(phone, name);
    addPoints(pointsEarned);
    saveOrder({ id: orderId, name, phone, address, city, items: state.cart, total, createdAt: new Date().toISOString(), offline: true });
    console.warn("Order saved locally:", err.message);
  }

  trackPurchase(state.cart, total, orderId);

  state.cart = [];
  persistCart();
  updateCartBadge();
  closeAllDrawers();

  showSuccessOverlay(name, pointsEarned);
  await fetchProducts();
  renderFeaturedDrop();
  updateClubUI();
  updateReferralUI();
  updateProfileUI();

  if (submitBtn) submitBtn.disabled = false;
}

function showSuccessOverlay(name, pointsEarned = 100) {
  const customer = getCustomer();
  $("#success-message").textContent = `Thanks ${name.split(" ")[0]}! Your mangoes are being handpicked for dispatch.`;
  $("#success-points").textContent = `+${pointsEarned} Sweetness Points`;
  const linkEl = $("#success-referral-link");
  if (linkEl && customer) {
    linkEl.textContent = getReferralLink(customer.phone);
    linkEl.href = getReferralLink(customer.phone);
  }
  successOverlay?.classList.add("open");
}

function updateClubUI() {
  const customer = getCustomer();
  const displayPoints = customer ? customer.points : 0;
  const level = getLevelInfo(displayPoints);

  $("#club-level-name").textContent = `Sweetness Level ${level.level}`;
  $("#club-level-label").textContent = level.name;
  $("#club-progress-fill").style.width = `${Math.min(level.progress, 100)}%`;

  if (customer) {
    $("#club-progress-text").textContent = `${displayPoints} / ${level.next ? level.next.min : level.max} points`;
  } else {
    $("#club-progress-text").textContent = "Complete checkout to start earning points";
  }
}

function updateReferralUI() {
  const customer = getCustomer();
  const count = customer?.referralCount ?? 0;
  const progress = getReferralProgress(count);

  const container = $("#quest-levels");
  if (container) {
    container.innerHTML = progress.levels
      .map((l) => {
        const done = count >= l.invites;
        const active = !done && (!progress.nextLevel || l.level === progress.nextLevel.level - 1 || l.invites === progress.nextLevel.invites);
        return `
        <div class="quest-level ${done ? "completed" : ""} ${active && !done ? "active" : ""}">
          <div class="quest-icon">${done ? "✓" : l.level}</div>
          <div class="quest-info">
            <div class="quest-title">Level ${l.level} — Invite ${l.invites} friend${l.invites > 1 ? "s" : ""}</div>
            <div class="quest-reward">Reward: ${l.reward}</div>
          </div>
        </div>`;
      })
      .join("");
  }

  $("#quest-progress-fill").style.width = `${Math.min(progress.progress, 100)}%`;
  $("#quest-progress-label").textContent = progress.progressLabel;

  const linkBox = $("#referral-link-box");
  const linkEl = $("#referral-link-text");
  if (customer && linkBox && linkEl) {
    linkBox.style.display = "block";
    linkEl.textContent = getReferralLink(customer.phone);
  } else if (linkBox) {
    linkBox.style.display = "none";
  }
}

function updateProfileUI() {
  const customer = getCustomer();
  const pointsEl = $("#profile-points");
  const referralsEl = $("#profile-referrals");
  const hintEl = $("#profile-hint");
  const statsEl = $("#profile-stats");

  if (customer) {
    hintEl.textContent = `Welcome back! Your sweetness journey continues.`;
    statsEl.style.display = "grid";
    pointsEl.textContent = customer.points;
    referralsEl.textContent = customer.referralCount ?? 0;
  } else {
    hintEl.textContent = "Enter your phone at checkout to unlock Sweetness Club rewards, track points, and build your Mango Squad.";
    statsEl.style.display = "none";
  }
}

function copyReferralLink() {
  const customer = getCustomer();
  if (!customer) return;
  const link = getReferralLink(customer.phone);
  navigator.clipboard?.writeText(link).then(() => {
    const btn = $("#copy-referral");
    if (btn) {
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy Referral Link"), 2000);
    }
  });
}

function triggerDropAnimation(callback) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelector("#drop")?.scrollIntoView({ behavior: "smooth" });
    callback?.();
    return;
  }

  const el = $("#drop-mango");
  if (!el) {
    callback?.();
    return;
  }

  el.classList.remove("falling");
  void el.offsetWidth;
  el.classList.add("falling");

  document.querySelector("#drop")?.scrollIntoView({ behavior: "smooth" });

  setTimeout(() => {
    el.classList.remove("falling");
    callback?.();
  }, 800);
}

function initScrollReveal() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $$(".reveal").forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  $$(".reveal").forEach((el) => observer.observe(el));
}

function initParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const hero = $("#hero");
  const mangoes = $$(".floating-mango");
  if (!hero || !mangoes.length) return;

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scroll = window.scrollY;
          mangoes.forEach((m, i) => {
            m.style.transform = `translateY(${scroll * (0.02 + i * 0.008)}px)`;
          });
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );
}

document.addEventListener("DOMContentLoaded", init);
