const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');

const JWT_SECRET = process.env.JWT_SECRET || 'green_valley_secret_jwt_key_2026';

// Seed default accounts if they don't exist
const seedDefaultUsers = async () => {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            console.log("No users found. Seeding default Administrator and Admin accounts...");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            await User.create([
                {
                    name: "Main Administrator",
                    email: "administrator@greenvalley.com",
                    password: hashedPassword,
                    role: "Administrator",
                    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
                    phone: "+91 98765 00001",
                    status: "Active"
                },
                {
                    name: "Operations Admin",
                    email: "admin@greenvalley.com",
                    password: hashedPassword,
                    role: "Admin",
                    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
                    phone: "+91 98765 00002",
                    status: "Active"
                }
            ]);
            console.log("Default accounts seeded successfully!");
        } else {
            // Check if Administrator and Admin specifically exist
            const adminExists = await User.findOne({ role: 'Admin' });
            const administratorExists = await User.findOne({ role: 'Administrator' });

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);

            if (!administratorExists) {
                await User.create({
                    name: "Main Administrator",
                    email: "administrator@greenvalley.com",
                    password: hashedPassword,
                    role: "Administrator",
                    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
                    phone: "+91 98765 00001",
                    status: "Active"
                });
                console.log("Administrator account seeded!");
            }

            if (!adminExists) {
                await User.create({
                    name: "Operations Admin",
                    email: "admin@greenvalley.com",
                    password: hashedPassword,
                    role: "Admin",
                    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
                    phone: "+91 98765 00002",
                    status: "Active"
                });
                console.log("Admin account seeded!");
            }
        }
    } catch (error) {
        console.error("User seed error:", error.message);
    }
};

// Run seeder once
seedDefaultUsers();

// Middleware to authenticate JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Authorization token missing or invalid" });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Token expired or invalid" });
    }
};

// 1. POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find user by email
        let user = await User.findOne({ email: normalizedEmail });

        // Fallback for demo convenience if user doesn't exist in DB yet
        if (!user) {
            if (normalizedEmail === 'administrator@greenvalley.com' && password === 'admin123') {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);
                user = await User.create({
                    name: "Main Administrator",
                    email: "administrator@greenvalley.com",
                    password: hashedPassword,
                    role: "Administrator",
                    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                });
            } else if (normalizedEmail === 'admin@greenvalley.com' && password === 'admin123') {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);
                user = await User.create({
                    name: "Operations Admin",
                    email: "admin@greenvalley.com",
                    password: hashedPassword,
                    role: "Admin",
                    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
                });
            } else {
                return res.status(401).json({ success: false, message: "Invalid email or password!" });
            }
        }

        // Compare password (support hashed or direct demo password)
        const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
        const isDirectMatch = (password === user.password);

        if (!isMatch && !isDirectMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password!" });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({ success: false, message: "Account is inactive. Contact Administrator." });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            success: true,
            message: `Login successful! Welcome ${user.name}`,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error during login", error: error.message });
    }
});

// 2. GET /api/auth/me (Get current authenticated user)
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching user", error: error.message });
    }
});

// 3. GET /api/auth/users (List all registered system users)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error fetching users", error: error.message });
    }
});

// 4. POST /api/auth/register (Create new staff/admin user)
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Please provide name, email, and password" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(400).json({ success: false, message: "User with this email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
            role: role === 'Administrator' ? 'Administrator' : 'Admin',
            phone: phone || '+91 98765 00000',
            avatar: role === 'Administrator' 
                ? "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                : "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
        });

        res.status(201).json({
            success: true,
            message: "User created successfully!",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error creating user", error: error.message });
    }
});

// 5. POST /api/auth/update-avatar
router.post('/update-avatar', verifyToken, async (req, res) => {
    try {
        const { avatar } = req.body;
        if (!avatar) {
            return res.status(400).json({ success: false, message: "Avatar is required" });
        }
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { avatar },
            { new: true }
        ).select('-password');

        res.status(200).json({ success: true, message: "Avatar updated successfully!", user: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error updating avatar", error: error.message });
    }
});

module.exports = router;
