import { describe, expect, it } from 'vitest';
import { formatCurrency, moneyAdd, moneyInput } from './formatters';

describe('money helpers', () => {
  it('adds decimal values without floating point drift', () => {
    expect(moneyAdd('0.1', '0.2').toFixed(4)).toBe('0.3000');
  });

  it('serializes four decimals and displays two', () => {
    expect(moneyInput('12.34567')).toBe('12.3457');
    expect(formatCurrency('12.3457')).toBe('৳12.35');
  });
});
