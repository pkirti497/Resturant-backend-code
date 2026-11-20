const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    capacity: {
        type: Number,
        default: 4
    },
    floor: {
        type: String,
        default: 'Main Hall'
    },
    status: {
        type: String,
        enum: ['Available', 'Occupied', 'Reserved', 'Bill Pending'],
        default: 'Available'
    },
    customerName: {
        type: String,
        default: ''
    },
    guests: {
        type: Number,
        default: 0
    },
    order: [
        {
            id: { type: String },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            qty: { type: Number, default: 1 },
            category: { type: String }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.models.Table || mongoose.model('Table', tableSchema);
