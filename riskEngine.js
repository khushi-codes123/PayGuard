const unusualLocations = ['unknown', 'international'];

function normalizeTransactionTime(value) {
  if (!value) return null;

  try {
    const input = typeof value === 'string' ? value.trim() : value;
    const normalized = input.includes(' ') ? input.replace(' ', 'T') : input;
    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch (error) {
    return null;
  }
}

function calculateRisk(transaction, recentTransactions = []) {
  let score = 0;
  const reasons = [];

  const amount = Number(transaction?.amount);
  if (Number.isFinite(amount)) {
    if (amount > 50000) {
      score += 30;
      reasons.push('Unusually high transaction amount');
    } else if (amount > 10000) {
      score += 15;
      reasons.push('High transaction amount');
    }
  }

  const date = normalizeTransactionTime(transaction?.transaction_time);
  if (date) {
    const hour = date.getHours();
    if (hour >= 0 && hour <= 5) {
      score += 20;
      reasons.push('Transaction occurred during unusual hours');
    }
  }

  const location = String(transaction?.location || '').trim().toLowerCase();
  if (unusualLocations.includes(location)) {
    score += 20;
    reasons.push('Unusual transaction location');
  }

  const merchant = String(transaction?.merchant || '').trim().toLowerCase();
  if (merchant) {
    const matchingTransactions = Array.isArray(recentTransactions)
      ? recentTransactions.filter((item) => {
          return String(item?.merchant || '').trim().toLowerCase() === merchant;
        })
      : [];

    if (matchingTransactions.length > 0) {
      score += 15;
      reasons.push('Repeated transactions detected');
    }
  }

  const cappedScore = Math.min(score, 100);

  let riskLevel = 'LOW';
  if (cappedScore >= 60) {
    riskLevel = 'HIGH';
  } else if (cappedScore >= 30) {
    riskLevel = 'MEDIUM';
  }

  return {
    riskScore: cappedScore,
    riskLevel,
    reasons
  };
}

module.exports = {
  calculateRisk
};
