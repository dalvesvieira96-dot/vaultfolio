const key = 'vaultfolio-v1';
const finance = window.VaultFinance;
const initial = {accounts:[],transactions:[],investments:[],subscriptions:[],dividends:[]};
const restoreData = () => {
  try { return finance.normalizeData(JSON.parse(localStorage.getItem(key) || 'null') || initial); }
  catch { return finance.normalizeData(initial); }
};
let data = restoreData();
let currentForm = null;
let stream = null;
let scanTimer = null;
const $ = (selector) => document.querySelector(selector);
const money = (amount, currency = 'USD') => finance.formatMoney(amount, currency);
const uid = () => crypto.randomUUID();
const save = () => { localStorage.setItem(key, JSON.stringify(data)); render(); };
const esc = (value = '') => String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const toast = (message) => { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2800); };
const empty = (text) => `<p class="empty">${esc(text)}</p>`;
const totals = (records, select) => finance.formatTotals(finance.grouped(records, select));
const countryLabel = (country) => ({US:'United States',BR:'Brazil',Other:'Other market'}[country] || 'United States');

function render() {
  const subscriptions = data.subscriptions.filter(record => record.active !== false);
  const position = [...data.accounts.map(record => ({...record, amount:record.balance})), ...data.investments.map(record => ({...record, amount:record.value}))];
  const monthly = finance.grouped(subscriptions, finance.monthlyAmount);
  $('#totalTracked').textContent = totals(position);
  $('#positionNote').textContent = data.accounts.length || data.investments.length
    ? `${data.accounts.length} account${data.accounts.length === 1 ? '' : 's'} and ${data.investments.length} investment${data.investments.length === 1 ? '' : 's'} tracked by currency.`
    : 'Add your first account to begin.';
  $('#accountCount').textContent = data.accounts.length;
  $('#investmentCount').textContent = data.investments.length;
  $('#subscriptionCount').textContent = subscriptions.length;
  $('#dashboardAccounts').innerHTML = data.accounts.length ? data.accounts.slice(0,4).map(account => `
    <div class="list-row"><div><b>${esc(account.name)}</b><small>${esc(account.institution || account.type)} · ${esc(countryLabel(account.country))}</small></div><span class="amount">${esc(money(account.balance, account.currency))}</span></div>`).join('') : empty('No accounts yet. Add the balances you want to see.');
  const next = [...subscriptions].sort((a,b) => String(a.renewal).localeCompare(String(b.renewal)))[0];
  $('#dashboardSubscriptions').innerHTML = next ? `
    <div class="list-row"><div><b>${esc(next.name)}</b><small>Renews ${esc(prettyDate(next.renewal))} · ${esc(next.cadence)}</small></div><span class="amount">${esc(money(next.amount, next.currency))}</span></div>
    ${subscriptions.length > 1 ? `<p class="quiet">${subscriptions.length - 1} other active service${subscriptions.length === 2 ? '' : 's'}.</p>` : ''}` : empty('No recurring charges saved.');
  $('#accountsList').innerHTML = data.accounts.length ? data.accounts.map(account => `
    <article class="account-card"><span class="type">${esc(account.type)} · ${esc(account.currency)}</span><h3>${esc(account.name)}</h3><p class="quiet">${account.institution ? `${esc(account.institution)} · ` : ''}${esc(countryLabel(account.country))}</p><strong>${esc(money(account.balance, account.currency))}</strong><div class="card-actions"><button class="mini-button" data-qr="${esc(account.id)}">QR share</button><button class="mini-button danger" data-delete="account:${esc(account.id)}">Remove</button></div></article>`).join('') : empty('Create an account record, then use QR share to take it with you.');
  $('#transactionsList').innerHTML = data.transactions.length ? [...data.transactions].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,8).map(transaction => `
    <div class="list-row"><div><b>${esc(transaction.description)}</b><small>${esc(accountName(transaction.accountId))} · ${esc(prettyDate(transaction.date))}</small></div><span class="amount">${transaction.kind === 'expense' ? '−' : '+'}${esc(money(transaction.amount, transaction.currency))}</span></div>`).join('') : empty('Record an income or expense here.');
  $('#investedTotal').textContent = totals(data.investments, record => record.cost);
  $('#investmentValue').textContent = totals(data.investments, record => record.value);
  $('#investmentReturn').textContent = finance.returnsByCurrency(data.investments);
  $('#investmentsList').innerHTML = data.investments.length ? data.investments.map(investment => `
    <article class="holding"><div><h3>${esc(investment.name)}${investment.ticker ? ` <span class="type">${esc(investment.ticker)}</span>` : ''}</h3><small>${esc(investment.category)} · ${esc(countryLabel(investment.country))} · ${esc(investment.currency)}${investment.quantity !== '' && investment.quantity !== undefined ? ` · ${esc(investment.quantity)} units` : ''}${investment.note ? ` · ${esc(investment.note)}` : ''}</small></div><div><small>Cost basis</small><span class="value">${esc(money(investment.cost, investment.currency))}</span></div><div><small>Current value</small><span class="value">${esc(money(investment.value, investment.currency))}</span></div><button class="mini-button danger" data-delete="investment:${esc(investment.id)}">Remove</button></article>`).join('') : empty('Add a US or Brazilian holding, currency balance, or another investment.');
  $('#monthlySubscriptions').textContent = finance.formatTotals(monthly);
  $('#yearlySubscriptions').textContent = finance.formatTotals(Object.fromEntries(Object.entries(monthly).map(([currency, amount]) => [currency, amount * 12])));
  $('#activeSubscriptions').textContent = subscriptions.length;
  $('#subscriptionsList').innerHTML = subscriptions.length ? [...subscriptions].sort((a,b) => String(a.renewal).localeCompare(String(b.renewal))).map(subscription => `
    <article class="subscription"><div><h3>${esc(subscription.name)}</h3><small>Renews ${esc(prettyDate(subscription.renewal))} · ${esc(subscription.cadence)}</small></div><div><small>Charge</small><span class="value">${esc(money(subscription.amount, subscription.currency))}</span></div><div><small>Payment account</small><span class="value">${esc(accountName(subscription.accountId) || 'Not set')}</span></div><button class="mini-button danger" data-delete="subscription:${esc(subscription.id)}">Remove</button></article>`).join('') : empty('No subscriptions saved.');
  renderDividends();
}

function renderDividends() {
  const received = data.dividends.filter(record => record.status === 'received');
  const scheduled = data.dividends.filter(record => record.status === 'scheduled');
  $('#dividendReceived').textContent = totals(received);
  $('#dividendScheduled').textContent = totals(scheduled);
  $('#dividendCount').textContent = data.dividends.length;
  $('#dividendsList').innerHTML = data.dividends.length ? [...data.dividends].sort((a,b) => String(b.date).localeCompare(String(a.date))).map(dividend => {
    const holding = data.investments.find(record => record.id === dividend.investmentId);
    return `<article class="list-row dividend-row"><div><b>${esc(holding?.name || dividend.holdingName || 'Removed holding')}${dividend.ticker ? ` · ${esc(dividend.ticker)}` : ''}</b><small>${esc(prettyDate(dividend.date))} · ${esc(dividend.status === 'scheduled' ? 'Scheduled' : 'Received')}</small></div><span class="amount">${esc(money(dividend.amount, dividend.currency))}</span><div class="dividend-actions">${dividend.status === 'scheduled' ? `<button class="mini-button" data-dividend-received="${esc(dividend.id)}">Mark received</button>` : ''}<button class="mini-button danger" data-delete="dividend:${esc(dividend.id)}">Remove</button></div></article>`;
  }).join('') : empty('Record received or scheduled dividends from your holdings.');
}

function accountName(id) { return data.accounts.find(record => record.id === id)?.name || ''; }
function prettyDate(value) {
  if (!value) return 'date not set';
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date) : 'date not set';
}
function accountOptions() {
  return data.accounts.map(account => `<option value="${esc(account.id)}">${esc(account.name)} · ${esc(account.currency)}</option>`).join('') || '<option value="" disabled>No accounts yet</option>';
}
function investmentOptions() {
  return data.investments.map(investment => `<option value="${esc(investment.id)}">${esc(investment.name)}${investment.ticker ? ` (${esc(investment.ticker)})` : ''} · ${esc(investment.currency)}</option>`).join('');
}
function marketFields() {
  return `<div class="two-fields"><div class="field"><label for="record-country">MARKET / COUNTRY</label><select id="record-country" name="country">${finance.countryOptions('US')}</select></div><div class="field"><label for="record-currency">CURRENCY</label><select id="record-currency" name="currency">${finance.currencyOptions('USD')}</select></div></div>`;
}
function openForm(type) {
  currentForm = type;
  const today = finance.localDate();
  const config = {
    account:{eyebrow:'NEW ACCOUNT',title:'Add account',submit:'Save account',fields:`<div class="field"><label for="record-name">ACCOUNT NAME</label><input id="record-name" name="name" required placeholder="e.g. Everyday checking" /></div><div class="two-fields"><div class="field"><label for="account-institution">INSTITUTION</label><input id="account-institution" name="institution" placeholder="e.g. Chase or Itaú" /></div><div class="field"><label for="account-type">TYPE</label><select id="account-type" name="type"><option>Checking</option><option>Savings</option><option>Credit card</option><option>Cash</option><option>Other</option></select></div></div>${marketFields()}<div class="field"><label for="account-balance">CURRENT BALANCE</label><input id="account-balance" name="balance" required type="number" step="0.01" placeholder="0.00" /></div>`},
    transaction:{eyebrow:'NEW MOVEMENT',title:'Record movement',submit:'Save movement',fields:`<div class="two-fields"><div class="field"><label for="movement-kind">TYPE</label><select id="movement-kind" name="kind"><option value="income">Income</option><option value="expense">Expense</option></select></div><div class="field"><label for="movement-date">DATE</label><input id="movement-date" name="date" required type="date" value="${today}" /></div></div><div class="field"><label for="movement-description">DESCRIPTION</label><input id="movement-description" name="description" required placeholder="e.g. Grocery run" /></div><div class="two-fields"><div class="field"><label for="movement-amount">AMOUNT</label><input id="movement-amount" name="amount" required type="number" min="0.01" step="0.01" /></div><div class="field"><label for="movement-account">ACCOUNT / CURRENCY</label><select id="movement-account" name="accountId" required>${accountOptions()}</select></div></div>`},
    investment:{eyebrow:'NEW INVESTMENT',title:'Add investment',submit:'Save investment',fields:`<div class="field"><label for="record-name">NAME</label><input id="record-name" name="name" required placeholder="e.g. Dividend ETF or FII" /></div><div class="two-fields"><div class="field"><label for="holding-ticker">TICKER (OPTIONAL)</label><input id="holding-ticker" name="ticker" placeholder="e.g. SCHD, HGLG11, BTC" maxlength="30" /></div><div class="field"><label for="holding-category">CATEGORY</label><select id="holding-category" name="category">${finance.assetCategories.map(category => `<option>${esc(category)}</option>`).join('')}</select></div></div>${marketFields()}<div class="two-fields"><div class="field"><label for="holding-cost">COST BASIS</label><input id="holding-cost" name="cost" required type="number" min="0" step="0.01" /></div><div class="field"><label for="holding-value">CURRENT VALUE</label><input id="holding-value" name="value" required type="number" min="0" step="0.01" /></div></div><div class="two-fields"><div class="field"><label for="holding-quantity">QUANTITY (OPTIONAL)</label><input id="holding-quantity" name="quantity" type="number" min="0" step="any" placeholder="Units or currency amount" /></div><div class="field"><label for="holding-note">NOTE (OPTIONAL)</label><input id="holding-note" name="note" placeholder="Brokerage or goal" /></div></div>`},
    subscription:{eyebrow:'NEW SUBSCRIPTION',title:'Add subscription',submit:'Save subscription',fields:`<div class="field"><label for="record-name">SERVICE</label><input id="record-name" name="name" required placeholder="e.g. Netflix" /></div><div class="two-fields"><div class="field"><label for="subscription-amount">CHARGE</label><input id="subscription-amount" name="amount" required type="number" min="0.01" step="0.01" /></div><div class="field"><label for="subscription-currency">CURRENCY</label><select id="subscription-currency" name="currency">${finance.currencyOptions('USD')}</select></div></div><div class="two-fields"><div class="field"><label for="subscription-cadence">CADENCE</label><select id="subscription-cadence" name="cadence"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="weekly">Weekly</option></select></div><div class="field"><label for="subscription-renewal">NEXT RENEWAL</label><input id="subscription-renewal" name="renewal" required type="date" value="${today}" /></div></div><div class="field"><label for="subscription-account">PAYMENT ACCOUNT</label><select id="subscription-account" name="accountId"><option value="">Not set</option>${accountOptions()}</select></div>`},
    dividend:{eyebrow:'DIVIDEND INCOME',title:'Record a dividend',submit:'Save dividend',fields:`<div class="field"><label for="dividend-investment">HOLDING / CURRENCY</label><select id="dividend-investment" name="investmentId" required>${investmentOptions()}</select></div><div class="two-fields"><div class="field"><label for="dividend-amount">AMOUNT</label><input id="dividend-amount" name="amount" required type="number" min="0.01" step="0.01" /></div><div class="field"><label for="dividend-date">PAYMENT DATE</label><input id="dividend-date" name="date" required type="date" value="${today}" /></div></div><div class="field"><label for="dividend-status">STATUS</label><select id="dividend-status" name="status"><option value="received">Received</option><option value="scheduled">Scheduled</option></select></div>`}
  }[type];
  if (!config) return;
  $('#dialogEyebrow').textContent = config.eyebrow;
  $('#dialogTitle').textContent = config.title;
  $('#formFields').innerHTML = config.fields;
  $('#formSubmit').textContent = config.submit;
  $('#entryDialog').showModal();
}

function submitForm(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const validNumber = (value, minimum = -Infinity) => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= minimum;
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(new Date(`${value}T12:00:00`).getTime());
  const fail = () => { toast('Check the required fields and amounts.'); return false; };
  if (['account','investment','subscription'].includes(currentForm) && (!values.name?.trim() || !finance.isCurrency(values.currency))) return fail();
  if (['account','investment'].includes(currentForm) && !finance.isCountry(values.country)) return fail();
  if (currentForm === 'account') {
    if (!validNumber(values.balance)) return fail();
    data.accounts.push({id:uid(),name:values.name.trim(),institution:values.institution.trim(),type:values.type,country:values.country,currency:values.currency,balance:Number(values.balance)});
  } else if (currentForm === 'investment') {
    if (!validNumber(values.cost,0) || !validNumber(values.value,0) || (values.quantity !== '' && !validNumber(values.quantity,0)) || !finance.assetCategories.includes(values.category)) return fail();
    data.investments.push({id:uid(),name:values.name.trim(),ticker:values.ticker.trim().toUpperCase(),category:values.category,country:values.country,currency:values.currency,cost:Number(values.cost),value:Number(values.value),quantity:values.quantity === '' ? '' : Number(values.quantity),note:values.note.trim()});
  } else if (currentForm === 'subscription') {
    if (!validNumber(values.amount,0.01) || !validDate(values.renewal) || !['monthly','yearly','weekly'].includes(values.cadence) || (values.accountId && !data.accounts.some(account => account.id === values.accountId))) return fail();
    data.subscriptions.push({id:uid(),name:values.name.trim(),amount:Number(values.amount),currency:values.currency,cadence:values.cadence,renewal:values.renewal,accountId:values.accountId,active:true});
  } else if (currentForm === 'transaction') {
    const account = data.accounts.find(record => record.id === values.accountId);
    if (!account || !values.description?.trim() || !validNumber(values.amount,0.01) || !validDate(values.date) || !['income','expense'].includes(values.kind)) return fail();
    const amount = Number(values.amount);
    data.transactions.push({id:uid(),accountId:account.id,currency:account.currency,kind:values.kind,date:values.date,description:values.description.trim(),amount});
    account.balance = Number(account.balance) + (values.kind === 'expense' ? -amount : amount);
  } else if (currentForm === 'dividend') {
    const investment = data.investments.find(record => record.id === values.investmentId);
    if (!investment || !validNumber(values.amount,0.01) || !validDate(values.date) || !['received','scheduled'].includes(values.status)) return fail();
    data.dividends.push({id:uid(),investmentId:investment.id,holdingName:investment.name,ticker:investment.ticker || '',currency:investment.currency,amount:Number(values.amount),date:values.date,status:values.status});
  } else return false;
  save();
  toast('Saved to this device.');
  return true;
}

function showQr(account) {
  if (!account) { toast('That account is no longer available.'); return; }
  const payload = 'VF1|' + encodeURIComponent(JSON.stringify({kind:'account',record:{name:account.name,institution:account.institution,type:account.type,balance:Number(account.balance),currency:account.currency,country:account.country}}));
  $('#qrEyebrow').textContent = 'ACCOUNT QR';
  $('#qrTitle').textContent = `Share ${account.name}`;
  $('#qrContent').innerHTML = `<div class="qr-wrap"><div id="qrcode"></div></div><p class="qr-help">This code shares the account label, type, institution, balance, currency and country. It never contains bank credentials or a card number.</p><div class="field"><label>QR PAYLOAD (BACKUP)</label><textarea class="qr-input" readonly>${esc(payload)}</textarea></div>`;
  $('#qrDialog').showModal();
  const draw = (attempt = 0) => {
    const target = $('#qrcode');
    if (window.QRCode && target) new window.QRCode(target,{text:payload,width:210,height:210,colorDark:'#06231c',colorLight:'#f6f1e7',correctLevel:window.QRCode.CorrectLevel.M});
    else if (attempt < 10) setTimeout(() => draw(attempt + 1),150);
    else if (target) target.textContent = 'QR generator unavailable. Use the payload below instead.';
  };
  draw();
}
function showImporter() {
  stopCamera();
  $('#qrEyebrow').textContent = 'QR IMPORT';
  $('#qrTitle').textContent = 'Bring in an account';
  $('#qrContent').innerHTML = `<p class="qr-help">Scan a Vaultfolio account QR, or paste its payload. Your camera is only used by your browser while this dialog is open.</p><video id="scanVideo" class="scan-video" playsinline muted></video><div class="scan-actions"><button class="button button-ink" type="button" id="startCamera">Use camera</button><span class="quiet" id="scanStatus">Camera off</span></div><div class="field"><label for="importPayload">PASTE QR PAYLOAD</label><textarea id="importPayload" class="qr-input" placeholder="VF1|..."></textarea></div><button class="button button-gold" type="button" id="importPayloadButton">Import account</button>`;
  $('#qrDialog').showModal();
  $('#startCamera').onclick = startCamera;
  $('#importPayloadButton').onclick = () => importPayload($('#importPayload').value);
}
async function startCamera() {
  if (!('BarcodeDetector' in window)) { $('#scanStatus').textContent = 'Camera QR scanning is not supported here. Paste the payload instead.'; return; }
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const video = $('#scanVideo');
    if (!video || !$('#qrDialog').open) { stopCamera(); return; }
    video.srcObject = stream;
    await video.play();
    const detector = new BarcodeDetector({formats:['qr_code']});
    $('#scanStatus').textContent = 'Point the camera at a Vaultfolio QR.';
    scanTimer = setInterval(async () => { try { const found = await detector.detect(video); if (found[0]) importPayload(found[0].rawValue); } catch {} },650);
  } catch { stopCamera(); if ($('#scanStatus')) $('#scanStatus').textContent = 'Camera unavailable. Paste the payload instead.'; }
}
function stopCamera() {
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
}
function importPayload(raw) {
  try {
    if (typeof raw !== 'string' || !raw.startsWith('VF1|')) throw Error();
    const parsed = JSON.parse(decodeURIComponent(raw.slice(4)));
    const record = parsed?.record;
    if (parsed?.kind !== 'account' || !record || Array.isArray(record) || typeof record.name !== 'string' || !record.name.trim()) throw Error();
    if (record.institution !== undefined && typeof record.institution !== 'string') throw Error();
    if (record.type !== undefined && typeof record.type !== 'string') throw Error();
    if (!['number','string'].includes(typeof record.balance) || (typeof record.balance === 'string' && !record.balance.trim())) throw Error();
    if (record.currency !== undefined && !finance.isCurrency(record.currency)) throw Error();
    if (record.country !== undefined && !finance.isCountry(record.country)) throw Error();
    const balance = Number(record.balance);
    if (!Number.isFinite(balance)) throw Error();
    data.accounts.push({id:uid(),name:record.name.trim(),institution:record.institution || '',type:record.type?.trim() || 'Other',balance,currency:finance.currency(record.currency),country:record.country || 'US'});
    save();
    stopCamera();
    $('#qrDialog').close();
    toast('Account imported.');
  } catch { toast('This is not a valid Vaultfolio account QR.'); }
}
function remove(item) {
  const separator = item.indexOf(':');
  const type = item.slice(0,separator), id = item.slice(separator + 1);
  const collection = {account:'accounts',investment:'investments',subscription:'subscriptions',dividend:'dividends'}[type];
  if (!collection || !id) return;
  data[collection] = data[collection].filter(record => record.id !== id);
  if (type === 'account') {
    data.transactions = data.transactions.filter(record => record.accountId !== id);
    data.subscriptions.forEach(record => { if (record.accountId === id) record.accountId = ''; });
  }
  save();
  toast('Record removed.');
}
document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'open-account') openForm('account');
  if (action === 'open-transaction') data.accounts.length ? openForm('transaction') : toast('Add an account first.');
  if (action === 'open-investment') openForm('investment');
  if (action === 'open-subscription') openForm('subscription');
  if (action === 'open-dividend') data.investments.length ? openForm('dividend') : toast('Add a holding before recording a dividend.');
  if (action === 'open-qr-import') showImporter();
  const page = event.target.closest('[data-page]')?.dataset.page || event.target.closest('[data-page-jump]')?.dataset.pageJump;
  const titles = {dashboard:['YOUR POSITION','Good financial mornings.'],accounts:['ACCOUNTS','All balances, one clear view.'],investments:['INVESTMENTS','Your holdings, across markets.'],subscriptions:['SUBSCRIPTIONS','Every recurring charge, in one place.'],manual:['MANUAL & PRIVACY','How Vaultfolio works.']};
  if (page && titles[page]) {
    document.querySelectorAll('.page').forEach(element => element.classList.toggle('active',element.id === page));
    document.querySelectorAll('.nav-link').forEach(element => element.classList.toggle('active',element.dataset.page === page));
    $('#sectionEyebrow').textContent = titles[page][0];
    $('#pageTitle').textContent = titles[page][1];
    window.scrollTo({top:0,behavior:'smooth'});
  }
  const qr = event.target.closest('[data-qr]')?.dataset.qr;
  if (qr) showQr(data.accounts.find(account => account.id === qr));
  const deleted = event.target.closest('[data-delete]')?.dataset.delete;
  if (deleted) remove(deleted);
  const received = event.target.closest('[data-dividend-received]')?.dataset.dividendReceived;
  if (received) {
    const dividend = data.dividends.find(record => record.id === received);
    if (dividend?.status === 'scheduled') { dividend.status = 'received'; save(); toast('Dividend marked received.'); }
  }
});
$('#entryForm').addEventListener('click', event => { if (event.target.closest('[data-entry-close]')) $('#entryDialog').close(); });
$('#entryForm').addEventListener('submit', event => { event.preventDefault(); if (submitForm(event.currentTarget)) $('#entryDialog').close(); });
$('#qrDialog').addEventListener('close', stopCamera);
render();
