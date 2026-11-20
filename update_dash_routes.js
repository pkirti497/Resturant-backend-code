const fs = require('fs');
const filePath = 'routes/dashboardRoutes.js';
let content = fs.readFileSync(filePath, 'utf8');

const newStatsHandler = `// Dashboard Stats API (Fully Dynamic & Real Calculations)
router.get('/stats', async (req, res) => {
    try {
        const totalRooms = await Room.countDocuments();
        const occupiedRoomsCount = await Room.countDocuments({ status: 'Occupied' });
        const orders = await Order.find().sort({ createdAt: -1 });
        const roomsList = await Room.find().limit(6);
        const tablesList = await Table.find().sort({ name: 1 });

        // 1. Separate Restaurant vs Hotel Room Stay Orders
        const restaurantOrders = orders.filter(o => 
            !(o.orderType || '').toLowerCase().includes('stay') && 
            !(o.orderType || '').toLowerCase().includes('booking')
        );
        const hotelStayOrders = orders.filter(o => 
            (o.orderType || '').toLowerCase().includes('stay') || 
            (o.orderType || '').toLowerCase().includes('booking')
        );

        const restaurantSales = restaurantOrders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);
        const hotelRevenue = hotelStayOrders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);
        const todaysSales = restaurantSales + hotelRevenue;

        // 2. Tables Occupied Calculation from Table model
        const occupiedCount = tablesList.filter(t => t.status === 'Occupied' || t.status === 'Bill Pending').length;
        const tablesOccupied = \`\${occupiedCount} / \${tablesList.length || 10}\`;

        // 3. Average Bill Calculation
        const averageBill = orders.length > 0 ? Math.round(todaysSales / orders.length) : 0;

        // 4. Top Selling Dish Calculation from items array
        const dishCounts = {};
        orders.forEach(order => {
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    if (item.name && !item.name.toLowerCase().includes('stay') && !item.name.toLowerCase().includes('booking')) {
                        dishCounts[item.name] = (dishCounts[item.name] || 0) + (item.qty || 1);
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

        // 5. Dynamic Graph Data (Supports ?period=7, 14, 30)
        const periodDays = parseInt(req.query.period) || 7;
        const graphData = [];
        for (let i = periodDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);

            const dayOrders = orders.filter(o => {
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

        res.status(200).json({
            todaysSales: todaysSales,
            restaurantSales: restaurantSales,
            hotelRevenue: hotelRevenue,
            occupiedRooms: \`\${occupiedRoomsCount} / \${totalRooms || 30}\`,
            pendingCheckouts: Math.max(0, occupiedRoomsCount),
            todaysOrders: orders.length,
            tablesOccupied: tablesOccupied,
            averageBill: averageBill,
            topDish: {
                name: topDishName,
                orders: topDishOrders,
                img: topDishImg
            },
            roomsList: roomsList,
            tablesList: tablesList,
            recentOrders: orders.slice(0, 6),
            graphData: graphData
        });
    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});`;

// Replace from router.get('/stats', ... ) to router.get('/admin-info'
const regex = /\/\/ Dashboard Stats API[\s\S]*?router\.get\('\/admin-info'/;
content = content.replace(regex, newStatsHandler + "\n\n// Admin Info API\nrouter.get('/admin-info'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated backend dashboardRoutes.js successfully!');
