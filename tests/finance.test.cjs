const test = require('node:test');
const assert = require('node:assert/strict');
const finance = require('../finance.js');

test('USD and BRL are grouped separately without implicit currency conversion', () => {
  const result = finance.grouped([{currency:'USD',amount:10},{currency:'BRL',amount:70},{currency:'USD',amount:25}]);
  assert.deepEqual(result, {USD:35,BRL:70});
  assert.match(finance.formatTotals(result), /35\.00 USD\nR\$70\.00 BRL/);
});

test('yearly and weekly subscription estimates reconcile over a year', () => {
  assert.equal(finance.monthlyAmount({amount:120,cadence:'yearly'}),10);
  assert.equal(finance.monthlyAmount({amount:12,cadence:'weekly'}) * 12,624);
});

test('holding returns use independent cost bases for each currency', () => {
  assert.equal(finance.returnsByCurrency([{currency:'USD',cost:100,value:110},{currency:'BRL',cost:200,value:180}]),'USD: +10.0%\nBRL: -10.0%');
});

test('legacy USD records and unknown data are preserved during migration', () => {
  const legacy = {accounts:[{id:'account',name:'Checking',balance:45}],investments:[{id:'holding',name:'Fund',cost:100,value:110}],subscriptions:[{id:'subscription',amount:12}],transactions:[],extra:'retain'};
  const migrated = finance.normalizeData(legacy);
  assert.equal(migrated.accounts[0].currency,'USD');
  assert.equal(migrated.accounts[0].country,'US');
  assert.equal(migrated.accounts[0].balance,45);
  assert.equal(migrated.investments[0].currency,'USD');
  assert.equal(migrated.extra,'retain');
  assert.deepEqual(migrated.dividends,[]);
  assert.equal(legacy.accounts[0].currency,undefined);
});

test('malformed top-level data loads into valid empty collections', () => {
  const result = finance.normalizeData(null);
  for(const name of ['accounts','transactions','investments','subscriptions','dividends']) assert.deepEqual(result[name],[]);
  assert.deepEqual(finance.normalizeData({accounts:[null,3,[],{name:'Valid'}]}).accounts.map(record=>record.name),['Valid']);
});

test('valid currency options support BRL and broader ISO currencies', () => {
  assert.equal(finance.isCurrency('BRL'),true);
  assert.equal(finance.isCurrency('<script>'),false);
  assert.match(finance.currencyOptions('BRL'), /value="BRL" selected/);
  assert.equal(finance.currency('invalid'),'USD');
});
