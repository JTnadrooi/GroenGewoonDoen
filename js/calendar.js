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
        // Fetch data from JSON file
        const response = await fetch('../data/orders.json'); 
        const jsonData = await response.json();
        
        // Pakt specifiek de 'orders' array uit je JSON
        const customerOrders = jsonData.orders; 

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
                // Aangepast naar existingOrder.userId
                details = `Client: ${existingOrder.userId} (ID: ${existingOrder.id})`;
                rowStyle = 'background-color: #ffcccc; font-weight: bold;';
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
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error loading data:", error);
        tbody.innerHTML = '<tr><td colspan="4">Error loading calendar data.</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', updateAdminCalendar);