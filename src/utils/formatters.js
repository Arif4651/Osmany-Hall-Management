import Decimal from 'decimal.js';

export const money = (value = 0) => {
  try {
    return new Decimal(value || 0);
  } catch {
    return new Decimal(0);
  }
};

export const moneyInput = (value) => money(value).toFixed(4);
export const moneyAdd = (...values) => values.reduce((sum, value) => sum.plus(money(value)), new Decimal(0));
export const moneyCompare = (left, right) => money(left).comparedTo(money(right));

export const formatCurrency = (amount) => `৳${money(amount).toFixed(2)}`;
export const todayLocal = () => new Intl.DateTimeFormat('en-CA').format(new Date());

/** A closing balance is a credit when it is below zero — the hall owes the student, not the reverse. */
export const isCredit = (balance) => money(balance).lessThan(0);

/**
 * Renders a closing balance the way a person reads it. A bare "-৳30.83" looks like a rendering
 * fault or a debt; "৳30.83 credit" says what it is. Pair with `balanceLabel` for the caption.
 */
export const formatBalance = (balance) => (isCredit(balance)
  ? `${formatCurrency(money(balance).abs())} credit`
  : formatCurrency(balance));

/** Short caption for a balance: what the number means, not just its sign. */
export const balanceLabel = (balance) => {
  if (isCredit(balance)) return 'In credit — carried to next month';
  return money(balance).isZero() ? 'Fully settled' : 'Outstanding';
};

export const formatDate = (dateInput) => {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatPercent = (value) => `${value.toFixed(1)}%`;
