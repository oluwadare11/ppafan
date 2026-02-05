// routes/dashboard.js - Tier-Aware Dashboard Data Aggregation
// Completely separate from Reports/Analytics module
const express = require('express');
const { identifyTenant, requireActiveTenant, addTenantHelpers } = require('../middleware/tenant');
const { requireAuthentication } = require('../middleware/cookieAuth');
const securityLogger = require('../utils/securityLogger');

const router = express.Router();

// Apply tenant middleware stack (CSRF and rate limiting applied at app level in server.js)
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireActiveTenant);
router.use(requireAuthentication);

/**
 * Helper: Get tier level from plan name
 */
function getTierLevel(plan) {
  if (!plan) return 1;
  const planLower = plan.toLowerCase();

  // Tier 1: Starter
  if (planLower === 'starter') return 1;

  // Tier 2: Growth
  if (planLower === 'growth') return 2;

  // Tier 3: Pro, Enterprise
  if (['pro', 'enterprise'].includes(planLower)) return 3;

  // Default to Tier 1
  return 1;
}

/**
 * Helper: Create date filter for queries
 */
function createDateFilter(startDate, endDate) {
  const filter = {};

  if (startDate || endDate) {
    filter.createdAt = {};

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filter.createdAt.$gte = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  return filter;
}

/**
 * Helper: Safe query execution
 */
async function safeQuery(model, queryFn, fallback = []) {
  if (!model) return fallback;

  try {
    return await queryFn(model);
  } catch (error) {
    console.error('Safe query error:', error.message);
    return fallback;
  }
}

/**
 * GET /api/dashboard/overview
 * Tier-aware dashboard data endpoint
 */
router.get('/overview', async (req, res) => {
  try {
    // Get tenant plan and tier level
    const tenantPlan = req.tenant?.subscription?.plan || 'starter';
    const tier = getTierLevel(tenantPlan);

    // Parse date range from query (default to today)
    const today = new Date().toISOString().split('T')[0];
    const { startDate = today, endDate = today } = req.query;

    // Log access
    securityLogger.logDataAccess(req, 'DASHBOARD_OVERVIEW', {
      resourceType: 'dashboard_data',
      tier,
      plan: tenantPlan,
      dateRange: { startDate, endDate }
    });

    // Create date filter
    const dateFilter = createDateFilter(startDate, endDate);
    const tenantFilter = { tenantId: req.tenantId };
    const combinedFilter = { ...tenantFilter, ...dateFilter };

    // Get tenant-specific models (Tier 1 - always available)
    const POSTransaction = req.getTenantModel('POSTransaction');
    const InventoryItem = req.getTenantModel('InventoryItem');
    const Customer = req.getTenantModel('Customer');
    const Expense = req.getTenantModel('Expense');

    // Initialize response structure
    const dashboardData = {
      tier,
      plan: tenantPlan,
      kpis: {},
      charts: {},
      tables: {},
      financial: {},
      alerts: {}
    };

    // ===== TIER 1 DATA AGGREGATION (Always Available) =====

    // Fetch all Tier 1 data in parallel for performance
    const [
      posTransactions,
      allTimeTransactions,
      inventoryItems,
      customers,
      expenses
    ] = await Promise.all([
      // Date-filtered transactions for revenue/sales KPIs and charts
      safeQuery(POSTransaction, model =>
        model.find(combinedFilter)
          .select('totalAmount items createdAt paymentMethod status department vat gratuity customer customerId')
          .lean()
          .limit(1000)
      ),
      // All-time transactions for top customers and recent sales (not filtered by date)
      safeQuery(POSTransaction, model =>
        model.find({ ...tenantFilter, status: 'completed' })
          .select('totalAmount items createdAt paymentMethod status department customer customerId')
          .sort({ createdAt: -1 })
          .lean()
          .limit(500)
      ),
      safeQuery(InventoryItem, model =>
        model.find(tenantFilter)
          .select('name sku quantity sellingPrice reorderLevel department')
          .lean()
      ),
      safeQuery(Customer, model =>
        model.find(tenantFilter)
          .select('name email totalSpent visitCount lastVisit createdAt')
          .lean()
      ),
      safeQuery(Expense, model =>
        model.find(combinedFilter)
          .select('amount category department')
          .lean()
      )
    ]);

    // === POS Metrics ===
    const completedTransactions = posTransactions.filter(t => t.status === 'completed');
    const totalRevenue = completedTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    const salesCount = completedTransactions.length;
    const avgTransaction = salesCount > 0 ? Math.round(totalRevenue / salesCount) : 0;

    dashboardData.kpis.revenue = Math.round(totalRevenue);
    dashboardData.kpis.salesCount = salesCount;
    dashboardData.kpis.avgTransaction = avgTransaction;

    // === Inventory Metrics ===
    const totalStock = inventoryItems.length;
    const lowStockItems = inventoryItems.filter(item =>
      (item.quantity || 0) <= (item.reorderLevel || 5)
    );

    dashboardData.kpis.totalStock = totalStock;
    dashboardData.kpis.lowStockCount = lowStockItems.length;
    dashboardData.alerts.lowStock = lowStockItems.slice(0, 5).map(item => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      reorderLevel: item.reorderLevel
    }));

    // === Customer Metrics ===
    // Count unique customers who made purchases in the selected date range
    const customerIdsInPeriod = new Set();
    completedTransactions.forEach(t => {
      const customerId = t.customer?._id || t.customerId;
      if (customerId) {
        customerIdsInPeriod.add(customerId.toString());
      }
    });
    const customersInPeriod = customerIdsInPeriod.size;

    // New customers created in the date range
    const newCustomers = customers.filter(c => {
      if (!c.createdAt) return false;
      const created = new Date(c.createdAt);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      if (start && created < start) return false;
      if (end && created > end) return false;
      return true;
    });

    // Total customers count (for reference, not date-filtered)
    const totalCustomersOverall = customers.length;

    // Use customers who made purchases in period for the KPI
    dashboardData.kpis.totalCustomers = customersInPeriod;
    dashboardData.kpis.newCustomers = newCustomers.length;
    dashboardData.kpis.totalCustomersOverall = totalCustomersOverall;

    // === Accounting/Financial Metrics ===
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const grossProfit = totalRevenue - totalExpenses;
    const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;

    dashboardData.kpis.profit = Math.round(grossProfit);
    dashboardData.kpis.expenses = Math.round(totalExpenses);

    dashboardData.financial = {
      revenue: Math.round(totalRevenue),
      expenses: Math.round(totalExpenses),
      grossProfit: Math.round(grossProfit),
      netProfit: Math.round(grossProfit), // Simplified for now
      grossMargin: parseFloat(grossMargin)
    };

    // === Charts Data ===

    // Sales Trend (last 30 days)
    const salesByDate = {};
    completedTransactions.forEach(t => {
      const date = new Date(t.createdAt).toISOString().split('T')[0];
      salesByDate[date] = (salesByDate[date] || 0) + (t.totalAmount || 0);
    });

    dashboardData.charts.salesTrend = Object.entries(salesByDate)
      .map(([date, amount]) => ({ date, sales: Math.round(amount) }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30); // Last 30 days only

    // Revenue by Section (departments that have generated actual revenue)
    // Only sections with POS items that generated revenue are shown
    const revenueBySection = {};
    completedTransactions.forEach(t => {
      // Get section from transaction department or from items
      const transactionSection = t.department || t.section;
      if (transactionSection && transactionSection !== 'General') {
        revenueBySection[transactionSection] = (revenueBySection[transactionSection] || 0) + (t.totalAmount || 0);
      } else if (t.items && Array.isArray(t.items)) {
        // Fallback: aggregate by item departments/sections
        t.items.forEach(item => {
          const itemSection = item.department || item.section;
          if (itemSection) {
            const itemRevenue = (item.price || 0) * (item.quantity || 0);
            revenueBySection[itemSection] = (revenueBySection[itemSection] || 0) + itemRevenue;
          }
        });
      }
    });

    // Only include sections that have actual revenue (excludes HR, Admin, etc.)
    dashboardData.charts.revenueBySection = Object.entries(revenueBySection)
      .filter(([_, value]) => value > 0) // Only sections with revenue
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6); // Top 6 revenue-generating sections

    // === Tables Data ===

    // Top Selling Items
    const itemSales = {};
    completedTransactions.forEach(t => {
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(item => {
          const name = item.name || 'Unknown';
          if (!itemSales[name]) {
            itemSales[name] = { quantity: 0, revenue: 0 };
          }
          itemSales[name].quantity += item.quantity || 0;
          itemSales[name].revenue += (item.price || 0) * (item.quantity || 0);
        });
      }
    });

    dashboardData.tables.topItems = Object.entries(itemSales)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: Math.round(data.revenue)
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Recent Transactions (latest 5, NOT filtered by date range)
    // Shows item name, payment type, and amount
    dashboardData.tables.recentTransactions = allTimeTransactions
      .slice(0, 5)
      .map(t => {
        // Get the first item name, or a summary if multiple items
        const items = t.items || [];
        let itemName = 'N/A';
        if (items.length === 1) {
          itemName = items[0]?.name || 'Unknown Item';
        } else if (items.length > 1) {
          itemName = `${items[0]?.name || 'Item'} +${items.length - 1} more`;
        }

        return {
          _id: t._id,
          date: t.createdAt,
          itemName: itemName,
          amount: Math.round(t.totalAmount || 0),
          paymentMethod: t.paymentMethod,
          itemCount: items.length
        };
      });

    // Top Customers (all-time spending, NOT filtered by date range)
    const customerSpending = {};
    allTimeTransactions.forEach(t => {
      const customerId = t.customer?._id || t.customerId;
      if (customerId) {
        const id = customerId.toString();
        if (!customerSpending[id]) {
          customerSpending[id] = {
            customer: t.customer,
            totalSpent: 0,
            transactionCount: 0
          };
        }
        customerSpending[id].totalSpent += t.totalAmount || 0;
        customerSpending[id].transactionCount += 1;
      }
    });

    dashboardData.tables.topCustomers = Object.values(customerSpending)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5)
      .map(c => ({
        name: c.customer?.name || 'Unknown',
        email: c.customer?.email || '',
        totalSpent: Math.round(c.totalSpent),
        transactionCount: c.transactionCount
      }));

    // ===== TIER 2 DATA (Growth+) =====
    if (tier >= 2) {
      const Attendance = req.getTenantModel('Attendance');
      const Staff = req.getTenantModel('Staff');

      // Get today's date for attendance
      const todayStr = new Date().toISOString().split('T')[0];

      const [attendanceRecords, staffMembers] = await Promise.all([
        safeQuery(Attendance, model =>
          model.find({
            tenantId: req.tenantId,
            date: todayStr
          }).lean()
        ),
        safeQuery(Staff, model =>
          model.find({ tenantId: req.tenantId }).lean()
        )
      ]);

      const presentCount = attendanceRecords.filter(a => !a.absent).length;
      const lateCount = attendanceRecords.filter(a => a.late).length;
      const totalStaff = staffMembers.length;
      const attendanceRate = totalStaff > 0 ? Math.round((presentCount / totalStaff) * 100) : 0;

      dashboardData.kpis.attendance = {
        present: presentCount,
        late: lateCount,
        total: totalStaff,
        rate: attendanceRate
      };

      // Fetch real payroll data
      try {
        const TenantPayrollSettings = req.getTenantModel('PayrollSettings');
        const TenantPayroll = req.getTenantModel('Payroll');

        // Get settings for payment day
        const payrollSettings = await TenantPayrollSettings.findOne({ isActive: true });
        const paymentDay = payrollSettings?.processing?.paymentDay || 28;

        // Calculate next payment date
        const today = new Date();
        let nextPaymentDate = new Date(today.getFullYear(), today.getMonth(), paymentDay);
        if (today.getDate() > paymentDay) {
          nextPaymentDate = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
        }

        // Format the date
        const formattedPaymentDate = nextPaymentDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        // Get current period payroll data
        const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const currentPayroll = await TenantPayroll.find({ period: currentPeriod });

        const totalDue = currentPayroll.reduce((sum, p) => sum + (p.netSalary || 0), 0);
        const pendingCount = currentPayroll.filter(p =>
          p.status === 'draft' || p.status === 'pending_approval'
        ).length;
        const processedCount = currentPayroll.filter(p =>
          p.status === 'approved' || p.status === 'paid'
        ).length;

        dashboardData.payroll = {
          nextPaymentDate: formattedPaymentDate,
          paymentDay,
          totalDue,
          pendingCount,
          processedCount,
          hasPayrollData: currentPayroll.length > 0,
          settingsConfigured: !!payrollSettings
        };
      } catch (payrollErr) {
        console.warn('Error fetching payroll data for dashboard:', payrollErr.message);
        // Fallback to placeholder
        dashboardData.payroll = {
          nextPaymentDate: 'Not configured',
          totalDue: 0,
          pendingCount: 0,
          processedCount: 0,
          hasPayrollData: false,
          settingsConfigured: false
        };
      }
    }

    // ===== TIER 3 DATA (Pro/Enterprise) =====
    // Note: SignageScreen and Visitor models removed - not used in Pump House ERP
    if (tier >= 3) {
      // Marketing data placeholder
      dashboardData.marketing = {
        activeCampaigns: 0,
        totalReach: 0,
        responseRate: 0
      };
    }

    // Add metadata
    dashboardData.timestamp = Date.now();
    dashboardData.ttl = 5 * 60 * 1000; // Cache for 5 minutes
    dashboardData.dateRange = { startDate, endDate };

    // Set cache headers
    res.set('Cache-Control', 'private, max-age=300'); // 5 minutes

    // Return response
    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Dashboard overview error:', error);
    securityLogger.logSecurityEvent(req, 'DASHBOARD_OVERVIEW_ERROR', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'DASHBOARD_FETCH_FAILED',
      message: 'Failed to fetch dashboard data'
    });
  }
});

module.exports = router;
