const API_BASE = 'http://localhost:3000';

async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`);

    if (!res.ok) throw new Error('API error');

    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error('POST failed');

    return res.json();
}

const packageSelect = document.getElementById('packages');
const descriptionEl = document.getElementById('packageDescription');
const areaInput = document.getElementById('area');
const totalPriceEl = document.getElementById('totalPrice');

let packagesCache = [];

async function loadPackages() {
    const data = await apiGet('/packages');

    packagesCache = data.gardeningPackages;

    renderPackages();
    if (packagesCache.length > 0) {
        packageSelect.value = packagesCache[0].id;
        updateUI();
    }
}


function renderPackages() {
    packageSelect.innerHTML = '';

    packagesCache.forEach((pkg, index) => {
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
    if (!pkg) return;

    descriptionEl.textContent = pkg.description;

    calculateTotal();
}

function calculateTotal() {
    const pkg = getSelectedPackage();

    const area = parseFloat(areaInput.value) || 0;
    const total = area * pkg.costPerM2;

    totalPriceEl.textContent = total.toFixed(2);
}

packageSelect.addEventListener('change', (e) => {
    updateUI(e.target.value);
});

areaInput.addEventListener('input', calculateTotal);

async function placeOrder() {
    const pkg = getSelectedPackage();
    const area = parseFloat(areaInput.value) || 0;

    if (!pkg || !area) {
        alert('Please select package and enter area');
        return;
    }

    const total = area * pkg.costPerM2;

    const order = await apiPost('/orders', {
        packageId: pkg.id,
        area,
        total
    });

    alert(`Order created! ID: ${order.id}`);

    areaInput.value = '';
    totalPriceEl.textContent = '0.00';
}

document.addEventListener('DOMContentLoaded', () => {
    loadPackages();
});