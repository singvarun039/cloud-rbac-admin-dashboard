import { describe, expect, it } from 'vitest';
import { unwrapData } from '../../src/types/api';

describe('unwrapData', () => {
  it('returns the nested data field when present', () => {
    expect(unwrapData<{ id: string }>({ data: { id: 'user-1' } })).toEqual({ id: 'user-1' });
  });

  it('returns undefined for non-envelope values', () => {
    expect(unwrapData('plain-value')).toBeUndefined();
    expect(unwrapData(null)).toBeUndefined();
  });
});
