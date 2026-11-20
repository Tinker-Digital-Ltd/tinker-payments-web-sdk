import assert from 'node:assert/strict';
import test from 'node:test';
import { TinkerClient, errors, type TinkerFetch } from '../src';

interface Call {
  method?: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function setup(responses: { status: number; body: unknown }[], publicKey = 'pk_live_abc', baseUrl?: string) {
  const calls: Call[] = [];
  const tokens: string[] = [];
  let next = 0;
  const fetch: TinkerFetch = async (url, init) => {
    calls.push({ method: init?.method, url, headers: init?.headers ?? {}, body: init?.body ? (JSON.parse(init.body) as unknown) : null });
    const response = responses[Math.min(next++, responses.length - 1)];
    return { status: response.status, text: async () => JSON.stringify(response.body), headers: new Headers() };
  };
  const client = new TinkerClient({
    publicKey,
    baseUrl,
    fetch,
    getCustomerToken: async () => {
      tokens.push(`token${tokens.length + 1}`);
      return tokens[tokens.length - 1];
    }
  });
  return { client, calls, tokens };
}

const ok = (data: unknown) => ({ status: 200, body: { success: true, data } });
const tokenInvalid = { status: 401, body: { success: false, error: { code: 'TOKEN_INVALID', message: 'expired' } } };

test('getCustomerInfo sends public key and bearer token', async () => {
  const info = { external_customer_id: 'c1' };
  const { client, calls } = setup([ok(info)]);
  assert.deepEqual(await client.getCustomerInfo(), info);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].url, 'https://api.tinkerpayments.com/v1/client/customer');
  assert.equal(calls[0].headers['X-Public-Key'], 'pk_live_abc');
  assert.equal(calls[0].headers.Authorization, 'Bearer token1');
});

test('getEntitlement escapes the identifier and isEntitled uses is_active', async () => {
  const { client, calls } = setup([ok({ identifier: 'a/b', is_active: true }), ok({ identifier: 'pro', is_active: false })]);
  assert.equal((await client.getEntitlement('a/b')).is_active, true);
  assert.equal(calls[0].url, 'https://api.tinkerpayments.com/v1/client/entitlements/a%2Fb');
  assert.equal(await client.isEntitled('pro'), false);
});

test('getOfferings returns the offerings', async () => {
  const offerings = { current_offering_identifier: 'default', offerings: [] };
  const { client, calls } = setup([ok(offerings)]);
  assert.deepEqual(await client.getOfferings(), offerings);
  assert.equal(calls[0].url, 'https://api.tinkerpayments.com/v1/client/offerings');
});

test('setAttributes posts the attributes', async () => {
  const { client, calls } = setup([ok({ attributes: { plan: 'x' } })]);
  await client.setAttributes({ plan: 'x', old: null });
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].url, 'https://api.tinkerpayments.com/v1/client/attributes');
  assert.deepEqual(calls[0].body, { attributes: { plan: 'x', old: null } });
});

test('token is cached across requests', async () => {
  const { client, tokens } = setup([ok({})]);
  await client.getCustomerInfo();
  await client.getOfferings();
  assert.equal(tokens.length, 1);
});

test('concurrent requests share one token fetch', async () => {
  const { client, tokens } = setup([ok({})]);
  await Promise.all([client.getCustomerInfo(), client.getOfferings()]);
  assert.equal(tokens.length, 1);
});

test('concurrent TOKEN_INVALID causes one refresh', async () => {
  const { client, calls, tokens } = setup([tokenInvalid, tokenInvalid, ok({}), ok({})]);
  await Promise.all([client.getCustomerInfo(), client.getOfferings()]);
  assert.equal(tokens.length, 2);
  assert.equal(calls.length, 4);
});

test('TOKEN_INVALID fetches a new token and retries once', async () => {
  const { client, calls, tokens } = setup([tokenInvalid, ok({ external_customer_id: 'c1' })]);
  assert.deepEqual(await client.getCustomerInfo(), { external_customer_id: 'c1' });
  assert.equal(calls.length, 2);
  assert.equal(tokens.length, 2);
  assert.equal(calls[1].headers.Authorization, 'Bearer token2');
});

test('a second TOKEN_INVALID is thrown', async () => {
  const { client, calls } = setup([tokenInvalid]);
  await assert.rejects(client.getCustomerInfo(), (error: errors.ApiError) => error instanceof errors.ApiError && error.errorCode === 'TOKEN_INVALID');
  assert.equal(calls.length, 2);
});

test('other API errors are not retried', async () => {
  const { client, calls } = setup([{ status: 404, body: { success: false, error: { code: 'CUSTOMER_NOT_FOUND', message: 'nope' } } }]);
  await assert.rejects(client.getCustomerInfo(), (error: errors.ApiError) => error.errorCode === 'CUSTOMER_NOT_FOUND' && error.status === 404);
  assert.equal(calls.length, 1);
});

test('network failures become NetworkError', async () => {
  const client = new TinkerClient({
    publicKey: 'pk_live_abc',
    getCustomerToken: async () => 't',
    fetch: async () => {
      throw new Error('offline');
    }
  });
  await assert.rejects(client.getCustomerInfo(), errors.NetworkError);
});

test('pk_test_ keys use the sandbox base URL', async () => {
  const { client, calls } = setup([ok({})], 'pk_test_abc');
  await client.getOfferings();
  assert.equal(calls[0].url, 'https://sandbox-api.tinkerpayments.com/v1/client/offerings');
});

test('baseUrl override gets /v1 appended once', async () => {
  const a = setup([ok({})], 'pk_live_abc', 'http://localhost:8080/');
  await a.client.getOfferings();
  assert.equal(a.calls[0].url, 'http://localhost:8080/v1/client/offerings');
  const b = setup([ok({})], 'pk_live_abc', 'http://localhost:8080/v1');
  await b.client.getOfferings();
  assert.equal(b.calls[0].url, 'http://localhost:8080/v1/client/offerings');
});

test('empty customer token and non-pk_ public key are rejected', async () => {
  const client = new TinkerClient({ publicKey: 'pk_live_abc', getCustomerToken: async () => '', fetch: async () => new Response('{}') });
  await assert.rejects(client.getCustomerInfo(), errors.TinkerError);
  assert.throws(() => new TinkerClient({ publicKey: 'sk_live_abc', getCustomerToken: async () => 't' }), errors.TinkerError);
});
