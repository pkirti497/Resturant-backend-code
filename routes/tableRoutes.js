const express = require('express');
const router = express.Router();
const Table = require('../models/TableModel');

// Helper to seed initial tables if none exist
const seedDefaultTables = async () => {
    try {
        const count = await Table.countDocuments();
        if (count === 0) {
            console.log("No tables found. Seeding default restaurant tables...");
            await Table.create([
                { name: 'Table 1', capacity: 4, floor: 'Main Hall', status: 'Available', customerName: '', guests: 0, order: [] },
                { name: 'Table 2', capacity: 4, floor: 'Main Hall', status: 'Available', customerName: '', guests: 0, order: [] },
                { name: 'Table 3', capacity: 2, floor: 'Window Side', status: 'Available', customerName: '', guests: 0, order: [] },
                { name: 'Table 4', capacity: 6, floor: 'Family Corner', status: 'Available', customerName: '', guests: 0, order: [] },
                { name: 'Table 5', capacity: 4, floor: 'Garden Area', status: 'Available', customerName: '', guests: 0, order: [] },
                { name: 'Table 6', capacity: 8, floor: 'VIP Lounge', status: 'Available', customerName: '', guests: 0, order: [] },
            ]);
            console.log("Default tables seeded successfully!");
        }
    } catch (err) {
        console.error("Table seed error:", err.message);
    }
};

// Seed tables
seedDefaultTables();

// 1. GET: Fetch all tables
router.get('/', async (req, res) => {
    try {
        const tables = await Table.find().sort({ createdAt: 1 });
        res.status(200).json(tables);
    } catch (error) {
        res.status(500).json({ message: "Error fetching tables", error: error.message });
    }
});

// 2. POST: Add new table
router.post('/add', async (req, res) => {
    try {
        const { name, capacity, floor, status } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Table name/number is required" });
        }

        // Check if table name already exists
        const existing = await Table.findOne({ name: name.trim() });
        if (existing) {
            return res.status(400).json({ message: `Table "${name}" already exists!` });
        }

        const newTable = new Table({
            name: name.trim(),
            capacity: Number(capacity) || 4,
            floor: floor || 'Main Hall',
            status: status || 'Available',
            customerName: '',
            guests: 0,
            order: []
        });

        const savedTable = await newTable.save();
        res.status(201).json({ message: "Table created successfully!", table: savedTable });
    } catch (error) {
        res.status(500).json({ message: "Error creating table", error: error.message });
    }
});

// 3. PUT: Edit table
router.put('/:id', async (req, res) => {
    try {
        const tableId = req.params.id;
        const { name, capacity, floor, status, customerName, guests, order } = req.body;

        const updatedTable = await Table.findByIdAndUpdate(
            tableId,
            {
                ...(name && { name: name.trim() }),
                ...(capacity !== undefined && { capacity: Number(capacity) }),
                ...(floor && { floor }),
                ...(status && { status }),
                ...(customerName !== undefined && { customerName }),
                ...(guests !== undefined && { guests: Number(guests) }),
                ...(order !== undefined && { order })
            },
            { new: true }
        );

        if (!updatedTable) {
            return res.status(404).json({ message: "Table not found" });
        }

        res.status(200).json({ message: "Table updated successfully!", table: updatedTable });
    } catch (error) {
        res.status(500).json({ message: "Error updating table", error: error.message });
    }
});

// 4. DELETE: Delete a table
router.delete('/:id', async (req, res) => {
    try {
        const tableId = req.params.id;
        const deletedTable = await Table.findByIdAndDelete(tableId);

        if (!deletedTable) {
            return res.status(404).json({ message: "Table not found" });
        }

        res.status(200).json({ message: `Table ${deletedTable.name} deleted successfully!` });
    } catch (error) {
        res.status(500).json({ message: "Error deleting table", error: error.message });
    }
});

// 5. POST: Clear table status back to Available
router.post('/:id/clear', async (req, res) => {
    try {
        const tableId = req.params.id;
        const table = await Table.findByIdAndUpdate(
            tableId,
            {
                status: 'Available',
                customerName: '',
                guests: 0,
                order: []
            },
            { new: true }
        );

        if (!table) {
            return res.status(404).json({ message: "Table not found" });
        }

        res.status(200).json({ message: `Table ${table.name} cleared successfully!`, table });
    } catch (error) {
        res.status(500).json({ message: "Error clearing table", error: error.message });
    }
});

module.exports = router;
