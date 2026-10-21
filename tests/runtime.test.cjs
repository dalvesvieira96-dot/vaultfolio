const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const financeScript = fs.readFileSync(path.join(root, 'finance.js'), 'utf8');

function startApp() {
  const dom = new JSDOM(html, { url: 'https://vaultfolio.example/', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  window.eval(financeScript);
  window.eval(script);
  return {
    window,
    document: window.document,
    records: () => JSON.parse(window.localStorage.getItem('vaultfolio-v1') || '{"accounts":[]}'),
    close: () => window.close()
  };
}

for (const selector of ['.icon-button', '.button-quiet']) {
  test(`entry dialog ${selector} closes an empty form without saving`, () => {
    const app = startApp();
    try {
      app.document.querySelector('[data-action="open-account"]').click();
      const dialog = app.document.querySelector('#entryDialog');
      dialog.querySelector(selector).click();
      assert.equal(dialog.open, false);
      assert.equal(app.records().accounts.length, 0);
    } finally { app.close(); }
  });

  test(`entry dialog ${selector} discards a completed form`, () => {
    const app = startApp();
    try {
      app.document.querySelector('[data-action="open-account"]').click();
      const dialog = app.document.querySelector('#entryDialog');
      dialog.querySelector('[name="name"]').value = 'Discard me';
      dialog.querySelector('[name="balance"]').value = '120.25';
      dialog.querySelector(selector).click();
      assert.equal(dialog.open, false);
      assert.equal(app.records().accounts.length, 0);
    } finally { app.close(); }
  });
}

test('Save still creates a valid account', () => {
  const app = startApp();
  try {
    app.document.querySelector('[data-action="open-account"]').click();
    app.document.querySelector('[name="name"]').value = 'Checking';
    app.document.querySelector('[name="balance"]').value = '120.25';
    app.document.querySelector('#formSubmit').click();
    assert.equal(app.records().accounts.length, 1);
    assert.equal(app.records().accounts[0].balance, 120.25);
    assert.equal(app.document.querySelector('#entryDialog').open, false);
  } finally { app.close(); }
});

function importRecord(app, record) {
  app.document.querySelector('[data-action="open-qr-import"]').click();
  app.document.querySelector('#importPayload').value = 'VF1|' + encodeURIComponent(JSON.stringify({ kind: 'account', record }));
  app.document.querySelector('#importPayloadButton').click();
}

test('QR import keeps only account fields and generates a fresh identifier', () => {
  const app = startApp();
  try {
    importRecord(app, { name: 'Imported account', institution: 'Example bank', type: 'Savings', balance: 40.75, id: '"><img src=x onerror=alert(1)>', extra: 'discard' });
    const [record] = app.records().accounts;
    assert.match(record.id, /^[0-9a-f-]{36}$/i);
    assert.deepEqual(Object.keys(record).sort(), ['balance', 'country', 'currency', 'id', 'institution', 'name', 'type']);
    assert.equal(record.name, 'Imported account');
    assert.equal(record.balance, 40.75);
    assert.equal(app.document.querySelector('#accountsList img'), null);
  } finally { app.close(); }
});

for (const record of [
  { name: { bad: 'type' }, type: 'Savings', balance: 10 },
  { name: ' ', type: 'Savings', balance: 10 },
  { name: 'Bad institution', institution: {}, type: 'Savings', balance: 10 },
  { name: 'Bad type', type: [], balance: 10 },
  { name: 'Bad balance', type: 'Savings', balance: 'not a number' },
  { name: 'Infinite balance', type: 'Savings', balance: 'Infinity' }
]) {
  test(`QR import rejects invalid account data: ${JSON.stringify(record)}`, () => {
    const app = startApp();
    try {
      importRecord(app, record);
      assert.equal(app.records().accounts.length, 0);
      assert.equal(app.document.querySelector('#qrDialog').open, true);
    } finally { app.close(); }
  });
}
