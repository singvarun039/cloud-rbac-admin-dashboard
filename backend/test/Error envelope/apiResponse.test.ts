import test from 'node:test';
import assert from 'node:assert/strict';
import '../../src/types/register';
import { ok, fail } from '../../src/utils/apiResponse';

test('ok returns a success envelope with status and meta', () => {
  const req = { requestId: 'req-123' } as any;
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
  } as any;

  ok(res, req, { hello: 'world' }, 201, { page: 1 });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.payload, {
    ok: true,
    data: { hello: 'world' },
    meta: { page: 1 },
    requestId: 'req-123',
  });
});

test('fail returns an error envelope and omits undefined details', () => {
  const req = { requestId: 'req-456' } as any;
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
  } as any;

  fail(res, req, 404, 'NOT_FOUND', 'Missing');

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.payload, {
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Missing' },
    requestId: 'req-456',
  });
});
