import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Send email via Brevo HTTP API (HTTPS port 443).
 * Used when BREVO_API_KEY is set — works on Render free tier where SMTP is blocked.
 * @private
 */
const sendViaBrevoApi = async ({ to, subject, htmlContent, fromEmail, fromName }) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return null; // Not configured — caller falls back to SMTP

  const senderEmail = fromEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@nearcart.app';
  const senderName = fromName || process.env.SMTP_FROM_NAME || 'NearCart Platform';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || 'Brevo API error');
    err.code = 'BREVO_API_ERROR';
    err.responseCode = response.status;
    throw err;
  }

  // Brevo returns { messageId: '...' }
  return { messageId: data.messageId || 'brevo-sent', response: `${response.status} OK` };
};

/**
 * Configure Nodemailer Transporter from environment variables.
 * connectionTimeout of 5 s ensures fast failure if SMTP is network-blocked (e.g. Render free tier).
 */
export const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  // Gmail App Passwords are 16 alphanumeric chars — spaces are display-only formatting.
  // Strip all spaces so auth works regardless of how the env var was entered.
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;
  const service = process.env.SMTP_SERVICE;

  if (user && pass && (host || service)) {
    const isGmail = service === 'gmail' || (host && host.includes('gmail'));

    if (isGmail) {
      console.log('[SHOP EMAIL TRACE] SMTP Ready: PASS (Gmail service transporter created)');
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 5000,  // Fail fast if SMTP port is blocked
        socketTimeout: 10000,
      });
    }

    console.log('[SHOP EMAIL TRACE] SMTP Ready: PASS (Custom SMTP transporter created)');
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 5000,  // Fail fast if SMTP port is blocked
      socketTimeout: 10000,
    });
  }

  console.warn('[SHOP EMAIL TRACE] SMTP Ready: FAIL (Missing SMTP_USER, SMTP_PASS, or SMTP_HOST/SERVICE)');
  return null;
};

/**
 * Resolves verified From Header (defaults to SMTP_USER if SMTP_FROM_EMAIL is unconfigured)
 */
export const getFromAddress = () => {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@nearcart.app';
  const fromName = process.env.SMTP_FROM_NAME || 'NearCart Platform';
  return `"${fromName}" <${fromEmail}>`;
};

/**
 * Returns safe boolean environment diagnostics without exposing credentials
 */
export const getSmtpStatusDiagnostic = () => {
  return {
    smtpHostConfigured: Boolean(process.env.SMTP_HOST || process.env.SMTP_SERVICE),
    smtpPortConfigured: Boolean(process.env.SMTP_PORT),
    smtpUserConfigured: Boolean(process.env.SMTP_USER),
    smtpPassConfigured: Boolean(process.env.SMTP_PASS),
    smtpFromEmailConfigured: Boolean(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER),
  };
};

/**
 * Verifies SMTP connection & authentication using transporter.verify()
 */
export const verifyTransporterConnection = async () => {
  const diagnostics = getSmtpStatusDiagnostic();
  console.log('[EMAIL DIAGNOSTIC] Runtime Environment Check:', JSON.stringify(diagnostics));

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[EMAIL] SMTP configuration: FAIL (Missing SMTP_USER, SMTP_PASS or SMTP_HOST/SERVICE)');
    console.warn('[EMAIL] SMTP verification: FAIL (Transporter not created)');
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      diagnostics,
      error: 'SMTP credentials (SMTP_USER, SMTP_PASS, SMTP_HOST) not found in environment',
    };
  }

  console.log('[EMAIL] SMTP configuration: PASS');

  try {
    await transporter.verify();
    console.log('[EMAIL] SMTP verification: PASS (Connection authenticated successfully)');
    return {
      success: true,
      status: 'CONNECTED',
      diagnostics,
    };
  } catch (error) {
    const safeError = {
      code: error.code || 'AUTH_FAILURE',
      responseCode: error.responseCode || null,
      command: error.command || null,
      message: error.message || 'SMTP Transporter verification failed',
    };

    console.error('[EMAIL] SMTP verification: FAIL');
    console.error(`[EMAIL] SMTP error code: ${safeError.code}`);
    if (safeError.responseCode) console.error(`[EMAIL] SMTP response code: ${safeError.responseCode}`);
    console.error(`[EMAIL] Provider error message: ${safeError.message}`);

    return {
      success: false,
      status: 'VERIFICATION_FAILED',
      diagnostics,
      error: safeError,
    };
  }
};

/**
 * Send complete order notification email to Shopkeeper when a new order is placed.
 * All monetary values are read directly from server-calculated Order document — never recalculated here.
 */
export const sendOrderPlacedEmailToShopkeeper = async ({
  shopkeeperEmail,
  shopkeeperName = 'Shopkeeper',
  shopName,
  shopPhone = '',
  shopAddress = '',
  shopUpiId = '',
  studentName = 'Customer',
  customerPhone = 'Not provided',
  // customerEmail = 'Not provided',
  orderNumber,
  orderId,
  items = [],
  subtotal = 0,
  packingCharges = 0,
  deliveryFee = 0,
  gstAmount = 0,
  discount = 0,
  couponCode = null,
  totalAmount = 0,
  paymentMethod = 'COD',
  paymentStatus = 'PENDING',
  addressDoc = null,
  deliveryAddress = '',
  orderTime = '',
  orderStatus = 'PLACED',
  notes = '',
}) => {
  console.log(`[EMAIL TRACE] Email function called: PASS (Shopkeeper Order Email)`);

  if (!shopkeeperEmail) {
    console.warn('[EMAIL TRACE] Shopkeeper email resolved: FAIL (Missing recipient email)');
    return { success: false, reason: 'No recipient email provided' };
  }

  console.log(`[EMAIL TRACE] Shopkeeper email resolved: PASS (${shopkeeperEmail})`);
  console.log(`[EMAIL] Shopkeeper recipient: ${shopkeeperEmail}`);

  // Format monetary values strictly as numbers with 2 decimal places
  const subtotalNum = Number(subtotal) || 0;
  const packingChargesNum = Number(packingCharges) || 0;
  const deliveryFeeNum = Number(deliveryFee) || 0;
  const gstAmountNum = Number(gstAmount) || 0;
  const discountNum = Number(discount) || 0;
  const totalAmountNum = Number(totalAmount) || 0;

  // Subject line: New Order Received — Order #ORDER_ID — ₹FINAL_TOTAL
  const subject = `New Order Received — Order #${orderNumber || orderId || 'N/A'} — ₹${totalAmountNum.toFixed(2)}`;

  // Build items rows
  const itemRowsHtml = items && items.length > 0
    ? items.map((item) => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.price) || 0;
        const itemSubtotal = Number(item.subtotal) !== undefined && !isNaN(Number(item.subtotal))
          ? Number(item.subtotal)
          : unitPrice * qty;
        const gstPct = item.gstPercentage ? ` <span style="font-size:0.75rem; color:#64748b;">(GST ${item.gstPercentage}%)</span>` : '';
        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#1e293b; font-weight:600;">${item.name || 'Product'}${gstPct}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; text-align:center; color:#334155;">${qty}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; text-align:right; color:#334155;">₹${unitPrice.toFixed(2)}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; text-align:right; color:#0f172a; font-weight:700;">₹${itemSubtotal.toFixed(2)}</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="4" style="padding:10px; text-align:center; color:#94a3b8;">No items listed</td></tr>`;

  // Coupon row formatting
  const couponRowHtml = couponCode || discountNum > 0
    ? `
      <tr>
        <td style="padding:6px 0; color:#16a34a; font-weight:600;">Coupon (${couponCode || 'Applied'}):</td>
        <td style="padding:6px 0; color:#16a34a; font-weight:600; text-align:right;">-₹${discountNum.toFixed(2)}</td>
      </tr>`
    : `
      <tr>
        <td style="padding:6px 0; color:#64748b;">Coupon:</td>
        <td style="padding:6px 0; color:#64748b; text-align:right;">None (₹0.00)</td>
      </tr>`;

  // Payment information formatting
  const payMethodUpper = String(paymentMethod || 'COD').toUpperCase();
  const payStatusUpper = String(paymentStatus || 'PENDING').toUpperCase();
  let paymentDetailsHtml = '';

  if (payMethodUpper === 'UPI') {
    paymentDetailsHtml = `
      <tr><td style="padding:5px 0; color:#64748b; width:45%;">Payment Method:</td><td style="padding:5px 0; font-weight:700; color:#0284c7;">UPI (Direct UPI Payment)</td></tr>
      <tr><td style="padding:5px 0; color:#64748b;">Payment Status:</td><td style="padding:5px 0; font-weight:600;">${payStatusUpper}</td></tr>
      <tr><td style="padding:5px 0; color:#64748b;">Shop UPI ID:</td><td style="padding:5px 0; font-weight:600;">${shopUpiId || 'Not provided'}</td></tr>
    `;
  } else if (payMethodUpper === 'COD') {
    paymentDetailsHtml = `
      <tr><td style="padding:5px 0; color:#64748b; width:45%;">Payment Method:</td><td style="padding:5px 0; font-weight:700; color:#d97706;">Cash on Delivery (COD)</td></tr>
      <tr><td style="padding:5px 0; color:#64748b;">Payment Status:</td><td style="padding:5px 0; font-weight:600;">Pending (COD)</td></tr>
    `;
  } else {
    paymentDetailsHtml = `
      <tr><td style="padding:5px 0; color:#64748b; width:45%;">Payment Method:</td><td style="padding:5px 0; font-weight:700;">${payMethodUpper}</td></tr>
      <tr><td style="padding:5px 0; color:#64748b;">Payment Status:</td><td style="padding:5px 0; font-weight:600;">${payStatusUpper}</td></tr>
    `;
  }

  // Address details helper
  const renderAddressHtml = () => {
    let html = '';
    if (deliveryAddress) {
      html += `<div style="color:#0f172a; font-weight:600; margin-bottom:8px; font-size:0.95rem;">${deliveryAddress}</div>`;
    }
    if (addressDoc && typeof addressDoc === 'object') {
      const parts = [];
      if (addressDoc.roomNumber) parts.push(`Room/Flat: <strong>${addressDoc.roomNumber}</strong>`);
      if (addressDoc.hostelName) parts.push(`Hostel/Building: <strong>${addressDoc.hostelName}</strong>`);
      if (addressDoc.landmark) parts.push(`Landmark: <strong>${addressDoc.landmark}</strong>`);
      if (addressDoc.city) parts.push(`City: <strong>${addressDoc.city}</strong>`);
      if (addressDoc.state) parts.push(`State: <strong>${addressDoc.state}</strong>`);
      if (addressDoc.postalCode) parts.push(`Pincode: <strong>${addressDoc.postalCode}</strong>`);
      
      if (parts.length > 0) {
        html += `<div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; margin-top:6px; font-size:0.85rem; color:#334155; line-height:1.6;">`;
        html += parts.join(' • ');
        html += `</div>`;
      }
    }
    return html || '<span style="color:#64748b;">Not provided</span>';
  };

  const formattedDate = orderTime || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlContent = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 650px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <!-- Header Banner -->
      <div style="background: linear-gradient(135deg, #0f172a 0%, #0284c7 100%); padding: 26px 30px; color: #ffffff;">
        <h2 style="margin: 0; font-size: 1.4rem; font-weight: 700; tracking: -0.5px;">🛒 New Order Received!</h2>
        <p style="margin: 6px 0 0 0; color: #bae6fd; font-size: 0.92rem;">NearCart Platform — ${shopName}</p>
      </div>

      <div style="padding: 26px 30px;">
        <p style="font-size: 1rem; color: #334155; margin-top: 0;">Hello <strong>${shopkeeperName}</strong>,</p>
        <p style="font-size: 0.95rem; color: #475569; margin-bottom: 22px;">You have received a new order on <strong>NearCart</strong>. Please inspect the order breakdown below:</p>

        <!-- ORDER INFORMATION -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">ORDER INFORMATION</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <tr>
              <td style="padding: 5px 0; color: #64748b; width: 45%;">Order ID:</td>
              <td style="padding: 5px 0; font-weight: 700; color: #0284c7;">#${orderNumber || orderId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Order Date:</td>
              <td style="padding: 5px 0; font-weight: 600;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Order Status:</td>
              <td style="padding: 5px 0;"><span style="background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700;">${orderStatus}</span></td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Shop:</td>
              <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${shopName || 'N/A'}</td>
            </tr>
          </table>
        </div>

        <!-- CUSTOMER INFORMATION -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">CUSTOMER INFORMATION</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <tr>
              <td style="padding: 5px 0; color: #64748b; width: 45%;">Customer Name:</td>
              <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${studentName || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b;">Mobile Number:</td>
              <td style="padding: 5px 0; font-weight: 700; color: #0f172a;">${customerPhone && String(customerPhone).trim() ? customerPhone : 'Not provided'}</td>
            </tr>
           
          </table>
        </div>

        <!-- DELIVERY INFORMATION -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">DELIVERY INFORMATION</h3>
          <div style="font-size: 0.9rem;">
            ${renderAddressHtml()}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-top: 10px; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
            <tr>
              <td style="padding: 6px 0 0 0; color: #64748b; width: 45%;">Delivery Fee:</td>
              <td style="padding: 6px 0 0 0; font-weight: 700; color: #0f172a;">₹${deliveryFeeNum.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- ORDER ITEMS -->
        <div style="margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">ORDER ITEMS</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f1f5f9; color: #475569;">
                <th style="padding: 10px 12px; text-align: left; font-weight: 700;">Product</th>
                <th style="padding: 10px 12px; text-align: center; font-weight: 700;">Qty</th>
                <th style="padding: 10px 12px; text-align: right; font-weight: 700;">Unit Price</th>
                <th style="padding: 10px 12px; text-align: right; font-weight: 700;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- BILLING SUMMARY -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">BILLING SUMMARY</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.92rem;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Subtotal:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">₹${subtotalNum.toFixed(2)}</td>
            </tr>
            ${packingChargesNum > 0 ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Packing Charges:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">₹${packingChargesNum.toFixed(2)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Delivery Fee:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">₹${deliveryFeeNum.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">GST Amount:</td>
              <td style="padding: 6px 0; font-weight: 600; text-align: right;">₹${gstAmountNum.toFixed(2)}</td>
            </tr>
            ${couponRowHtml}
            <tr style="border-top: 2px solid #94a3b8;">
              <td style="padding: 12px 0 6px 0; font-weight: 800; font-size: 1.05rem; color: #0f172a;">Grand Total:</td>
              <td style="padding: 12px 0 6px 0; font-weight: 800; font-size: 1.1rem; color: #0284c7; text-align: right;">₹${totalAmountNum.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <!-- PAYMENT INFORMATION -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">PAYMENT INFORMATION</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            ${paymentDetailsHtml}
          </table>
        </div>

        <!-- ORDER NOTES -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">ORDER NOTES</h3>
          <p style="margin: 0; font-size: 0.9rem; color: #334155;">${notes && String(notes).trim() ? notes.trim() : 'None'}</p>
        </div>

        <!-- SHOP INFORMATION -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 22px;">
          <h3 style="font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 12px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">SHOP INFORMATION</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <tr>
              <td style="padding: 4px 0; color: #64748b; width: 45%;">Shop Name:</td>
              <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${shopName || 'Not provided'}</td>
            </tr>
            ${shopPhone ? `<tr><td style="padding: 4px 0; color: #64748b;">Shop Phone:</td><td style="padding: 4px 0; font-weight: 600;">${shopPhone}</td></tr>` : ''}
            ${shopAddress ? `<tr><td style="padding: 4px 0; color: #64748b;">Shop Address:</td><td style="padding: 4px 0; font-weight: 600;">${shopAddress}</td></tr>` : ''}
          </table>
        </div>

        <p style="font-size: 0.9rem; color: #64748b; text-align: center; margin-top: 25px;">
          Please log in to your <strong>NearCart Shopkeeper Dashboard</strong> to manage and process this order.
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 16px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">
          Thank you,<br><strong>NearCart Platform</strong>
        </p>
      </div>
    </div>
  `;

  try {
    // --- Primary: Brevo HTTP API (works on Render free tier, SMTP is blocked there) ---
    if (process.env.BREVO_API_KEY) {
      console.log('[EMAIL TRACE] Transport: Brevo HTTP API');
      const info = await sendViaBrevoApi({
        to: shopkeeperEmail,
        subject,
        htmlContent,
      });
      console.log(`[EMAIL TRACE] SMTP send: SUCCESS (via Brevo API)`);
      console.log(`[EMAIL TRACE] Message ID: ${info.messageId}`);
      console.log(`[EMAIL] Send status: SUCCESS (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, response: info.response };
    }

    // --- Fallback: Nodemailer SMTP (local dev / non-Render environments) ---
    const transporter = createTransporter();
    if (!transporter) {
      console.log('[EMAIL TRACE] SMTP send: LOGGED_ONLY (SMTP environment credentials not configured in runtime)');
      console.log('[EMAIL] Send status: LOGGED_ONLY');
      return { success: true, loggedOnly: true };
    }

    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: shopkeeperEmail,
      subject,
      html: htmlContent,
    });

    console.log(`[EMAIL TRACE] SMTP send: SUCCESS`);
    console.log(`[EMAIL TRACE] Message ID: ${info.messageId}`);
    console.log(`[EMAIL] Send status: SUCCESS (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    const safeError = {
      code: error.code || 'SEND_FAILURE',
      responseCode: error.responseCode || null,
      command: error.command || null,
      message: error.message || 'SMTP send failed',
    };

    console.error(`[EMAIL TRACE] SMTP send: FAIL`);
    console.error(`[EMAIL] Send status: FAILED`);
    console.error(`[EMAIL] Provider error code: ${safeError.code}`);
    if (safeError.responseCode) console.error(`[EMAIL] Provider response code: ${safeError.responseCode}`);
    console.error(`[EMAIL] Provider error message: ${safeError.message}`);

    // Non-blocking failure isolation
    return { success: false, error: safeError };
  }
};

/**
 * Send email notification to Delivery Partner when a delivery is assigned
 */
export const sendDeliveryAssignedEmailToDeliveryBoy = async ({
  deliveryBoyEmail,
  deliveryBoyName,
  orderNumber,
  shopName,
  shopAddress,
  deliveryAddress,
  customerName,
  totalAmount,
  orderId,
}) => {
  console.log(`[EMAIL TRACE] Delivery email function called: PASS`);

  if (!deliveryBoyEmail) {
    console.warn('[EMAIL TRACE] Delivery email resolved: FAIL (Missing recipient email)');
    return { success: false, reason: 'No recipient email provided' };
  }

  console.log(`[EMAIL TRACE] Delivery email resolved: PASS (${deliveryBoyEmail})`);
  console.log(`[EMAIL] Delivery recipient: ${deliveryBoyEmail}`);

  const subject = `NearCart Delivery Assigned — #${orderNumber}`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
      <h2 style="color: #16a34a; margin-top: 0;">🚀 New Delivery Assignment</h2>
      <p>Hello <strong>${deliveryBoyName}</strong>,</p>
      <p>You have been assigned to deliver order <strong>#${orderNumber}</strong>.</p>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 18px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 1rem;">Assignment Details</h3>
        <p style="margin: 6px 0;"><strong>Pickup Shop:</strong> ${shopName} (${shopAddress || 'See dashboard for details'})</p>
        <p style="margin: 6px 0;"><strong>Customer Name:</strong> ${customerName || 'Student'}</p>
        <p style="margin: 6px 0;"><strong>Delivery Destination:</strong> ${deliveryAddress}</p>
        <p style="margin: 6px 0;"><strong>Order Amount:</strong> ₹${totalAmount}</p>
      </div>

      <p style="font-size: 0.9rem; color: #64748b;">
        Open your <strong>NearCart Delivery Dashboard</strong> to navigate to the shop and update delivery status.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-top: 24px;" />
      <p style="font-size: 0.75rem; color: #94a3b8; text-align: center;">
        NearCart Platform Delivery Network — Automatic Notification
      </p>
    </div>
  `;

  try {
    // --- Primary: Brevo HTTP API (works on Render free tier, SMTP is blocked there) ---
    if (process.env.BREVO_API_KEY) {
      console.log('[EMAIL TRACE] Transport: Brevo HTTP API');
      const info = await sendViaBrevoApi({
        to: deliveryBoyEmail,
        subject,
        htmlContent,
      });
      console.log(`[EMAIL TRACE] SMTP send: SUCCESS (via Brevo API)`);
      console.log(`[EMAIL TRACE] Message ID: ${info.messageId}`);
      console.log(`[EMAIL] Send status: SUCCESS (MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId, response: info.response };
    }

    // --- Fallback: Nodemailer SMTP (local dev / non-Render environments) ---
    const transporter = createTransporter();
    if (!transporter) {
      console.log('[EMAIL TRACE] SMTP send: LOGGED_ONLY (SMTP environment credentials not configured in runtime)');
      console.log('[EMAIL] Send status: LOGGED_ONLY');
      return { success: true, loggedOnly: true };
    }

    const info = await transporter.sendMail({
      from: getFromAddress(),
      to: deliveryBoyEmail,
      subject,
      html: htmlContent,
    });

    console.log(`[EMAIL TRACE] SMTP send: SUCCESS`);
    console.log(`[EMAIL TRACE] Message ID: ${info.messageId}`);
    console.log(`[EMAIL] Send status: SUCCESS (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    const safeError = {
      code: error.code || 'SEND_FAILURE',
      responseCode: error.responseCode || null,
      command: error.command || null,
      message: error.message || 'SMTP send failed',
    };

    console.error(`[EMAIL TRACE] SMTP send: FAIL`);
    console.error(`[EMAIL] Send status: FAILED`);
    console.error(`[EMAIL] Provider error code: ${safeError.code}`);
    if (safeError.responseCode) console.error(`[EMAIL] Provider response code: ${safeError.responseCode}`);
    console.error(`[EMAIL] Provider error message: ${safeError.message}`);

    // Non-blocking failure isolation
    return { success: false, error: safeError };
  }
};

/**
 * Send welcome email to newly registered student/customer using Brevo HTTP API
 */
export const sendWelcomeEmailToUser = async ({ userEmail, userName }) => {
  if (!userEmail) return { success: false, reason: 'No recipient email provided' };

  const subject = 'Welcome to NearCart 🎉';
  const name = userName || 'Customer';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
      <h2 style="color: #0284c7; margin-top: 0;">🎉 Welcome to NearCart!</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your account has been created successfully. You can now explore local shops and place orders straight to your location.</p>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 18px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #334155; font-size: 1rem;">What you can do on NearCart:</h3>
        <ul style="padding-left: 20px; margin-bottom: 0; color: #475569;">
          <li>Browse products from nearby canteen, stationery, and grocery shops</li>
          <li>Place quick orders with Cash on Delivery or UPI payments</li>
          <li>Track your delivery partner live on the map</li>
        </ul>
      </div>

      <p style="font-size: 0.9rem; color: #64748b;">
        "Your nearby shops, delivered."
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-top: 24px;" />
      <p style="font-size: 0.75rem; color: #94a3b8; text-align: center;">
        NearCart Platform — Automatic Notification System
      </p>
    </div>
  `;

  try {
    if (process.env.BREVO_API_KEY) {
      const info = await sendViaBrevoApi({ to: userEmail, subject, htmlContent });
      return { success: true, messageId: info.messageId };
    }
    const transporter = createTransporter();
    if (!transporter) return { success: true, loggedOnly: true };

    const info = await transporter.sendMail({ from: getFromAddress(), to: userEmail, subject, html: htmlContent });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL WARNING] Welcome email dispatch failed safely:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email to staff member (Shopkeeper / Delivery Boy) created by admin
 */
export const sendStaffWelcomeEmailToStaff = async ({ staffEmail, staffName, role }) => {
  if (!staffEmail) return { success: false, reason: 'No recipient email provided' };

  const subject = 'Welcome to the NearCart Team 🎉';
  const roleName = role === 'SHOPKEEPER' ? 'Shop Partner' : 'Delivery Partner';
  const portalName = role === 'SHOPKEEPER' ? 'NearCart Shopkeeper Portal' : 'NearCart Delivery Hub';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background: #ffffff;">
      <h2 style="color: #0284c7; margin-top: 0;">🎉 Welcome to the NearCart Team!</h2>
      <p>Hello <strong>${staffName || 'Partner'}</strong>,</p>
      <p>Your <strong>${roleName}</strong> account has been created successfully by the administrator.</p>
      
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 18px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 4px 0;"><strong>Role:</strong> ${roleName}</p>
        <p style="margin: 4px 0;"><strong>Portal:</strong> ${portalName}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> Active & Approved</p>
      </div>

      <p style="font-size: 0.9rem; color: #64748b;">
        You can now log in to NearCart using your registered email address to access your dashboard.
      </p>

      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-top: 24px;" />
      <p style="font-size: 0.75rem; color: #94a3b8; text-align: center;">
        NearCart Platform Administration — Automatic Notification
      </p>
    </div>
  `;

  try {
    if (process.env.BREVO_API_KEY) {
      const info = await sendViaBrevoApi({ to: staffEmail, subject, htmlContent });
      return { success: true, messageId: info.messageId };
    }
    const transporter = createTransporter();
    if (!transporter) return { success: true, loggedOnly: true };

    const info = await transporter.sendMail({ from: getFromAddress(), to: staffEmail, subject, html: htmlContent });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL WARNING] Staff welcome email dispatch failed safely:', error.message);
    return { success: false, error: error.message };
  }
};
