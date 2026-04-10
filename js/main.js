// main.js talks to the backend through api.js.
// apiFetch handles finding the working backend origin and sending requests there.
import { apiFetch, getBackendOrigin } from "./api.js";

// Stores the currently logged-in user once /me has been loaded.
let currentUser = null;

// Stores the package list loaded from the server.
// A custom package is added on the frontend after loading.
let packagesCache = [];

// Stores the hourly rate loaded from /rates.
let hourlyRate = 0;

// Main page elements used by the order form.
const packageSelect = document.getElementById("packages");
const descriptionEl = document.getElementById("packageDescription");
const orderDateInput = document.getElementById("orderDate");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderInfo = document.getElementById("orderInfo");

// Elements that are shown or hidden depending on the selected package.
const gardenSizeContainer = document.getElementById("gardenSizeContainer");
const gardenSizeInput = document.getElementById("gardenSize");
const customDurationContainer = document.getElementById("customDurationContainer");
const customDurationInput = document.getElementById("customDuration");
const costPredictionEl = document.getElementById("costPrediction");

// Table body where the user's orders are displayed.
const ordersTableBody = document.getElementById("ordersTableBody");

// Sends a GET request to the backend and returns parsed JSON.
// If the backend says 401, return a special object instead of throwing.
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

// Sends a POST request with JSON and returns parsed JSON.
// Just like apiGet, a 401 becomes a special object instead of a thrown error.
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

// Loads the current user profile from /me.
// If the user is not logged in, currentUser becomes null.
async function getCurrentUser() {
  const data = await apiGet("/me");

  if (data && data.__unauthorized) {
    currentUser = null;
    return null;
  }

  currentUser = data || null;
  return currentUser;
}

// Logs the user out through the backend and then redirects to the login page.
// If the request fails, it still tries to redirect safely.
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

// Loads the user's orders and fills the orders table.
// If the user is not logged in, a friendly message is shown instead.
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

    // The backend already returns the current user's own orders.
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

      // Show a quote if present, otherwise show the duration.
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

      // Color the status for easier reading.
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

// Loads the package list from the server and adds a custom package option.
async function loadPackages() {
  if (!packageSelect) return;

  try {
    const data = await apiGet("/packages");

    if (data && data.__unauthorized) {
      return;
    }

    // Support both a plain array and an object with gardeningPackages.
    if (Array.isArray(data)) {
      packagesCache = data.slice();
    } else {
      packagesCache = (data && data.gardeningPackages) ? data.gardeningPackages.slice() : [];
    }

    // Add the custom package option manually on the frontend.
    const customPackage = {
      id: "custom",
      name: "Custom",
      description: "Enter your own duration in hours",
      costPerM2: 0
    };

    packagesCache.push(customPackage);

    renderPackages();

    // Select the first package by default if any exist.
    if (packagesCache.length > 0) {
      packageSelect.value = packagesCache[0].id;
    }

    await updateUI();
    await updateCostPrediction();
  } catch (err) {
    console.error("Failed to load packages:", err);
  }
}

// Renders the package dropdown from packagesCache.
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

// Returns the package object that is currently selected in the dropdown.
function getSelectedPackage() {
  if (!packageSelect) return null;

  const id = packageSelect.value;

  return packagesCache.find(function (p) {
    return p.id === id;
  }) || null;
}

// Loads the rates list and returns the numeric costPer value for the given rate ID.
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

// Updates the visible form fields and package description based on the selected package.
async function updateUI() {
  const pkg = getSelectedPackage();

  if (descriptionEl) {
    descriptionEl.textContent = pkg ? pkg.description : "";
  }

  // The custom package uses a duration field instead of garden size.
  if (pkg && pkg.id === "custom") {
    if (customDurationContainer) customDurationContainer.style.display = "block";
    if (gardenSizeContainer) gardenSizeContainer.style.display = "none";
  } else {
    if (customDurationContainer) customDurationContainer.style.display = "none";
    if (gardenSizeContainer) gardenSizeContainer.style.display = "block";
  }

  await updateCostPrediction();
}

// Recalculates the estimated cost and duration shown to the user.
async function updateCostPrediction() {
  const pkg = getSelectedPackage();

  if (!costPredictionEl) return;

  if (!pkg) {
    costPredictionEl.textContent = "";
    return;
  }

  // If the required input is empty, do not show an estimate yet.
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

    // Keep the current formula exactly as it already works.
    duration = Math.ceil(size * 0.45);
    cost = Number(pkg.costPerM2 || 0) * size + hourlyRate * duration;

    costPredictionEl.textContent =
      `Estimated cost: $${cost.toFixed(2)}, Duration: ${duration.toFixed(2)} hours`;
  }
}

// Sends a new order to the backend using the current form values.
async function placeOrder() {
  const pkg = getSelectedPackage();
  const datetime = orderDateInput ? orderDateInput.value : "";

  if (!pkg || !datetime) {
    alert("Please select a package and date/time.");
    return;
  }

  // Make sure the user is logged in before placing an order.
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

    // Keep the existing duration formula exactly as it is.
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

    // Refresh the orders table after placing a new order.
    await loadOrders();
  } catch (err) {
    alert("Failed to place order: " + err.message);
  }
}

// When the page is ready, load the initial data and connect the event handlers.
document.addEventListener('DOMContentLoaded', async () => {
    loadPackages();
    loadOrders();

    hourlyRate = await getRateFor("hourly");

    packageSelect.addEventListener('change', updateUI);
    gardenSizeInput.addEventListener('input', updateCostPrediction);
    customDurationInput.addEventListener('input', updateCostPrediction);
    placeOrderBtn.addEventListener('click', placeOrder);
});

// Expose logout globally so inline HTML can call it if needed.
window.logout = logout;