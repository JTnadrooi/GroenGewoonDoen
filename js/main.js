const API_BASE = 'http://localhost:3000';
const USER_ID = 'user123'; // Replace with real logged-in user logic

// DOM elements
const packageSelect = document.getElementById('packages');
const descriptionEl = document.getElementById('packageDescription');
const orderDateInput = document.getElementById('orderDate');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const orderInfo = document.getElementById('orderInfo');

const gardenSizeContainer = document.getElementById('gardenSizeContainer');
const gardenSizeInput = document.getElementById('gardenSize');
const customDurationContainer = document.getElementById('customDurationContainer');
const customDurationInput = document.getElementById('customDuration');
const costPredictionEl = document.getElementById('costPrediction');
const ordersTableBody = document.getElementById('ordersTableBody');
let packagesCache = [];

// Helper to GET from API
async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
}

// Helper to POST to API
async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('POST failed: ' + res.status);
    return res.json();
}

// Load and render orders
async function loadOrders() {
    try {
        const orders = await apiGet('/orders');

        // show only this user's orders
        const myOrders = orders.filter(o => o.userId === USER_ID);

        ordersTableBody.innerHTML = '';

        if (!myOrders.length) {
            ordersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center">No orders yet</td>
                </tr>
            `;
            return;
        }

        myOrders.forEach(order => {
            const row = document.createElement('tr');

            const quote = order.quote
                ? `$${order.quote}`
                : (order.duration ? `${order.duration.toFixed(2)}h` : '-');

            row.innerHTML = `
                <td>${order.id}</td>
                <td>${order.packageName || '-'}</td>
                <td>${quote}</td>
                <td class="status">${order.status || 'pending'}</td>
                <td>${new Date(order.date).toLocaleString()}</td>
            `;

            // simple status colors
            const statusCell = row.querySelector('.status');
            if (order.status === 'completed') statusCell.style.color = 'green';
            else if (order.status === 'pending') statusCell.style.color = 'orange';
            else if (order.status === 'cancelled') statusCell.style.color = 'red';

            ordersTableBody.appendChild(row);
        });

    } catch (err) {
        console.error('Failed to load orders:', err);
    }
}

async function loadPackages() {
    try {
        const data = await apiGet('/packages');
        packagesCache = data.gardeningPackages || [];

        const customPackage = {
            id: 'custom',
            name: 'Custom',
            description: 'Enter your own duration in hours',
            costPerM2: 0
        };
        packagesCache.push(customPackage);

        renderPackages();

        packageSelect.value = packagesCache[0].id;
        updateUI();
        updateCostPrediction();
    } catch (err) {
        console.error('Failed to load packages:', err);
    }
}

// Render options in the select dropdown
function renderPackages() {
    packageSelect.innerHTML = '';
    packagesCache.forEach(pkg => {
        const option = document.createElement('option');
        option.value = pkg.id;
        option.textContent = pkg.id === 'custom'
            ? pkg.name
            : `${pkg.name} — $${pkg.costPerM2}/m²`;
        packageSelect.appendChild(option);
    });
}

// Get currently selected package
function getSelectedPackage() {
    const id = packageSelect.value;
    return packagesCache.find(p => p.id === id);
}

async function getRateFor(rateId) {
    const data = await apiGet('/rates');
    return data.find(r => r.id == rateId).costPer;
}

// Update UI based on selected package
async function updateUI() {
    const pkg = getSelectedPackage();
    descriptionEl.textContent = pkg ? pkg.description : '';

    if (pkg && pkg.id === 'custom') {
        customDurationContainer.style.display = 'block';
        gardenSizeContainer.style.display = 'none';
    } else {
        customDurationContainer.style.display = 'none';
        gardenSizeContainer.style.display = 'block';
    }

    await updateCostPrediction();
}

// Update cost prediction dynamically
async function updateCostPrediction() {
    const pkg = getSelectedPackage();

    if (!pkg) {
        costPredictionEl.textContent = '';
        return;
    }

    if (pkg.id === 'custom' && !customDurationInput.value.trim()) {
        costPredictionEl.textContent = '';
        return;
    }

    if (pkg.id !== 'custom' && !gardenSizeInput.value.trim()) {
        costPredictionEl.textContent = '';
        return;
    }
    let duration, cost;

    const hourlyRate = await getRateFor("hourly");

    if (pkg.id === 'custom') {
        duration = parseFloat(customDurationInput.value);

        cost = hourlyRate * duration;

        costPredictionEl.textContent =
            `Estimated cost (excluding resources): $${cost.toFixed(2)}, Duration: ${duration.toFixed(2)} hours`;
    } else {
        const size = parseFloat(gardenSizeInput.value);

        if (isNaN(size) || size <= 0) {
            costPredictionEl.textContent = '';
            return;
        }

        duration = Math.ceil(size * 0.45);
        cost = pkg.costPerM2 * size + hourlyRate * duration;

        costPredictionEl.textContent =
            `Estimated cost: $${cost.toFixed(2)}, Duration: ${duration.toFixed(2)} hours`;
    }
}

// Place an order
async function placeOrder() {
    const pkg = getSelectedPackage();
    const datetime = orderDateInput.value;

    if (!pkg || !datetime) {
        alert('Please select a package and date/time.');
        return;
    }

    let duration = 0;
    let size = 0;

    if (pkg.id === 'custom') {
        duration = parseFloat(customDurationInput.value);
        if (isNaN(duration) || duration <= 0) {
            alert('Enter a valid duration for the custom package.');
            return;
        }
    } else {
        size = parseFloat(gardenSizeInput.value);
        if (isNaN(size) || size <= 0) {
            alert('Enter a valid garden size.');
            return;
        }
        duration = (pkg.costPerM2 * size) / 10;
    }

    try {
        const order = await apiPost('/orders', {
            userId: USER_ID,
            duration,
            date: new Date(datetime).toISOString()
        });

        orderInfo.textContent = `Order placed! ID: ${order.id}, Duration: ${duration.toFixed(2)}h, Date: ${new Date(order.date).toLocaleString()}`;

        await loadOrders();
    } catch (err) {
        alert('Failed to place order: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadPackages();
    loadOrders();

    packageSelect.addEventListener('change', updateUI);
    gardenSizeInput.addEventListener('input', updateCostPrediction);
    customDurationInput.addEventListener('input', updateCostPrediction);
    placeOrderBtn.addEventListener('click', placeOrder);
});