// test_pdf_generation.mjs
import PDFDocument from 'pdfkit';
import fs from 'fs';

async function testPdf() {
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));

  const donePromise = new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc.fillColor('#0284c7').fontSize(22).text('NearCart', 40, 40);
  doc.fillColor('#64748b').fontSize(9).text('Campus Hyperlocal Marketplace', 40, 66);
  doc.fillColor('#0f172a').fontSize(14).text('OFFICIAL ORDER RECEIPT', 300, 40, { align: 'right' });
  doc.fontSize(9).fillColor('#64748b').text('Receipt No: ORD-TEST-1234', 300, 58, { align: 'right' });
  doc.text(`Date: ${new Date().toLocaleString('en-IN')}`, 300, 70, { align: 'right' });

  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 85).lineTo(555, 85).stroke();

  doc.y = 95;
  doc.fontSize(10).fillColor('#0f172a').text('Customer Name: Test Student', 40);
  doc.text('Delivery Address: Room 204, Ganga Hostel, IIT Campus');
  doc.text('Shop: Quick Mart Grocery');

  doc.moveDown(1);
  doc.fillColor('#0284c7').fontSize(11).text('ITEM DETAILS');
  doc.moveDown(0.4);

  // Table header
  const tableTop = doc.y;
  doc.rect(40, tableTop, 515, 20).fill('#f8fafc');
  doc.fillColor('#475569').fontSize(9);
  doc.text('Item Description', 45, tableTop + 5, { width: 235 });
  doc.text('Qty', 285, tableTop + 5, { width: 45, align: 'center' });
  doc.text('Unit Price', 335, tableTop + 5, { width: 85, align: 'right' });
  doc.text('Subtotal', 425, tableTop + 5, { width: 85, align: 'right' });

  doc.y = tableTop + 24;

  const items = [
    { name: 'Maggi 2-Minute Instant Noodles 70g Pack of 4 Special Edition', quantity: 2, price: 56, subtotal: 112 },
    { name: 'Amul Taaza Homogenised Toned Milk 500ml', quantity: 1, price: 34, subtotal: 34 },
    { name: 'Britannia Good Day Butter Cookies 120g', quantity: 3, price: 30, subtotal: 90 },
  ];

  items.forEach((item, index) => {
    const y = doc.y;
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.rect(40, y - 2, 515, 18).fill('#fbfcfd');
    }
    doc.fillColor('#0f172a').fontSize(9);
    doc.text(item.name, 45, y, { width: 235 });
    doc.text(String(item.quantity), 285, y, { width: 45, align: 'center' });
    doc.text(`INR ${item.price.toFixed(2)}`, 335, y, { width: 85, align: 'right' });
    doc.text(`INR ${item.subtotal.toFixed(2)}`, 425, y, { width: 85, align: 'right' });
    doc.y = Math.max(doc.y, y + 16);
  });

  doc.moveDown(1);
  doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(330, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  const startSummaryY = doc.y;
  doc.fillColor('#475569').fontSize(9);
  doc.text('Items Subtotal:', 335, startSummaryY, { width: 100, align: 'right' });
  doc.fillColor('#0f172a').text('INR 236.00', 440, startSummaryY, { width: 70, align: 'right' });

  doc.text('Delivery Fee:', 335, doc.y + 4, { width: 100, align: 'right' });
  doc.text('INR 25.00', 440, doc.y, { width: 70, align: 'right' });

  doc.text('Packaging Charges:', 335, doc.y + 4, { width: 100, align: 'right' });
  doc.text('INR 10.00', 440, doc.y, { width: 70, align: 'right' });

  doc.text('Discount (SAVE20):', 335, doc.y + 4, { width: 100, align: 'right' });
  doc.fillColor('#10b981').text('-INR 20.00', 440, doc.y, { width: 70, align: 'right' });

  doc.moveDown(0.5);
  doc.rect(330, doc.y, 225, 24).fill('#f0f9ff');
  doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold');
  doc.text('TOTAL PAID:', 335, doc.y + 6, { width: 100, align: 'right' });
  doc.text('INR 251.00', 440, doc.y, { width: 70, align: 'right' });

  // Page Numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text(
      `Page ${i + 1} of ${range.count} • Computer generated official receipt by NearCart`,
      40,
      doc.page.height - 30,
      { align: 'center', width: doc.page.width - 80 }
    );
  }

  doc.end();
  const pdfBuffer = await donePromise;
  console.log('PDF Generated Successfully! Size:', pdfBuffer.length, 'bytes');
  fs.writeFileSync('scratch/test_receipt_output.pdf', pdfBuffer);
}

testPdf().catch(console.error);
