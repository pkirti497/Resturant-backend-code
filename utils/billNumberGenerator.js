const mongoose = require('mongoose');

/**
 * Monthly Sequential Bill Number Generator
 * Resets back to 001 on the 1st of every month automatically (even at 12:00 AM midnight).
 * Format: BILL-YYYYMM-001, BILL-YYYYMM-002, etc.
 */
async function generateMonthlyBillNo() {
    const Order = mongoose.models.Order || require('../models/OrderModel');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthYear = `${year}-${month}`; // e.g. "2026-11"
    const prefix = `BILL-${year}${month}-`; // e.g. "BILL-202611-"

    // Find orders in this month
    const latestOrder = await Order.findOne({
        $or: [
            { monthYear: monthYear },
            { billNo: { $regex: `^${prefix}` } }
        ]
    }).sort({ billSequence: -1, createdAt: -1 });

    let nextSequence = 1;
    if (latestOrder && typeof latestOrder.billSequence === 'number' && latestOrder.billSequence > 0) {
        nextSequence = latestOrder.billSequence + 1;
    } else if (latestOrder && latestOrder.billNo && latestOrder.billNo.startsWith(prefix)) {
        const parts = latestOrder.billNo.split('-');
        const parsed = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(parsed)) {
            nextSequence = parsed + 1;
        }
    } else {
        // Double check count in this monthYear as fallback
        const countThisMonth = await Order.countDocuments({
            $or: [
                { monthYear: monthYear },
                { billNo: { $regex: `^${prefix}` } }
            ]
        });
        nextSequence = countThisMonth + 1;
    }

    const sequenceFormatted = String(nextSequence).padStart(3, '0');
    const billNo = `${prefix}${sequenceFormatted}`;

    const dateFormatted = now.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return {
        billNo,
        billSequence: nextSequence,
        monthYear,
        dateFormatted
    };
}

module.exports = { generateMonthlyBillNo };
