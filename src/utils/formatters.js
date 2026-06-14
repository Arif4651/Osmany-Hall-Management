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

export const formatDate = (dateInput) => {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatPercent = (value) => `${value.toFixed(1)}%`;
