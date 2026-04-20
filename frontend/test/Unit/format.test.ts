import { describe, expect, it } from 'vitest';
import { formatDate, formatYmdLabel } from '../../src/utils/format';

describe('format utilities', () => {
  it('returns a dash when the date is missing', () => {
    expect(formatDate()).toBe('-');
  });

  it('returns the original value for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatYmdLabel('still-not-a-date')).toBe('still-not-a-date');
  });

  it('formats YYYY-MM-DD values into short labels', () => {
    expect(formatYmdLabel('2026-04-20T00:00:00.000Z')).toMatch(/Apr/);
  });
});
