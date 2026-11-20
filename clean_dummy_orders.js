const mongoose = require('mongoose');
require('dotenv').config();
const Order = require('./models/OrderModel');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const dummyNames = [
    'Rahul Sharma', 
    'Kirti Pandey', 
    'Rohan POS Table Guest', 
    'Suresh Room Guest', 
    'neha', 
    'Amit Verma', 
    'Aman Verma', 
    'Priya Singh'
  ];
  const res = await Order.deleteMany({ customerName: { $in: dummyNames } });
  console.log('Cleaned dummy orders count:', res.deletedCount);
  
  const remaining = await Order.find();
  console.log('Remaining real orders:', remaining.length);
  remaining.forEach(o => console.log(' - Order:', o.billNo, o.customerName, o.tableNumber, o.orderType, o.totalAmount));
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
