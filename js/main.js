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

// Load packages from API and render
async function loadPackages() {
    try {
        const data = await apiGet('/packages');
        packagesCache = data.gardeningPackages || [];

        // Always add "Custom" package
        const customPackage = {
            id: 'custom',
            name: 'Custom',
            description: 'Enter your own duration in hours',
            costPerM2: 0 // no automatic cost
        };
        packagesCache.push(customPackage);

        renderPackages();

        // Select first package by default
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

// Update UI based on selected package
function updateUI() {
    const pkg = getSelectedPackage();
    descriptionEl.textContent = pkg ? pkg.description : '';

    if (pkg && pkg.id === 'custom') {
        customDurationContainer.style.display = 'block';
        gardenSizeContainer.style.display = 'none';
    } else {
        customDurationContainer.style.display = 'none';
        gardenSizeContainer.style.display = 'block';
    }

    updateCostPrediction();
}

// Update cost prediction dynamically
function updateCostPrediction() {
    const pkg = getSelectedPackage();

    if (!pkg) {
        costPredictionEl.textContent = '';
        return;
    }

    if (pkg.id === 'custom') {
        const customDuration = parseFloat(customDurationInput.value);
        costPredictionEl.textContent = (!isNaN(customDuration) && customDuration > 0)
            ? `Custom duration: ${customDuration.toFixed(2)} hours`
            : 'Enter your desired duration to see prediction';
    } else {
        const size = parseFloat(gardenSizeInput.value);
        if (isNaN(size) || size <= 0) {
            costPredictionEl.textContent = '';
            return;
        }
        const cost = pkg.costPerM2 * size;
        const duration = cost / 10;
        costPredictionEl.textContent = `Estimated cost: $${cost.toFixed(2)}, Duration: ${duration.toFixed(2)} hours`;
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
    } catch (err) {
        alert('Failed to place order: ' + err.message);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadPackages();

    packageSelect.addEventListener('change', updateUI);
    gardenSizeInput.addEventListener('input', updateCostPrediction);
    customDurationInput.addEventListener('input', updateCostPrediction);
    placeOrderBtn.addEventListener('click', placeOrder);
});