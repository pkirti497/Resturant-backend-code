const express = require('express');
const router = express.Router();
const Room = require('../models/RoomModel');
const mongoose = require('mongoose');

// 1. GET: Fetch all rooms
router.get('/', async (req, res) => {
    try {
        const rooms = await Room.find().sort({ roomNumber: 1 });
        res.status(200).json(rooms);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. POST: Add new room
router.post('/add', async (req, res) => {
    try {
        const { 
            roomNumber, 
            roomType, 
            acType,
            price, 
            status, 
            floor, 
            guest, 
            phone, 
            checkInDate,
            checkOutDate,
            days,
            advancePayment,
            idProof,
            numberOfGuests,
            amenities,
            img 
        } = req.body;

        // Strict Image Size Validation (Max 1 MB / 1024 KB)
        if (img && img.startsWith('data:image')) {
            const approxBytes = Math.round(img.length * 0.75);
            const maxBytes = 1 * 1024 * 1024; // 1 MB
            if (approxBytes > maxBytes) {
                const sizeMB = (approxBytes / (1024 * 1024)).toFixed(2);
                return res.status(400).json({ 
                    message: `Room image is too large (${sizeMB} MB)! Maximum limit is 1 MB (1,024 KB). Please upload an image under 1 MB.` 
                });
            }
        }
        
        const newRoom = new Room({ 
            roomNumber, 
            roomType: roomType || 'Deluxe AC', 
            acType: acType || (roomType && roomType.toLowerCase().includes('non-ac') ? 'Non-AC' : 'AC'),
            price: Number(price) || 0, 
            status: status || 'Available',
            floor: floor || '1st Floor',
            guest: status === 'Occupied' ? (guest || 'Unassigned') : 'Unassigned',
            phone: status === 'Occupied' ? (phone || '-') : '-',
            checkInDate: status === 'Occupied' ? (checkInDate || '') : '',
            checkOutDate: status === 'Occupied' ? (checkOutDate || '') : '',
            days: Number(days) || 1,
            advancePayment: Number(advancePayment) || 0,
            idProof: idProof || '-',
            numberOfGuests: Number(numberOfGuests) || 1,
            amenities: Array.isArray(amenities) && amenities.length > 0 
                ? amenities 
                : ['Free WiFi', 'Smart TV', 'Room Service'],
            img: img && img.trim() !== '' ? img : 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=400&q=80',
            userId: 1
        });

        const savedRoom = await newRoom.save();
        res.status(201).json({ message: "Room added successfully!", newRoom: savedRoom });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 3. PUT: Update room details (Supports Edit, Check-in, Status changes)
router.put('/:id', async (req, res) => {
    try {
        const idOrRoomNo = req.params.id;
        const updateData = { ...req.body };

        // Strict Image Size Validation (Max 1 MB / 1024 KB)
        if (updateData.img && updateData.img.startsWith('data:image')) {
            const approxBytes = Math.round(updateData.img.length * 0.75);
            const maxBytes = 1 * 1024 * 1024; // 1 MB
            if (approxBytes > maxBytes) {
                const sizeMB = (approxBytes / (1024 * 1024)).toFixed(2);
                return res.status(400).json({ 
                    message: `Room image is too large (${sizeMB} MB)! Maximum limit is 1 MB (1,024 KB). Please upload an image under 1 MB.` 
                });
            }
        }

        // Clean up guest info if available or cleaning
        if (updateData.status === 'Available' || updateData.status === 'Cleaning') {
            if (!req.body.guest || req.body.guest === '') updateData.guest = 'Unassigned';
            if (!req.body.phone || req.body.phone === '') updateData.phone = '-';
            updateData.checkInDate = '';
            updateData.checkOutDate = '';
            updateData.days = 1;
            updateData.advancePayment = 0;
        }

        let updatedRoom = null;

        if (mongoose.Types.ObjectId.isValid(idOrRoomNo)) {
            updatedRoom = await Room.findByIdAndUpdate(idOrRoomNo, updateData, { new: true });
        }

        if (!updatedRoom) {
            updatedRoom = await Room.findOneAndUpdate({ roomNumber: idOrRoomNo }, updateData, { new: true });
        }

        if (!updatedRoom) {
            return res.status(404).json({ message: "Room not found in database" });
        }

        res.status(200).json({ message: "Room updated successfully!", updatedRoom });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: error.message });
    }
});

// 4. DELETE: Delete room
router.delete('/:id', async (req, res) => {
    try {
        const idOrRoomNo = req.params.id;
        let deletedRoom = null;

        if (mongoose.Types.ObjectId.isValid(idOrRoomNo)) {
            deletedRoom = await Room.findByIdAndDelete(idOrRoomNo);
        }

        if (!deletedRoom) {
            deletedRoom = await Room.findOneAndDelete({ roomNumber: idOrRoomNo });
        }

        if (!deletedRoom) {
            return res.status(404).json({ message: "Room not found in database" });
        }

        res.status(200).json({ message: "Room deleted successfully!" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
