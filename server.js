'use strict';

const path = require('path');
const express = require('express');
const { createStore, StoreError } = require('./lib/store');

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new StoreError('Invalid id', 400);
    throw error;
  }
  return id;
}

function handleError(res, error) {
  if (error instanceof StoreError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong' });
}

function createApp(options = {}) {
  const store = options.store || createStore(options.dataFile);
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/summary', (req, res) => {
    try {
      res.json(store.summary());
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get('/api/kids', (req, res) => {
    try {
      res.json(store.listKids());
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/kids', (req, res) => {
    try {
      const kid = store.createKid({
        name: req.body.name,
        age: req.body.age,
        weeklyAllowancePence: req.body.weeklyAllowancePence,
      });
      res.status(201).json(kid);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get('/api/kids/:id', (req, res) => {
    try {
      res.json(store.getKid(parseId(req.params.id)));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.patch('/api/kids/:id', (req, res) => {
    try {
      const kid = store.updateKid(parseId(req.params.id), {
        name: req.body.name,
        age: req.body.age,
        weeklyAllowancePence: req.body.weeklyAllowancePence,
      });
      res.json(kid);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete('/api/kids/:id', (req, res) => {
    try {
      store.deleteKid(parseId(req.params.id));
      res.status(204).end();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/kids/:id/chores', (req, res) => {
    try {
      const chore = store.createChore(parseId(req.params.id), {
        name: req.body.name,
        valuePence: req.body.valuePence,
      });
      res.status(201).json(chore);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete('/api/chores/:id', (req, res) => {
    try {
      store.deleteChore(parseId(req.params.id));
      res.status(204).end();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/chores/:id/complete', (req, res) => {
    try {
      const result = store.completeChore(parseId(req.params.id), req.body.date);
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete('/api/chore-logs/:id', (req, res) => {
    try {
      store.undoChoreLog(parseId(req.params.id));
      res.status(204).end();
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/kids/:id/allowance', (req, res) => {
    try {
      const result = store.payAllowance(parseId(req.params.id), req.body.date);
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.get('/api/kids/:id/transactions', (req, res) => {
    try {
      res.json(store.listTransactions(parseId(req.params.id)));
    } catch (error) {
      handleError(res, error);
    }
  });

  app.post('/api/kids/:id/transactions', (req, res) => {
    try {
      const result = store.createTransaction(parseId(req.params.id), {
        type: req.body.type,
        amountPence: req.body.amountPence,
        description: req.body.description,
        date: req.body.date,
      });
      res.status(201).json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.delete('/api/transactions/:id', (req, res) => {
    try {
      const result = store.deleteTransaction(parseId(req.params.id));
      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(port, () => {
    console.log(`Pocket Money Tracker listening on http://localhost:${port}`);
  });
}

module.exports = { createApp };
