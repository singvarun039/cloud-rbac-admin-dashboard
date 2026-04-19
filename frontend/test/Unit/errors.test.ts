import { describe, expect, it } from 'vitest';
import { isCanceledError, isConflictError } from '../../src/utils/errors';

describe('error utilities', () => {
  it('detects canceled requests by code', () => {
    expect(isCanceledError({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isCanceledError({ code: 'OTHER' })).toBe(false);
  });

  it('detects 409 conflict responses', () => {
    expect(isConflictError({ response: { status: 409 } })).toBe(true);
    expect(isConflictError({ response: { status: 400 } })).toBe(false);
  });
});
