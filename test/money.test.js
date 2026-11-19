'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { penceToPounds, formatPounds, parsePounds } = require('../lib/money');

test('penceToPounds converts integer pence', () => {
  assert.equal(penceToPounds(0), 0);
  assert.equal(penceToPounds(100), 1);
  assert.equal(penceToPounds(250), 2.5);
  assert.equal(penceToPounds(-150), -1.5);
});

test('penceToPounds rejects non-integers', () => {
  assert.throws(() => penceToPounds(1.5), TypeError);
  assert.throws(() => penceToPounds('100'), TypeError);
});

test('formatPounds shows a pounds sign and two decimal places', () => {
  assert.equal(formatPounds(0), '£0.00');
  assert.equal(formatPounds(800), '£8.00');
  assert.equal(formatPounds(5450), '£54.50');
  assert.equal(formatPounds(-300), '-£3.00');
  assert.equal(formatPounds(5), '£0.05');
});

test('parsePounds accepts pounds strings and numbers', () => {
  assert.equal(parsePounds('8'), 800);
  assert.equal(parsePounds('8.50'), 850);
  assert.equal(parsePounds('£8.50'), 850);
  assert.equal(parsePounds('-3.00'), -300);
  assert.equal(parsePounds(2.5), 250);
});

test('parsePounds rejects invalid amounts', () => {
  assert.throws(() => parsePounds(''), TypeError);
  assert.throws(() => parsePounds('12.345'), TypeError);
  assert.throws(() => parsePounds('abc'), TypeError);
});
