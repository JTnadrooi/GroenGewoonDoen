const API_BASE = 'http://localhost:3000';
const USER_ID = 'user123'; // Replace with real logged-in user logic

const packageSelect = document.getElementById('packages');
const descriptionEl = document.getElementById('packageDescription');
const orderDateInput = document.getElementById('orderDate');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const orderInfo = document.getElementById('orderInfo');

let packagesCache = [];

async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error('API error: ' + res.status);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('POST failed: ' + res.status);
    return res.json();
}

async function loadPackages() {
    try {
        const data = await apiGet('/packages');
        packagesCache = data.gardeningPackages || [];

        renderPackages();

        if (packagesCache.length > 0) {
            packageSelect.value = packagesCache[0].id;
            updateUI();
        }
    } catch (err) {
        console.error('Failed to load packages:', err);
    }
}

function renderPackages() {
    packageSelect.innerHTML = '';
    packagesCache.forEach(pkg => {
        const option = document.createElement('option');
        option.value = pkg.id;
        option.textContent = `${pkg.name} — $${pkg.costPerM2}/m²`;
        packageSelect.appendChild(option);
    });
}

function getSelectedPackage() {
    const id = packageSelect.value;
    return packagesCache.find(p => p.id === id);
}

function updateUI() {
    const pkg = getSelectedPackage();
    descriptionEl.textContent = pkg ? pkg.description : '';
}

async function placeOrder() {
    const pkg = getSelectedPackage();
    const datetime = orderDateInput.value;

    if (!pkg || !datetime) {
        alert('Please select a package and date/time.');
        return;
    }

    const duration = (pkg.costPerM2 || 0) / 10;

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

document.addEventListener('DOMContentLoaded', () => {
    loadPackages();

    packageSelect.addEventListener('change', updateUI);

    placeOrderBtn.addEventListener('click', placeOrder);
});