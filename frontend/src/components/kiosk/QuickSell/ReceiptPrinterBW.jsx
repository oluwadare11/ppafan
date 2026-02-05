// src/components/kiosk/QuickSell/ReceiptPrinterBW.jsx
// MAC CHROME OPTIMIZED - DIRECT PRINT DIALOG
// No popup window - just fast print dialog
// Optimized for Chrome on Mac with strategic rendering delays



class ReceiptPrinterBW {
  constructor() {
    // Business info and logo are now generated from tenantInfo in print()
  }

  // Extract first name from user data (same logic as POSHeader)
  getDisplayName(cashierData) {
    // Priority 1: If already a simple first name, use it
    if (!cashierData || typeof cashierData !== 'string') {
      return 'Staff';
    }
    
    // Priority 2: Extract from username (before first dot)
    if (cashierData.includes('.')) {
      const firstName = cashierData.split('.')[0];
      // Capitalize first letter, lowercase rest
      return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
    
    // Priority 3: No dots, capitalize the name
    return cashierData.charAt(0).toUpperCase() + cashierData.slice(1).toLowerCase();
  }

  async print(receiptData) {
    try {
      console.time('⚡ TOTAL PRINT TIME');

      // Validate receiptData has tenantInfo with fallback
      const tenantInfo = receiptData?.tenantInfo || {};

      // Generate optimized HTML (no QR code)
      console.time('⚡ HTML Generation');
      const html = await this.generateReceiptHTML(receiptData, tenantInfo);
      console.timeEnd('⚡ HTML Generation');

      // STEP 3: Direct print (NO POPUP)
      console.time('⚡ Print Dialog Time');
      await this.printDirectly(html);
      console.timeEnd('⚡ Print Dialog Time');

      console.timeEnd('⚡ TOTAL PRINT TIME');
      return true;
    } catch (error) {
      console.error('Receipt print failed:', error);
      console.timeEnd('⚡ TOTAL PRINT TIME');
      throw error;
    }
  }

  async generateReceiptHTML(data, tenantInfo = {}) {
    const {
      transactionId,
      cart = [],
      customerDetails = {},
      subtotal = 0,
      vat = 0,
      total = 0,
      discount = 0,
      gratuity = 0, // FIXED: Add gratuity/tip support
      paymentMethod = 'cash',
      splitPayments = null,
      applyVAT = false,
      timestamp = new Date(),
      cashier = 'Staff',
      tendered = null, // FIXED: Actual tendered amount (optional)
      change = null // FIXED: Actual change amount (optional)
    } = data;

    // Generate business info from tenantInfo with robust fallbacks
    const businessInfo = {
      name: tenantInfo?.businessName || 'Your Business',
      tagline: tenantInfo?.branding?.tagline || '',
      address: tenantInfo?.contactInfo?.address || '',
      city: tenantInfo?.contactInfo?.city || '',
      phone: tenantInfo?.contactInfo?.phone || '',
      website: 'thepumphouseng.com', // FIXED: Always show main domain, not subdomain
      email: tenantInfo?.contactInfo?.email || ''
    };

    // Extract first name from cashier
    const cashierFirstName = this.getDisplayName(cashier) || 'Staff';

    const dateStr = timestamp.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const timeStr = timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const discountAmount = discount > 0 ? (subtotal + vat) * (discount / 100) : 0;

    // Generate receipt ID prefix from business name with validation
    const businessPrefix = (tenantInfo?.businessName || 'PH')
      .toUpperCase() // Uppercase first
      .replace(/[^A-Z]/g, '') // Remove non-letters
      .substring(0, 3) // Take first 3 letters
      || 'PH'; // Fallback to OP (Pump House) if result is empty

    const receiptId = `${businessPrefix}-${timestamp.getFullYear()}${String(timestamp.getMonth()+1).padStart(2,'0')}${String(timestamp.getDate()).padStart(2,'0')}-${transactionId?.slice(-6) || '000000'}`;
    
    let paymentText = 'Cash';
    if (paymentMethod) {
      switch(paymentMethod.toLowerCase()) {
        case 'cash': paymentText = 'Cash'; break;
        case 'card': paymentText = 'Card'; break;
        case 'bank_transfer': paymentText = 'Bank Transfer'; break;
        default: paymentText = paymentMethod.replace('_', ' ').toUpperCase();
      }
    }

    // Generate items rows
    const itemsRows = cart.map((item) => {
      const qty = item.cartQty || item.quantity || 1;
      const price = item.price || 0;
      const itemTotal = price * qty;
      
      return `
        <tr>
          <td style="padding: 4px 2px; font-size: 10px; font-weight: 700; border-bottom: 1px solid #ddd;">${qty}x</td>
          <td style="padding: 4px 4px; font-size: 10px; border-bottom: 1px solid #ddd;">
            <b>${item.name || 'Item'}</b><br>
            <span style="font-size: 9px; color: #666;">@ ₦${this.formatNumber(price)}</span>
          </td>
          <td align="right" style="padding: 4px 2px; font-size: 10px; font-weight: 700; border-bottom: 1px solid #ddd;">
            ₦${this.formatNumber(itemTotal)}
          </td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Receipt - ${receiptId}</title>
    <style>
        /* MAC CHROME OPTIMIZED - MINIMAL CSS FOR FAST RENDERING */
        @page {
            size: 80mm auto;
            margin: 0;
        }
        
        @media print {
            body { margin: 0; padding: 2mm; }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 11px;
            line-height: 1.3;
            width: 302px;
            margin: 0 auto;
            padding: 8px;
            background: #fff;
            color: #000;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .logo-container {
            text-align: center;
            padding: 10px 0;
            border: 2px solid #000;
            margin-bottom: 8px;
        }
        
        .business-name {
            font-size: 18px;
            font-weight: bold;
            margin: 6px 0 2px 0;
        }
        
        .tagline {
            font-size: 10px;
            color: #333;
            margin-bottom: 6px;
        }
        
        .contact-info {
            font-size: 9px;
            color: #444;
            line-height: 1.4;
        }
        
        .divider {
            border-top: 2px solid #000;
            margin: 8px 0;
        }
        
        .info-box {
            background: #f5f5f5;
            border: 1px solid #000;
            padding: 8px;
            margin: 8px 0;
        }
        
        .info-box td {
            font-size: 10px;
            padding: 2px 0;
        }
        
        .label {
            font-weight: 700;
        }
        
        .items-table {
            margin: 8px 0;
        }
        
        .items-table th {
            background: #000;
            color: #fff;
            padding: 6px 4px;
            font-size: 10px;
            font-weight: 700;
            text-align: left;
        }
        
        .totals-box {
            background: #f5f5f5;
            border: 2px solid #000;
            padding: 10px;
            margin: 8px 0;
        }
        
        .totals-box td {
            padding: 3px 0;
            font-size: 11px;
        }
        
        .grand-total {
            border-top: 2px solid #000;
            padding-top: 6px !important;
            font-size: 14px !important;
            font-weight: 700;
        }
        
        .thank-you {
            background: #000;
            color: #fff;
            text-align: center;
            padding: 10px;
            margin: 8px 0;
        }
        
        .thank-you-text {
            font-size: 13px;
            font-weight: 700;
        }
        
        .thank-you-sub {
            font-size: 9px;
            margin-top: 3px;
        }

        .footer {
            text-align: center;
            border-top: 2px dashed #666;
            padding-top: 8px;
            margin-top: 8px;
            font-size: 9px;
            color: #666;
        }
        
        .powered-by {
            font-size: 10px;
            font-weight: 700;
            color: #000;
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <!-- Logo & Header -->
    <div class="logo-container">
        ${tenantInfo?.branding?.logo ?
          `<img src="${tenantInfo.branding.logo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; margin: 0 auto 8px;" onerror="this.style.display='none'; this.nextSibling.style.display='flex';">
           <div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 50%; margin: 0 auto 8px; display: none; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #6b7280;">${(businessInfo.name || 'Y').charAt(0)}</div>` :
          `<div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 50%; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: #6b7280;">${(businessInfo.name || 'Y').charAt(0)}</div>`
        }
        <div class="business-name">${businessInfo.name}</div>
        ${businessInfo.tagline ? `<div class="tagline">${businessInfo.tagline}</div>` : ''}
        <hr style="border: none; border-top: 1px solid #ccc; margin: 6px 20px;">
        <div class="contact-info">
            ${businessInfo.address ? `${businessInfo.address}<br>` : ''}
            ${businessInfo.city ? `${businessInfo.city}<br>` : ''}
            ${businessInfo.phone ? `&#128222; ${businessInfo.phone}<br>` : ''}
            &#127760; ${businessInfo.website}
        </div>
    </div>

    <div class="divider"></div>

    <!-- Transaction Info -->
    <div class="info-box">
        <table>
            <tr>
                <td class="label">Receipt:</td>
                <td align="right">${receiptId}</td>
            </tr>
            <tr>
                <td class="label">Date:</td>
                <td align="right">${dateStr}</td>
            </tr>
            <tr>
                <td class="label">Time:</td>
                <td align="right">${timeStr}</td>
            </tr>
            <tr>
                <td class="label">Cashier:</td>
                <td align="right">${cashierFirstName}</td>
            </tr>
            ${customerDetails?.name ? `
            <tr>
                <td class="label">Customer:</td>
                <td align="right">${customerDetails.name}</td>
            </tr>
            ` : ''}
        </table>
    </div>

    <!-- Items -->
    <div style="font-size: 11px; font-weight: 700; margin: 8px 0; text-transform: uppercase;">
        ITEMS PURCHASED
    </div>
    
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 15%;">QTY</th>
                <th style="width: 55%;">ITEM</th>
                <th style="width: 30%;" align="right">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${itemsRows}
        </tbody>
    </table>

    <div class="divider"></div>

    <!-- Totals -->
    <div class="totals-box">
        <table>
            <tr>
                <td class="label">Subtotal:</td>
                <td align="right"><b>₦${this.formatNumber(subtotal)}</b></td>
            </tr>
            ${applyVAT && vat > 0 ? `
            <tr>
                <td class="label">VAT (7.5%):</td>
                <td align="right"><b>₦${this.formatNumber(vat)}</b></td>
            </tr>
            ` : ''}
            ${discount > 0 ? `
            <tr>
                <td class="label">Discount (${discount}%):</td>
                <td align="right"><b>-₦${this.formatNumber(discountAmount)}</b></td>
            </tr>
            ` : ''}
            ${gratuity > 0 ? `
            <tr>
                <td class="label">Tip/Gratuity:</td>
                <td align="right"><b>₦${this.formatNumber(gratuity)}</b></td>
            </tr>
            ` : ''}
            <tr class="grand-total">
                <td class="label">TOTAL:</td>
                <td align="right"><b>₦${this.formatNumber(total)}</b></td>
            </tr>
        </table>
    </div>

    <!-- Payment -->
    <div style="background: #f9f9f9; border: 1px solid #ccc; padding: 8px; margin: 8px 0;">
        ${paymentMethod === 'split' && splitPayments && splitPayments.length > 0 ? `
        <!-- Split Payment Details -->
        <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
            <div style="font-size: 11px; font-weight: 700; margin-bottom: 6px; text-align: center; color: #92400e;">
                SPLIT PAYMENT (${splitPayments.length} METHODS)
            </div>
        </div>
        <table>
            ${splitPayments.map((payment, index) => {
              let methodText = '';
              switch(payment.method.toLowerCase()) {
                case 'cash': methodText = '💵 Cash'; break;
                case 'card': methodText = '💳 Card'; break;
                case 'bank_transfer': methodText = '🏦 Bank Transfer'; break;
                default: methodText = payment.method.replace('_', ' ').toUpperCase();
              }
              return `
              <tr>
                <td class="label" style="font-size: 10px; padding: 4px 0;">${methodText}:</td>
                <td align="right" style="font-size: 10px; padding: 4px 0;"><b>₦${this.formatNumber(payment.amount)}</b></td>
              </tr>
              ${payment.reference ? `
              <tr>
                <td colspan="2" style="font-size: 9px; color: #666; padding: 0 0 4px 10px;">Ref: ${payment.reference}</td>
              </tr>
              ` : ''}
              `;
            }).join('')}
        </table>
        ` : `
        <!-- Single Payment Method -->
        <table>
            <tr>
                <td class="label" style="font-size: 10px;">Payment Method:</td>
                <td align="right" style="font-size: 10px;"><b>${paymentText}</b></td>
            </tr>
            ${/* FIXED: Only show tendered/change if actual values are provided */
              tendered !== null && tendered > 0 ? `
            <tr>
                <td class="label" style="font-size: 10px;">Tendered:</td>
                <td align="right" style="font-size: 10px;"><b>₦${this.formatNumber(tendered)}</b></td>
            </tr>
            ${change !== null && change > 0 ? `
            <tr>
                <td class="label" style="font-size: 10px;">Change:</td>
                <td align="right" style="font-size: 10px;"><b>₦${this.formatNumber(change)}</b></td>
            </tr>
            ` : ''}
            ` : ''}
        </table>
        `}
    </div>

    <!-- Thank You -->
    <div class="thank-you">
        <div class="thank-you-text">
            ${customerDetails?.name && customerDetails.name.trim() ?
                `Thank you, ${customerDetails.name}!` :
                `Thank you for visiting!`
            }
        </div>
        <div class="thank-you-sub">Your satisfaction is our priority</div>
    </div>

    <!-- Footer -->
    <div class="footer">
        Visit us again soon!<br>
        Please keep this receipt for your records
        <div class="powered-by">
            Powered by Pump House ERP.io<br>
            &#128241; 09052463435
        </div>
    </div>
</body>
</html>
    `;
  }

  formatNumber(num) {
    return Math.round(num).toLocaleString('en-NG');
  }

  async printDirectly(htmlContent) {
    return new Promise((resolve, reject) => {
      let iframe = null;
      let cleanupDone = false;

      // Helper to safely remove iframe
      const cleanup = () => {
        if (!cleanupDone && iframe && iframe.parentNode) {
          try {
            document.body.removeChild(iframe);
          } catch (e) {
            console.warn('Cleanup warning:', e);
          }
          cleanupDone = true;
        }
      };

      try {
        // Create hidden iframe (optimized for Mac Chrome)
        iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-9999px';
        iframe.style.left = '-9999px';
        iframe.style.width = '302px';
        iframe.style.height = '800px'; // FIXED: Taller height for Chrome PDF generation
        iframe.style.border = 'none';

        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();

        // CRITICAL: Mac Chrome optimization with improved error handling
        // Wait for complete render before printing
        iframe.onload = () => {
          console.log('✅ Receipt HTML loaded');

          // STRATEGY 1: Let Chrome breathe (requestAnimationFrame)
          requestAnimationFrame(() => {
            // STRATEGY 2: Another frame for good measure
            requestAnimationFrame(() => {
              // STRATEGY 3: Longer timeout for Chrome PDF generation
              setTimeout(() => {
                console.log('✅ Opening print dialog...');

                try {
                  iframe.contentWindow.focus();
                  iframe.contentWindow.print();

                  // Clean up after print dialog closes (or after longer timeout)
                  setTimeout(() => {
                    cleanup();
                    resolve();
                  }, 1000); // FIXED: Longer cleanup delay for PDF generation

                } catch (printError) {
                  console.error('Print error:', printError);
                  cleanup();
                  // FIXED: Don't reject on print errors - user may have cancelled
                  resolve(); // Resolve anyway, print dialog was shown
                }
              }, 300); // FIXED: Slightly longer delay for Chrome PDF rendering
            });
          });
        };

        iframe.onerror = (error) => {
          console.error('iframe error:', error);
          cleanup();
          reject(new Error('Failed to load receipt content'));
        };

        // FIXED: Timeout fallback in case onload never fires
        setTimeout(() => {
          if (!cleanupDone) {
            console.warn('⚠️ Receipt load timeout - attempting print anyway');
            try {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              setTimeout(cleanup, 1000);
              resolve();
            } catch (e) {
              cleanup();
              reject(new Error('Receipt print timed out'));
            }
          }
        }, 5000); // 5 second fallback

      } catch (error) {
        console.error('printDirectly error:', error);
        cleanup();
        reject(error);
      }
    });
  }
}

export default ReceiptPrinterBW;