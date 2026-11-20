const express = require('express');
const router = express.Router();
const MenuItem = require('../models/MenuItemModel');

// Default initial menu items to seed if empty
const seedDefaultMenu = async () => {
    try {
        const count = await MenuItem.countDocuments();
        if (count === 0) {
            console.log("No menu items found. Seeding initial restaurant menu...");
            await MenuItem.create([
                { name: 'Paneer Tikka', category: 'Starters', price: 300, type: 'Veg', img: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=300&q=80' },
                { name: 'Crispy Veg Spring Roll', category: 'Starters', price: 220, type: 'Veg', img: 'https://images.unsplash.com/photo-1548365328-8c6db32c3836?auto=format&fit=crop&w=300&q=80' },
                { name: 'Butter Chicken', category: 'Main Course', price: 400, type: 'Non-Veg', img: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=300&q=80' },
                { name: 'Dal Makhani', category: 'Main Course', price: 240, type: 'Veg', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80' },
                { name: 'Veg Manchurian', category: 'Chinese', price: 250, type: 'Veg', img: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=300&q=80' },
                { name: 'Hakka Noodles', category: 'Chinese', price: 220, type: 'Veg', img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=300&q=80' },
                { name: 'Butter Naan', category: 'Breads', price: 45, type: 'Veg', img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=300&q=80' },
                { name: 'Garlic Naan', category: 'Breads', price: 60, type: 'Veg', img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=300&q=80' },
                { name: 'Veg Biryani', category: 'Rice', price: 260, type: 'Veg', img: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80' },
                { name: 'Jeera Rice', category: 'Rice', price: 170, type: 'Veg', img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=300&q=80' },
                { name: 'Cold Coffee', category: 'Drinks', price: 150, type: 'Beverage', img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=300&q=80' },
                { name: 'Gulab Jamun', category: 'Desserts', price: 120, type: 'Dessert', img: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?auto=format&fit=crop&w=300&q=80' },
            ]);
            console.log("Initial menu seeded successfully!");
        }
    } catch (err) {
        console.error("Menu seed error:", err.message);
    }
};

// Seed on startup
seedDefaultMenu();

// 1. GET: Fetch all menu dishes
router.get('/', async (req, res) => {
    try {
        const items = await MenuItem.find().sort({ category: 1, name: 1 });
        res.status(200).json(items);
    } catch (error) {
        res.status(500).json({ message: "Error fetching menu: " + error.message });
    }
});

// 2. POST: Add new dish
router.post('/add', async (req, res) => {
    try {
        const { name, category, price, img, type, description, available } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Dish name is required" });
        }
        if (price === undefined || isNaN(Number(price))) {
            return res.status(400).json({ message: "Valid price is required" });
        }

        // Strict Image Size Validation (Max 1 MB / 1024 KB)
        if (img && img.startsWith('data:image')) {
            const approxBytes = Math.round(img.length * 0.75);
            const maxBytes = 1 * 1024 * 1024; // 1 MB
            if (approxBytes > maxBytes) {
                const sizeMB = (approxBytes / (1024 * 1024)).toFixed(2);
                return res.status(400).json({ 
                    message: `Dish image is too large (${sizeMB} MB)! Maximum limit is 1 MB (1,024 KB). Please upload an image under 1 MB.` 
                });
            }
        }

        const newDish = new MenuItem({
            name: name.trim(),
            category: category ? category.trim() : 'Main Course',
            price: Number(price),
            img: img && img.trim() !== '' ? img : 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80',
            type: type || 'Veg',
            description: description || '',
            available: available !== undefined ? Boolean(available) : true
        });

        const savedDish = await newDish.save();
        res.status(201).json({ message: "New dish added successfully!", dish: savedDish });
    } catch (error) {
        res.status(500).json({ message: "Error adding dish: " + error.message });
    }
});

// 3. PUT: Edit existing dish
router.put('/:id', async (req, res) => {
    try {
        const dishId = req.params.id;
        const { name, category, price, img, type, description, available } = req.body;

        // Strict Image Size Validation (Max 1 MB / 1024 KB)
        if (img && img.startsWith('data:image')) {
            const approxBytes = Math.round(img.length * 0.75);
            const maxBytes = 1 * 1024 * 1024; // 1 MB
            if (approxBytes > maxBytes) {
                const sizeMB = (approxBytes / (1024 * 1024)).toFixed(2);
                return res.status(400).json({ 
                    message: `Dish image is too large (${sizeMB} MB)! Maximum limit is 1 MB (1,024 KB). Please upload an image under 1 MB.` 
                });
            }
        }

        const updatedDish = await MenuItem.findByIdAndUpdate(
            dishId,
            {
                ...(name && { name: name.trim() }),
                ...(category && { category: category.trim() }),
                ...(price !== undefined && { price: Number(price) }),
                ...(img && { img }),
                ...(type && { type }),
                ...(description !== undefined && { description }),
                ...(available !== undefined && { available: Boolean(available) })
            },
            { new: true }
        );

        if (!updatedDish) {
            return res.status(404).json({ message: "Dish not found" });
        }

        res.status(200).json({ message: "Dish updated successfully!", dish: updatedDish });
    } catch (error) {
        res.status(500).json({ message: "Error updating dish: " + error.message });
    }
});

// 4. DELETE: Delete dish
router.delete('/:id', async (req, res) => {
    try {
        const dishId = req.params.id;
        const deleted = await MenuItem.findByIdAndDelete(dishId);

        if (!deleted) {
            return res.status(404).json({ message: "Dish not found" });
        }

        res.status(200).json({ message: `Dish "${deleted.name}" deleted successfully!` });
    } catch (error) {
        res.status(500).json({ message: "Error deleting dish: " + error.message });
    }
});

module.exports = router;
