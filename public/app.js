async function loadHealthStatus() {
  const healthStatus = document.getElementById('health-status');
  const healthResult = document.getElementById('health-result');

  try {
    const response = await fetch('/api/health');
    const data = await response.json();

    healthStatus.textContent = data.status.toUpperCase();
    healthResult.innerHTML = `
      <strong>Service:</strong> ${data.service}<br />
      <strong>Status:</strong> ${data.status}<br />
      <strong>Message:</strong> ${data.message}<br />
      <strong>Timestamp:</strong> ${new Date(data.timestamp).toLocaleString()}
    `;
  } catch (error) {
    healthStatus.textContent = 'ERROR';
    healthResult.textContent = 'The backend is not responding. Please check the server.';
    console.error('Health check failed:', error);
  }
}

function formatCurrency(value) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(numericValue);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value || 0));
}

function getRiskClass(level) {
  const normalized = String(level || 'low').toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
}

function formatDateTime(value) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

async function loadDashboardStats() {
  const statIds = {
    totalTransactions: document.getElementById('total-transactions'),
    totalValue: document.getElementById('total-value'),
    approvedTransactions: document.getElementById('approved-transactions'),
    flaggedTransactions: document.getElementById('flagged-transactions'),
    highRiskTransactions: document.getElementById('high-risk-transactions'),
    averageTransactionAmount: document.getElementById('average-amount')
  };

  try {
    const response = await fetch('/api/dashboard/stats');

    if (!response.ok) {
      throw new Error('Dashboard stats failed');
    }

    const payload = await response.json();
    const stats = payload?.stats || {};

    statIds.totalTransactions.textContent = formatNumber(stats.totalTransactions ?? 0);
    statIds.totalValue.textContent = formatCurrency(stats.totalValue ?? 0);
    statIds.approvedTransactions.textContent = formatNumber(stats.approvedTransactions ?? 0);
    statIds.flaggedTransactions.textContent = formatNumber(stats.flaggedTransactions ?? 0);
    statIds.highRiskTransactions.textContent = formatNumber(stats.highRiskTransactions ?? 0);
    statIds.averageTransactionAmount.textContent = formatCurrency(stats.averageTransactionAmount ?? 0);
  } catch (error) {
    console.error('Dashboard stats load failed:', error);
    Object.values(statIds).forEach((element) => {
      if (element) {
        element.textContent = 'Unable to load';
      }
    });
  }
}

async function loadRiskDistribution() {
  const ctx = document.getElementById('riskChart');

  try {
    const response = await fetch('/api/dashboard/risk-distribution');

    if (!response.ok) {
      throw new Error('Risk distribution failed');
    }

    const payload = await response.json();
    const distribution = payload?.distribution || { LOW: 0, MEDIUM: 0, HIGH: 0 };

    if (window.riskChart && typeof window.riskChart.destroy === 'function') {
      window.riskChart.destroy();
    }

    window.riskChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['LOW', 'MEDIUM', 'HIGH'],
        datasets: [{
          data: [
            Number(distribution.LOW || 0),
            Number(distribution.MEDIUM || 0),
            Number(distribution.HIGH || 0)
          ],
          backgroundColor: ['#4ade80', '#fbbf24', '#f87171'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  } catch (error) {
    console.error('Risk distribution load failed:', error);
    if (ctx) {
      ctx.parentElement.innerHTML = '<p>Unable to load dashboard data</p>';
    }
  }
}

async function loadTransactionTrend() {
  const ctx = document.getElementById('trendChart');

  try {
    const response = await fetch('/api/dashboard/trend');

    if (!response.ok) {
      throw new Error('Transaction trend failed');
    }

    const payload = await response.json();
    const trend = Array.isArray(payload?.trend) ? payload.trend : [];

    if (window.trendChart && typeof window.trendChart.destroy === 'function') {
      window.trendChart.destroy();
    }

    const labels = trend.map((entry) => {
      const date = new Date(`${entry.date}T00:00:00`);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const data = trend.map((entry) => Number(entry.count || 0));

    window.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Transactions',
          data,
          borderColor: '#66d9ef',
          backgroundColor: 'rgba(102, 217, 239, 0.2)',
          borderWidth: 2,
          tension: 0.3,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Transaction trend load failed:', error);
    if (ctx) {
      ctx.parentElement.innerHTML = '<p>Unable to load dashboard data</p>';
    }
  }
}

async function loadTransactions() {
  const transactionList = document.getElementById('transaction-list');

  try {
    const response = await fetch('/api/transactions');

    if (!response.ok) {
      throw new Error('Failed to load transactions');
    }

    const payload = await response.json();
    const transactions = payload && Array.isArray(payload.transactions)
      ? payload.transactions
      : Array.isArray(payload)
        ? payload
        : [];

    window.allTransactions = transactions;
    updateStatusFilterOptions();
    applyTransactionFilters();

    if (!transactions || transactions.length === 0) {
      transactionList.innerHTML = '<li><p>No transactions available.</p></li>';
      return;
    }

    transactionList.innerHTML = transactions
      .slice(0, 4)
      .map((transaction) => {
        const riskLevel = String(transaction.risk_level || 'low').toLowerCase();
        const riskClass = getRiskClass(transaction.risk_level);
        const riskScore = transaction.risk_score ?? 0;

        return `
          <li>
            <div>
              <strong>${transaction.transaction_id}</strong>
              <p>${transaction.merchant} • ${transaction.location}</p>
              <p class="risk-meta">Risk Score: ${riskScore} • Risk Level: ${riskLevel.toUpperCase()}</p>
            </div>
            <span class="risk ${riskClass}">${riskLevel}</span>
          </li>
        `;
      })
      .join('');
  } catch (error) {
    console.error('Transaction load failed:', error);
    window.allTransactions = [];
    updateStatusFilterOptions();
    applyTransactionFilters();
    transactionList.innerHTML = '<li><p>Unable to load transactions. Please try again.</p></li>';
  }
}

function updateStatusFilterOptions() {
  const statusFilter = document.getElementById('status-filter');
  if (!statusFilter) return;

  const statuses = Array.from(
    new Set((window.allTransactions || []).map((transaction) => String(transaction.status || '').trim()))
  )
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));

  const currentValue = statusFilter.value || 'ALL';
  const options = ['<option value="ALL">All</option>']
    .concat(statuses.map((status) => `<option value="${status}">${status}</option>`));

  statusFilter.innerHTML = options.join('');
  if (statuses.includes(currentValue)) {
    statusFilter.value = currentValue;
  } else {
    statusFilter.value = 'ALL';
  }
}

function applyTransactionFilters() {
  const tableBody = document.getElementById('transaction-table-body');
  const searchField = document.getElementById('transaction-search');
  const riskFilter = document.getElementById('risk-filter');
  const statusFilter = document.getElementById('status-filter');
  const sortOrder = document.getElementById('sort-order');

  if (!tableBody || !searchField || !riskFilter || !statusFilter || !sortOrder) {
    return;
  }

  const searchTerm = String(searchField.value || '').trim().toLowerCase();
  const riskValue = riskFilter.value || 'ALL';
  const statusValue = statusFilter.value || 'ALL';
  const sortValue = sortOrder.value || 'newest';

  let filteredTransactions = [...(window.allTransactions || [])];

  if (searchTerm) {
    filteredTransactions = filteredTransactions.filter((transaction) => {
      const haystacks = [
        transaction.transaction_id,
        transaction.merchant,
        transaction.location
      ].filter(Boolean).map((value) => String(value).toLowerCase());

      return haystacks.some((value) => value.includes(searchTerm));
    });
  }

  if (riskValue !== 'ALL') {
    filteredTransactions = filteredTransactions.filter((transaction) => {
      return String(transaction.risk_level || '').toUpperCase() === riskValue;
    });
  }

  if (statusValue !== 'ALL') {
    filteredTransactions = filteredTransactions.filter((transaction) => {
      return String(transaction.status || '').toLowerCase() === String(statusValue).toLowerCase();
    });
  }

  filteredTransactions.sort((first, second) => {
    const firstTime = new Date(first.transaction_time || 0).getTime();
    const secondTime = new Date(second.transaction_time || 0).getTime();
    const firstAmount = Number(first.amount || 0);
    const secondAmount = Number(second.amount || 0);
    const firstRisk = Number(first.risk_score || 0);
    const secondRisk = Number(second.risk_score || 0);

    switch (sortValue) {
      case 'oldest':
        return firstTime - secondTime;
      case 'highestAmount':
        return secondAmount - firstAmount;
      case 'lowestAmount':
        return firstAmount - secondAmount;
      case 'highestRisk':
        return secondRisk - firstRisk;
      case 'lowestRisk':
        return firstRisk - secondRisk;
      case 'newest':
      default:
        return secondTime - firstTime;
    }
  });

  if (!filteredTransactions.length) {
    tableBody.innerHTML = '<tr><td colspan="8" class="table-empty">No transactions found. Try changing your search or filters.</td></tr>';
    return;
  }

  tableBody.innerHTML = filteredTransactions.map((transaction) => {
    const riskClass = getRiskClass(transaction.risk_level);
    const riskLevel = String(transaction.risk_level || 'low').toUpperCase();
    const amount = formatCurrency(Number(transaction.amount || 0));

    return `
      <tr data-transaction-id="${transaction.id}">
        <td>${transaction.transaction_id}</td>
        <td>${transaction.merchant}</td>
        <td>${amount}</td>
        <td>${transaction.location}</td>
        <td>${formatDateTime(transaction.transaction_time)}</td>
        <td>${transaction.status}</td>
        <td>${transaction.risk_score ?? 0}</td>
        <td><span class="risk ${riskClass}">${riskLevel}</span></td>
      </tr>
    `;
  }).join('');

  tableBody.querySelectorAll('tr[data-transaction-id]').forEach((row) => {
    row.addEventListener('click', () => {
      openTransactionDetails(Number(row.dataset.transactionId));
    });
  });
}

function openTransactionDetails(transactionId) {
  const modal = document.getElementById('transaction-modal');
  const modalBody = document.getElementById('transaction-modal-body');

  if (!modal || !modalBody) return;

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modalBody.innerHTML = '<p>Loading transaction details...</p>';

  fetch(`/api/transactions/${transactionId}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Unable to load transaction details.');
      }

      const payload = await response.json();
      const transaction = payload?.transaction || {};
      const reasons = Array.isArray(transaction.risk_reasons) ? transaction.risk_reasons : [];

      modalBody.innerHTML = `
        <div class="detail-grid">
          <div class="detail-item"><span>Transaction ID</span><strong>${transaction.transaction_id || 'N/A'}</strong></div>
          <div class="detail-item"><span>Amount</span><strong>${formatCurrency(Number(transaction.amount || 0))}</strong></div>
          <div class="detail-item"><span>Currency</span><strong>${transaction.currency || 'N/A'}</strong></div>
          <div class="detail-item"><span>Merchant</span><strong>${transaction.merchant || 'N/A'}</strong></div>
          <div class="detail-item"><span>Location</span><strong>${transaction.location || 'N/A'}</strong></div>
          <div class="detail-item"><span>Transaction Type</span><strong>${transaction.transaction_type || 'N/A'}</strong></div>
          <div class="detail-item"><span>Transaction Time</span><strong>${formatDateTime(transaction.transaction_time)}</strong></div>
          <div class="detail-item"><span>Status</span><strong>${transaction.status || 'N/A'}</strong></div>
          <div class="detail-item"><span>Risk Score</span><strong>${transaction.risk_score ?? 0}</strong></div>
          <div class="detail-item"><span>Risk Level</span><strong>${String(transaction.risk_level || 'low').toUpperCase()}</strong></div>
          <div class="detail-item" style="grid-column: 1 / -1;"><span>Risk Reasons</span><strong>${reasons.length ? reasons.join('; ') : 'No risk reasons recorded.'}</strong></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary-btn" data-close-modal="true">Close</button>
          <button type="button" class="primary-btn" id="delete-transaction-btn">Delete Transaction</button>
        </div>
      `;

      const deleteButton = document.getElementById('delete-transaction-btn');
      if (deleteButton) {
        deleteButton.addEventListener('click', () => {
          const confirmed = window.confirm('Are you sure you want to delete this transaction?');
          if (!confirmed) return;

          deleteTransaction(transactionId);
        });
      }

      modalBody.querySelectorAll('[data-close-modal="true"]').forEach((button) => {
        button.addEventListener('click', closeTransactionModal);
      });
    })
    .catch((error) => {
      console.error('Transaction details failed:', error);
      modalBody.innerHTML = '<p>Unable to load transaction details. Please try again.</p>';
    });
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

function closeFormModal() {
  const modal = document.getElementById('transaction-form-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}

async function deleteTransaction(transactionId) {
  try {
    const response = await fetch(`/api/transactions/${transactionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    closeTransactionModal();
    await refreshTransactionData();
  } catch (error) {
    console.error('Transaction deletion failed:', error);
    window.alert('Unable to delete transaction. Please try again.');
  }
}

function showFormError(message) {
  const errorBox = document.getElementById('form-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function hideFormError() {
  const errorBox = document.getElementById('form-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function openAddTransactionModal() {
  const modal = document.getElementById('transaction-form-modal');
  if (!modal) return;
  hideFormError();
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

async function handleNewTransactionSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const transactionData = Object.fromEntries(formData.entries());

  if (!transactionData.transaction_id || !transactionData.amount || !transactionData.currency || !transactionData.merchant || !transactionData.location || !transactionData.transaction_type || !transactionData.transaction_time || !transactionData.status) {
    showFormError('Please fill in all required fields.');
    return;
  }

  const parsedAmount = Number(transactionData.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    showFormError('Amount must be greater than 0.');
    return;
  }

  try {
    const response = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...transactionData,
        amount: parsedAmount,
        transaction_time: new Date(transactionData.transaction_time).toISOString()
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Unable to create transaction.');
    }

    form.reset();
    closeFormModal();
    await refreshTransactionData();
  } catch (error) {
    console.error('Transaction creation failed:', error);
    showFormError(error.message || 'Unable to create transaction. Please try again.');
  }
}

async function refreshTransactionData() {
  await loadTransactions();
  await loadDashboardStats();
  await loadRiskDistribution();
  await loadTransactionTrend();
}

function bindGlobalEvents() {
  const searchField = document.getElementById('transaction-search');
  const riskFilter = document.getElementById('risk-filter');
  const statusFilter = document.getElementById('status-filter');
  const sortOrder = document.getElementById('sort-order');
  const addButton = document.getElementById('open-add-transaction');
  const form = document.getElementById('transaction-form');

  searchField?.addEventListener('input', applyTransactionFilters);
  riskFilter?.addEventListener('change', applyTransactionFilters);
  statusFilter?.addEventListener('change', applyTransactionFilters);
  sortOrder?.addEventListener('change', applyTransactionFilters);
  addButton?.addEventListener('click', openAddTransactionModal);
  form?.addEventListener('submit', handleNewTransactionSubmit);

  document.querySelectorAll('[data-close-modal="true"]').forEach((button) => {
    button.addEventListener('click', closeTransactionModal);
  });

  document.querySelectorAll('[data-close-form-modal="true"]').forEach((button) => {
    button.addEventListener('click', closeFormModal);
  });
}

loadHealthStatus();
loadTransactions();
loadDashboardStats();
loadRiskDistribution();
loadTransactionTrend();
bindGlobalEvents();
