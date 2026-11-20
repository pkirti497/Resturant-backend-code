const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    roomNumber: { type: String, required: true },
    roomType: { type: String, required: true }, // Deluxe AC, Super Deluxe AC, Luxury Suite AC, Standard Non-AC, etc.
    acType: { type: String, default: 'AC' }, // 'AC' or 'Non-AC'
    status: { type: String, default: 'Available' }, // 'Available', 'Occupied', 'Cleaning', 'Reserved'
    price: { type: Number, required: true },
    floor: { type: String, default: '1st Floor' },
    guest: { type: String, default: 'Unassigned' },
    phone: { type: String, default: '-' },
    checkInDate: { type: String, default: '' },
    checkOutDate: { type: String, default: '' },
    days: { type: Number, default: 1 },
    advancePayment: { type: Number, default: 0 },
    idProof: { type: String, default: '-' },
    numberOfGuests: { type: Number, default: 1 },
    amenities: { type: [String], default: ['Free WiFi', 'Smart TV', 'Room Service'] },
    img: { type: String, default: '' },
    userId: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);
