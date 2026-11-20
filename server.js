const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db'); // Database connection file

// 1. Routes import karein
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const roomRoutes = require('./routes/roomRoutes');
const orderRoutes = require('./routes/orderRoutes');
const tableRoutes = require('./routes/tableRoutes');
const menuRoutes = require('./routes/menuRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Database Connection Call
connectDB();

// Middlewares
app.use(cors());

// Gallery ki badi base64 images ko handle karne ke liye limit (50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2. Routes Register Karein
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);

// Test Route
app.get('/api/test', (req, res) => {
    res.json({ message: "Backend, Database, and Routes are all connected!" });
});

// Server Listen
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
