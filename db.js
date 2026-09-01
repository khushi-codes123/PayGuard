const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbFile = process.env.SQLITE_DB_PATH || path.join(__dirname, 'database', 'payguard.db');
const dbDir = path.dirname(dbFile);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbFile);

const sampleTransactions = [
  {
    transaction_id: 'TXN-10001',
    amount: 125.5,
    currency: 'USD',
    merchant: 'Apex Travel',
    location: 'New York, US',
    transaction_type: 'travel',
    transaction_time: '2026-08-30T10:15:00Z',
    status: 'approved',
    risk_score: 18,
    risk_level: 'low'
  },
  {
    transaction_id: 'TXN-10002',
    amount: 2400.0,
    currency: 'USD',
    merchant: 'Northstar Logistics',
    location: 'Chicago, US',
    transaction_type: 'business',
    transaction_time: '2026-08-30T12:40:00Z',
    status: 'pending',
    risk_score: 42,
    risk_level: 'medium'
  },
  {
    transaction_id: 'TXN-10003',
    amount: 780.75,
    currency: 'EUR',
    merchant: 'BlueWave Retail',
    location: 'Frankfurt, DE',
    transaction_type: 'online',
    transaction_time: '2026-08-31T08:05:00Z',
    status: 'flagged',
    risk_score: 71,
    risk_level: 'high'
  },
  {
    transaction_id: 'TXN-10004',
    amount: 59.99,
    currency: 'USD',
    merchant: 'QuickCart',
    location: 'Austin, US',
    transaction_type: 'ecommerce',
    transaction_time: '2026-08-31T15:25:00Z',
    status: 'approved',
    risk_score: 12,
    risk_level: 'low'
  }
];

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_id TEXT UNIQUE NOT NULL,
          amount REAL NOT NULL,
          currency TEXT NOT NULL,
          merchant TEXT NOT NULL,
          location TEXT,
          transaction_type TEXT,
          transaction_time TEXT NOT NULL,
          status TEXT NOT NULL,
          risk_score INTEGER DEFAULT 0,
          risk_level TEXT DEFAULT 'low',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (createErr) => {
        if (createErr) {
          reject(createErr);
          return;
        }

        db.get('SELECT COUNT(*) AS count FROM transactions', (countErr, row) => {
          if (countErr) {
            reject(countErr);
            return;
          }

          if (row.count === 0) {
            const insertSQL = `
              INSERT INTO transactions (
                transaction_id, amount, currency, merchant, location,
                transaction_type, transaction_time, status, risk_score, risk_level
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.parallelize(() => {
              sampleTransactions.forEach((transaction) => {
                db.run(insertSQL, [
                  transaction.transaction_id,
                  transaction.amount,
                  transaction.currency,
                  transaction.merchant,
                  transaction.location,
                  transaction.transaction_type,
                  transaction.transaction_time,
                  transaction.status,
                  transaction.risk_score,
                  transaction.risk_level
                ]);
              });
            });

            resolve();
            return;
          }

          resolve();
        });
      });
    });
  });
}

function getAllTransactions() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM transactions ORDER BY transaction_time DESC',
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

function getTransactionById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM transactions WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function createTransaction(transaction) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO transactions (
        transaction_id, amount, currency, merchant, location,
        transaction_type, transaction_time, status, risk_score, risk_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [
      transaction.transaction_id,
      transaction.amount,
      transaction.currency,
      transaction.merchant,
      transaction.location,
      transaction.transaction_type,
      transaction.transaction_time,
      transaction.status,
      transaction.risk_score || 0,
      transaction.risk_level || 'low'
    ], function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this.lastID);
    });
  });
}

function deleteTransactionById(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM transactions WHERE id = ?', [id], function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this.changes > 0);
    });
  });
}

function getDashboardStats() {
  return new Promise((resolve, reject) => {
    Promise.all([
      new Promise((resolveCount, rejectCount) => {
        db.get('SELECT COUNT(*) AS totalTransactions FROM transactions', (err, row) => {
          if (err) return rejectCount(err);
          resolveCount(Number(row?.totalTransactions || 0));
        });
      }),
      new Promise((resolveValue, rejectValue) => {
        db.get('SELECT COALESCE(SUM(amount), 0) AS totalValue FROM transactions', (err, row) => {
          if (err) return rejectValue(err);
          resolveValue(Number(row?.totalValue || 0));
        });
      }),
      new Promise((resolveApproved, rejectApproved) => {
        db.get("SELECT COUNT(*) AS approvedTransactions FROM transactions WHERE LOWER(status) = 'approved'", (err, row) => {
          if (err) return rejectApproved(err);
          resolveApproved(Number(row?.approvedTransactions || 0));
        });
      }),
      new Promise((resolveFlagged, rejectFlagged) => {
        db.get("SELECT COUNT(*) AS flaggedTransactions FROM transactions WHERE LOWER(risk_level) IN ('medium', 'high')", (err, row) => {
          if (err) return rejectFlagged(err);
          resolveFlagged(Number(row?.flaggedTransactions || 0));
        });
      }),
      new Promise((resolveHighRisk, rejectHighRisk) => {
        db.get("SELECT COUNT(*) AS highRiskTransactions FROM transactions WHERE LOWER(risk_level) = 'high'", (err, row) => {
          if (err) return rejectHighRisk(err);
          resolveHighRisk(Number(row?.highRiskTransactions || 0));
        });
      }),
      new Promise((resolveAvg, rejectAvg) => {
        db.get('SELECT COALESCE(AVG(amount), 0) AS averageTransactionAmount FROM transactions', (err, row) => {
          if (err) return rejectAvg(err);
          resolveAvg(Number(row?.averageTransactionAmount || 0));
        });
      })
    ])
      .then(([totalTransactions, totalValue, approvedTransactions, flaggedTransactions, highRiskTransactions, averageTransactionAmount]) => {
        resolve({
          totalTransactions,
          totalValue,
          approvedTransactions,
          flaggedTransactions,
          highRiskTransactions,
          averageTransactionAmount
        });
      })
      .catch(reject);
  });
}

function getRiskDistribution() {
  return new Promise((resolve, reject) => {
    db.all('SELECT LOWER(risk_level) AS riskLevel, COUNT(*) AS count FROM transactions GROUP BY LOWER(risk_level)', (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const distribution = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0
      };

      rows.forEach((row) => {
        const key = String(row.riskLevel || '').toUpperCase();
        if (key in distribution) {
          distribution[key] = Number(row.count || 0);
        }
      });

      resolve(distribution);
    });
  });
}

function getTransactionTrend() {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT date(transaction_time) AS date, COUNT(*) AS count FROM transactions GROUP BY date(transaction_time) ORDER BY date ASC',
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows.map((row) => ({
          date: row.date,
          count: Number(row.count || 0)
        })));
      }
    );
  });
}

module.exports = {
  initializeDatabase,
  getAllTransactions,
  getTransactionById,
  createTransaction,
  deleteTransactionById,
  getDashboardStats,
  getRiskDistribution,
  getTransactionTrend
};
