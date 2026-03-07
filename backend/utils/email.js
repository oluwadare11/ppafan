// utils/email.js - Complete Multi-Tenant Email Service with Beautiful UI
const nodemailer = require('nodemailer');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.MAIL_PORT) || 465,
  secure: process.env.MAIL_SECURE !== 'false',
  auth: {
    user: process.env.MAIL_USERNAME || (process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER),
    pass: process.env.MAIL_PASSWORD || process.env.EMAIL_PASS,
  },
});

/**
 * Common email styles - Modern, Clean, Consistent
 * Optimized for email clients (Gmail, Outlook, Apple Mail, Yahoo)
 */
const getEmailStyles = (tenant) => {
  const primaryColor = tenant?.branding?.primaryColor || '#3B82F6';

  return {
    container: `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background-color: #f8fafc;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    `,
    card: `
      background-color: #ffffff;
      margin: 16px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    `,
    header: `
      background-color: ${primaryColor};
      padding: 32px 24px;
      text-align: center;
    `,
    logo: `
      width: 72px;
      height: auto;
      margin-bottom: 16px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    `,
    headerTitle: `
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      margin: 0;
      line-height: 1.3;
    `,
    headerSubtitle: `
      color: #ffffff;
      opacity: 0.9;
      font-size: 15px;
      margin: 8px 0 0 0;
      font-weight: 400;
      line-height: 1.4;
    `,
    content: `
      padding: 28px 24px;
    `,
    text: `
      color: #334155;
      font-size: 15px;
      line-height: 1.65;
      margin: 0 0 16px 0;
    `,
    codeBox: `
      background-color: #f1f5f9;
      border: 2px dashed ${primaryColor};
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    `,
    codeLabel: `
      color: #64748b;
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 0 0 12px 0;
    `,
    code: `
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 10px;
      color: ${primaryColor};
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
    `,
    infoBox: `
      background-color: #f0fdf4;
      border-left: 4px solid #10b981;
      border-radius: 6px;
      padding: 16px 18px;
      margin: 20px 0;
    `,
    infoTable: `
      width: 100%;
      border-collapse: collapse;
    `,
    infoRow: `
      border-bottom: 1px solid #d1fae5;
    `,
    infoLabel: `
      padding: 10px 8px 10px 0;
      color: #065f46;
      font-weight: 600;
      font-size: 13px;
      width: 40%;
      vertical-align: top;
    `,
    infoValue: `
      padding: 10px 0;
      color: #059669;
      font-weight: 600;
      font-size: 14px;
      font-family: 'Courier New', Courier, monospace;
      word-break: break-word;
    `,
    button: `
      display: inline-block;
      background-color: ${primaryColor};
      color: #ffffff;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
    `,
    buttonContainer: `
      text-align: center;
      margin: 24px 0;
    `,
    warningBox: `
      background-color: #fef2f2;
      border-left: 4px solid #ef4444;
      border-radius: 6px;
      padding: 14px 16px;
      margin: 16px 0;
    `,
    warningText: `
      color: #991b1b;
      font-size: 14px;
      margin: 0;
      line-height: 1.55;
    `,
    alertBox: `
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      border-radius: 6px;
      padding: 14px 16px;
      margin: 16px 0;
    `,
    alertText: `
      color: #92400e;
      font-size: 14px;
      margin: 0;
      line-height: 1.55;
    `,
    // Attendance status styles
    statusLate: `
      background: #fef2f2;
      color: #dc2626;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    `,
    statusOvertime: `
      background: #f0f9ff;
      color: #0369a1;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    `,
    statusEarly: `
      background: #fef3c7;
      color: #92400e;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
    `,
    // Table styles for attendance emails
    table: `
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      border-radius: 8px;
      overflow: hidden;
    `,
    tableHeader: `
      background: linear-gradient(135deg, ${primaryColor} 0%, #1d4ed8 100%);
      color: #ffffff;
      padding: 12px 15px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 13px;
      text-align: left;
    `,
    tableCell: `
      border: 1px solid #e5e7eb;
      padding: 12px 15px;
      color: #374151;
      background-color: #fafafa;
    `,
    tableCellAlt: `
      border: 1px solid #e5e7eb;
      padding: 12px 15px;
      color: #374151;
      background-color: #ffffff;
    `,
  };
};

/**
 * Clean, Minimal Footer - Powered by Opsuite
 */
const getFooter = () => {
  return `
    <div style="background-color: #f8fafc; padding: 24px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <!-- Powered by Opsuite -->
      <p style="color: #94a3b8; font-size: 11px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">
        Powered by
      </p>

      <!-- Opsuite Logo (smaller) with link -->
      <a href="https://opsuite.io" target="_blank" style="text-decoration: none; display: inline-block; margin: 0 0 12px 0;">
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 10px 18px; border-radius: 6px; display: inline-block;">
          <img src="https://app.opsuite.io/opsuite.io_logo.png" alt="Opsuite" width="70" style="max-width: 70px; height: auto; display: block;" />
        </div>
      </a>

      <!-- Tagline -->
      <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">
        All-in-One Business Management Platform
      </p>

      <!-- Modules List -->
      <p style="color: #94a3b8; font-size: 10px; margin: 0; line-height: 1.5;">
        Dashboard | Inventory | POS | Accounting | CRM | Attendance | Payroll | Analytics | Marketing | Signage | Visitor
      </p>
    </div>
  `;
};

/**
 * Fetch and encode logo - returns object with base64 data and content type
 */
const getLogo = async (tenant) => {
  const fs = require('fs');
  const path = require('path');

  try {
    const tenantLogo = tenant?.branding?.logo;

    if (tenantLogo) {
      console.log('Found tenant logo:', tenantLogo.substring(0, 50) + '...');

      // If it's already base64 data
      if (tenantLogo.startsWith('data:image/')) {
        const matches = tenantLogo.match(/^data:image\/([a-z]+);base64,(.+)$/i);
        if (matches) {
          try {
            // Decode and check actual byte size (should be at least 500 bytes for a valid logo)
            const decodedBuffer = Buffer.from(matches[2], 'base64');
            if (decodedBuffer.length >= 500) {
              console.log(`Using base64 tenant logo (${decodedBuffer.length} bytes)`);
              return { data: matches[2], type: matches[1] };
            } else {
              console.log(`Base64 logo too small (${decodedBuffer.length} bytes), treating as placeholder`);
            }
          } catch (decodeErr) {
            console.log('Failed to decode base64 logo:', decodeErr.message);
          }
        }
      }

      // If it's a local file path (starts with /uploads/)
      if (tenantLogo.startsWith('/uploads/')) {
        // Try to read directly from disk first (more reliable than HTTP fetch)
        const localPath = path.join(__dirname, '..', tenantLogo);
        console.log('Trying to read logo from disk:', localPath);

        try {
          if (fs.existsSync(localPath)) {
            const fileBuffer = fs.readFileSync(localPath);
            // Reject tiny placeholder files (< 500 bytes)
            if (fileBuffer.length < 500) {
              console.log('Logo file too small (placeholder), using fallback');
              return null;
            }
            const ext = path.extname(localPath).toLowerCase().replace('.', '') || 'png';
            const imageType = ext === 'jpg' ? 'jpeg' : ext;
            console.log('Tenant logo read from disk successfully');
            return {
              data: fileBuffer.toString('base64'),
              type: imageType
            };
          }
        } catch (diskErr) {
          console.error('Failed to read logo from disk:', diskErr.message);
        }
      }

      // Fallback: try HTTP fetch for remote URLs
      if (tenantLogo.startsWith('http')) {
        console.log('Fetching tenant logo from URL:', tenantLogo);

        try {
          const response = await axios.get(tenantLogo, {
            responseType: 'arraybuffer',
            timeout: 8000,
            headers: {
              'User-Agent': 'Opsuite-Email-Service'
            }
          });

          const contentType = response.headers['content-type'] || 'image/png';
          const imageType = contentType.split('/')[1] || 'png';

          console.log('Tenant logo fetched successfully');
          return {
            data: Buffer.from(response.data).toString('base64'),
            type: imageType
          };
        } catch (fetchErr) {
          console.error('Failed to fetch tenant logo:', fetchErr.message);
        }
      }
    }

    // No tenant logo or fetch failed - return null so business name initial can be shown
    console.log('No tenant logo available');
    return null;
  } catch (err) {
    console.error('Error in getLogo:', err.message);
    return null;
  }
};

/**
 * Generate logo HTML for email header
 * Uses CID attachment reference for Gmail compatibility
 * @param {Object} logoData - Logo data with base64 and type
 * @param {string} businessName - Business name for alt text
 * @param {Object} styles - Style object
 * @param {boolean} useCid - If true, use cid: reference (for attachment-based emails)
 * @returns {string} HTML string for logo
 */
const getLogoHtml = (logoData, businessName, styles, useCid = true) => {
  if (logoData && logoData.data) {
    // Use CID reference for Gmail compatibility - the actual attachment is added in sendMail
    if (useCid) {
      return `<img src="cid:company-logo" alt="${businessName}" style="${styles.logo}" />`;
    }
    // Fallback to data URI (won't work in Gmail but works in other clients)
    return `<img src="data:image/${logoData.type || 'png'};base64,${logoData.data}" alt="${businessName}" style="${styles.logo}" />`;
  }
  // Fallback: Show business name initial in a circle
  const initial = (businessName || 'B').charAt(0).toUpperCase();
  return `
    <div style="width: 72px; height: 72px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
      <span style="color: #ffffff; font-size: 32px; font-weight: 700;">${initial}</span>
    </div>
  `;
};

/**
 * Generate email template based on type
 * Returns logoData for CID attachment creation
 */
const getEmailTemplate = async (type, data, tenant = null) => {
  const styles = getEmailStyles(tenant);
  const logoData = await getLogo(tenant);
  let subject, html, attachments = [];

  const businessName = tenant?.businessName || 'Opsuite';
  const logoHtml = getLogoHtml(logoData, businessName, styles, true); // Use CID reference
  
  switch (type) {
    case 'daily_business_report':
      subject = `Daily Business Report - ${businessName} - ${data.date}`;
      html = `
        <div style="${styles.container}">
          <div style="${styles.card}">
            <div style="${styles.header}">
              ${logoHtml}
              <h1 style="${styles.headerTitle}">📊 Daily Business Report</h1>
              <p style="${styles.headerSubtitle}">${businessName} - ${data.date}</p>
            </div>
            
            <div style="${styles.content}">
              <!-- Sales Summary -->
              <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #10b981;">
                <h2 style="color: #047857; margin: 0 0 20px 0; font-size: 20px;">💰 Sales Summary</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr style="border-bottom: 1px solid #a7f3d0;">
                    <td style="padding: 12px 0; color: #065f46; font-weight: 600;">Total Revenue</td>
                    <td style="padding: 12px 0; color: #059669; font-weight: 700; text-align: right; font-size: 24px;">₦${data.totalRevenue.toLocaleString()}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #a7f3d0;">
                    <td style="padding: 12px 0; color: #065f46; font-weight: 600;">Total Transactions</td>
                    <td style="padding: 12px 0; color: #059669; font-weight: 700; text-align: right; font-size: 18px;">${data.totalTransactions}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; color: #065f46; font-weight: 600;">Average Transaction</td>
                    <td style="padding: 12px 0; color: #059669; font-weight: 700; text-align: right; font-size: 18px;">₦${data.avgTransaction.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <!-- Expenses -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #f59e0b;">
                <h2 style="color: #d97706; margin: 0 0 20px 0; font-size: 20px;">💸 Expenses</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: #92400e; font-weight: 600;">Total Expenses</td>
                    <td style="padding: 12px 0; color: #d97706; font-weight: 700; text-align: right; font-size: 24px;">₦${data.totalExpenses.toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <!-- Profitability -->
              <div style="background: linear-gradient(135deg, ${data.netProfit >= 0 ? '#dbeafe 0%, #bfdbfe 100%' : '#fee2e2 0%, #fecaca 100%'}); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid ${data.netProfit >= 0 ? '#3b82f6' : '#ef4444'};">
                <h2 style="color: ${data.netProfit >= 0 ? '#1e40af' : '#dc2626'}; margin: 0 0 20px 0; font-size: 20px;">
                  ${data.netProfit >= 0 ? '📈' : '📉'} Profitability
                </h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; color: ${data.netProfit >= 0 ? '#1e3a8a' : '#991b1b'}; font-weight: 600;">Net Profit/Loss</td>
                    <td style="padding: 12px 0; color: ${data.netProfit >= 0 ? '#2563eb' : '#dc2626'}; font-weight: 700; text-align: right; font-size: 28px;">₦${data.netProfit.toLocaleString()}</td>
                  </tr>
                </table>
                ${data.netProfit < 0 ? '<p style="margin: 10px 0 0 0; color: #991b1b; font-size: 14px;"><strong>Note:</strong> Today\'s expenses exceeded revenue</p>' : ''}
              </div>

              <!-- Metrics Grid -->
              <div style="display: table; width: 100%; margin: 25px 0;">
                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #8b5cf6; text-align: center; margin-bottom: 12px;">
                  <div style="font-size: 32px; font-weight: 700; color: #7c3aed; margin-bottom: 8px;">${data.attendanceCount}</div>
                  <div style="font-size: 14px; color: #6b7280; font-weight: 600;">👥 Staff Attendance</div>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #06b6d4; text-align: center; margin-bottom: 12px;">
                  <div style="font-size: 32px; font-weight: 700; color: #0891b2; margin-bottom: 8px;">${data.inventoryCount}</div>
                  <div style="font-size: 14px; color: #6b7280; font-weight: 600;">📦 Inventory Items</div>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #ec4899; text-align: center; margin-bottom: 12px;">
                  <div style="font-size: 32px; font-weight: 700; color: #db2777; margin-bottom: 8px;">${data.checkoutsCount}</div>
                  <div style="font-size: 14px; color: #6b7280; font-weight: 600;">🔄 Checkouts</div>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 4px solid #14b8a6; text-align: center;">
                  <div style="font-size: 32px; font-weight: 700; color: #0d9488; margin-bottom: 8px;">${data.customersCount}</div>
                  <div style="font-size: 14px; color: #6b7280; font-weight: 600;">👤 Customers</div>
                </div>
              </div>

              <div style="${styles.buttonContainer}">
                <a href="${data.dashboardUrl}" style="${styles.button}">
                  📊 View Detailed Analytics
                </a>
              </div>

              <!-- Metadata -->
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 30px; border-top: 2px solid #e5e7eb;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                  <strong>Report Generated:</strong> ${data.generatedAt}<br>
                  <strong>Period:</strong> ${data.date} (Lagos Time)
                </p>
              </div>
            </div>

            ${getFooter()}
          </div>
        </div>
      `;
      break;

// ===== POS Sale Email Template - Clean & Professional =====
case 'pos_sale':
  const formatNaira = (amount) => `₦${(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const saleDate = data.createdAt ? new Date(data.createdAt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  subject = `Sale Receipt - ${formatNaira(data.totalAmount)} - ${data.tenantName || businessName}`;
  html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">

      <!-- Main Card -->
      <div style="background-color: #ffffff; margin: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">

        <!-- Header -->
        <div style="background-color: #1e40af; padding: 24px; text-align: center;">
          ${logoHtml}
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">Sale Completed</h1>
          <p style="color: #bfdbfe; font-size: 14px; margin: 6px 0 0 0;">${data.tenantName || businessName}</p>
        </div>

        <!-- Sale Amount Highlight -->
        <div style="background-color: #f0fdf4; padding: 20px; text-align: center; border-bottom: 1px solid #bbf7d0;">
          <p style="color: #166534; font-size: 13px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Total Amount</p>
          <p style="color: #15803d; font-size: 32px; font-weight: 700; margin: 0;">${formatNaira(data.totalAmount)}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">${saleDate}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">

          <!-- Items Section -->
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1f2937; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Items Purchased</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${data.items && Array.isArray(data.items) ? data.items.map(item => `
                <tr>
                  <td style="padding: 8px 0; color: #374151; font-size: 14px; border-bottom: 1px solid #f3f4f6;">
                    ${item.name || 'Item'}
                    ${item.modifiers && item.modifiers.length > 0 ? `<br><span style="color: #6b7280; font-size: 12px;">${item.modifiers.map(m => m.name || m).join(', ')}</span>` : ''}
                  </td>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 13px; text-align: center; border-bottom: 1px solid #f3f4f6; width: 60px;">x${item.quantity || 1}</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6; width: 100px;">${formatNaira((item.price || 0) * (item.quantity || 1))}</td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="padding: 12px 0; color: #6b7280; text-align: center;">No items</td></tr>'}
            </table>
          </div>

          <!-- Transaction Summary -->
          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Subtotal</td>
                <td style="padding: 6px 0; color: #374151; font-size: 13px; text-align: right;">${formatNaira(data.subtotal)}</td>
              </tr>
              ${data.vat > 0 ? `
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">VAT (7.5%)</td>
                <td style="padding: 6px 0; color: #374151; font-size: 13px; text-align: right;">${formatNaira(data.vat)}</td>
              </tr>
              ` : ''}
              ${data.gratuity > 0 ? `
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Gratuity/Tip</td>
                <td style="padding: 6px 0; color: #374151; font-size: 13px; text-align: right;">${formatNaira(data.gratuity)}</td>
              </tr>
              ` : ''}
              ${data.discount > 0 ? `
              <tr>
                <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Discount</td>
                <td style="padding: 6px 0; color: #059669; font-size: 13px; text-align: right;">-${formatNaira(data.discount)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 10px 0 0 0; color: #1f2937; font-size: 15px; font-weight: 600;">Total</td>
                <td style="padding: 10px 0 0 0; color: #15803d; font-size: 15px; font-weight: 700; text-align: right;">${formatNaira(data.totalAmount)}</td>
              </tr>
            </table>
          </div>

          <!-- Payment & Staff Info -->
          <div style="display: table; width: 100%; margin-bottom: 20px;">
            <div style="display: table-cell; width: 50%; padding-right: 8px; vertical-align: top;">
              <div style="background-color: #eff6ff; border-radius: 6px; padding: 12px;">
                <p style="color: #1e40af; font-size: 11px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Payment</p>
                <p style="color: #1e3a8a; font-size: 14px; font-weight: 500; margin: 0;">${(data.paymentMethod || 'cash').replace('_', ' ').toUpperCase()}</p>
              </div>
            </div>
            <div style="display: table-cell; width: 50%; padding-left: 8px; vertical-align: top;">
              <div style="background-color: #f5f3ff; border-radius: 6px; padding: 12px;">
                <p style="color: #6d28d9; font-size: 11px; font-weight: 600; margin: 0 0 4px 0; text-transform: uppercase;">Cashier</p>
                <p style="color: #4c1d95; font-size: 14px; font-weight: 500; margin: 0;">${data.cashier || data.staffName || 'Staff'}</p>
              </div>
            </div>
          </div>


          ${data.customer && data.customer.name ? `
          <!-- Customer Info -->
          <div style="border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
            <p style="color: #6b7280; font-size: 11px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase;">Customer</p>
            <p style="color: #1f2937; font-size: 14px; font-weight: 500; margin: 0 0 4px 0;">${data.customer.name}</p>
            ${data.customer.phone ? `<p style="color: #6b7280; font-size: 13px; margin: 0 0 2px 0;">${data.customer.phone}</p>` : ''}
            ${data.customer.email ? `<p style="color: #6b7280; font-size: 13px; margin: 0;">${data.customer.email}</p>` : ''}
          </div>
          ` : ''}

          <!-- Reference -->
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            Ref: ${data.transactionId || data._id || 'N/A'} | ${data.section || data.department || 'Sales'}
          </p>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Inventory Checkout Email Template - Professional StockFlow Style =====
case 'inventory_checkout':
  const checkoutDate = data.createdAt ? new Date(data.createdAt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  // Determine checkout type styling (no emojis)
  const checkoutTypeColors = {
    operational: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    sample: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    damaged: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    expired: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    transfer: { bg: '#f0fdf4', border: '#10b981', text: '#065f46' },
    return: { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
    other: { bg: '#f9fafb', border: '#6b7280', text: '#374151' }
  };
  const checkoutType = (data.reason || data.checkoutType || 'other').toLowerCase();
  const typeStyle = checkoutTypeColors[checkoutType] || checkoutTypeColors.other;

  // Calculate total items count
  const totalItemsCount = data.items && Array.isArray(data.items)
    ? data.items.reduce((sum, item) => sum + (item.quantity || 1), 0)
    : (data.quantity || 1);

  // Helper to get remaining quantity display
  const getRemainingDisplay = (remaining) => {
    if (remaining === undefined || remaining === null || remaining === 'N/A') return '—';
    return remaining;
  };

  subject = `StockFlow Checkout - ${totalItemsCount} item${totalItemsCount !== 1 ? 's' : ''} - ${data.tenantName || businessName}`;
  html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">

      <!-- Main Card -->
      <div style="background-color: #ffffff; margin: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">

        <!-- Header -->
        <div style="background-color: #7c3aed; padding: 24px; text-align: center;">
          ${logoHtml}
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">Inventory Checkout</h1>
          <p style="color: #ddd6fe; font-size: 14px; margin: 6px 0 0 0;">${data.tenantName || businessName} • StockFlow</p>
        </div>

        <!-- Checkout Type Highlight -->
        <div style="background-color: ${typeStyle.bg}; padding: 20px; text-align: center; border-bottom: 3px solid ${typeStyle.border};">
          <p style="color: ${typeStyle.text}; font-size: 13px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Checkout Type</p>
          <p style="color: ${typeStyle.text}; font-size: 24px; font-weight: 700; margin: 0;">${(checkoutType.charAt(0).toUpperCase() + checkoutType.slice(1)).replace('_', ' ')}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">${checkoutDate}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">

          <!-- Items Section -->
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1f2937; font-size: 14px; font-weight: 600; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">Items Checked Out</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background-color: #f9fafb;">
                <th style="padding: 10px 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-align: left; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Item</th>
                <th style="padding: 10px 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-align: center; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Qty</th>
                <th style="padding: 10px 8px; color: #6b7280; font-size: 12px; font-weight: 600; text-align: right; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Remaining</th>
              </tr>
              ${data.items && Array.isArray(data.items) ? data.items.map(item => {
                const remaining = getRemainingDisplay(item.remainingQuantity);
                const isLowStock = remaining !== '—' && parseInt(remaining) <= 5;
                return `
                <tr>
                  <td style="padding: 10px 8px; color: #374151; font-size: 14px; border-bottom: 1px solid #f3f4f6;">
                    ${item.name || item.itemName || 'Item'}
                    ${item.sku ? `<br><span style="color: #9ca3af; font-size: 11px;">SKU: ${item.sku}</span>` : ''}
                  </td>
                  <td style="padding: 10px 8px; color: #374151; font-size: 14px; font-weight: 600; text-align: center; border-bottom: 1px solid #f3f4f6;">${item.quantity || 1}</td>
                  <td style="padding: 10px 8px; font-size: 14px; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6; ${isLowStock ? 'color: #dc2626;' : 'color: #059669;'}">
                    ${remaining}${isLowStock ? ' (Low)' : ''}
                  </td>
                </tr>
              `}).join('') : `
                <tr>
                  <td style="padding: 10px 8px; color: #374151; font-size: 14px; border-bottom: 1px solid #f3f4f6;">${data.itemName || 'Item'}</td>
                  <td style="padding: 10px 8px; color: #374151; font-size: 14px; font-weight: 600; text-align: center; border-bottom: 1px solid #f3f4f6;">${data.quantity || 1}</td>
                  <td style="padding: 10px 8px; color: #059669; font-size: 14px; font-weight: 500; text-align: right; border-bottom: 1px solid #f3f4f6;">${getRemainingDisplay(data.remainingQuantity)}</td>
                </tr>
              `}
              <tr style="background-color: #f9fafb;">
                <td style="padding: 12px 8px; color: #1f2937; font-size: 14px; font-weight: 600;">Total Checked Out</td>
                <td style="padding: 12px 8px; color: #7c3aed; font-size: 16px; font-weight: 700; text-align: center;">${totalItemsCount}</td>
                <td style="padding: 12px 8px;"></td>
              </tr>
            </table>
          </div>

          <!-- Checkout Details -->
          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <h3 style="color: #1f2937; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Checkout Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 40%;">Checked Out By</td>
                <td style="padding: 8px 0; color: #374151; font-size: 13px; font-weight: 500;">${data.staffName || data.checkedOutBy || 'Staff'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Department</td>
                <td style="padding: 8px 0; color: #374151; font-size: 13px; font-weight: 500;">${data.department || 'General'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Reason</td>
                <td style="padding: 8px 0; color: ${typeStyle.text}; font-size: 13px; font-weight: 600;">${(data.reason || data.checkoutType || 'Other').charAt(0).toUpperCase() + (data.reason || data.checkoutType || 'Other').slice(1).replace('_', ' ')}</td>
              </tr>
              ${data.notes ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Notes</td>
                <td style="padding: 8px 0; color: #374151; font-size: 13px; font-style: italic;">"${data.notes}"</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${data.items && data.items.some(item => item.remainingQuantity !== undefined && item.remainingQuantity !== null && parseInt(item.remainingQuantity) <= 5) ? `
          <!-- Low Stock Warning -->
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px 16px; margin-bottom: 20px;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.55;">
              <strong>Low Stock Alert:</strong> One or more items are running low and may need restocking soon.
            </p>
          </div>
          ` : ''}

          <!-- Reference -->
          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
            Ref: ${data.checkoutId || data._id || 'N/A'} | ${data.department || 'Inventory'} | ${checkoutDate}
          </p>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Invoice Marked as Paid - Revenue Inflow Notification =====
case 'invoice_marked_paid':
  const paidDate = data.paymentDate ? new Date(data.paymentDate).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  subject = `💰 Invoice Paid - ${data.invoiceNumber} - ₦${(data.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })} - ${data.tenantName || businessName}`;
  html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
      <div style="background-color: #ffffff; margin: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">💰 Payment Received</h1>
          <p style="color: #d1fae5; font-size: 14px; margin: 8px 0 0 0;">${data.tenantName || businessName}</p>
        </div>

        <!-- Amount Highlight -->
        <div style="background-color: #f0fdf4; padding: 20px; text-align: center; border-bottom: 3px solid #10b981;">
          <p style="color: #166534; font-size: 13px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Amount Received</p>
          <p style="color: #15803d; font-size: 32px; font-weight: 700; margin: 0;">₦${(data.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">${paidDate}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Invoice Number</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.invoiceNumber || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Customer</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${data.customerName || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Payment Method</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${(data.paymentMethod || 'cash').replace(/_/g, ' ').toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Department</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.department || 'General'}</td>
              </tr>
              ${data.processedBy ? `<tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Processed By</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.processedBy}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 4px;">
            <p style="color: #065f46; font-size: 13px; margin: 0;">
              <strong>Revenue Recorded:</strong> This payment has been automatically synced to your accounting records.
            </p>
          </div>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Invoice Sent Notification =====
case 'invoice_sent':
  const invoiceSentDate = data.sentAt ? new Date(data.sentAt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  subject = `📄 Invoice Sent - ${data.invoiceNumber} - ${data.tenantName || businessName}`;
  html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
      <div style="background-color: #ffffff; margin: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">📄 Invoice Sent</h1>
          <p style="color: #bfdbfe; font-size: 14px; margin: 8px 0 0 0;">${data.tenantName || businessName}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            An invoice has been sent to your customer. Here are the details:
          </p>

          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Invoice Number</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.invoiceNumber || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Amount</td>
                <td style="padding: 10px 0; color: #059669; font-size: 16px; font-weight: 700; text-align: right;">₦${(data.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Customer</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${data.customerName || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Sent To</td>
                <td style="padding: 10px 0; color: #3b82f6; font-size: 14px; text-align: right;">${data.recipientEmail || 'N/A'}</td>
              </tr>
              ${data.dueDate ? `<tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Due Date</td>
                <td style="padding: 10px 0; color: #dc2626; font-size: 14px; font-weight: 600; text-align: right;">${new Date(data.dueDate).toLocaleDateString('en-NG')}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px;">
            <p style="color: #1e40af; font-size: 13px; margin: 0;">
              <strong>Note:</strong> The invoice PDF has been attached to the email sent to the customer.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 20px 0 0 0;">
            Sent at: ${invoiceSentDate}${data.sentBy ? ` by ${data.sentBy}` : ''}
          </p>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Quotation Sent Notification =====
case 'quotation_sent':
  const quotationSentDate = data.sentAt ? new Date(data.sentAt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  subject = `📋 Quotation Sent - ${data.quotationNumber} - ${data.tenantName || businessName}`;
  html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
      <div style="background-color: #ffffff; margin: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">📋 Quotation Sent</h1>
          <p style="color: #e9d5ff; font-size: 14px; margin: 8px 0 0 0;">${data.tenantName || businessName}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
            A quotation has been sent to your client. Here are the details:
          </p>

          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Quotation Number</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.quotationNumber || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Total Amount</td>
                <td style="padding: 10px 0; color: #7c3aed; font-size: 16px; font-weight: 700; text-align: right;">₦${(data.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Client</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${data.clientName || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Sent To</td>
                <td style="padding: 10px 0; color: #7c3aed; font-size: 14px; text-align: right;">${data.recipientEmail || 'N/A'}</td>
              </tr>
              ${data.validUntil ? `<tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Valid Until</td>
                <td style="padding: 10px 0; color: #f59e0b; font-size: 14px; font-weight: 600; text-align: right;">${new Date(data.validUntil).toLocaleDateString('en-NG')}</td>
              </tr>` : ''}
            </table>
          </div>

          <div style="background-color: #f5f3ff; border-left: 4px solid #7c3aed; padding: 12px 16px; border-radius: 4px;">
            <p style="color: #5b21b6; font-size: 13px; margin: 0;">
              <strong>Note:</strong> The quotation PDF has been attached to the email sent to the client.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 20px 0 0 0;">
            Sent at: ${quotationSentDate}${data.sentBy ? ` by ${data.sentBy}` : ''}
          </p>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Other Revenue Entry Notification =====
case 'other_revenue_entry':
  const revenueDate = data.date ? new Date(data.date).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  subject = `💵 Revenue Entry - ₦${(data.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })} - ${data.source || 'Other'} - ${data.tenantName || businessName}`;
  html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc;">
      <div style="background-color: #ffffff; margin: 16px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">💵 Revenue Entry Recorded</h1>
          <p style="color: #ccfbf1; font-size: 14px; margin: 8px 0 0 0;">${data.tenantName || businessName}</p>
        </div>

        <!-- Amount Highlight -->
        <div style="background-color: #f0fdfa; padding: 20px; text-align: center; border-bottom: 3px solid #14b8a6;">
          <p style="color: #115e59; font-size: 13px; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Revenue Amount</p>
          <p style="color: #0d9488; font-size: 32px; font-weight: 700; margin: 0;">₦${(data.amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
          <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">${revenueDate}</p>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <div style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Source</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${data.source || 'Other'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Description</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.description || 'N/A'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Department</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.department || 'General'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Payment Method</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; text-align: right;">${(data.paymentMethod || 'cash').replace(/_/g, ' ').toUpperCase()}</td>
              </tr>
              ${data.customer ? `<tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Customer</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.customer}</td>
              </tr>` : ''}
              ${data.referenceNumber ? `<tr>
                <td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Reference</td>
                <td style="padding: 10px 0; color: #1f2937; font-size: 14px; text-align: right;">${data.referenceNumber}</td>
              </tr>` : ''}
            </table>
          </div>

          ${data.notes ? `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 16px;">
            <p style="color: #92400e; font-size: 13px; margin: 0;">
              <strong>Notes:</strong> ${data.notes}
            </p>
          </div>` : ''}

          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 4px;">
            <p style="color: #065f46; font-size: 13px; margin: 0;">
              <strong>Recorded:</strong> This revenue entry has been added to your accounting records.
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 20px 0 0 0;">
            Created by: ${data.createdBy || 'System'}
          </p>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Staff Clock-In Email Template =====
case 'staff_clock_in':
  subject = `⏰ Staff Clock-In - ${data.tenantName || businessName}`;
  html = `
    <div style="${styles.container}">
      <div style="${styles.card}">
        <div style="${styles.header}">
          ${logoHtml}
          <h1 style="${styles.headerTitle}">⏰ Staff Clock-In</h1>
          <p style="${styles.headerSubtitle}">${data.tenantName || businessName}</p>
        </div>

        <div style="${styles.content}">
          <p style="${styles.text}">
            <strong>${data.staffName || 'Staff'}</strong> has successfully clocked in for their shift.
          </p>

          <table style="${styles.table}">
            <tr>
              <th style="${styles.tableHeader}">Field</th>
              <th style="${styles.tableHeader}">Details</th>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Staff Member</td>
              <td style="${styles.tableCellAlt}">${data.staffName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Employee ID</td>
              <td style="${styles.tableCellAlt}">${data.employeeId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Department</td>
              <td style="${styles.tableCellAlt}">${data.department || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Position</td>
              <td style="${styles.tableCellAlt}">${data.position || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Clock-In Time</td>
              <td style="${styles.tableCellAlt}">${data.timestamp || 'N/A'}${data.late ? ` <span style="${styles.statusLate}">${data.late}</span>` : ''}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Date</td>
              <td style="${styles.tableCellAlt}">${data.date || 'N/A'}</td>
            </tr>
          </table>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

// ===== Staff Clock-Out Email Template =====
case 'staff_clock_out':
  subject = `⏰ Staff Clock-Out - ${data.tenantName || businessName}`;
  html = `
    <div style="${styles.container}">
      <div style="${styles.card}">
        <div style="${styles.header}">
          ${logoHtml}
          <h1 style="${styles.headerTitle}">⏰ Staff Clock-Out</h1>
          <p style="${styles.headerSubtitle}">${data.tenantName || businessName}</p>
        </div>

        <div style="${styles.content}">
          <p style="${styles.text}">
            <strong>${data.staffName || 'Staff'}</strong> has successfully clocked out from their shift.
          </p>

          <table style="${styles.table}">
            <tr>
              <th style="${styles.tableHeader}">Field</th>
              <th style="${styles.tableHeader}">Details</th>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Staff Member</td>
              <td style="${styles.tableCellAlt}">${data.staffName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Employee ID</td>
              <td style="${styles.tableCellAlt}">${data.employeeId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Department</td>
              <td style="${styles.tableCellAlt}">${data.department || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Position</td>
              <td style="${styles.tableCellAlt}">${data.position || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Clock-Out Time</td>
              <td style="${styles.tableCellAlt}">${data.timestamp || 'N/A'}${data.earlyLeave ? ` <span style="${styles.statusEarly}">${data.earlyLeave}</span>` : ''}${data.overtime ? ` <span style="${styles.statusOvertime}">${data.overtime}</span>` : ''}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Date</td>
              <td style="${styles.tableCellAlt}">${data.date || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Check-In Time</td>
              <td style="${styles.tableCellAlt}">${data.checkInTime || 'N/A'}</td>
            </tr>
            <tr>
              <td style="${styles.tableCell}">Work Duration</td>
              <td style="${styles.tableCellAlt}">${data.workDuration || 'N/A'}</td>
            </tr>
          </table>
        </div>

        ${getFooter()}
      </div>
    </div>
  `;
  break;

    default:
      subject = `${businessName} - System Notification`;
      html = `
        <div style="${styles.container}">
          <div style="${styles.card}">
            <div style="${styles.header}">
              ${logoHtml}
              <h1 style="${styles.headerTitle}">📢 Notification</h1>
              <p style="${styles.headerSubtitle}">${businessName}</p>
            </div>

            <div style="${styles.content}">
              <p style="${styles.text}">
                ${data.message || 'A new event has occurred in your business management system.'}
              </p>
            </div>

            ${getFooter()}
          </div>
        </div>
      `;
      break;
  }

  return { subject, html, attachments, logoData };
};

/**
 * Send email
 * Includes CID attachment for logo to ensure Gmail compatibility
 */
const sendEmail = async (to, type, data, tenant = null) => {
  try {
    if (!to || !type) {
      throw new Error('Email recipient and type are required');
    }

    console.log(`Preparing ${type} email for: ${to}`, {
      tenantId: tenant?.tenantId,
      businessName: tenant?.businessName
    });

    const { subject, html, attachments, logoData } = await getEmailTemplate(type, data, tenant);

    // Build final attachments array with CID logo attachment for Gmail compatibility
    const finalAttachments = [...attachments];

    // Add logo as CID attachment if available (Gmail requires this instead of base64 data URIs)
    if (logoData && logoData.data) {
      finalAttachments.push({
        filename: `logo.${logoData.type || 'png'}`,
        content: Buffer.from(logoData.data, 'base64'),
        contentType: `image/${logoData.type || 'png'}`,
        cid: 'company-logo' // This matches the cid: reference in the HTML
      });
    }

    const fromName = tenant?.businessName ? `${tenant.businessName} via Opsuite` : 'Opsuite Business Management';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${(process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER)}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      attachments: finalAttachments,
    });

    console.log(`Email sent successfully:`, {
      messageId: info.messageId,
      subject,
      recipients: to,
      type,
      tenantId: tenant?.tenantId
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Email sending failed:', {
      error: err.message,
      type,
      recipients: to,
      tenantId: tenant?.tenantId
    });
    
    throw new Error(`Failed to send ${type} email: ${err.message}`);
  }
};

/**
 * Test email configuration
 */
const testEmailConfig = async () => {
  try {
    console.log('Testing email configuration...');
    await transporter.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error) {
    console.error('Email configuration error:', {
      message: error.message,
      code: error.code,
      response: error.response
    });
    return false;
  }
};

/**
 * Send bulk emails to multiple recipients
 */
const sendBulkEmail = async (recipients, type, data, tenant = null) => {
  try {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await sendEmail(recipient, type, data, tenant);
        results.push({ recipient, success: true, messageId: result.messageId });
      } catch (error) {
        results.push({ recipient, success: false, error: error.message });
      }
    }
    
    return {
      success: true,
      results,
      total: recipients.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  } catch (error) {
    throw new Error(`Bulk email sending failed: ${error.message}`);
  }
};

/**
 * Send notification email to business owners
 */
const sendNotificationEmail = async (tenant, type, data) => {
  try {
    const notificationEmails = tenant.settings?.notificationEmails || [tenant.adminUser?.email];
    
    if (!notificationEmails.length) {
      console.warn('No notification emails configured for tenant', { tenantId: tenant.tenantId });
      return { success: false, error: 'No notification emails configured' };
    }
    
    return await sendBulkEmail(notificationEmails, type, data, tenant);
  } catch (error) {
    throw new Error(`Notification email failed: ${error.message}`);
  }
};

/**
 * Generate secure JWT-based verification token
 */
const generateSecureVerificationToken = (tenantId) => {
  const payload = {
    tenantId: tenantId.toString(),
    timestamp: Date.now(),
    type: 'email_verification',
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET);
};

/**
 * Verify secure JWT-based verification token
 */
const verifySecureVerificationToken = (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    if (payload.type !== 'email_verification') {
      return null;
    }
    
    return payload.tenantId;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

/**
 * Generate tenant-branded email wrapper
 */
const generateTenantEmail = (tenantInfo, subject, htmlContent) => {
  const styles = getEmailStyles(tenantInfo);
  const businessName = tenantInfo?.businessName || 'Opsuite';

  return `
    <div style="${styles.container}">
      <div style="${styles.card}">
        ${htmlContent}
        ${getFooter()}
      </div>
    </div>
  `;
};

/**
 * Send Invoice Email with PDF attachment
 */
const sendInvoiceEmail = async (invoice, tenantInfo, pdfBuffer, recipientEmail) => {
  try {
    const styles = getEmailStyles(tenantInfo);
    const logoData = await getLogo(tenantInfo);
    const primaryColor = tenantInfo?.branding?.primaryColor || '#3B82F6';
    const businessName = tenantInfo?.businessName || 'Your Business';
    const logoHtml = getLogoHtml(logoData, businessName, styles);

    const html = `
      <div style="${styles.container}">
        <div style="${styles.card}">
          <div style="${styles.header}">
            ${logoHtml}
            <h1 style="${styles.headerTitle}">📄 Invoice from ${businessName}</h1>
            <p style="${styles.headerSubtitle}">Invoice #${invoice.invoiceNumber}</p>
          </div>
          
          <div style="${styles.content}">
            <p style="${styles.text}">
              Dear <strong>${invoice.customerName}</strong>,
            </p>
            <p style="${styles.text}">
              Thank you for your business! Please find attached invoice <strong>#${invoice.invoiceNumber}</strong>
              for ₦${parseFloat(invoice.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.
            </p>

            <div style="${styles.infoBox}">
              <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 16px;">📋 Invoice Details</h3>
              <table style="${styles.infoTable}">
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Invoice Number</td>
                  <td style="${styles.infoValue}">${invoice.invoiceNumber}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Invoice Date</td>
                  <td style="${styles.infoValue}">${new Date(invoice.date).toLocaleDateString()}</td>
                </tr>
                ${invoice.dueDate ? `
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Due Date</td>
                  <td style="padding: 12px 0; color: #dc2626; font-weight: 700; font-size: 16px;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: none;">
                  <td style="${styles.infoLabel}">Amount Due</td>
                  <td style="padding: 12px 0; color: ${primaryColor}; font-weight: 700; font-size: 20px;">₦${parseFloat(invoice.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
              </table>
            </div>

            <p style="${styles.text}">
              The invoice PDF is attached to this email. If you have any questions, please contact us at 
              <strong>${tenantInfo?.email || 'support@opsuite.io'}</strong>${tenantInfo?.phone ? ` or <strong>${tenantInfo.phone}</strong>` : ''}.
            </p>

            ${tenantInfo?.paymentDetails ? `
            <div style="${styles.alertBox}">
              <p style="${styles.alertText}">
                <strong>💳 Payment Methods:</strong><br/>
                ${tenantInfo.paymentDetails}
              </p>
            </div>
            ` : ''}

            <p style="${styles.text}">
              Thank you for your business!
            </p>
          </div>

          ${getFooter()}
        </div>
      </div>
    `;

    const subject = `Invoice #${invoice.invoiceNumber} from ${businessName}`;
    const fromName = businessName;

    const attachments = [];

    // Add logo as CID attachment for Gmail compatibility
    if (logoData && logoData.data) {
      attachments.push({
        filename: `logo.${logoData.type || 'png'}`,
        content: Buffer.from(logoData.data, 'base64'),
        contentType: `image/${logoData.type || 'png'}`,
        cid: 'company-logo'
      });
    }

    if (pdfBuffer) {
      attachments.push({
        filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${(process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER)}>`,
      to: recipientEmail || invoice.customerEmail,
      subject,
      html,
      attachments
    });

    console.log(`Invoice email sent successfully:`, {
      messageId: info.messageId,
      invoiceNumber: invoice.invoiceNumber,
      recipient: recipientEmail || invoice.customerEmail
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Invoice email sending failed:', {
      error: error.message,
      invoiceNumber: invoice?.invoiceNumber
    });
    throw new Error(`Failed to send invoice email: ${error.message}`);
  }
};

/**
 * Send Financial Statement Email with PDF attachment
 */
const sendFinancialStatementEmail = async (type, period, tenantInfo, pdfBuffer, recipientEmail) => {
  try {
    const styles = getEmailStyles(tenantInfo);
    const logoData = await getLogo(tenantInfo);
    const businessName = tenantInfo?.businessName || 'Your Business';
    const logoHtml = getLogoHtml(logoData, businessName, styles);

    const statementTypes = {
      income_statement: 'Income Statement (Profit & Loss)',
      balance_sheet: 'Balance Sheet',
      cash_flow: 'Cash Flow Statement'
    };

    const statementTitle = statementTypes[type] || 'Financial Statement';

    const html = `
      <div style="${styles.container}">
        <div style="${styles.card}">
          <div style="${styles.header}">
            ${logoHtml}
            <h1 style="${styles.headerTitle}">📊 ${statementTitle}</h1>
            <p style="${styles.headerSubtitle}">${businessName}</p>
          </div>
          
          <div style="${styles.content}">
            <p style="${styles.text}">
              Please find attached the <strong>${statementTitle}</strong> for ${businessName}.
            </p>

            <div style="${styles.infoBox}">
              <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 16px;">📋 Report Details</h3>
              <table style="${styles.infoTable}">
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Report Type</td>
                  <td style="${styles.infoValue}">${statementTitle}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Period</td>
                  <td style="${styles.infoValue}">${period || 'All Time'}</td>
                </tr>
                <tr style="border-bottom: none;">
                  <td style="${styles.infoLabel}">Generated</td>
                  <td style="${styles.infoValue}">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>

            <div style="${styles.warningBox}">
              <p style="${styles.warningText}">
                <strong>⚠️ CONFIDENTIAL:</strong> This financial statement contains sensitive business information.
                Please keep it secure and do not share with unauthorized parties.
              </p>
            </div>

            <p style="${styles.text}">
              The financial statement PDF is attached to this email. If you have any questions,
              please contact <strong>${tenantInfo?.email || 'support@opsuite.io'}</strong>.
            </p>
          </div>

          ${getFooter()}
        </div>
      </div>
    `;

    const fromName = `${businessName} Financial Reports`;
    const subject = `${statementTitle} - ${period || 'All Time'}`;

    const attachments = [];

    // Add logo as CID attachment for Gmail compatibility
    if (logoData && logoData.data) {
      attachments.push({
        filename: `logo.${logoData.type || 'png'}`,
        content: Buffer.from(logoData.data, 'base64'),
        contentType: `image/${logoData.type || 'png'}`,
        cid: 'company-logo'
      });
    }

    if (pdfBuffer) {
      attachments.push({
        filename: `${type.replace(/_/g, '-')}-${Date.now()}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${(process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER)}>`,
      to: recipientEmail,
      subject,
      html,
      attachments
    });

    console.log(`Financial statement email sent successfully:`, {
      messageId: info.messageId,
      type,
      period,
      recipient: recipientEmail
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Financial statement email sending failed:', {
      error: error.message,
      type
    });
    throw new Error(`Failed to send financial statement email: ${error.message}`);
  }
};

/**
 * Send Quotation Email with PDF attachment
 */
const sendQuotationEmail = async (quotation, tenantInfo, pdfBuffer, recipientEmail) => {
  try {
    const styles = getEmailStyles(tenantInfo);
    const logoData = await getLogo(tenantInfo);
    const primaryColor = tenantInfo?.branding?.primaryColor || '#3B82F6';
    const businessName = tenantInfo?.businessName || 'Your Business';
    const logoHtml = getLogoHtml(logoData, businessName, styles);

    const html = `
      <div style="${styles.container}">
        <div style="${styles.card}">
          <div style="${styles.header}">
            ${logoHtml}
            <h1 style="${styles.headerTitle}">📋 Quotation from ${businessName}</h1>
            <p style="${styles.headerSubtitle}">Quote #${quotation.quotationNumber}</p>
          </div>

          <div style="${styles.content}">
            <p style="${styles.text}">
              Dear <strong>${quotation.clientName}</strong>,
            </p>
            <p style="${styles.text}">
              Thank you for your interest! Please find attached quotation <strong>#${quotation.quotationNumber}</strong>
              with a total of ₦${parseFloat(quotation.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}.
            </p>

            <div style="${styles.infoBox}">
              <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 16px;">📋 Quotation Details</h3>
              <table style="${styles.infoTable}">
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Quote Number</td>
                  <td style="${styles.infoValue}">${quotation.quotationNumber}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Date</td>
                  <td style="${styles.infoValue}">${new Date(quotation.date || quotation.createdAt).toLocaleDateString()}</td>
                </tr>
                ${quotation.validUntil ? `
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Valid Until</td>
                  <td style="padding: 12px 0; color: #dc2626; font-weight: 700; font-size: 16px;">${new Date(quotation.validUntil).toLocaleDateString()}</td>
                </tr>
                ` : ''}
                <tr style="border-bottom: none;">
                  <td style="${styles.infoLabel}">Total Amount</td>
                  <td style="padding: 12px 0; color: ${primaryColor}; font-weight: 700; font-size: 20px;">₦${parseFloat(quotation.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
              </table>
            </div>

            <p style="${styles.text}">
              The quotation PDF is attached to this email. This quote is valid for ${quotation.validityDays || 30} days.
              If you have any questions or would like to proceed, please contact us at
              <strong>${tenantInfo?.email || 'support@opsuite.io'}</strong>${tenantInfo?.phone ? ` or <strong>${tenantInfo.phone}</strong>` : ''}.
            </p>

            <div style="${styles.alertBox}">
              <p style="${styles.alertText}">
                <strong>✨ Ready to proceed?</strong><br/>
                Reply to this email or contact us to convert this quotation into an invoice.
              </p>
            </div>

            <p style="${styles.text}">
              We look forward to working with you!
            </p>
          </div>

          ${getFooter()}
        </div>
      </div>
    `;

    const subject = `Quotation #${quotation.quotationNumber} from ${businessName}`;
    const fromName = businessName;

    const attachments = [];

    // Add logo as CID attachment for Gmail compatibility
    if (logoData && logoData.data) {
      attachments.push({
        filename: `logo.${logoData.type || 'png'}`,
        content: Buffer.from(logoData.data, 'base64'),
        contentType: `image/${logoData.type || 'png'}`,
        cid: 'company-logo'
      });
    }

    if (pdfBuffer) {
      attachments.push({
        filename: `Quotation-${quotation.quotationNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${(process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER)}>`,
      to: recipientEmail || quotation.customerEmail,
      subject,
      html,
      attachments
    });

    console.log(`Quotation email sent successfully:`, {
      messageId: info.messageId,
      quotationNumber: quotation.quotationNumber,
      recipient: recipientEmail || quotation.customerEmail
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Quotation email sending failed:', {
      error: error.message,
      quotationNumber: quotation?.quotationNumber
    });
    throw new Error(`Failed to send quotation email: ${error.message}`);
  }
};

/**
 * Send Invoice Owner Notification with PDF attachment
 * This email goes to the business owner to inform them an invoice was sent
 */
const sendInvoiceOwnerNotification = async (invoice, tenantInfo, pdfBuffer, recipientEmail, sentBy, notificationRecipients = null) => {
  try {
    const styles = getEmailStyles(tenantInfo);
    const logoData = await getLogo(tenantInfo);
    const businessName = tenantInfo?.businessName || 'Your Business';
    const logoHtml = getLogoHtml(logoData, businessName, styles);
    const primaryColor = tenantInfo?.branding?.primaryColor || '#3B82F6';

    const html = `
      <div style="${styles.container}">
        <div style="${styles.card}">
          <div style="${styles.header}">
            ${logoHtml}
            <h1 style="${styles.headerTitle}">📄 Invoice Sent to Customer</h1>
            <p style="${styles.headerSubtitle}">${businessName}</p>
          </div>

          <div style="${styles.content}">
            <p style="${styles.text}">
              An invoice has been successfully sent to your customer. Here are the details:
            </p>

            <div style="${styles.infoBox}">
              <h3 style="color: #065f46; margin: 0 0 15px 0; font-size: 16px;">📋 Invoice Details</h3>
              <table style="${styles.infoTable}">
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Invoice Number</td>
                  <td style="${styles.infoValue}">${invoice.invoiceNumber}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Customer</td>
                  <td style="${styles.infoValue}">${invoice.customerName}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Sent To</td>
                  <td style="${styles.infoValue}">${recipientEmail}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Amount</td>
                  <td style="padding: 12px 0; color: ${primaryColor}; font-weight: 700; font-size: 18px;">NGN ${parseFloat(invoice.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                ${invoice.dueDate ? `
                <tr style="border-bottom: none;">
                  <td style="${styles.infoLabel}">Due Date</td>
                  <td style="padding: 12px 0; color: #dc2626; font-weight: 600;">${new Date(invoice.dueDate).toLocaleDateString()}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="${styles.alertBox}">
              <p style="${styles.alertText}">
                <strong>ℹ️ Note:</strong> A copy of the invoice PDF has been attached to this email for your records.
              </p>
            </div>

            <p style="${styles.text}">
              ${sentBy ? `Sent by <strong>${sentBy}</strong> at ${new Date().toLocaleString()}` : `Sent at ${new Date().toLocaleString()}`}
            </p>
          </div>

          ${getFooter()}
        </div>
      </div>
    `;

    const subject = `Invoice #${invoice.invoiceNumber} Sent to ${invoice.customerName}`;
    const fromName = businessName;

    const attachments = [];

    // Add logo as CID attachment
    if (logoData && logoData.data) {
      attachments.push({
        filename: `logo.${logoData.type || 'png'}`,
        content: Buffer.from(logoData.data, 'base64'),
        contentType: `image/${logoData.type || 'png'}`,
        cid: 'company-logo'
      });
    }

    // Add invoice PDF
    if (pdfBuffer) {
      attachments.push({
        filename: `Invoice-${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    // Use notification recipients if provided, otherwise fallback to tenantInfo.email
    const toAddress = notificationRecipients && notificationRecipients.length > 0
      ? notificationRecipients.join(', ')
      : (tenantInfo.email || tenantInfo.ownerEmail);

    if (!toAddress) {
      console.warn('No notification recipients configured for invoice owner notification');
      return { success: false, message: 'No recipients configured' };
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${(process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER)}>`,
      to: toAddress,
      subject,
      html,
      attachments
    });

    console.log(`Invoice owner notification sent successfully:`, {
      messageId: info.messageId,
      invoiceNumber: invoice.invoiceNumber,
      recipients: toAddress
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Invoice owner notification failed:', {
      error: error.message,
      invoiceNumber: invoice?.invoiceNumber
    });
    throw new Error(`Failed to send invoice owner notification: ${error.message}`);
  }
};

/**
 * Send Quotation Owner Notification with PDF attachment
 * This email goes to the business owner to inform them a quotation was sent
 */
const sendQuotationOwnerNotification = async (quotation, tenantInfo, pdfBuffer, recipientEmail, sentBy, notificationRecipients = null) => {
  try {
    const styles = getEmailStyles(tenantInfo);
    const logoData = await getLogo(tenantInfo);
    const businessName = tenantInfo?.businessName || 'Your Business';
    const logoHtml = getLogoHtml(logoData, businessName, styles);
    const primaryColor = tenantInfo?.branding?.primaryColor || '#7C3AED';

    const html = `
      <div style="${styles.container}">
        <div style="${styles.card}">
          <div style="${styles.header}">
            ${logoHtml}
            <h1 style="${styles.headerTitle}">📋 Quotation Sent to Client</h1>
            <p style="${styles.headerSubtitle}">${businessName}</p>
          </div>

          <div style="${styles.content}">
            <p style="${styles.text}">
              A quotation has been successfully sent to your client. Here are the details:
            </p>

            <div style="${styles.infoBox}">
              <h3 style="color: #5b21b6; margin: 0 0 15px 0; font-size: 16px;">📋 Quotation Details</h3>
              <table style="${styles.infoTable}">
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Quotation Number</td>
                  <td style="${styles.infoValue}">${quotation.quotationNumber}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Client</td>
                  <td style="${styles.infoValue}">${quotation.clientName}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Sent To</td>
                  <td style="${styles.infoValue}">${recipientEmail}</td>
                </tr>
                <tr style="${styles.infoRow}">
                  <td style="${styles.infoLabel}">Amount</td>
                  <td style="padding: 12px 0; color: ${primaryColor}; font-weight: 700; font-size: 18px;">NGN ${parseFloat(quotation.total || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                </tr>
                ${quotation.validUntil ? `
                <tr style="border-bottom: none;">
                  <td style="${styles.infoLabel}">Valid Until</td>
                  <td style="padding: 12px 0; color: #dc2626; font-weight: 600;">${new Date(quotation.validUntil).toLocaleDateString()}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <div style="${styles.alertBox}">
              <p style="${styles.alertText}">
                <strong>ℹ️ Note:</strong> A copy of the quotation PDF has been attached to this email for your records.
              </p>
            </div>

            <p style="${styles.text}">
              ${sentBy ? `Sent by <strong>${sentBy}</strong> at ${new Date().toLocaleString()}` : `Sent at ${new Date().toLocaleString()}`}
            </p>
          </div>

          ${getFooter()}
        </div>
      </div>
    `;

    const subject = `Quotation #${quotation.quotationNumber} Sent to ${quotation.clientName}`;
    const fromName = businessName;

    const attachments = [];

    // Add logo as CID attachment
    if (logoData && logoData.data) {
      attachments.push({
        filename: `logo.${logoData.type || 'png'}`,
        content: Buffer.from(logoData.data, 'base64'),
        contentType: `image/${logoData.type || 'png'}`,
        cid: 'company-logo'
      });
    }

    // Add quotation PDF
    if (pdfBuffer) {
      attachments.push({
        filename: `Quotation-${quotation.quotationNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    // Use notification recipients if provided, otherwise fallback to tenantInfo.email
    const toAddress = notificationRecipients && notificationRecipients.length > 0
      ? notificationRecipients.join(', ')
      : (tenantInfo.email || tenantInfo.ownerEmail);

    if (!toAddress) {
      console.warn('No notification recipients configured for quotation owner notification');
      return { success: false, message: 'No recipients configured' };
    }

    const info = await transporter.sendMail({
      from: `"${fromName}" <${(process.env.MAIL_FROM_EMAIL || process.env.MAIL_USERNAME || process.env.EMAIL_USER)}>`,
      to: toAddress,
      subject,
      html,
      attachments
    });

    console.log(`Quotation owner notification sent successfully:`, {
      messageId: info.messageId,
      quotationNumber: quotation.quotationNumber,
      recipients: toAddress
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Quotation owner notification failed:', {
      error: error.message,
      quotationNumber: quotation?.quotationNumber
    });
    throw new Error(`Failed to send quotation owner notification: ${error.message}`);
  }
};

// Export all functions
module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.testEmailConfig = testEmailConfig;
module.exports.getEmailTemplate = getEmailTemplate;
module.exports.generateSecureVerificationToken = generateSecureVerificationToken;
module.exports.verifySecureVerificationToken = verifySecureVerificationToken;
module.exports.sendBulkEmail = sendBulkEmail;
module.exports.sendNotificationEmail = sendNotificationEmail;
module.exports.generateTenantEmail = generateTenantEmail;
module.exports.sendInvoiceEmail = sendInvoiceEmail;
module.exports.sendFinancialStatementEmail = sendFinancialStatementEmail;
module.exports.sendQuotationEmail = sendQuotationEmail;
module.exports.sendInvoiceOwnerNotification = sendInvoiceOwnerNotification;
module.exports.sendQuotationOwnerNotification = sendQuotationOwnerNotification;