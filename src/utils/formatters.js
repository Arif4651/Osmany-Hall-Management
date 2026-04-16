export const formatCurrency = (amount, currency = 'BDT') =>
  new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatDate = (dateInput) => {
  const date = new Date(dateInput);
  return new Intl.DateTimeFormat('en-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatPercent = (value) => `${value.toFixed(1)}%`;