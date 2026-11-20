const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    billNo: { 
        type: String, 
        required: true 
    },
    billSequence: { 
        type: Number, 
        default: 1 
    },
    monthYear: { 
        type: String, 
        default: () => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } 
    },
    customerName: { 
        type: String, 
        required: true, 
        trim: true 
    },
    phone: { 
        type: String, 
        default: '-' 
    },
    orderType: { 
        type: String, 
        default: 'Dine-In' // 'Dine-In', 'Takeaway', 'Room Service', 'Room Stay', 'Consolidated Checkout'
    },
    tableNumber: { 
        type: String, 
        default: 'Table 1' // 'Table 1', 'Room 101', etc.
    },
    roomNumber: { 
        type: String, 
        default: '' // '101' if charged to room
    },
    paymentMode: { 
        type: String, 
        default: 'Cash' // 'Cash', 'UPI / QR Code', 'Card', 'Charge to Room (Pay at Checkout)'
    },
    isPaid: { 
        type: Boolean, 
        default: true // false when 'Charge to Room (Pay at Checkout)'
    },
    items: [
        {
            name: { type: String, required: true },
            price: { type: Number, required: true },
            qty: { type: Number, required: true, default: 1 }
        }
    ],
    roomTariff: { 
        type: Number, 
        default: 0 
    },
    foodCharges: { 
        type: Number, 
        default: 0 
    },
    advancePaid: { 
        type: Number, 
        default: 0 
    },
    stayDays: { 
        type: Number, 
        default: 1 
    },
    checkInDate: { 
        type: String, 
        default: '' 
    },
    checkOutDate: { 
        type: String, 
        default: '' 
    },
    dateFormatted: { 
        type: String, 
        default: '' 
    },
    subtotal: { 
        type: Number, 
        default: 0 
    },
    tax: { 
        type: Number, 
        default: 0 
    },
    totalAmount: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        default: 'Completed' // 'Completed', 'Pending at Checkout', 'Paid at Checkout'
    }
}, { timestamps: true });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
