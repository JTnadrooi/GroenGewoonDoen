import { apiFetch, getBackendOrigin } from "./api.js";

let currentUser = null;
let packagesCache = [];
let hourlyRate = 0;

const packageSelect = document.getElementById("packages");
const descriptionEl = document.getElementById("packageDescription");
const orderDateInput = document.getElementById("orderDate");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderInfo = document.getElementById("orderInfo");

const gardenSizeContainer = document.getElementById("gardenSizeContainer");
const gardenSizeInput = document.getElementById("gardenSize");
const customDurationContainer = document.getElementById("customDurationContainer");
const customDurationInput = document.getElementById("customDuration");
const costPredictionEl = document.getElementById("costPrediction");
const ordersTableBody = document.getElementById("ordersTableBody");

async function apiGet(path) {
  const result = await apiFetch(path, {
    method: "GET",
    headers: {
      "Accept": "application/json"
    }
  });

  const res = result.res;

  if (res.status === 401) {
    return { __unauthorized: true };
  }

  if (!res.ok) {
    throw new Error("API error: " + res.status);
  }

  return res.json();
}

async function apiPost(path, body) {
  const result = await apiFetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(body || {})
  });

  const res = result.res;

  if (res.status === 401) {
    return { __unauthorized: true };
  }

  if (!res.ok) {
    throw new Error("POST failed: " + res.status);
  }

  return res.json();
}

async function getCurrentUser() {
  const data = await apiGet("/me");
  if (data && data.__unauthorized) {
    currentUser = null;
    return null;
  }

  currentUser = data || null;
  return currentUser;
}

async function logout() {
  try {
    const result = await apiFetch("/logout", {
      method: "POST",
      headers: {
        "Accept": "application/json"
      }
    });

    const data = await result.res.json().catch(function () {
      return {};
    });

    window.location.href = result.origin + (data.redirect || "/login");
  } catch (e) {
    console.error("Logout failed:", e);

    try {
      const origin = await getBackendOrigin();
      window.location.href = origin + "/login";
    } catch {
      window.location.href = "/html/login.html";
    }
  }
}

async function loadOrders() {
  if (!ordersTableBody) return;

  try {
    const orders = await apiGet("/orders");

    if (orders && orders.__unauthorized) {
      ordersTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center">Please log in to view your orders</td>
        </tr>
      `;
      return;
    }

    const myOrders = Array.isArray(orders) ? orders : [];

    ordersTableBody.innerHTML = "";

    if (!myOrders.length) {
      ordersTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center">No orders yet</td>
        </tr>
      `;
      return;
    }

    myOrders.forEach(function (order) {
      const row = document.createElement("tr");

      const quote = order.quote
        ? `$${Number(order.quote).toFixed(2)}`
        : (order.duration ? `${Number(order.duration).toFixed(2)}h` : "-");

      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.packageName || "-"}</td>
        <td>${quote}</td>
        <td class="status">${order.status || "pending"}</td>
        <td>${order.date ? new Date(order.date).toLocaleString() : "-"}</td>
      `;

      const statusCell = row.querySelector(".status");
      if (statusCell) {
        if (order.status === "completed") statusCell.style.color = "green";
        else if (order.status === "pending") statusCell.style.color = "orange";
        else if (order.status === "cancelled") statusCell.style.color = "red";
      }

      ordersTableBody.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to load orders:", err);

    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center">Failed to load orders</td>
      </tr>
    `;
  }
}

async function loadPackages() {
  if (!packageSelect) return;

  try {
    const data = await apiGet("/packages");

    if (data && data.__unauthorized) {
      return;
    }

    if (Array.isArray(data)) {
      packagesCache = data.slice();
    } else {
      packagesCache = (data && data.gardeningPackages) ? data.gardeningPackages.slice() : [];
    }

    const customPackage = {
      id: "custom",
      name: "Custom",
      description: "Enter your own duration in hours",
      costPerM2: 0
    };

    packagesCache.push(customPackage);

    renderPackages();

    if (packagesCache.length > 0) {
      packageSelect.value = packagesCache[0].id;
    }

    await updateUI();
    await updateCostPrediction();
  } catch (err) {
    console.error("Failed to load packages:", err);
  }
}

function renderPackages() {
  if (!packageSelect) return;

  packageSelect.innerHTML = "";

  packagesCache.forEach(function (pkg) {
    const option = document.createElement("option");
    option.value = pkg.id;
    option.textContent = pkg.id === "custom"
      ? pkg.name
      : `${pkg.name} — $${Number(pkg.costPerM2 || 0).toFixed(2)}/m²`;

    packageSelect.appendChild(option);
  });
}

function getSelectedPackage() {
  if (!packageSelect) return null;

  const id = packageSelect.value;
  return packagesCache.find(function (p) {
    return p.id === id;
  }) || null;
}

async function getRateFor(rateId) {
  const data = await apiGet("/rates");

  if (data && data.__unauthorized) {
    return 0;
  }

  const rates = Array.isArray(data) ? data : [];
  const match = rates.find(function (r) {
    return r.id == rateId;
  });

  return match ? Number(match.costPer || 0) : 0;
}

async function updateUI() {
  const pkg = getSelectedPackage();

  if (descriptionEl) {
    descriptionEl.textContent = pkg ? pkg.description : "";
  }

  if (pkg && pkg.id === "custom") {
    if (customDurationContainer) customDurationContainer.style.display = "block";
    if (gardenSizeContainer) gardenSizeContainer.style.display = "none";
  } else {
    if (customDurationContainer) customDurationContainer.style.display = "none";
    if (gardenSizeContainer) gardenSizeContainer.style.display = "block";
  }

  await updateCostPrediction();
}

async function updateCostPrediction() {
  const pkg = getSelectedPackage();

  if (!costPredictionEl) return;

  if (!pkg) {
    costPredictionEl.textContent = "";
    return;
  }

  if (pkg.id === "custom" && (!customDurationInput || !customDurationInput.value.trim())) {
    costPredictionEl.textContent = "";
    return;
  }

  if (pkg.id !== "custom" && (!gardenSizeInput || !gardenSizeInput.value.trim())) {
    costPredictionEl.textContent = "";
    return;
  }

  let duration;
  let cost;

  if (pkg.id === "custom") {
    duration = parseFloat(customDurationInput.value);

    if (isNaN(duration) || duration <= 0) {
      costPredictionEl.textContent = "";
      return;
    }

    cost = hourlyRate * duration;

    costPredictionEl.textContent =
      `Estimated cost (excluding resources): $${cost.toFixed(2)}, Duration: ${duration.toFixed(2)} hours`;
  } else {
    const size = parseFloat(gardenSizeInput.value);

    if (isNaN(size) || size <= 0) {
      costPredictionEl.textContent = "";
      return;
    }

    duration = Math.ceil(size * 0.45);
    cost = Number(pkg.costPerM2 || 0) * size + hourlyRate * duration;

    costPredictionEl.textContent =
      `Estimated cost: $${cost.toFixed(2)}, Duration: ${duration.toFixed(2)} hours`;
  }
}

async function placeOrder() {
  const pkg = getSelectedPackage();
  const datetime = orderDateInput ? orderDateInput.value : "";

  if (!pkg || !datetime) {
    alert("Please select a package and date/time.");
    return;
  }

  if (!currentUser) {
    const me = await getCurrentUser();
    if (!me) {
      alert("Please log in before placing an order.");
      return;
    }
  }

  let duration = 0;
  let size = 0;

  if (pkg.id === "custom") {
    duration = parseFloat(customDurationInput.value);

    if (isNaN(duration) || duration <= 0) {
      alert("Enter a valid duration for the custom package.");
      return;
    }
  } else {
    size = parseFloat(gardenSizeInput.value);

    if (isNaN(size) || size <= 0) {
      alert("Enter a valid garden size.");
      return;
    }

    duration = (Number(pkg.costPerM2 || 0) * size) / 10;
  }

  try {
    const order = await apiPost("/orders", {
      duration: duration,
      date: new Date(datetime).toISOString(),
      packageId: pkg.id,
      packageName: pkg.name,
      gardenSize: size || null
    });

    if (order && order.__unauthorized) {
      alert("Please log in before placing an order.");
      return;
    }

    if (orderInfo) {
      orderInfo.textContent =
        `Order placed! ID: ${order.id}, Duration: ${duration.toFixed(2)}h, Date: ${new Date(order.date).toLocaleString()}`;
    }

    await loadOrders();
  } catch (err) {
    alert("Failed to place order: " + err.message);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  await getCurrentUser();
  await loadPackages();
  await loadOrders();

  hourlyRate = await getRateFor("hourly");

  if (packageSelect) {
    packageSelect.addEventListener("change", updateUI);
  }

  if (gardenSizeInput) {
    gardenSizeInput.addEventListener("input", updateCostPrediction);
  }

  if (customDurationInput) {
    customDurationInput.addEventListener("input", updateCostPrediction);
  }

  if (placeOrderBtn) {
    placeOrderBtn.addEventListener("click", placeOrder);
  }

  await updateCostPrediction();
});

window.logout = logout;