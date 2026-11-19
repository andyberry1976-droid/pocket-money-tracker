'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

let server;
let baseUrl;
let dataFile;

function listen(app) {
  return new Promise((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => {
      const { port } = httpServer.address();
      resolve({ httpServer, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function request(pathname, options = {}) {
  const response = await fetch(baseUrl + pathname, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body };
}

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketmoney-api-'));
  dataFile = path.join(dir, 'db.json');
  const started = await listen(createApp({ dataFile }));
  server = started.httpServer;
  baseUrl = started.url;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET / serves the homepage', async () => {
  const response = await fetch(baseUrl + '/');
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Pocket Money Tracker/);
});

test('POST /api/kids creates a child and lists them', async () => {
  const created = await request('/api/kids', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Child A', age: 7 }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Test Child A');
  assert.equal(created.body.weeklyAllowancePence, 700);

  const list = await request('/api/kids');
  assert.equal(list.status, 200);
  assert.ok(list.body.some((kid) => kid.id === created.body.id));
});

test('chore completion and allowance endpoints update the balance', async () => {
  const created = await request('/api/kids', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Child B', age: 10 }),
  });
  const kidId = created.body.id;

  const chore = await request(`/api/kids/${kidId}/chores`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Feed the cat', valuePence: 75 }),
  });
  assert.equal(chore.status, 201);

  const done = await request(`/api/chores/${chore.body.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ date: '2026-11-15' }),
  });
  assert.equal(done.status, 201);
  assert.equal(done.body.kid.balancePence, 75);

  const again = await request(`/api/chores/${chore.body.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ date: '2026-11-15' }),
  });
  assert.equal(again.status, 409);

  const allowance = await request(`/api/kids/${kidId}/allowance`, {
    method: 'POST',
    body: JSON.stringify({ date: '2026-11-15' }),
  });
  assert.equal(allowance.status, 201);
  assert.equal(allowance.body.kid.balancePence, 1075);
});

test('API returns 404 for a missing child and 400 for bad input', async () => {
  const missing = await request('/api/kids/9999');
  assert.equal(missing.status, 404);

  const bad = await request('/api/kids', {
    method: 'POST',
    body: JSON.stringify({ name: '', age: 8 }),
  });
  assert.equal(bad.status, 400);
});

test('spend endpoint records a debit and rejects an overdraft', async () => {
  const created = await request('/api/kids', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Child C', age: 6, weeklyAllowancePence: 500 }),
  });
  const kidId = created.body.id;
  await request(`/api/kids/${kidId}/allowance`, {
    method: 'POST',
    body: JSON.stringify({ date: '2026-11-08' }),
  });

  const spend = await request(`/api/kids/${kidId}/transactions`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'spend',
      amountPence: 200,
      description: 'Stickers',
      date: '2026-11-10',
    }),
  });
  assert.equal(spend.status, 201);
  assert.equal(spend.body.kid.balancePence, 300);

  const overdraft = await request(`/api/kids/${kidId}/transactions`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'spend',
      amountPence: 400,
      description: 'Too much',
      date: '2026-11-11',
    }),
  });
  assert.equal(overdraft.status, 400);
});
