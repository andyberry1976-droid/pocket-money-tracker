'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, StoreError } = require('../lib/store');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pocketmoney-'));
  const file = path.join(dir, 'db.json');
  return { store: createStore(file), file, dir };
}

test('createKid defaults weekly allowance to £1 per year of age', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9 });
  assert.equal(kid.weeklyAllowancePence, 900);
  assert.equal(kid.balancePence, 0);
  assert.equal(store.listKids().length, 1);
});

test('createKid trims the name and rejects a blank one', () => {
  const { store } = tempStore();
  assert.throws(() => store.createKid({ name: '   ', age: 8 }), StoreError);
  const kid = store.createKid({ name: '  Leo  ', age: 8 });
  assert.equal(kid.name, 'Leo');
});

test('createKid rejects an age outside 1-18', () => {
  const { store } = tempStore();
  assert.throws(() => store.createKid({ name: 'Sam', age: 0 }), StoreError);
  assert.throws(() => store.createKid({ name: 'Sam', age: 19 }), StoreError);
});

test('completing a chore credits the balance and cannot be done twice on the same day', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9 });
  const chore = store.createChore(kid.id, { name: 'Tidy bedroom', valuePence: 100 });
  const first = store.completeChore(chore.id, '2026-11-15');
  assert.equal(first.kid.balancePence, 100);
  assert.equal(first.transaction.type, 'chore');
  assert.equal(first.transaction.amountPence, 100);
  assert.throws(() => store.completeChore(chore.id, '2026-11-15'), (error) => {
    assert.equal(error.status, 409);
    return true;
  });
  const second = store.completeChore(chore.id, '2026-11-16');
  assert.equal(second.kid.balancePence, 200);
});

test('payAllowance credits the weekly amount', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9, weeklyAllowancePence: 900 });
  const result = store.payAllowance(kid.id, '2026-11-15');
  assert.equal(result.transaction.type, 'allowance');
  assert.equal(result.transaction.amountPence, 900);
  assert.equal(result.kid.balancePence, 900);
});

test('a spend reduces the balance and cannot overdraw', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9 });
  store.payAllowance(kid.id, '2026-11-08');
  const spent = store.createTransaction(kid.id, {
    type: 'spend',
    amountPence: 300,
    description: 'Comic book',
    date: '2026-11-10',
  });
  assert.equal(spent.transaction.amountPence, -300);
  assert.equal(spent.kid.balancePence, 600);
  assert.throws(
    () =>
      store.createTransaction(kid.id, {
        type: 'spend',
        amountPence: 700,
        description: 'Too much',
        date: '2026-11-11',
      }),
    StoreError
  );
  assert.equal(store.getKid(kid.id).balancePence, 600);
});

test('deleting a transaction reverses the balance and linked chore log', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9 });
  const chore = store.createChore(kid.id, { name: 'Walk the dog', valuePence: 200 });
  const completed = store.completeChore(chore.id, '2026-11-15');
  store.deleteTransaction(completed.transaction.id);
  const reloaded = store.getKid(kid.id);
  assert.equal(reloaded.balancePence, 0);
  assert.equal(reloaded.transactions.length, 0);
  // The same chore can be completed again on that date once the log is gone
  store.completeChore(chore.id, '2026-11-15');
  assert.equal(store.getKid(kid.id).balancePence, 200);
});

test('deleting a child removes chores, logs, and transactions', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9 });
  const chore = store.createChore(kid.id, { name: 'Tidy bedroom', valuePence: 100 });
  store.completeChore(chore.id, '2026-11-15');
  store.deleteKid(kid.id);
  assert.equal(store.listKids().length, 0);
  assert.throws(() => store.getKid(kid.id), (error) => error.status === 404);
  assert.throws(() => store.listChores(kid.id), (error) => error.status === 404);
});

test('updateKid can change the allowance without resetting the balance', () => {
  const { store } = tempStore();
  const kid = store.createKid({ name: 'Test Child D', age: 9 });
  store.payAllowance(kid.id, '2026-11-08');
  const updated = store.updateKid(kid.id, { weeklyAllowancePence: 1000, name: 'Maya Q' });
  assert.equal(updated.name, 'Maya Q');
  assert.equal(updated.weeklyAllowancePence, 1000);
  assert.equal(store.getKid(kid.id).balancePence, 900);
});

test('summary totals every child balance', () => {
  const { store } = tempStore();
  const maya = store.createKid({ name: 'Test Child D', age: 9 });
  const leo = store.createKid({ name: 'Test Child E', age: 12 });
  store.payAllowance(maya.id, '2026-11-08');
  store.payAllowance(leo.id, '2026-11-08');
  const summary = store.summary();
  assert.equal(summary.childCount, 2);
  assert.equal(summary.totalBalancePence, 900 + 1200);
});
