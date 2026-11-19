'use strict';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const formatPounds = (pence) => {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  return `${sign}£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

const poundsToPence = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const text = String(value).trim().replace(/^£/, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error('Enter an amount with at most two decimal places');
  }
  const negative = text.startsWith('-');
  const [pounds, fraction = ''] = text.replace(/^-/, '').split('.');
  const pence = Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  return negative ? -pence : pence;
};

const api = async (pathname, options = {}) => {
  const response = await fetch(pathname, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }
  return body;
};

const state = { kids: [], selectedId: null, detail: null };

const flash = (message) => {
  const el = document.getElementById('flash');
  el.textContent = message;
  el.classList.toggle('hidden', !message);
};

const renderSummary = (summary) => {
  document.getElementById('child-count').textContent = String(summary.childCount);
  document.getElementById('family-total').textContent = formatPounds(summary.totalBalancePence);
};

const renderKids = () => {
  const root = document.getElementById('kid-list');
  if (!state.kids.length) {
    root.innerHTML = '<p class="muted">No children yet. Add one to get started.</p>';
    return;
  }
  root.innerHTML = state.kids
    .map(
      (kid) => `
      <button type="button" class="kid-card${kid.id === state.selectedId ? ' active' : ''}" data-select="${kid.id}">
        <h3>${escapeHtml(kid.name)}</h3>
        <p class="muted">Age ${kid.age} · Allowance ${formatPounds(kid.weeklyAllowancePence)} / week</p>
        <p class="balance">${formatPounds(kid.balancePence)}</p>
      </button>`
    )
    .join('');
};

const renderDetail = () => {
  const root = document.getElementById('detail');
  const kid = state.detail;
  if (!kid) {
    root.classList.add('hidden');
    root.innerHTML = '';
    return;
  }
  root.classList.remove('hidden');
  const chores = kid.chores
    .map(
      (chore) => `
      <li>
        <span>${escapeHtml(chore.name)} · ${formatPounds(chore.valuePence)}</span>
        <span>
          ${
            chore.doneToday
              ? '<span class="done-tag">Done today</span>'
              : `<button type="button" data-complete="${chore.id}">Mark done</button>`
          }
          <button type="button" class="danger" data-delete-chore="${chore.id}">Remove</button>
        </span>
      </li>`
    )
    .join('') || '<li class="muted">No chores yet.</li>';

  const transactions = kid.transactions
    .map((item) => {
      const cls = item.amountPence < 0 ? 'debit' : 'credit';
      return `<li>
        <span>${escapeHtml(item.date)} · ${escapeHtml(item.description)}</span>
        <span>
          <span class="amount ${cls}">${formatPounds(item.amountPence)}</span>
          <button type="button" class="danger" data-delete-txn="${item.id}">Remove</button>
        </span>
      </li>`;
    })
    .join('') || '<li class="muted">No transactions yet.</li>';

  root.innerHTML = `
    <div class="form-row" style="justify-content:space-between;align-items:center">
      <h2 style="margin:0">${escapeHtml(kid.name)} · ${formatPounds(kid.balancePence)}</h2>
      <button type="button" class="danger" id="remove-child">Remove child</button>
    </div>
    <p class="muted">Age ${kid.age} · Weekly allowance ${formatPounds(kid.weeklyAllowancePence)}</p>

    <form id="edit-child-form" class="form-row">
      <label>Name <input name="name" maxlength="40" required value="${escapeHtml(kid.name)}"></label>
      <label>Age <input name="age" type="number" min="1" max="18" required value="${kid.age}"></label>
      <label>Weekly allowance (£)
        <input name="allowance" type="number" min="0" step="0.01" required value="${(kid.weeklyAllowancePence / 100).toFixed(2)}">
      </label>
      <button type="submit">Save details</button>
      <button type="button" id="pay-allowance">Pay allowance</button>
    </form>

    <h3>Chores</h3>
    <ul class="chore-list">${chores}</ul>
    <form id="add-chore-form" class="form-row">
      <label>Chore <input name="name" maxlength="40" required placeholder="e.g. Tidy bedroom"></label>
      <label>Reward (£) <input name="value" type="number" min="0" step="0.01" value="1.00" required></label>
      <button type="submit">Add chore</button>
    </form>

    <h3>Record a spend or adjustment</h3>
    <form id="add-txn-form" class="form-row">
      <label>Type
        <select name="type">
          <option value="spend">Spend</option>
          <option value="adjustment">Adjustment</option>
        </select>
      </label>
      <label>Amount (£) <input name="amount" type="number" step="0.01" required placeholder="3.00"></label>
      <label>Description <input name="description" maxlength="40" required placeholder="e.g. Comic book"></label>
      <button type="submit">Record</button>
    </form>

    <h3>Transactions</h3>
    <ul class="txn-list">${transactions}</ul>
  `;
};

const loadAll = async () => {
  const summary = await api('/api/summary');
  state.kids = summary.kids;
  renderSummary(summary);
  if (state.selectedId) {
    try {
      state.detail = await api(`/api/kids/${state.selectedId}`);
    } catch (error) {
      state.selectedId = null;
      state.detail = null;
      flash(error.message);
    }
  }
  renderKids();
  renderDetail();
};

document.getElementById('add-child-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    const allowanceValue = form.allowance.value;
    const body = { name: form.name.value, age: Number(form.age.value) };
    if (allowanceValue !== '') {
      body.weeklyAllowancePence = poundsToPence(allowanceValue);
    }
    const kid = await api('/api/kids', { method: 'POST', body: JSON.stringify(body) });
    form.reset();
    form.age.value = 8;
    state.selectedId = kid.id;
    flash('');
    await loadAll();
  } catch (error) {
    flash(error.message);
  }
});

document.getElementById('kid-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-select]');
  if (!button) return;
  state.selectedId = Number(button.dataset.select);
  flash('');
  await loadAll();
});

document.getElementById('detail').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'edit-child-form') {
      await api(`/api/kids/${state.selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.value,
          age: Number(form.age.value),
          weeklyAllowancePence: poundsToPence(form.allowance.value),
        }),
      });
    } else if (form.id === 'add-chore-form') {
      await api(`/api/kids/${state.selectedId}/chores`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.value,
          valuePence: poundsToPence(form.value.value),
        }),
      });
      form.reset();
      form.value.value = '1.00';
    } else if (form.id === 'add-txn-form') {
      await api(`/api/kids/${state.selectedId}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          type: form.type.value,
          amountPence: poundsToPence(form.amount.value),
          description: form.description.value,
        }),
      });
      form.reset();
    }
    flash('');
    await loadAll();
  } catch (error) {
    flash(error.message);
  }
});

document.getElementById('detail').addEventListener('click', async (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  try {
    if (target.id === 'pay-allowance') {
      await api(`/api/kids/${state.selectedId}/allowance`, { method: 'POST', body: '{}' });
    } else if (target.id === 'remove-child') {
      if (!confirm('Remove this child and all of their chores and transactions?')) return;
      await api(`/api/kids/${state.selectedId}`, { method: 'DELETE' });
      state.selectedId = null;
      state.detail = null;
    } else if (target.dataset.complete) {
      await api(`/api/chores/${target.dataset.complete}/complete`, { method: 'POST', body: '{}' });
    } else if (target.dataset.deleteChore) {
      await api(`/api/chores/${target.dataset.deleteChore}`, { method: 'DELETE' });
    } else if (target.dataset.deleteTxn) {
      await api(`/api/transactions/${target.dataset.deleteTxn}`, { method: 'DELETE' });
    } else {
      return;
    }
    flash('');
    await loadAll();
  } catch (error) {
    flash(error.message);
  }
});

loadAll().catch((error) => flash(error.message));
