const fs = require('fs');
const path = require('path');
const fastcsv = require('fast-csv');
const Product = require('../models/Product');
const Sale = require('../models/Sale');

async function generateCSV() {
  try {
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // 1️⃣ Sales CSV - Use fields from Sale model directly
    const sales = await Sale.find({ date: { $gte: weekAgo } })
      .populate({
        path: 'customerId',
        select: 'email' // optional if needed
      })
      .lean();

    const salesData = sales.map(s => ({
      Date: s.date ? s.date.toISOString().split('T')[0] : '',
      Product: s.productName || 'Unknown',
      QuantitySold: s.quantitySold || 0,
      UnitPrice: s.unitPrice || 0,
      TotalPrice: s.totalPrice || 0
    }));

    const salesPath = path.join(reportsDir, 'sales.csv');
    await new Promise((resolve, reject) => {
      fastcsv.write(salesData, { headers: true })
        .pipe(fs.createWriteStream(salesPath))
        .on('finish', () => {
          console.log(`📄 Sales CSV generated at ${salesPath}`);
          resolve();
        })
        .on('error', reject);
    });

    // 2️⃣ Products CSV
    const products = await Product.find().lean();
    const productData = products.map(p => ({
      Product: p.name || 'Unknown',
      CurrentStock: p.quantity || 0,
      ExpiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
      Supplier: p.supplier || 'Unknown',
      Price: p.price || 0
    }));

    const productsPath = path.join(reportsDir, 'products.csv');
    await new Promise((resolve, reject) => {
      fastcsv.write(productData, { headers: true })
        .pipe(fs.createWriteStream(productsPath))
        .on('finish', () => {
          console.log(`📄 Products CSV generated at ${productsPath}`);
          resolve();
        })
        .on('error', reject);
    });

    console.log('✅ Both CSV files generated successfully!');
    return { salesPath, productsPath };

  } catch (err) {
    console.error('❌ Error generating CSV files:', err);
    throw err;
  }
}

module.exports = generateCSV;
