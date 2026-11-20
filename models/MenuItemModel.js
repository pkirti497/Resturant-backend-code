const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true 
    },
    category: { 
        type: String, 
        required: true,
        default: 'Main Course'
    },
    price: { 
        type: Number, 
        required: true,
        min: 0
    },
    img: { 
        type: String, 
        default: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80'
    },
    type: { 
        type: String, 
        enum: ['Veg', 'Non-Veg', 'Beverage', 'Dessert'],
        default: 'Veg'
    },
    description: { 
        type: String, 
        default: '' 
    },
    available: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

module.exports = mongoose.models.MenuItem || mongoose.model('MenuItem', menuItemSchema);
