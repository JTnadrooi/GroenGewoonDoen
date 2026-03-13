const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const packagesPath = path.join(__dirname, '../data/packages.json');
const ordersPath = path.join(__dirname, '../data/orders.json');
const ratesPath = path.join(__dirname, '../data/rates.json');

app.get('/packages', async (req, res) => {
  try {
    const data = await fs.readFile(packagesPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load packages' });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const { userId, duration, date } = req.body;

    if (!userId || typeof duration !== 'number') {
      return res.status(400).json({ error: 'Invalid order data' });
    }

    let db;
    try {
      const raw = await fs.readFile(ordersPath, 'utf-8');
      db = JSON.parse(raw);
    } catch {
      db = { orders: [] };
    }

    const newOrder = {
      id: Date.now(),
      userId,
      duration, // in decimal hours.
      date: date
    };

    db.orders.push(newOrder);

    await fs.writeFile(ordersPath, JSON.stringify(db, null, 2));

    res.status(201).json(newOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save order' });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const raw = await fs.readFile(ordersPath, 'utf-8');
    const db = JSON.parse(raw);
    res.json(db.orders || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    
    // 1. Read the current file
    const raw = await fs.readFile(ordersPath, 'utf-8');
    const db = JSON.parse(raw);

    // 2. Check if the order exists
    const initialLength = db.orders.length;
    
    // 3. Filter the list: keep everything EXCEPT the order with the specified ID
    db.orders = db.orders.filter(order => order.id !== orderId);

    // 4. Check if something was actually removed
    if (db.orders.length === initialLength) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // 5. Save the updated file
    await fs.writeFile(ordersPath, JSON.stringify(db, null, 2));

    res.status(200).json({ message: 'Order successfully deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error while deleting the order' });
  }
});

app.get('/rates', async (req, res) => {
  try {
    const raw = await fs.readFile(ratesPath, 'utf-8');
    const db = JSON.parse(raw);
    res.json(db.rates || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load rates' });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);