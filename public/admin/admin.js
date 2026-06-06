const TOKEN_KEY = "mangoeverse_admin_token";
const STATUSES = ["pending", "packed", "shipped", "delivered"];

let token = sessionStorage.getItem(TOKEN_KEY) || "";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function formatRs(n) {
  return `Rs. ${Number(n).toLocaleString("en-PK")}`;
}

async function api(path, options = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const res = await fetch(`/api/admin${path}`, { ...options, headers, body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function showView(name) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $(`#view-${name}`)?.classList.remove("hidden");
  $$(".nav-item[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

async function loadDashboard() {
  const { metrics } = await api("/dashboard");
  $("#metrics-grid").innerHTML = `
    <div class="metric-card"><div class="metric-label">Revenue</div><div class="metric-value">${formatRs(metrics.revenue)}</div></div>
    <div class="metric-card"><div class="metric-label">Orders</div><div class="metric-value">${metrics.orders}</div></div>
    <div class="metric-card"><div class="metric-label">Customers</div><div class="metric-value">${metrics.customers}</div></div>
    <div class="metric-card"><div class="metric-label">Referrals</div><div class="metric-value">${metrics.referralConversions}</div></div>
  `;
  const tbody = $("#recent-orders-table tbody");
  tbody.innerHTML = (metrics.recentOrders || [])
    .map(
      (o) => `<tr>
        <td>${o.id}</td>
        <td>${o.name}</td>
        <td>${formatRs(o.total)}</td>
        <td>${o.status}</td>
      </tr>`
    )
    .join("") || "<tr><td colspan='4'>No orders yet</td></tr>";
}

async function loadOrders() {
  const { orders } = await api("/orders");
  const kanban = $("#kanban");
  kanban.innerHTML = STATUSES.map((status) => {
    const cols = orders.filter((o) => o.status === status);
    return `
      <div class="kanban-col" data-status="${status}">
        <div class="kanban-col-header">${status}<span class="kanban-count">${cols.length}</span></div>
        ${cols.map((o) => orderCard(o)).join("")}
      </div>`;
  }).join("");

  setupKanbanDnD();
}

function orderCard(o) {
  return `<div class="kanban-card" draggable="true" data-order-id="${o.id}">
    <div class="kanban-card-id">${o.id}</div>
    <div class="kanban-card-meta">${o.name} · ${o.city}</div>
    <div class="kanban-card-total">${formatRs(o.total)}</div>
  </div>`;
}

function setupKanbanDnD() {
  let draggedId = null;

  $$(".kanban-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedId = card.dataset.orderId;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });

  $$(".kanban-col").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("drag-over");
    });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      if (!draggedId) return;
      const newStatus = col.dataset.status;
      try {
        await api(`/orders/${draggedId}`, {
          method: "PATCH",
          body: { status: newStatus },
        });
        await loadOrders();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function loadInventory() {
  const { products, lowStock } = await api("/products");
  const alertEl = $("#low-stock-alert");
  if (lowStock?.length) {
    alertEl.innerHTML = `<div class="alert alert-warn">Low stock: ${lowStock.map((p) => `${p.name} (${p.stock})`).join(", ")}</div>`;
  } else {
    alertEl.innerHTML = "";
  }

  const tbody = $("#inventory-table tbody");
  tbody.innerHTML = products
    .map(
      (p) => `<tr data-id="${p.id}">
        <td><strong>${p.name}</strong></td>
        <td>${formatRs(p.price)}</td>
        <td class="${p.stock <= 10 ? "stock-low" : "stock-ok"}">${p.stock}</td>
        <td>${p.featured ? "Yes" : "—"}</td>
        <td>
          <div class="form-row" style="margin:0">
            <input type="number" class="stock-input" value="${p.stock}" min="0" aria-label="Stock">
            <button type="button" class="btn btn-sm btn-ghost save-stock">Save</button>
            <label class="btn btn-sm btn-ghost" style="cursor:pointer">
              Image<input type="file" class="image-input hidden" accept="image/*">
            </label>
          </div>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll(".save-stock").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const id = row.dataset.id;
      const stock = parseInt(row.querySelector(".stock-input").value, 10);
      try {
        await api(`/products/${id}`, { method: "PATCH", body: { stock } });
        await loadInventory();
      } catch (err) {
        alert(err.message);
      }
    });
  });

  tbody.querySelectorAll(".image-input").forEach((input) => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      const row = input.closest("tr");
      const id = row.dataset.id;
      const fd = new FormData();
      fd.append("image", file);
      try {
        await api(`/products/${id}/image`, { method: "POST", body: fd });
        alert("Image uploaded");
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function loadReferrals() {
  const { ambassadors, referrals } = await api("/referrals");
  $("#ambassadors-list").innerHTML =
    ambassadors
      ?.map(
        (a, i) => `<div class="referral-leader">
          <span class="referral-rank">${i + 1}</span>
          <div><strong>${a.name || a.phone}</strong><br><span style="font-size:0.8125rem;color:var(--color-muted)">${a.referral_count} invites · ${a.conversions} conversions</span></div>
        </div>`
      )
      .join("") || "<p>No ambassadors yet</p>";

  $("#referrals-table tbody").innerHTML = (referrals || [])
    .map(
      (r) => `<tr>
        <td>${r.referrer_name || r.referrer_phone}</td>
        <td>${r.referred_name || r.referred_phone}</td>
        <td>${r.converted ? "Yes" : "Pending"}</td>
        <td>${new Date(r.created_at).toLocaleDateString()}</td>
      </tr>`
    )
    .join("") || "<tr><td colspan='4'>No referrals yet</td></tr>";
}

async function loadCustomers() {
  const { customers } = await api("/customers");
  $("#customers-table tbody").innerHTML = customers
    .map(
      (c) => `<tr>
        <td>${c.phone}</td>
        <td>${c.name || "—"}</td>
        <td>${c.points}</td>
        <td>${c.referralCount}</td>
        <td>${formatRs(c.lifetimeValue)}</td>
        <td><button type="button" class="btn btn-sm btn-ghost view-customer" data-phone="${c.phone}">View</button></td>
      </tr>`
    )
    .join("");

  $$(".view-customer").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { customer, orders, rewards } = await api(`/customers/${btn.dataset.phone}`);
      const detail = $("#customer-detail");
      detail.classList.remove("hidden");
      detail.innerHTML = `
        <div class="panel-title">${customer.name || customer.phone}</div>
        <p>Points: ${customer.points} · Level: ${customer.level} · Referrals: ${customer.referralCount}</p>
        <h4 style="margin:1rem 0 0.5rem">Orders (${orders.length})</h4>
        ${orders.map((o) => `<div style="font-size:0.875rem">${o.id} — ${formatRs(o.total)} — ${o.status}</div>`).join("") || "<p>No orders</p>"}
        <h4 style="margin:1rem 0 0.5rem">Recent Rewards</h4>
        ${rewards.map((r) => `<div style="font-size:0.875rem">+${r.points} ${r.type}: ${r.description}</div>`).join("") || "<p>No rewards</p>"}
      `;
    });
  });
}

async function verifyToken() {
  await api("/dashboard");
  return true;
}

function enterApp() {
  $("#login-screen").classList.add("hidden");
  $("#admin-app").classList.remove("hidden");
  loadDashboard();
}

async function tryLogin(inputToken) {
  token = inputToken;
  try {
    await verifyToken();
    sessionStorage.setItem(TOKEN_KEY, token);
    enterApp();
  } catch {
    token = "";
    $("#login-error").textContent = "Invalid token or admin not configured.";
    $("#login-error").classList.remove("hidden");
  }
}

$$(".nav-item[data-view]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const view = btn.dataset.view;
    showView(view);
    if (view === "dashboard") await loadDashboard();
    if (view === "orders") await loadOrders();
    if (view === "inventory") await loadInventory();
    if (view === "referrals") await loadReferrals();
    if (view === "customers") await loadCustomers();
  });
});

$("#login-btn")?.addEventListener("click", () => tryLogin($("#token-input").value.trim()));
$("#token-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryLogin($("#token-input").value.trim());
});
$("#logout-btn")?.addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  token = "";
  location.reload();
});
$("#refresh-dashboard")?.addEventListener("click", loadDashboard);
$("#refresh-orders")?.addEventListener("click", loadOrders);
$("#refresh-inventory")?.addEventListener("click", loadInventory);

if (token) {
  verifyToken().then(enterApp).catch(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    token = "";
  });
}
