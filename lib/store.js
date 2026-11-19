'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'db.json');

class StoreError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
  }
}

function emptyData() {
  return { lastId: 0, kids: [], chores: [], choreLogs: [], transactions: [] };
}

function createStore(filePath = process.env.DATA_FILE || DEFAULT_FILE) {
  const resolved = path.resolve(filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(resolved)) {
    fs.writeFileSync(resolved, JSON.stringify(emptyData(), null, 2) + '\n');
  }

  function load() {
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  }

  function save(data) {
    const tmp = resolved + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    fs.renameSync(tmp, resolved);
  }

  function nextId(data) {
    data.lastId += 1;
    return data.lastId;
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function requireIsoDate(value, fallback) {
    const date = value || fallback || todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new StoreError('Date must be in YYYY-MM-DD format');
    }
    return date;
  }

  function requireIntegerPence(value, label) {
    if (!Number.isInteger(value)) {
      throw new StoreError(`${label} must be an integer number of pence`);
    }
    return value;
  }

  function findKid(data, id) {
    const kid = data.kids.find((item) => item.id === id);
    if (!kid) {
      throw new StoreError('Child not found', 404);
    }
    return kid;
  }

  function findChore(data, id) {
    const chore = data.chores.find((item) => item.id === id);
    if (!chore) {
      throw new StoreError('Chore not found', 404);
    }
    return chore;
  }

  function findTransaction(data, id) {
    const transaction = data.transactions.find((item) => item.id === id);
    if (!transaction) {
      throw new StoreError('Transaction not found', 404);
    }
    return transaction;
  }

  function findLog(data, id) {
    const log = data.choreLogs.find((item) => item.id === id);
    if (!log) {
      throw new StoreError('Chore log not found', 404);
    }
    return log;
  }

  function normaliseName(name, label = 'Name') {
    if (typeof name !== 'string') {
      throw new StoreError(`${label} is required`);
    }
    const trimmed = name.trim();
    if (!trimmed) {
      throw new StoreError(`${label} is required`);
    }
    if (trimmed.length > 40) {
      throw new StoreError(`${label} must be 40 characters or fewer`);
    }
    return trimmed;
  }

  function normaliseAge(age) {
    if (!Number.isInteger(age) || age < 1 || age > 18) {
      throw new StoreError('Age must be a whole number between 1 and 18');
    }
    return age;
  }

  function listKids() {
    return load().kids.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  function getKid(id) {
    const data = load();
    const kid = findKid(data, id);
    const chores = data.chores
      .filter((chore) => chore.kidId === id)
      .map((chore) => ({
        ...chore,
        doneToday: data.choreLogs.some(
          (log) => log.choreId === chore.id && log.date === todayIso()
        ),
      }));
    const transactions = data.transactions
      .filter((item) => item.kidId === id)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    return { ...kid, chores, transactions };
  }

  function createKid({ name, age, weeklyAllowancePence }) {
    const data = load();
    const cleanName = normaliseName(name);
    const cleanAge = normaliseAge(age);
    let allowance = weeklyAllowancePence;
    if (allowance === undefined || allowance === null || allowance === '') {
      allowance = cleanAge * 100;
    }
    requireIntegerPence(allowance, 'Weekly allowance');
    if (allowance < 0) {
      throw new StoreError('Weekly allowance cannot be negative');
    }
    const kid = {
      id: nextId(data),
      name: cleanName,
      age: cleanAge,
      weeklyAllowancePence: allowance,
      balancePence: 0,
    };
    data.kids.push(kid);
    save(data);
    return kid;
  }

  function updateKid(id, changes) {
    const data = load();
    const kid = findKid(data, id);
    if (changes.name !== undefined) {
      kid.name = normaliseName(changes.name);
    }
    if (changes.age !== undefined) {
      kid.age = normaliseAge(changes.age);
    }
    if (changes.weeklyAllowancePence !== undefined) {
      requireIntegerPence(changes.weeklyAllowancePence, 'Weekly allowance');
      if (changes.weeklyAllowancePence < 0) {
        throw new StoreError('Weekly allowance cannot be negative');
      }
      kid.weeklyAllowancePence = changes.weeklyAllowancePence;
    }
    save(data);
    return { ...kid };
  }

  function deleteKid(id) {
    const data = load();
    findKid(data, id);
    const choreIds = new Set(
      data.chores.filter((chore) => chore.kidId === id).map((chore) => chore.id)
    );
    data.kids = data.kids.filter((item) => item.id !== id);
    data.chores = data.chores.filter((chore) => chore.kidId !== id);
    data.choreLogs = data.choreLogs.filter((log) => !choreIds.has(log.choreId));
    data.transactions = data.transactions.filter((item) => item.kidId !== id);
    save(data);
  }

  function listChores(kidId) {
    const data = load();
    findKid(data, kidId);
    return data.chores.filter((chore) => chore.kidId === kidId);
  }

  function createChore(kidId, { name, valuePence }) {
    const data = load();
    findKid(data, kidId);
    const cleanName = normaliseName(name, 'Chore name');
    requireIntegerPence(valuePence, 'Chore reward');
    if (valuePence < 0) {
      throw new StoreError('Chore reward cannot be negative');
    }
    const chore = {
      id: nextId(data),
      kidId,
      name: cleanName,
      valuePence,
    };
    data.chores.push(chore);
    save(data);
    return chore;
  }

  function deleteChore(id) {
    const data = load();
    findChore(data, id);
    data.chores = data.chores.filter((chore) => chore.id !== id);
    data.choreLogs = data.choreLogs.filter((log) => log.choreId !== id);
    save(data);
  }

  function completeChore(choreId, date) {
    const data = load();
    const chore = findChore(data, choreId);
    const kid = findKid(data, chore.kidId);
    const day = requireIsoDate(date);
    const already = data.choreLogs.some(
      (log) => log.choreId === choreId && log.date === day
    );
    if (already) {
      throw new StoreError('This chore has already been marked done on that date', 409);
    }
    const log = {
      id: nextId(data),
      choreId,
      date: day,
    };
    const transaction = {
      id: nextId(data),
      kidId: kid.id,
      amountPence: chore.valuePence,
      type: 'chore',
      description: chore.name,
      date: day,
      choreLogId: log.id,
    };
    data.choreLogs.push(log);
    data.transactions.push(transaction);
    kid.balancePence += chore.valuePence;
    save(data);
    return { log, transaction, kid: { ...kid } };
  }

  function undoChoreLog(logId) {
    const data = load();
    const log = findLog(data, logId);
    const linked = data.transactions.find((item) => item.choreLogId === log.id);
    if (linked) {
      const kid = findKid(data, linked.kidId);
      kid.balancePence -= linked.amountPence;
      data.transactions = data.transactions.filter((item) => item.id !== linked.id);
    }
    data.choreLogs = data.choreLogs.filter((item) => item.id !== logId);
    save(data);
  }

  function listTransactions(kidId) {
    const data = load();
    findKid(data, kidId);
    return data.transactions
      .filter((item) => item.kidId === kidId)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }

  function addSignedTransaction(data, kid, { amountPence, type, description, date, choreLogId }) {
    requireIntegerPence(amountPence, 'Amount');
    const allowed = new Set(['allowance', 'chore', 'spend', 'adjustment']);
    if (!allowed.has(type)) {
      throw new StoreError('Transaction type must be allowance, chore, spend, or adjustment');
    }
    if (type === 'spend' && kid.balancePence + amountPence < 0) {
      throw new StoreError('Spend would take the balance below zero');
    }
    const transaction = {
      id: nextId(data),
      kidId: kid.id,
      amountPence,
      type,
      description: normaliseName(description, 'Description'),
      date: requireIsoDate(date),
    };
    if (choreLogId) {
      transaction.choreLogId = choreLogId;
    }
    data.transactions.push(transaction);
    kid.balancePence += amountPence;
    return transaction;
  }

  function payAllowance(kidId, date) {
    const data = load();
    const kid = findKid(data, kidId);
    const day = requireIsoDate(date);
    const transaction = addSignedTransaction(data, kid, {
      amountPence: kid.weeklyAllowancePence,
      type: 'allowance',
      description: 'Weekly allowance',
      date: day,
    });
    save(data);
    return { transaction, kid: { ...kid } };
  }

  function createTransaction(kidId, { type, amountPence, description, date }) {
    const data = load();
    const kid = findKid(data, kidId);
    let signed = requireIntegerPence(amountPence, 'Amount');
    if (type === 'spend') {
      if (signed <= 0) {
        throw new StoreError('Spend amount must be a positive number of pence');
      }
      signed = -signed;
    } else if (type === 'adjustment' || type === 'allowance') {
      // adjustment may be credit or debit; allowance should be positive
      if (type === 'allowance' && signed < 0) {
        throw new StoreError('Allowance amount cannot be negative');
      }
    } else {
      throw new StoreError('Use the chore endpoint to record a chore payment');
    }
    const transaction = addSignedTransaction(data, kid, {
      amountPence: signed,
      type,
      description,
      date,
    });
    save(data);
    return { transaction, kid: { ...kid } };
  }

  function deleteTransaction(id) {
    const data = load();
    const transaction = findTransaction(data, id);
    const kid = findKid(data, transaction.kidId);
    kid.balancePence -= transaction.amountPence;
    data.transactions = data.transactions.filter((item) => item.id !== id);
    if (transaction.choreLogId) {
      data.choreLogs = data.choreLogs.filter((log) => log.id !== transaction.choreLogId);
    }
    save(data);
    return { kid: { ...kid } };
  }

  function summary() {
    const kids = listKids();
    const totalBalancePence = kids.reduce((sum, kid) => sum + kid.balancePence, 0);
    return { kids, totalBalancePence, childCount: kids.length };
  }

  return {
    filePath: resolved,
    listKids,
    getKid,
    createKid,
    updateKid,
    deleteKid,
    listChores,
    createChore,
    deleteChore,
    completeChore,
    undoChoreLog,
    listTransactions,
    payAllowance,
    createTransaction,
    deleteTransaction,
    summary,
  };
}

module.exports = { createStore, emptyData, StoreError, DEFAULT_FILE };
