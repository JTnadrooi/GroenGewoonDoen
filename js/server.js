const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.get('/message', (req, res) => {
    res.send('Ahoy!');
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));