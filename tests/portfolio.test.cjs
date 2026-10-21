const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname,'..');
function boot(seed = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'), {url:'https://vaultfolio.example/',runScripts:'outside-only'});
  const {window} = dom;
  window.scrollTo = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.localStorage.setItem('vaultfolio-v1',JSON.stringify(seed));
  for(const file of ['finance.js','app.js','assistant.js']) window.eval(fs.readFileSync(path.join(root,file),'utf8'));
  const document = window.document;
  return {window,document,close:()=>window.close(), records:()=>JSON.parse(window.localStorage.getItem('vaultfolio-v1')), set:(name,value)=>{document.querySelector(`#entryForm [name="${name}"]`).value=value;}, save:()=>document.querySelector('#formSubmit').click()};
}

test('overview and investment totals never mix US dollars with Brazilian reais',()=>{
  const app=boot({accounts:[{id:'usd',name:'US checking',balance:100,currency:'USD'},{id:'brl',name:'Brazil savings',balance:500,currency:'BRL'}],investments:[{id:'fii',name:'Brazil holding',cost:200,value:220,currency:'BRL'}]});
  try {
    assert.match(app.document.querySelector('#totalTracked').textContent,/100\.00 USD/);
    assert.match(app.document.querySelector('#totalTracked').textContent,/720\.00 BRL/);
    assert.doesNotMatch(app.document.querySelector('#totalTracked').textContent,/820/);
    assert.match(app.document.querySelector('#investmentReturn').textContent,/BRL: \+10\.0%/);
  } finally {app.close();}
});

test('a Brazilian account saves its own country and currency',()=>{
  const app=boot();
  try {
    app.document.querySelector('[data-action="open-account"]').click();
    app.set('name','Brazil savings'); app.set('country','BR'); app.set('currency','BRL'); app.set('balance','345.67'); app.save();
    const record=app.records().accounts[0];
    assert.equal(record.country,'BR'); assert.equal(record.currency,'BRL'); assert.equal(record.balance,345.67);
    assert.match(app.document.querySelector('#totalTracked').textContent,/345\.67 BRL/);
  } finally {app.close();}
});

test('dividend status changes preserve currency and do not credit cash twice',()=>{
  const app=boot({accounts:[{id:'bank',name:'Cash',balance:100,currency:'BRL'}],investments:[{id:'fii',name:'FII holding',ticker:'EXAMPLE11',category:'FII',cost:500,value:550,currency:'BRL',country:'BR'}]});
  try {
    app.document.querySelector('[data-action="open-dividend"]').click();
    app.set('investmentId','fii'); app.set('amount','15'); app.set('date','2026-10-21'); app.set('status','scheduled'); app.save();
    const dividend=app.records().dividends[0];
    assert.equal(dividend.currency,'BRL'); assert.equal(dividend.status,'scheduled');
    assert.match(app.document.querySelector('#dividendScheduled').textContent,/15\.00 BRL/);
    app.document.querySelector('[data-dividend-received]').click();
    assert.equal(app.records().dividends[0].status,'received');
    assert.match(app.document.querySelector('#dividendReceived').textContent,/15\.00 BRL/);
    assert.equal(app.records().accounts[0].balance,100);
    assert.equal(app.records().transactions.length,0);
  } finally {app.close();}
});

test('new BRL QR records retain currency and reject invented codes',()=>{
  for(const code of ['BRL','INVALID']) {
    const app=boot();
    try {
      app.document.querySelector('[data-action="open-qr-import"]').click();
      app.document.querySelector('#importPayload').value='VF1|'+encodeURIComponent(JSON.stringify({kind:'account',record:{name:'Imported',balance:40,currency:code,country:'BR'}}));
      app.document.querySelector('#importPayloadButton').click();
      if(code==='BRL') assert.equal(app.records().accounts[0].currency,'BRL');
      else assert.equal(app.records().accounts?.length||0,0);
    } finally {app.close();}
  }
});

test('assistant describes dividend income by currency without aggregating it',()=>{
  const app=boot({dividends:[{id:'d1',amount:10,currency:'USD',date:'2026-10-21',status:'received'},{id:'d2',amount:30,currency:'BRL',date:'2026-10-21',status:'received'}]});
  try {
    app.document.querySelector('[data-assistant-open]').click();
    app.document.querySelector('[data-assistant-prompt="How much dividend income have I received?"]').click();
    const text=app.document.querySelector('#assistantMessages').textContent;
    assert.match(text,/10\.00 USD/); assert.match(text,/30\.00 BRL/); assert.doesNotMatch(text,/40\.00/);
  } finally {app.close();}
});

test('movements inherit their account currency',()=>{
  const app=boot({accounts:[{id:'bank',name:'Brazil savings',balance:100,currency:'BRL',country:'BR'}]});
  try {
    app.document.querySelector('[data-action="open-transaction"]').click();
    app.set('kind','expense'); app.set('description','Recorded expense'); app.set('amount','15'); app.set('accountId','bank'); app.set('date','2026-10-21'); app.save();
    assert.equal(app.records().accounts[0].balance,85);
    assert.equal(app.records().transactions[0].currency,'BRL');
  } finally {app.close();}
});

test('removing a holding preserves its historical dividend records',()=>{
  const app=boot({investments:[{id:'fii',name:'FII holding',value:200,cost:180,currency:'BRL'}],dividends:[{id:'income',investmentId:'fii',holdingName:'FII holding',amount:10,date:'2026-10-21',currency:'BRL',status:'received'}]});
  try {
    app.document.querySelector('[data-delete="investment:fii"]').click();
    assert.equal(app.records().investments.length,0);
    assert.equal(app.records().dividends.length,1);
    assert.match(app.document.querySelector('#dividendsList').textContent,/FII holding/);
    assert.match(app.document.querySelector('#dividendReceived').textContent,/10\.00 BRL/);
  } finally {app.close();}
});
