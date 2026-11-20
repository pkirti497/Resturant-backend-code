const express = require('express');
const router = express.Router();
const Room = require('../models/RoomModel');
const Order = require('../models/OrderModel');
const Table = require('../models/TableModel');

// Dashboard Stats API (Supports 7, 14, 30, 90 Days and Custom Date Range)
router.get('/stats', async (req, res) => {
    try {
        const { startDate, endDate, period } = req.query;

        const totalRooms = await Room.countDocuments();
        const occupiedRoomsCount = await Room.countDocuments({ status: 'Occupied' });
        const availableRoomsCount = await Room.countDocuments({ status: 'Available' });
        const cleaningRoomsCount = await Room.countDocuments({ status: 'Cleaning' });
        const reservedRoomsCount = await Room.countDocuments({ status: 'Reserved' });

        const roomsList = await Room.find().limit(6);
        const tablesList = await Table.find().sort({ name: 1 });

        // Filter orders by date range if provided
        const dateQuery = {};
        let isCustomRange = false;
        let rangeStart = null;
        let rangeEnd = null;

        if (startDate || endDate) {
            isCustomRange = true;
            dateQuery.createdAt = {};
            if (startDate) {
                rangeStart = new Date(startDate);
                rangeStart.setHours(0, 0, 0, 0);
                dateQuery.createdAt.$gte = rangeStart;
            }
            if (endDate) {
                rangeEnd = new Date(endDate);
                rangeEnd.setHours(23, 59, 59, 999);
                dateQuery.createdAt.$lte = rangeEnd;
            }
        }

        const allOrders = await Order.find().sort({ createdAt: -1 });
        const filteredOrders = isCustomRange 
            ? await Order.find(dateQuery).sort({ createdAt: -1 })
            : allOrders;

        // 1. Separate Restaurant vs Hotel Room Stay Orders
        const restaurantOrders = filteredOrders.filter(o => 
            !(o.orderType || '').toLowerCase().includes('stay') && 
            !(o.orderType || '').toLowerCase().includes('booking')
        );
        const hotelStayOrders = filteredOrders.filter(o => 
            (o.orderType || '').toLowerCase().includes('stay') || 
            (o.orderType || '').toLowerCase().includes('booking')
        );

        const restaurantSales = restaurantOrders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);
        const hotelRevenue = hotelStayOrders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);
        const totalSales = restaurantSales + hotelRevenue;

        // 2. Tables Occupied Calculation from Table model
        const occupiedCount = tablesList.filter(t => t.status === 'Occupied' || t.status === 'Bill Pending').length;
        const tablesOccupied = `${occupiedCount} / ${tablesList.length || 10}`;

        // 3. Average Bill Calculation
        const averageBill = filteredOrders.length > 0 ? Math.round(totalSales / filteredOrders.length) : 0;

        // 4. Top Selling Dish Calculation
        const dishCounts = {};
        filteredOrders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemName = item.name || '';
                    if (!itemName.toLowerCase().includes('room stay') && !itemName.toLowerCase().includes('booking')) {
                        const cleanName = itemName.replace(/^\[F&B\]\s*/i, '');
                        dishCounts[cleanName] = (dishCounts[cleanName] || 0) + (item.qty || 1);
                    }
                });
            }
        });

        let topDishName = 'No dish ordered yet';
        let topDishOrders = 0;
        let topDishImg = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=150&q=80';

        const sortedDishes = Object.entries(dishCounts).sort((a, b) => b[1] - a[1]);
        if (sortedDishes.length > 0) {
            topDishName = sortedDishes[0][0];
            topDishOrders = sortedDishes[0][1];
        }

        // 5. Dynamic Graph Data (Supports ?period=7, 14, 30, 90 or custom ?startDate & ?endDate)
        const periodDays = parseInt(period, 10) || 7;
        const graphData = [];

        if (isCustomRange && rangeStart && rangeEnd) {
            const diffDays = Math.max(1, Math.ceil((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)));
            const stepDays = Math.max(1, Math.ceil(diffDays / 7));
            let curr = new Date(rangeStart);

            while (curr <= rangeEnd) {
                const nextStep = new Date(curr);
                nextStep.setDate(nextStep.getDate() + stepDays);
                const stepEnd = nextStep > rangeEnd ? new Date(rangeEnd) : new Date(nextStep);
                stepEnd.setHours(23, 59, 59, 999);

                const label = `${curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${stepEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                const bucketOrders = allOrders.filter(o => {
                    const oDate = new Date(o.createdAt || Date.now());
                    return oDate >= curr && oDate <= stepEnd;
                });

                const bucketRestSales = bucketOrders
                    .filter(o => !(o.orderType || '').toLowerCase().includes('stay') && !(o.orderType || '').toLowerCase().includes('booking'))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                const bucketHotelRev = bucketOrders
                    .filter(o => (o.orderType || '').toLowerCase().includes('stay') || (o.orderType || '').toLowerCase().includes('booking'))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                graphData.push({
                    day: label,
                    sales: bucketRestSales,
                    hotel: bucketHotelRev,
                    total: bucketRestSales + bucketHotelRev
                });

                curr.setDate(curr.getDate() + stepDays + 1);
            }
        } else if (periodDays >= 60) {
            // If 90 days, group into weekly/fortnightly buckets so chart remains clean and responsive
            const stepDays = Math.ceil(periodDays / 8); // ~8 points
            for (let i = 7; i >= 0; i--) {
                const endD = new Date();
                endD.setDate(endD.getDate() - (i * stepDays));
                const startD = new Date(endD);
                startD.setDate(startD.getDate() - stepDays);

                const label = `${startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

                const bucketOrders = allOrders.filter(o => {
                    const oDate = new Date(o.createdAt || Date.now());
                    return oDate >= startD && oDate <= endD;
                });

                const bucketRestSales = bucketOrders
                    .filter(o => !(o.orderType || '').toLowerCase().includes('stay') && !(o.orderType || '').toLowerCase().includes('booking'))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                const bucketHotelRev = bucketOrders
                    .filter(o => (o.orderType || '').toLowerCase().includes('stay') || (o.orderType || '').toLowerCase().includes('booking'))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                graphData.push({
                    day: label,
                    sales: bucketRestSales,
                    hotel: bucketHotelRev,
                    total: bucketRestSales + bucketHotelRev
                });
            }
        } else {
            // Daily granularity for 7, 14, 30 days
            for (let i = periodDays - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                const dayStart = new Date(d);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(d);
                dayEnd.setHours(23, 59, 59, 999);

                const dayOrders = allOrders.filter(o => {
                    const oDate = new Date(o.createdAt || Date.now());
                    return oDate >= dayStart && oDate <= dayEnd;
                });

                const dayRestSales = dayOrders
                    .filter(o => !(o.orderType || '').toLowerCase().includes('stay') && !(o.orderType || '').toLowerCase().includes('booking'))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                const dayHotelRev = dayOrders
                    .filter(o => (o.orderType || '').toLowerCase().includes('stay') || (o.orderType || '').toLowerCase().includes('booking'))
                    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

                graphData.push({
                    day: dateStr,
                    sales: dayRestSales,
                    hotel: dayHotelRev,
                    total: dayRestSales + dayHotelRev
                });
            }
        }

        res.status(200).json({
            todaysSales: totalSales,
            restaurantSales: restaurantSales,
            hotelRevenue: hotelRevenue,
            totalRooms: totalRooms,
            availableRoomsCount: availableRoomsCount,
            occupiedRoomsCount: occupiedRoomsCount,
            cleaningRoomsCount: cleaningRoomsCount,
            reservedRoomsCount: reservedRoomsCount,
            occupiedRooms: `${occupiedRoomsCount} / ${totalRooms || 0}`,
            pendingCheckouts: Math.max(0, occupiedRoomsCount),
            todaysOrders: filteredOrders.length,
            tablesOccupied: tablesOccupied,
            averageBill: averageBill,
            topDish: {
                name: topDishName,
                orders: topDishOrders,
                img: topDishImg
            },
            roomsList: roomsList,
            tablesList: tablesList,
            recentOrders: filteredOrders.slice(0, 6),
            graphData: graphData
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// Admin Info API
router.get('/admin-info', async (req, res) => {
    try {
        const recentRooms = await Room.find().sort({ createdAt: -1 }).limit(3);
        const notifications = recentRooms.map((room) => ({
            id: room._id,
            text: `Room ${room.roomNumber} (${room.roomType}) status: ${room.status}`,
            time: "Updated"
        }));

        res.status(200).json({
            name: "Admin",
            email: "admin@greenvalley.com",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
            unreadNotificationsCount: notifications.length,
            notifications: notifications.length > 0 ? notifications : [
                { id: 1, text: "Welcome to Green Valley Hotel System", time: "Just now" }
            ]
        });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// GLOBAL SEARCH API
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const regex = new RegExp(query, 'i');

        const rooms = await Room.find({
            $or: [
                { roomNumber: regex },
                { roomType: regex },
                { guest: regex },
                { phone: regex },
                { status: regex }
            ]
        });

        const orders = await Order.find({
            $or: [
                { customerName: regex },
                { billNo: regex },
                { status: regex }
            ]
        });

        res.status(200).json({
            query,
            rooms,
            orders,
            totalResults: rooms.length + orders.length
        });
    } catch (error) {
        res.status(500).json({ message: "Search Server Error", error: error.message });
    }
});

module.exports = router;
