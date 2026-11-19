'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('starter data balances match the sum of each child\'s transactions', () => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'db.json'), 'utf8')
  );
  for (const kid of data.kids) {
    const total = data.transactions
      .filter((item) => item.kidId === kid.id)
      .reduce((sum, item) => sum + item.amountPence, 0);
    assert.equal(total, kid.balancePence, `${kid.name} balance should equal transaction sum`);
  }

  const ids = [
    ...data.kids.map((item) => item.id),
    ...data.chores.map((item) => item.id),
    ...data.choreLogs.map((item) => item.id),
    ...data.transactions.map((item) => item.id),
  ];
  assert.equal(new Set(ids).size, ids.length, 'every record should have a unique id');
  assert.ok(data.lastId >= Math.max(...ids));

  for (const log of data.choreLogs) {
    const chore = data.chores.find((item) => item.id === log.choreId);
    assert.ok(chore, `chore log ${log.id} should point at a chore`);
    const linked = data.transactions.filter((item) => item.choreLogId === log.id);
    assert.equal(linked.length, 1, `chore log ${log.id} should have one transaction`);
    assert.equal(linked[0].kidId, chore.kidId);
    assert.equal(linked[0].amountPence, chore.valuePence);
  }
});
