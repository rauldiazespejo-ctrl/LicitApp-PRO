export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrency(amount: number, currency = 'CLP'): string {
  if (currency === 'CLP') return formatCLP(amount);
  if (currency === 'USD') return formatUSD(amount);
  return `${currency} ${amount.toLocaleString('es-CL')}`;
}

export function parseCurrencyAmount(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, ''));
}
