// Single-Tenant Aware Reports Routes for OpSuite Business Management System - FIXED
const express = require('express');
const { requireAuthentication } = require('../middleware/cookieAuth');
const { identifyTenant, addTenantHelpers } = require('../middleware/tenant');
const { generateEnhancedDailyReport } = require('../crons/reporting-cron');
const logger = require('../utils/logger');
const router = express.Router();

// Apply tenant middleware to all routes FIRST
router.use(identifyTenant);
router.use(addTenantHelpers);
router.use(requireAuthentication);

// FIXED: Debug middleware for development
if (process.env.NODE_ENV === 'development') {
  router.use((req, res, next) => {
    console.log('📊 Reports Route Debug:', {
      path: req.path,
      method: req.method,
      hasTenant: !!req.tenant,
      tenantId: req.tenantId,
      hasUser: !!req.user,
      subdomain: req.subdomain,
      tenantIdHeader: req.get('x-tenant-id'),
      tenantSubdomainHeader: req.get('x-tenant-subdomain'),
      host: req.get('host'),
      cookies: Object.keys(req.cookies || {}),
      hasAuthToken: !!(req.cookies?.accessToken),
      hasRefreshToken: !!(req.cookies?.refreshToken)
    });
    
    if (!req.tenant && req.path !== '/dashboard-data') {
      console.log('⚠️  Missing tenant context in reports route');
    }
    
    next();
  });
}

// Helper function to parse date strings with proper timezone handling
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return null;
  }
  return date;
};

// Helper function to create date range filter
const createDateFilter = (startDate, endDate) => {
  const filter = {};
  
  if (startDate || endDate) {
    filter.createdAt = {};
    
    if (startDate) {
      const start = parseDate(startDate);
      if (start) {
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
    }
    
    if (endDate) {
      const end = parseDate(endDate);
      if (end) {
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
  }
  
  return filter;
};

// Helper function to create attendance date filter
const createAttendanceDateFilter = (startDate, endDate) => {
  const filter = {};
  
  if (startDate || endDate) {
    filter.date = {};
    
    if (startDate) {
      filter.date.$gte = startDate;
    }
    
    if (endDate) {
      filter.date.$lte = endDate;
    }
  }
  
  return filter;
};

// FIXED: Helper function to safely get tenant model with singular naming
const getTenantModelSafe = (req, modelName) => {
  try {
    const model = req.getTenantModel(modelName);
    if (!model) {
      logger.warn(`Model ${modelName} not available for tenant`, {
        tenantId: req.tenantId,
        modelName
      });
      return null;
    }
    return model;
  } catch (error) {
    logger.warn(`Model ${modelName} failed to load for tenant`, {
      tenantId: req.tenantId,
      error: error.message
    });
    return null;
  }
};

// Helper function to safely execute database query
const safeQuery = async (model, operation, fallback = []) => {
  if (!model) return fallback;
  
  try {
    return await operation(model);
  } catch (error) {
    logger.warn('Database query failed', {
      error: error.message,
      modelName: model.modelName
    });
    return fallback;
  }
};

// FIXED: Dashboard Data Aggregation Endpoint (Single-Tenant with Missing Collection Handling)
router.get('/dashboard-data', async (req, res) => {
  try {
    if (!req.tenant) {
      logger.error('Dashboard data request without tenant context', {
        path: req.path,
        host: req.get('host'),
        tenantIdHeader: req.get('x-tenant-id'),
        tenantSubdomainHeader: req.get('x-tenant-subdomain')
      });
      
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found. Please ensure you are accessing the correct business URL.',
        debug: process.env.NODE_ENV === 'development' ? {
          host: req.get('host'),
          headers: {
            'x-tenant-id': req.get('x-tenant-id'),
            'x-tenant-subdomain': req.get('x-tenant-subdomain')
          },
          suggestion: 'Use X-Tenant-ID header with tenant name'
        } : undefined
      });
    }

    const { subBusiness, startDate, endDate } = req.query;
    
    logger.debug('Dashboard data request:', { 
      tenantId: req.tenantId,
      subBusiness, 
      startDate, 
      endDate 
    });

    // Create proper date filters
    const dateFilter = createDateFilter(startDate, endDate);
    const attendanceDateFilter = createAttendanceDateFilter(
      startDate || '2020-01-01', 
      endDate || new Date().toISOString().split('T')[0]
    );
    
    const mongoFilter = subBusiness && subBusiness !== 'All' ? 
      { ...dateFilter, subBusiness } : dateFilter;
    
    const inventoryFilter = subBusiness && subBusiness !== 'All' ? 
      { subBusiness } : {};

    logger.debug('Filters created:', { 
      tenantId: req.tenantId,
      mongoFilter, 
      attendanceDateFilter, 
      inventoryFilter 
    });

    // FIXED: Get tenant-specific models safely with correct naming
    const TenantPOSTransaction = getTenantModelSafe(req, 'POSTransaction');
    const TenantInventoryItem = getTenantModelSafe(req, 'InventoryItem');
    const TenantAttendance = getTenantModelSafe(req, 'Attendance');
    const TenantExpense = getTenantModelSafe(req, 'Expense');
    const TenantCustomer = getTenantModelSafe(req, 'Customer');
    const TenantInventoryCheckout = getTenantModelSafe(req, 'InventoryCheckout');
    const TenantStaff = getTenantModelSafe(req, 'Staff');

    // Log which models are available
    if (process.env.NODE_ENV === 'development') {
      console.log('Available models for tenant:', {
        tenantId: req.tenantId,
        POSTransaction: !!TenantPOSTransaction,
        InventoryItem: !!TenantInventoryItem,
        Attendance: !!TenantAttendance,
        Expense: !!TenantExpense,
        Customer: !!TenantCustomer,
        InventoryCheckout: !!TenantInventoryCheckout,
        Staff: !!TenantStaff
      });
    }

    // FIXED: Fetch all necessary data with error handling and safe queries
    const [
      salesTransactions,
      inventoryItems,
      attendanceRecords,
      expenses,
      customers,
      inventoryCheckouts,
      staff
    ] = await Promise.all([
      safeQuery(
        TenantPOSTransaction,
        (model) => model.find(mongoFilter)
          .populate('items.itemId', 'name sku', null, { strictPopulate: false })
          .populate('customer', 'name email', null, { strictPopulate: false })
          .lean()
      ),
      safeQuery(TenantInventoryItem, (model) => model.find(inventoryFilter).lean()),
      safeQuery(
        TenantAttendance,
        (model) => model.find({
          ...attendanceDateFilter,
          employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] }
        })
        .populate('staffId', 'firstName lastName department position', null, { strictPopulate: false })
        .lean()
      ),
      safeQuery(TenantExpense, (model) => model.find(mongoFilter).lean()),
      safeQuery(TenantCustomer, (model) => model.find(dateFilter).lean()),
      safeQuery(
        TenantInventoryCheckout,
        (model) => model.find(mongoFilter)
          .populate('staffId', 'firstName lastName', null, { strictPopulate: false })
          .lean()
      ),
      safeQuery(TenantStaff, (model) => model.find().lean())
    ]);

    logger.debug('Fetched data counts:', {
      tenantId: req.tenantId,
      sales: salesTransactions.length,
      inventory: inventoryItems.length,
      attendance: attendanceRecords.length,
      expenses: expenses.length,
      customers: customers.length,
      checkouts: inventoryCheckouts.length,
      staff: staff.length
    });

    // Calculate KPIs with null safety
    const safeSum = (arr, accessor) => arr.reduce((sum, item) => {
      const value = typeof accessor === 'function' ? accessor(item) : item[accessor];
      return sum + (Number(value) || 0);
    }, 0);

    const totalRevenue = safeSum(salesTransactions, t => t.totalAmount);
    const totalExpenses = safeSum(expenses, e => e.amount);
    const netProfit = totalRevenue - totalExpenses;
    const totalTransactions = salesTransactions.length;
    const averageTransactionValue = totalTransactions ? totalRevenue / totalTransactions : 0;
    
    // Staff metrics with null safety
    const presentStaff = attendanceRecords.filter(a => !a.absent).length;
    const lateStaff = attendanceRecords.filter(a => a.late).length;
    const totalStaff = staff.length;
    const attendanceRate = totalStaff ? (presentStaff / totalStaff) * 100 : 0;

    // Inventory metrics with null safety
    const lowStockItems = inventoryItems.filter(item => 
      (Number(item.quantity) || 0) <= (Number(item.reorderPoint) || 10)
    );

    // Customer metrics with null safety
    const startDateObj = parseDate(startDate);
    const endDateObj = parseDate(endDate);
    const newCustomers = customers.filter(customer => {
      if (!startDateObj || !endDateObj || !customer.createdAt) return false;
      const customerDate = new Date(customer.createdAt);
      return customerDate >= startDateObj && customerDate <= endDateObj;
    });

    // Top selling items with null safety
    const itemSales = {};
    salesTransactions.forEach(transaction => {
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach(item => {
          const itemName = item.name || 'Unknown Item';
          if (!itemSales[itemName]) {
            itemSales[itemName] = { quantity: 0, revenue: 0 };
          }
          const quantity = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          itemSales[itemName].quantity += quantity;
          itemSales[itemName].revenue += quantity * price;
        });
      }
    });

    const topSellingItems = Object.entries(itemSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top customers with null safety
    const customerSales = {};
    salesTransactions.forEach(transaction => {
      const customerId = transaction.customer?._id || transaction.customerId;
      if (customerId) {
        if (!customerSales[customerId]) {
          customerSales[customerId] = { 
            totalSpent: 0, 
            transactions: 0,
            customer: transaction.customer || customers.find(c => c._id?.toString() === customerId.toString())
          };
        }
        customerSales[customerId].totalSpent += Number(transaction.totalAmount) || 0;
        customerSales[customerId].transactions += 1;
      }
    });

    const topCustomers = Object.values(customerSales)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Chart data aggregations with null safety
    const aggregateByKey = (data, keyFn, valueFn) => {
      return data.reduce((acc, item) => {
        const key = keyFn(item);
        const value = valueFn(item);
        acc[key] = (acc[key] || 0) + value;
        return acc;
      }, {});
    };

    // Revenue by sub-business
    const revenueByBusiness = aggregateByKey(
      salesTransactions,
      sale => sale.subBusiness || 'General',
      sale => Number(sale.totalAmount) || 0
    );

    // Sales by date
    const salesByDate = aggregateByKey(
      salesTransactions,
      sale => {
        try {
          return new Date(sale.createdAt).toLocaleDateString();
        } catch {
          return 'Unknown Date';
        }
      },
      sale => Number(sale.totalAmount) || 0
    );

    // Attendance by date
    const attendanceByDate = {};
    attendanceRecords.forEach(record => {
      const date = record.date || new Date(record.createdAt).toISOString().split('T')[0];
      const displayDate = new Date(date).toLocaleDateString();
      
      if (!attendanceByDate[displayDate]) {
        attendanceByDate[displayDate] = { present: 0, absent: 0, late: 0 };
      }
      if (!record.absent) attendanceByDate[displayDate].present++;
      if (record.absent) attendanceByDate[displayDate].absent++;
      if (record.late) attendanceByDate[displayDate].late++;
    });

    // Customer distribution
    const customersByType = aggregateByKey(
      customers,
      customer => customer.customerType || 'Regular',
      () => 1
    );

    // Expense categories
    const expensesByCategory = aggregateByKey(
      expenses,
      expense => expense.category || 'General',
      expense => Number(expense.amount) || 0
    );

    // Recent activities with null safety
    const createActivity = (type, title, description, time, icon, color) => ({
      type, title, description, time, icon, color
    });

    const recentActivities = [
      ...salesTransactions.slice(0, 5).map(sale => 
        createActivity(
          'sale',
          'New Sale',
          `₦${(Number(sale.totalAmount) || 0).toLocaleString()} sale in ${sale.subBusiness || 'General'}`,
          new Date(sale.createdAt).toLocaleString(),
          'ShoppingCart',
          'text-green-600'
        )
      ),
      ...inventoryCheckouts.slice(0, 3).map(checkout => 
        createActivity(
          'inventory',
          'Inventory Checkout',
          `${checkout.items?.length || 0} items checked out by ${checkout.staffId?.firstName || 'Staff'}`,
          new Date(checkout.createdAt).toLocaleString(),
          'Package',
          'text-orange-600'
        )
      )
    ].slice(0, 15);

    // Staff performance with proper staff name lookup
    const staffMetrics = {};
    attendanceRecords.forEach(record => {
      const employeeId = record.employeeId;
      if (employeeId) {
        if (!staffMetrics[employeeId]) {
          // Find staff by employeeId instead of relying on populated data
          const staffMember = staff.find(s => s.employeeId === employeeId);
          staffMetrics[employeeId] = {
            name: staffMember ? 
              `${staffMember.firstName || ''} ${staffMember.lastName || ''}`.trim() : 
              `Employee ${employeeId}`,
            present: 0,
            absent: 0,
            late: 0,
            totalDays: 0
          };
        }
        staffMetrics[employeeId].totalDays += 1;
        if (!record.absent) staffMetrics[employeeId].present += 1;
        if (record.absent) staffMetrics[employeeId].absent += 1;
        if (record.late) staffMetrics[employeeId].late += 1;
      }
    });

    const staffPerformance = Object.values(staffMetrics)
      .map(metrics => ({
        ...metrics,
        attendanceRate: metrics.totalDays ? (metrics.present / metrics.totalDays) * 100 : 0
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10);

    // Compile dashboard data
    const dashboardData = {
      kpiMetrics: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        activeStaff: presentStaff,
        totalTransactions,
        averageTransactionValue: Math.round(averageTransactionValue * 100) / 100,
        lowStockItems: lowStockItems.length,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        totalCustomers: customers.length,
        newCustomers: newCustomers.length,
        inventoryCheckouts: inventoryCheckouts.length,
        totalStaff
      },
      chartData: {
        salesByDate,
        attendanceByDate,
        revenueByBusiness,
        customersByType,
        expensesByCategory
      },
      tableData: {
        topSellingItems,
        topCustomers,
        lowStockItems: lowStockItems.map(item => ({
          name: item.name || 'Unknown Item',
          quantity: Number(item.quantity) || 0,
          reorderPoint: Number(item.reorderPoint) || 10,
          subBusiness: item.subBusiness || 'General'
        })),
        recentTransactions: salesTransactions.slice(0, 10),
        staffPerformance
      },
      recentActivities,
      metadata: {
        generatedAt: new Date().toISOString(),
        period: { startDate, endDate },
        subBusiness: subBusiness || 'All',
        tenantId: req.tenantId
      }
    };

    logger.info('Dashboard data compiled successfully', {
      tenantId: req.tenantId,
      recordCounts: {
        transactions: totalTransactions,
        customers: customers.length,
        staff: totalStaff,
        lowStock: lowStockItems.length
      }
    });

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Error fetching dashboard data:', {
      tenantId: req.tenantId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Keep all other routes unchanged but add tenant context validation
router.use((req, res, next) => {
  if (!req.tenant) {
    return res.status(400).json({ 
      error: 'NO_TENANT_CONTEXT',
      message: 'Tenant context not found' 
    });
  }
  next();
});

// All other existing routes remain exactly the same...
router.post('/daily', async (req, res) => {
  try {
    logger.info('Manual daily report generation requested', {
      tenantId: req.tenantId,
      requestedBy: req.user.username
    });
    
    const { subBusiness, startDate, endDate } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    const reportParams = {
      subBusiness: subBusiness || 'All',
      startDate: startDate || today,
      endDate: endDate || today,
      tenantId: req.tenantId
    };
    
    const result = await generateEnhancedDailyReport(reportParams);
    
    res.status(200).json({ 
      message: 'Daily report generated and emailed successfully',
      params: reportParams,
      result
    });
  } catch (err) {
    logger.error('Error generating daily report:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to generate daily report', 
      error: err.message 
    });
  }
});

// Get report analytics (EXISTING - UPDATED FOR SINGLE-TENANT)
router.get('/analytics', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { startDate, endDate, subBusiness } = req.query;
    
    // Build query parameters
    const dateFilter = createDateFilter(startDate, endDate);
    const mongoFilter = subBusiness && subBusiness !== 'All' ? 
      { ...dateFilter, subBusiness } : dateFilter;

    // Get tenant-specific models safely
    const TenantPOSTransaction = getTenantModelSafe(req, 'POSTransaction');
    const TenantInventoryItem = getTenantModelSafe(req, 'InventoryItem');
    const TenantAttendance = getTenantModelSafe(req, 'Attendance');
    const TenantExpense = getTenantModelSafe(req, 'Expense');
    const TenantCustomer = getTenantModelSafe(req, 'Customer');

    // Fetch summary data with safe queries
    const [
      salesStats,
      inventoryStats,
      attendanceStats,
      expenseStats,
      customerStats
    ] = await Promise.all([
      safeQuery(TenantPOSTransaction, (model) => model.aggregate([
        { $match: mongoFilter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalTransactions: { $sum: 1 },
            averageTransaction: { $avg: '$totalAmount' },
            totalItemsSold: { $sum: { $sum: '$items.quantity' } }
          }
        }
      ])),
      safeQuery(TenantInventoryItem, (model) => model.aggregate([
        { $match: subBusiness && subBusiness !== 'All' ? { subBusiness } : {} },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$quantity', { $ifNull: ['$sellingPrice', 0] }] } },
            lowStockItems: {
              $sum: {
                $cond: [
                  { $lte: ['$quantity', { $ifNull: ['$reorderPoint', 10] }] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])),
      safeQuery(TenantAttendance, (model) => model.aggregate([
        { 
          $match: {
            date: { 
              $gte: startDate || '2020-01-01',
              $lte: endDate || new Date().toISOString().split('T')[0]
            },
            employeeId: { $nin: ['HOLIDAY', /^LEAVE_/] }
          }
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $eq: ['$absent', false] }, 1, 0] } },
            lateCount: { $sum: { $cond: ['$late', 1, 0] } },
            absentCount: { $sum: { $cond: ['$absent', 1, 0] } }
          }
        }
      ])),
      safeQuery(TenantExpense, (model) => model.aggregate([
        { $match: mongoFilter },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: '$amount' },
            totalRecords: { $sum: 1 }
          }
        }
      ])),
      safeQuery(TenantCustomer, (model) => model.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            vipCustomers: { $sum: { $cond: [{ $eq: ['$customerType', 'VIP'] }, 1, 0] } }
          }
        }
      ]))
    ]);

    const analytics = {
      sales: salesStats[0] || { totalRevenue: 0, totalTransactions: 0, averageTransaction: 0, totalItemsSold: 0 },
      inventory: inventoryStats[0] || { totalItems: 0, totalValue: 0, lowStockItems: 0 },
      attendance: attendanceStats[0] || { totalRecords: 0, presentCount: 0, lateCount: 0, absentCount: 0 },
      expenses: expenseStats[0] || { totalExpenses: 0, totalRecords: 0 },
      customers: customerStats[0] || { totalCustomers: 0, vipCustomers: 0 }
    };

    // Calculate derived metrics
    analytics.profitability = {
      grossProfit: analytics.sales.totalRevenue - analytics.expenses.totalExpenses,
      profitMargin: analytics.sales.totalRevenue ? 
        ((analytics.sales.totalRevenue - analytics.expenses.totalExpenses) / analytics.sales.totalRevenue * 100) : 0
    };

    analytics.attendance.attendanceRate = analytics.attendance.totalRecords ? 
      (analytics.attendance.presentCount / analytics.attendance.totalRecords * 100) : 0;

    logger.info('Analytics fetched successfully', {
      tenantId: req.tenantId,
      period: { startDate, endDate },
      subBusiness
    });

    res.json({
      success: true,
      analytics,
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time'
      },
      subBusiness: subBusiness || 'All'
    });

  } catch (error) {
    logger.error('Error fetching analytics:', {
      tenantId: req.tenantId,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// ALL OTHER EXISTING ROUTES (kept as-is but made tenant-aware where needed)
router.get('/templates', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const templates = [
      {
        id: 'weekly',
        name: 'Weekly Summary Report',
        description: 'Weekly performance analysis and trends',
        frequency: 'Weekly',
        lastGenerated: new Date().toISOString()
      },
      {
        id: 'monthly',
        name: 'Monthly Business Report',
        description: 'Comprehensive monthly business analysis',
        frequency: 'Monthly',
        lastGenerated: new Date().toISOString()
      },
      {
        id: 'custom',
        name: 'Custom Date Range Report',
        description: 'Generate reports for any custom date range',
        frequency: 'On-demand',
        lastGenerated: new Date().toISOString()
      }
    ];
    
    res.json({
      templates,
      totalTemplates: templates.length,
      message: 'Available report templates'
    });
  } catch (err) {
    logger.error('Error fetching report templates:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to fetch report templates', 
      error: err.message 
    });
  }
});

router.post('/generate', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { 
      reportType = 'daily', 
      subBusiness, 
      startDate, 
      endDate, 
      emailRecipients 
    } = req.body;
    
    logger.info('Custom report generation requested:', {
      tenantId: req.tenantId,
      reportType,
      subBusiness,
      startDate,
      endDate,
      emailRecipients
    });
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Start date and end date are required for custom reports'
      });
    }
    
    let result;
    switch (reportType) {
      case 'daily':
      case 'weekly':
      case 'monthly':
      case 'custom':
        const reportParams = {
          subBusiness: subBusiness || 'All',
          startDate,
          endDate,
          tenantId: req.tenantId
        };
        
        result = await generateEnhancedDailyReport(reportParams);
        break;
        
      default:
        return res.status(400).json({
          message: 'Invalid report type. Supported types: daily, weekly, monthly, custom'
        });
    }
    
    logger.info('Custom report generated successfully', {
      tenantId: req.tenantId,
      reportType
    });
    
    res.status(200).json({ 
      message: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully`,
      reportType,
      params: { subBusiness, startDate, endDate },
      result,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Error generating custom report:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to generate custom report', 
      error: err.message 
    });
  }
});

// Keep all other existing routes as-is...
router.get('/history', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { page = 1, limit = 20 } = req.query;
    
    const reportHistory = [
      {
        id: 1,
        type: 'daily',
        generatedAt: new Date().toISOString(),
        generatedBy: req.user.username,
        status: 'completed',
        parameters: {
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          subBusiness: 'All'
        }
      }
    ];
    
    res.json({
      reports: reportHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(reportHistory.length / limit),
        totalCount: reportHistory.length,
        limit: parseInt(limit)
      },
      message: 'Report generation history'
    });
  } catch (err) {
    logger.error('Error fetching report history:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to fetch report history', 
      error: err.message 
    });
  }
});

router.post('/schedule', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { 
      reportType, 
      frequency, 
      subBusiness, 
      emailRecipients, 
      enabled = true 
    } = req.body;
    
    if (!reportType || !frequency) {
      return res.status(400).json({
        message: 'Report type and frequency are required'
      });
    }
    
    const allowedFrequencies = ['daily', 'weekly', 'monthly'];
    if (!allowedFrequencies.includes(frequency)) {
      return res.status(400).json({
        message: 'Invalid frequency. Allowed: daily, weekly, monthly'
      });
    }
    
    const scheduledReport = {
      id: Date.now(),
      reportType,
      frequency,
      subBusiness: subBusiness || 'All',
      emailRecipients: emailRecipients || req.tenant.settings?.notificationEmails || [],
      enabled,
      createdBy: req.user.username,
      createdAt: new Date().toISOString(),
      nextRun: new Date().toISOString(),
      tenantId: req.tenantId
    };
    
    logger.info('Report scheduled:', {
      tenantId: req.tenantId,
      scheduledReport
    });
    
    res.status(201).json({
      message: 'Report scheduled successfully',
      scheduledReport,
      nextExecution: scheduledReport.nextRun
    });
  } catch (err) {
    logger.error('Error scheduling report:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to schedule report', 
      error: err.message 
    });
  }
});

router.get('/scheduled', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const scheduledReports = [
      {
        id: 1,
        reportType: 'daily',
        frequency: 'daily',
        subBusiness: 'All',
        emailRecipients: req.tenant.settings?.notificationEmails || [],
        enabled: true,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        nextRun: new Date().toISOString(),
        lastRun: new Date().toISOString(),
        status: 'active',
        tenantId: req.tenantId
      }
    ];
    
    res.json({
      scheduledReports,
      totalScheduled: scheduledReports.length,
      activeSchedules: scheduledReports.filter(r => r.enabled).length,
      message: 'Scheduled reports'
    });
  } catch (err) {
    logger.error('Error fetching scheduled reports:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to fetch scheduled reports', 
      error: err.message 
    });
  }
});

router.put('/scheduled/:id', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { id } = req.params;
    const { 
      reportType, 
      frequency, 
      subBusiness, 
      emailRecipients, 
      enabled 
    } = req.body;
    
    const updatedSchedule = {
      id: parseInt(id),
      reportType,
      frequency,
      subBusiness,
      emailRecipients,
      enabled,
      updatedBy: req.user.username,
      updatedAt: new Date().toISOString(),
      tenantId: req.tenantId
    };
    
    logger.info('Report schedule updated:', {
      tenantId: req.tenantId,
      updatedSchedule
    });
    
    res.json({
      message: 'Scheduled report updated successfully',
      updatedSchedule
    });
  } catch (err) {
    logger.error('Error updating scheduled report:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to update scheduled report', 
      error: err.message 
    });
  }
});

router.delete('/scheduled/:id', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { id } = req.params;
    
    logger.info('Report schedule deleted:', {
      tenantId: req.tenantId,
      deletedId: id
    });
    
    res.json({
      message: 'Scheduled report deleted successfully',
      deletedId: id
    });
  } catch (err) {
    logger.error('Error deleting scheduled report:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to delete scheduled report', 
      error: err.message 
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { 
      format = 'json', 
      startDate, 
      endDate, 
      subBusiness 
    } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        message: 'Start date and end date are required for export'
      });
    }
    
    const allowedFormats = ['json', 'csv', 'xlsx'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({
        message: 'Invalid format. Allowed: json, csv, xlsx'
      });
    }
    
    const exportData = {
      exportId: Date.now(),
      format,
      parameters: { startDate, endDate, subBusiness },
      generatedAt: new Date().toISOString(),
      status: 'ready',
      downloadUrl: `/api/reports/download/${Date.now()}.${format}`,
      tenantId: req.tenantId
    };
    
    logger.info('Report export generated:', {
      tenantId: req.tenantId,
      exportData
    });
    
    res.json({
      message: 'Report export generated successfully',
      export: exportData
    });
  } catch (err) {
    logger.error('Error exporting report:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to export report', 
      error: err.message 
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({ 
        error: 'NO_TENANT_CONTEXT',
        message: 'Tenant context not found' 
      });
    }

    const { period = 'last30days' } = req.query;
    
    const metrics = {
      totalReportsGenerated: 150,
      reportsThisMonth: 45,
      mostRequestedReport: 'daily',
      averageGenerationTime: '2.3 seconds',
      emailDeliveryRate: '98.5%',
      scheduledReportsActive: 3,
      lastGeneratedReport: new Date().toISOString(),
      reportsByType: {
        daily: 120,
        weekly: 20,
        monthly: 8,
        custom: 2
      },
      reportsByStatus: {
        completed: 145,
        failed: 3,
        processing: 2
      },
      period,
      tenantId: req.tenantId
    };
    
    res.json({
      metrics,
      calculatedAt: new Date().toISOString(),
      message: 'Report generation metrics'
    });
  } catch (err) {
    logger.error('Error fetching report metrics:', {
      tenantId: req.tenantId,
      error: err.message
    });
    res.status(500).json({ 
      message: 'Failed to fetch report metrics', 
      error: err.message 
    });
  }
});

module.exports = router;