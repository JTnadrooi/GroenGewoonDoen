const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const packagesPath = path.join(__dirname, '../data/packages.json');
const ordersPath = path.join(__dirname, '../data/orders.json');


app.get('/packages', async (req, res) => {
    const data = await fs.readFile(packagesPath, 'utf-8');
    res.json(JSON.parse(data));
});


app.post('/orders', async (req, res) => {
    try {
        const { packageId, area, total } = req.body;

        const raw = await fs.readFile(ordersPath, 'utf-8');
        const db = JSON.parse(raw);

        const newOrder = {
            id: Date.now(),
            packageId,
            area,
            total,
            status: 'pending',
            date: new Date().toISOString()
        };

        db.orders.push(newOrder);

        await fs.writeFile(ordersPath, JSON.stringify(db, null, 2));

        res.status(201).json(newOrder);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save order' });
    }
});


app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
);