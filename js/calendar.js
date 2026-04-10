// Returns the dates for the current week from Monday to Sunday.
// Each date is returned as a string in YYYY-MM-DD format.
function getCurrentWeek() {
    const week = [];
    const today = new Date();

    // Find the Monday of the current week.
    // getDay() returns 0 for Sunday, 1 for Monday, and so on.
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));

    // Build the 7 dates of the week starting from Monday.
    for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i);

        // Keep only the date part, not the time.
        week.push(nextDay.toISOString().split('T')[0]);
    }

    return week;
}

// Loads the current week's orders into the admin calendar table.
async function updateAdminCalendar() {
    const tbody = document.getElementById('admin-calendar-body');

    // Stop if this page does not contain the admin calendar table.
    if (!tbody) return;

    try {
        // Load all orders from the backend.
        const response = await fetch('http://localhost:3000/orders');
        const customerOrders = await response.json();

        const datesToDisplay = getCurrentWeek();
        tbody.innerHTML = '';

        // Get today's date for checking whether a day is already in the past.
        const todayStr = new Date().toISOString().split('T')[0];

        datesToDisplay.forEach(dateStr => {
            const rowDate = new Date(dateStr);
            const dayName = rowDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dayNumber = rowDate.getDay(); // 0 = Sunday, 6 = Saturday

            // Find whether there is an order on this exact date.
            const existingOrder = customerOrders.find(order => {
                const orderDateOnly = order.date.split('T')[0];
                return orderDateOnly === dateStr;
            });

            let status = 'Available';
            let details = '-';
            let rowStyle = '';
            let actionButton = '-';

            // Weekend days are marked as unavailable.
            if (dayNumber === 0 || dayNumber === 6) {
                status = 'Weekend';
                details = 'Not available';
                rowStyle = 'background-color: #f0f0f0; color: #aaa; font-style: italic;';
            }
            // If there is an order on a weekday, mark it as occupied.
            else if (existingOrder) {
                status = 'Occupied';
                details = `Client: ${existingOrder.userId} (ID: ${existingOrder.id})`;
                rowStyle = 'background-color: #ffcccc; font-weight: bold;';
                actionButton = `<button onclick="deleteOrder(${existingOrder.id})">Delete</button>`;
            }
            // If the date is in the past and still has no order, mark it as expired.
            else if (dateStr < todayStr) {
                status = 'Expired';
                rowStyle = 'color: #888; background-color: #f9f9f9;';
            }

            const tr = document.createElement('tr');

            if (rowStyle) {
                tr.setAttribute('style', rowStyle);
            }

            tr.innerHTML = `
                <td>${dayName}</td>
                <td>${dateStr}</td>
                <td>${status}</td>
                <td>${details}</td>
                <td>${actionButton}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading data:", error);
        tbody.innerHTML = '<tr><td colspan="5">Error loading calendar data.</td></tr>';
    }
}

// Deletes one order by ID and refreshes the calendar afterwards.
async function deleteOrder(orderId) {
    // Ask for confirmation before deleting.
    if (!confirm(`Are you sure you want to delete order ID ${orderId}?`)) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Order successfully deleted!');
            updateAdminCalendar();
        } else {
            alert('Something went wrong while deleting the order.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Cannot reach the server.');
    }
}

// Load the admin calendar as soon as the page is ready.
document.addEventListener('DOMContentLoaded', updateAdminCalendar);