# Pocket Money Tracker

A small Node.js and Express app for tracking children's pocket money, chores, and spending. Data is stored in a local JSON file, so no database is required.

## Features

- Add, update, and remove children
- Set a weekly allowance for each child (defaults to £1 per year of age)
- Track a running balance in pounds and pence
- Assign chores with a reward amount
- Mark a chore as done (once per day) and credit the child's balance
- Pay weekly allowance
- Record spending and manual adjustments
- Prevent a spend that would take a balance below zero
- View and remove items from a child's transaction history

The starter data in `data/db.json` is a made-up family used only as an example.

## Setup

Requires Node.js 18 or later.

```bash
npm install
```

## Run

```bash
npm start
```

The app listens on port 3000, or the port set in the `PORT` environment variable. Open [http://localhost:3000](http://localhost:3000) in a browser.

To use a different data file:

```bash
DATA_FILE=/tmp/pocket-money.json npm start
```

## Test

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) and do not need any extra packages.

## Project structure

```
server.js          Express app and HTTP API
lib/store.js       JSON file data store
lib/money.js       Pounds and pence helpers
data/db.json       Starter data
public/            Homepage, styles, and browser JavaScript
test/              node:test suites
```

Amounts are stored as integer pence and shown as pounds in the interface.

## Licence

MIT. See `LICENSE`.
