import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../../src/errors/AppError';
import {
  addUtcDays,
  formatDateUtcYYYYMMDD,
  startOfUtcDay,
  utcDayRangeWindow,
} from '../../src/utils/dateWindow';

test('AppError factories return expected status and codes', () => {
  const validation = AppError.validation({ field: 'email' });
  const unauthorized = AppError.unauthorized();
  const forbidden = AppError.forbidden();
  const notFound = AppError.notFound();
  const conflict = AppError.conflict();

  assert.equal(validation.status, 400);
  assert.equal(validation.code, 'VALIDATION_ERROR');
  assert.deepEqual(validation.details, { field: 'email' });
  assert.equal(unauthorized.status, 401);
  assert.equal(forbidden.status, 403);
  assert.equal(notFound.status, 404);
  assert.equal(conflict.status, 409);
});

test('date window helpers normalize UTC boundaries predictably', () => {
  const input = new Date('2026-04-20T18:42:19.000Z');
  const start = startOfUtcDay(input);
  const shifted = addUtcDays(input, 2);
  const window = utcDayRangeWindow(3, input);

  assert.equal(start.toISOString(), '2026-04-20T00:00:00.000Z');
  assert.equal(shifted.toISOString(), '2026-04-22T00:00:00.000Z');
  assert.equal(formatDateUtcYYYYMMDD(input), '2026-04-20');
  assert.equal(window.start.toISOString(), '2026-04-18T00:00:00.000Z');
  assert.equal(window.endExclusive.toISOString(), '2026-04-21T00:00:00.000Z');
  assert.deepEqual(window.dates, ['2026-04-18', '2026-04-19', '2026-04-20']);
});
