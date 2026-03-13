// Function to generate the dates of the current week (Mon to Sun)
function getCurrentWeek() {
    const week = [];
    const today = new Date();
    
    // Find the Monday of the current week
    const dayOfWeek = today.getDay(); 
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    const monday = new Date(today.setDate(diff));

    for (let i = 0; i < 7; i++) {
        const nextDay = new Date(monday);
        nextDay.setDate(monday.getDate() + i);
        // Format to YYYY-MM-DD
        week.push(nextDay.toISOString().split('T')[0]);
    }
    return week;
}

async function updateAdminCalendar() {
    const tbody = document.getElementById('admin-calendar-body');
    if (!tbody) return;

    try {
        // UPDATED: We now fetch data via your server instead of the local file.
        // This prevents caching and ensures you always see the most recent (deleted) status.
        const response = await fetch('http://localhost:3000/orders'); 
        
        // Since your server.js (at app.get('/orders')) already returns 'db.orders' directly,
        // the result here is already an array. We no longer need to extract '.orders'.
        const customerOrders = await response.json(); 

        const datesToDisplay = getCurrentWeek();
        tbody.innerHTML = '';
        
        // Current date string for comparison
        const todayStr = new Date().toISOString().split('T')[0];

        datesToDisplay.forEach(dateStr => {
            const rowDate = new Date(dateStr);
            const dayName = rowDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dayNumber = rowDate.getDay(); // 0 = Sunday, 6 = Saturday

            // Check if order exists. We split the order.date to ignore the time (e.g., T22:07:40.643Z)
            const existingOrder = customerOrders.find(order => {
                const orderDateOnly = order.date.split('T')[0];
                return orderDateOnly === dateStr;
            });
            
            let status = 'Available';
            let details = '-';
            let rowStyle = '';
            let actionButton = '-'; // Default no button

            // LOGIC ORDER:
            // 1. Check for Weekend
            if (dayNumber === 0 || dayNumber === 6) {
                status = 'Weekend';
                details = 'Not available';
                rowStyle = 'background-color: #f0f0f0; color: #aaa; font-style: italic;';
            } 
            // 2. Check if there is an order for weekdays
            else if (existingOrder) {
                status = 'Occupied';
                details = `Client: ${existingOrder.userId} (ID: ${existingOrder.id})`;
                rowStyle = 'background-color: #ffcccc; font-weight: bold;';
                
                // UPDATED: 'click' changed to 'onclick' so the button works in HTML.
                actionButton = `<button onclick="deleteOrder(${existingOrder.id})">Delete</button>`;
            } 
            // 3. Check if the date has passed
            else if (dateStr < todayStr) {
                status = 'Expired';
                rowStyle = 'color: #888; background-color: #f9f9f9;';
            }

            const tr = document.createElement('tr');
            if (rowStyle) tr.setAttribute('style', rowStyle);
            
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

// UPDATED: This function is now OUTSIDE updateAdminCalendar so the HTML button can find it.
async function deleteOrder(orderId) {
    // Ask for confirmation before deleting
    if (!confirm(`Are you sure you want to delete order ID ${orderId}?`)) {
        return;
    }

    try {
        // Send a DELETE request to the server
        const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Order successfully deleted!');
            // Reload the calendar to visually remove the deleted order immediately
            updateAdminCalendar();
        } else {
            alert('Something went wrong while deleting the order.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Cannot reach the server.');
    }
}

document.addEventListener('DOMContentLoaded', updateAdminCalendar);