const express = require('express');
const router = express.Router();
const Order = require('../models/OrderModel');
const Room = require('../models/RoomModel');
const { generateMonthlyBillNo } = require('../utils/billNumberGenerator');

// 1. GET: Preview next sequential bill number for current month
router.get('/next-bill-number', async (req, res) => {
    try {
        const billMeta = await generateMonthlyBillNo();
        res.status(200).json(billMeta);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 2. GET: Unpaid Food & Restaurant Orders linked to a Room
router.get('/room-unpaid/:roomNumber', async (req, res) => {
    try {
        const rawRoom = req.params.roomNumber;
        const cleanRoom = rawRoom.replace(/[^0-9]/g, ''); // e.g. "101" from "Room 101" or "101"

        const unpaidOrders = await Order.find({
            $and: [
                {
                    $or: [
                        { roomNumber: cleanRoom },
                        { roomNumber: `Room ${cleanRoom}` },
                        { tableNumber: `Room ${cleanRoom}` },
                        { tableNumber: cleanRoom }
                    ]
                },
                {
                    $or: [
                        { isPaid: false },
                        { status: 'Pending at Checkout' },
                        { paymentMode: 'Charge to Room (Pay at Checkout)' }
                    ]
                },
                {
                    orderType: { $ne: 'Consolidated Checkout' }
                }
            ]
        }).sort({ createdAt: 1 });

        // Flatten all items with order reference
        const allFoodItems = [];
        let totalFoodCharges = 0;

        unpaidOrders.forEach(ord => {
            (ord.items || []).forEach(it => {
                const itemTotal = (Number(it.price) || 0) * (Number(it.qty) || 1);
                allFoodItems.push({
                    orderId: ord._id,
                    billNo: ord.billNo,
                    orderDate: ord.createdAt,
                    name: it.name,
                    price: Number(it.price) || 0,
                    qty: Number(it.qty) || 1,
                    total: itemTotal
                });
                totalFoodCharges += itemTotal;
            });
        });

        res.status(200).json({
            roomNumber: cleanRoom,
            ordersCount: unpaidOrders.length,
            unpaidOrders,
            allFoodItems,
            totalFoodCharges
        });
    } catch (error) {
        console.error("Error fetching room unpaid orders:", error);
        res.status(500).json({ message: error.message });
    }
});

// 3. POST: Add POS or Room Stay Order to Database
router.post('/add', async (req, res) => {
    try {
        const { 
            customerName, 
            phone, 
            orderType, 
            tableNumber, 
            roomNumber,
            paymentMode,
            isPaid,
            items, 
            subtotal, 
            tax, 
            totalAmount, 
            status, 
            billNo,
            advancePaid,
            roomTariff,
            foodCharges,
            stayDays,
            checkInDate,
            checkOutDate
        } = req.body;

        // Generate sequential monthly bill number if not already formatted as BILL-YYYYMM-XXX
        let finalBillNo = billNo;
        let billSequence = 1;
        let monthYear = '';
        let dateFormatted = '';

        if (!finalBillNo || finalBillNo.startsWith('ORD-') || finalBillNo.startsWith('INV-')) {
            const billMeta = await generateMonthlyBillNo();
            finalBillNo = billMeta.billNo;
            billSequence = billMeta.billSequence;
            monthYear = billMeta.monthYear;
            dateFormatted = billMeta.dateFormatted;
        } else {
            const now = new Date();
            monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            dateFormatted = now.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        const formattedItems = (items || []).map(item => ({
            name: item.name || 'Item',
            price: Number(item.price) || 0,
            qty: Number(item.qty || item.quantity) || 1
        }));

        // Check if this is a "Charge to Room (Pay at Checkout)" order
        const isChargedToRoom = paymentMode === 'Charge to Room (Pay at Checkout)' || 
                                orderType === 'Room Service' && isPaid === false;
        
        const finalStatus = isChargedToRoom ? 'Pending at Checkout' : (status || 'Completed');
        const finalIsPaid = isChargedToRoom ? false : (isPaid !== undefined ? isPaid : true);

        // Normalize roomNumber
        let cleanRoom = roomNumber || '';
        if (!cleanRoom && tableNumber && tableNumber.toLowerCase().includes('room')) {
            cleanRoom = tableNumber.replace(/[^0-9]/g, '');
        }

        const newOrder = new Order({
            billNo: finalBillNo,
            billSequence,
            monthYear,
            dateFormatted,
            customerName: customerName ? customerName.trim() : 'Guest',
            phone: phone || '-',
            orderType: orderType || 'Dine-In',
            tableNumber: tableNumber || (cleanRoom ? `Room ${cleanRoom}` : 'Table 1'),
            roomNumber: cleanRoom,
            paymentMode: paymentMode || 'Cash',
            isPaid: finalIsPaid,
            items: formattedItems,
            roomTariff: Number(roomTariff) || 0,
            foodCharges: Number(foodCharges) || 0,
            advancePaid: Number(advancePaid) || 0,
            stayDays: Number(stayDays) || 1,
            checkInDate: checkInDate || '',
            checkOutDate: checkOutDate || '',
            subtotal: Number(subtotal) || Number(totalAmount) || 0,
            tax: Number(tax) || 0,
            totalAmount: Number(totalAmount) || 0,
            status: finalStatus
        });

        const savedOrder = await newOrder.save();
        res.status(201).json({ 
            message: isChargedToRoom 
                ? `Order charged to Room ${cleanRoom} (Will be settled at Checkout)` 
                : "Order saved successfully!", 
            order: savedOrder 
        });
    } catch (error) {
        console.error("Order Save Error:", error.message);
        res.status(500).json({ message: "Database Error: " + error.message });
    }
});

// 4. POST: Consolidated Checkout Master Bill (Rooms + Food & Beverages)
router.post('/checkout-consolidated', async (req, res) => {
    try {
        const {
            roomNumber,
            guestName,
            phone,
            roomType,
            pricePerNight,
            stayDays,
            checkInDate,
            checkOutDate,
            advancePaid,
            paymentMode,
            newRoomStatus,
            allFoodItems
        } = req.body;

        const cleanRoom = String(roomNumber).replace(/[^0-9]/g, '');
        const days = Math.max(1, Number(stayDays) || 1);
        const ratePerNight = Number(pricePerNight) || 0;
        const roomTariff = days * ratePerNight;

        // Fetch any additional unpaid food orders directly from DB to be 100% accurate
        const unpaidOrders = await Order.find({
            $and: [
                {
                    $or: [
                        { roomNumber: cleanRoom },
                        { roomNumber: `Room ${cleanRoom}` },
                        { tableNumber: `Room ${cleanRoom}` },
                        { tableNumber: cleanRoom }
                    ]
                },
                {
                    $or: [
                        { isPaid: false },
                        { status: 'Pending at Checkout' },
                        { paymentMode: 'Charge to Room (Pay at Checkout)' }
                    ]
                },
                {
                    orderType: { $ne: 'Consolidated Checkout' }
                }
            ]
        });

        const foodItemsList = [];
        let calculatedFoodCharges = 0;

        unpaidOrders.forEach(ord => {
            (ord.items || []).forEach(it => {
                const itemTotal = (Number(it.price) || 0) * (Number(it.qty) || 1);
                foodItemsList.push({
                    name: `[F&B] ${it.name}`,
                    price: Number(it.price) || 0,
                    qty: Number(it.qty) || 1
                });
                calculatedFoodCharges += itemTotal;
            });
        });

        // If client provided manual food items and DB had none
        if (foodItemsList.length === 0 && Array.isArray(allFoodItems) && allFoodItems.length > 0) {
            allFoodItems.forEach(it => {
                const itemTotal = (Number(it.price) || 0) * (Number(it.qty) || 1);
                foodItemsList.push({
                    name: `[F&B] ${it.name}`,
                    price: Number(it.price) || 0,
                    qty: Number(it.qty) || 1
                });
                calculatedFoodCharges += itemTotal;
            });
        }

        // Consolidated Items list
        const consolidatedItems = [
            {
                name: `Room Stay: ${roomType || 'Accommodation'} (Room ${cleanRoom}) - ${days} Night(s) @ ₹${ratePerNight}/night`,
                price: ratePerNight,
                qty: days
            },
            ...foodItemsList
        ];

        const rawSubtotal = roomTariff + calculatedFoodCharges;
        const tax = Math.round(rawSubtotal * 0.05); // 5% GST
        const advanceDeduction = Number(advancePaid) || 0;
        const finalGrandTotal = Math.max(0, rawSubtotal + tax - advanceDeduction);

        // Generate sequential monthly bill number
        const billMeta = await generateMonthlyBillNo();

        const masterOrder = new Order({
            billNo: billMeta.billNo,
            billSequence: billMeta.billSequence,
            monthYear: billMeta.monthYear,
            dateFormatted: billMeta.dateFormatted,
            customerName: guestName ? guestName.trim() : 'Guest',
            phone: phone || '-',
            orderType: 'Consolidated Checkout',
            tableNumber: `Room ${cleanRoom}`,
            roomNumber: cleanRoom,
            paymentMode: paymentMode || 'Cash',
            isPaid: true,
            items: consolidatedItems,
            roomTariff: roomTariff,
            foodCharges: calculatedFoodCharges,
            advancePaid: advanceDeduction,
            stayDays: days,
            checkInDate: checkInDate || '',
            checkOutDate: checkOutDate || '',
            subtotal: rawSubtotal,
            tax: tax,
            totalAmount: finalGrandTotal,
            status: 'Completed'
        });

        const savedMasterOrder = await masterOrder.save();

        // Mark all linked food orders as Paid
        if (unpaidOrders.length > 0) {
            const orderIds = unpaidOrders.map(o => o._id);
            await Order.updateMany(
                { _id: { $in: orderIds } },
                {
                    $set: {
                        isPaid: true,
                        status: 'Paid at Checkout'
                    }
                }
            );
        }

        // Update Room status to Cleaning (or Available) and clear guest assignment
        await Room.findOneAndUpdate(
            { roomNumber: cleanRoom },
            {
                $set: {
                    status: newRoomStatus || 'Cleaning',
                    guest: 'Unassigned',
                    phone: '-',
                    checkInDate: '',
                    checkOutDate: '',
                    days: 1,
                    advancePayment: 0
                }
            }
        );

        res.status(201).json({
            message: `Checkout successful! Consolidated invoice ${billMeta.billNo} generated.`,
            bill: savedMasterOrder,
            roomNumber: cleanRoom,
            roomStatus: newRoomStatus || 'Cleaning'
        });

    } catch (error) {
        console.error("Consolidated Checkout Error:", error);
        res.status(500).json({ message: "Checkout Error: " + error.message });
    }
});

// 5. GET: Fetch all orders (Supports ?startDate, ?endDate, ?monthYear, ?orderType, ?roomNumber)
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, monthYear, orderType, roomNumber } = req.query;
        const query = {};

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                const s = new Date(startDate);
                s.setHours(0, 0, 0, 0);
                query.createdAt.$gte = s;
            }
            if (endDate) {
                const e = new Date(endDate);
                e.setHours(23, 59, 59, 999);
                query.createdAt.$lte = e;
            }
        }

        if (monthYear) {
            query.monthYear = monthYear;
        }

        if (orderType && orderType !== 'All') {
            query.orderType = orderType;
        }

        if (roomNumber) {
            const clean = roomNumber.replace(/[^0-9]/g, '');
            query.$or = [
                { roomNumber: clean },
                { roomNumber: `Room ${clean}` },
                { tableNumber: `Room ${clean}` }
            ];
        }

        const orders = await Order.find(query).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 6. PUT: Update order
router.put('/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { ...req.body },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.status(200).json({ message: "Order updated successfully!", order: updatedOrder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 7. DELETE: Delete an order by ID
router.delete('/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const deletedOrder = await Order.findByIdAndDelete(orderId);

        if (!deletedOrder) {
            return res.status(404).json({ message: "Order not found in database" });
        }

        res.status(200).json({ message: "Order deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
