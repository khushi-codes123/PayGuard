const express = require('express');
const path = require('path');
const {
  initializeDatabase,
  getAllTransactions,
  getTransactionById,
  createTransaction,
  deleteTransactionById,
  getDashboardStats,
  getRiskDistribution,
  getTransactionTrend
} = require('./db');
const { calculateRisk } = require('./riskEngine');

const app = express();
const PORT = process.env.PORT || 3000;

function parsePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload.'
    });
  }

  return next(error);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PayGuard API',
    message: 'Backend is running successfully.',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await getAllTransactions();
    return res.status(200).json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to load transactions.'
    });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const parsedId = parsePositiveInteger(id);

  if (parsedId === null) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction ID.'
    });
  }

  try {
    const transaction = await getTransactionById(parsedId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Transaction not found.'
      });
    }

    return res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error fetching transaction by id:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to load transaction.'
    });
  }
});

app.post('/api/transactions', async (req, res) => {
  const transaction = req.body || {};

  const requiredFields = [
    'transaction_id',
    'amount',
    'currency',
    'merchant',
    'location',
    'transaction_type',
    'transaction_time',
    'status'
  ];

  for (const field of requiredFields) {
    const value = transaction[field];

    if (value === undefined || value === null || String(value).trim() === '') {
      return res.status(400).json({
        success: false,
        error: `${field.replace(/_/g, ' ')} is required.`
      });
    }
  }

  const parsedAmount = Number(transaction.amount);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount must be greater than 0'
    });
  }

  const currentTransactions = await getAllTransactions().catch(() => []);
  const risk = calculateRisk(
    {
      ...transaction,
      amount: parsedAmount
    },
    currentTransactions
  );

  const newTransaction = {
    transaction_id: String(transaction.transaction_id).trim(),
    amount: parsedAmount,
    currency: String(transaction.currency).trim(),
    merchant: String(transaction.merchant).trim(),
    location: String(transaction.location).trim(),
    transaction_type: String(transaction.transaction_type).trim(),
    transaction_time: String(transaction.transaction_time).trim(),
    status: String(transaction.status).trim(),
    risk_score: risk.riskScore,
    risk_level: risk.riskLevel
  };

  try {
    const id = await createTransaction(newTransaction);
    return res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      id,
      risk: {
        score: risk.riskScore,
        level: risk.riskLevel,
        reasons: risk.reasons
      }
    });
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({
        success: false,
        error: 'Transaction already exists.',
        message: 'A transaction with this ID already exists.'
      });
    }

    console.error('Error creating transaction:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to create transaction.'
    });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const parsedId = parsePositiveInteger(id);

  if (parsedId === null) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction ID.'
    });
  }

  try {
    const wasDeleted = await deleteTransactionById(parsedId);

    if (!wasDeleted) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
        message: 'Transaction not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to delete transaction.'
    });
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    return res.status(200).json({
      success: true,
      stats: {
        totalTransactions: Number(stats.totalTransactions || 0),
        totalValue: Number(stats.totalValue || 0),
        approvedTransactions: Number(stats.approvedTransactions || 0),
        flaggedTransactions: Number(stats.flaggedTransactions || 0),
        highRiskTransactions: Number(stats.highRiskTransactions || 0),
        averageTransactionAmount: Number(stats.averageTransactionAmount || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to load dashboard statistics.'
    });
  }
});

app.get('/api/dashboard/risk-distribution', async (req, res) => {
  try {
    const distribution = await getRiskDistribution();
    return res.status(200).json({
      success: true,
      distribution: {
        LOW: Number(distribution.LOW || 0),
        MEDIUM: Number(distribution.MEDIUM || 0),
        HIGH: Number(distribution.HIGH || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching risk distribution:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to load risk distribution.'
    });
  }
});

app.get('/api/dashboard/trend', async (req, res) => {
  try {
    const trend = await getTransactionTrend();
    return res.status(200).json({
      success: true,
      trend
    });
  } catch (error) {
    console.error('Error fetching transaction trend:', error);
    return res.status(500).json({
      success: false,
      error: 'Database error',
      message: 'Unable to load transaction trend.'
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PayGuard server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
