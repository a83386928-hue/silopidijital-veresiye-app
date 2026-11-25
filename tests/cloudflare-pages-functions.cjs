const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const routePath = path.join(__dirname, '..', 'functions/api/veresiye/[name].js');
  const { onRequest } = await import(require('node:url').pathToFileURL(routePath).href);
  const originalFetch = global.fetch;
  const calls = [];

  const setFetch = (handler) => {
    global.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return handler(String(url), options);
    };
  };
  const invoke = (name, { method = 'POST', body, headers = {}, cfIp = '203.0.113.7' } = {}) => {
    const requestHeaders = new Headers(headers);
    if (cfIp) requestHeaders.set('CF-Connecting-IP', cfIp);
    const request = new Request(`https://portal.pages.dev/api/veresiye/${name}`, {
      method,
      headers: requestHeaders,
      ...(body === undefined ? {} : { body }),
    });
    return onRequest({ request, params: { name } });
  };

  try {
    // Health succeeds only for the exact expected no-code login response.
    setFetch(async (url, options) => {
      assert.equal(url, 'https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/veresiye-portal-login');
      assert.equal(options.method, 'POST');
      assert.equal(options.body, '{}');
      assert.equal(options.headers.apikey, 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS');
      return new Response(JSON.stringify({ success: false, message: 'Giriş kodu geçersiz veya erişim şu anda kapalı.' }), { status: 401 });
    });
    let response = await invoke('health', { method: 'GET' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true, platform: 'cloudflare-pages', proxy: 'ready', supabase_edge_function: 'reachable',
    });

    // The real Cloudflare-provided client IP is forwarded; browser spoofed IP is ignored.
    calls.length = 0;
    setFetch(async (url, options) => {
      assert.equal(url, 'https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/veresiye-portal-login');
      assert.equal(options.headers['X-Veresiye-Client-IP'], '203.0.113.7');
      assert.equal(options.headers['X-Client-Info'], 'silopidijital-veresiye-cloudflare-pages');
      assert.equal(options.body, JSON.stringify({ code: '123456' }));
      return new Response(JSON.stringify({ success: false, message: 'Giriş kodu geçersiz.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    });
    response = await invoke('veresiye-portal-login', {
      body: JSON.stringify({ code: '123456' }),
      headers: {
        'Content-Type': 'application/json',
        'X-Veresiye-Client-IP': '198.51.100.99',
        'X-Forwarded-For': '198.51.100.88',
      },
    });
    assert.equal(response.status, 401, 'Supabase business errors/statuses must pass through unchanged');
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match((await response.json()).message, /Giriş kodu geçersiz/);

    // Admin requests use only the allow-listed admin Edge Function.
    setFetch(async (url, options) => {
      assert.equal(url, 'https://ukfeuojhigxxxlnhsmls.supabase.co/functions/v1/veresiye-portal-admin');
      assert.equal(options.headers.apikey, 'sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS');
      return new Response(JSON.stringify({ success: true, admin_token: 'test-token' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    });
    response = await invoke('veresiye-portal-admin', {
      body: JSON.stringify({ action: 'login', admin_pin: 'test-pin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).admin_token, 'test-token');

    // Health must not report success for an unexpected upstream status/body.
    setFetch(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    response = await invoke('health', { method: 'GET' });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);

    // Network errors are converted into deterministic JSON 502 responses.
    const originalConsoleError = console.error;
    console.error = () => {};
    setFetch(async () => { throw new Error('simulated upstream timeout'); });
    response = await invoke('veresiye-portal-login', {
      body: JSON.stringify({ code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);
    console.error = originalConsoleError;

    // Input/route validation must reject bad requests before calling Supabase.
    calls.length = 0;
    setFetch(async () => { throw new Error('upstream must not be called for invalid requests'); });
    response = await invoke('not-allowed', { body: '{}', headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, 404);

    response = await invoke('veresiye-portal-login', { method: 'GET' });
    assert.equal(response.status, 405);

    response = await invoke('veresiye-portal-login', { method: 'OPTIONS' });
    assert.equal(response.status, 204);

    response = await invoke('veresiye-portal-health', { method: 'GET' });
    assert.equal(response.status, 404);

    response = await invoke('veresiye-portal-login', { body: 'not-json', headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, 400);

    response = await invoke('veresiye-portal-login', { body: '[]', headers: { 'Content-Type': 'application/json' } });
    assert.equal(response.status, 400);

    response = await invoke('veresiye-portal-login', { body: '{}', headers: { 'Content-Type': 'text/plain' } });
    assert.equal(response.status, 415);

    response = await invoke('veresiye-portal-login', {
      body: JSON.stringify({ long: 'x'.repeat(17 * 1024) }),
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(response.status, 413);

    response = await invoke('veresiye-portal-login', {
      body: '{}',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '20000' },
    });
    assert.equal(response.status, 413);

    assert.equal(calls.length, 0, 'Invalid requests must never call the upstream');
    console.log('PASS: Cloudflare Pages Function routing, real health contract, login/admin forwarding, exact Supabase target/key, upstream status/body pass-through, trusted IP handling, cache control, allow-list, method, OPTIONS, JSON, payload-size, and network-error handling. Supabase upstream is mocked; no live customer data is accessed.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    global.fetch = originalFetch;
  }
})();
