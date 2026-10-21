(function (root, factory) {
  const finance = factory();
  if (typeof module === 'object' && module.exports) module.exports = finance;
  else root.VaultFinance = finance;
})(typeof window === 'object' ? window : globalThis, function () {
  const available = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('currency')
    : ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'CHF', 'JPY', 'AUD', 'CNY', 'MXN'];
  const supportedCurrencies = [...new Set(['USD', 'BRL', ...available])];
  const countries = ['US', 'BR', 'Other'];
  const assetCategories = ['US stock', 'Brazil stock', 'ETF', 'FII', 'REIT', 'Bonds', 'Crypto', 'Currency', 'Other'];
  const isCurrency = code => typeof code === 'string' && supportedCurrencies.includes(code);
  const isCountry = code => countries.includes(code);
  const currency = code => isCurrency(code) ? code : 'USD';
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatMoney = (value, code = 'USD') => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency(code)
  }).format(finite(value));
  const currencyOptions = selected => supportedCurrencies.map(code =>
    `<option value="${code}"${code === currency(selected) ? ' selected' : ''}>${code}</option>`).join('');
  const countryOptions = selected => countries.map(code =>
    `<option value="${code}"${code === (isCountry(selected) ? selected : 'US') ? ' selected' : ''}>${({US:'United States',BR:'Brazil',Other:'Other markets'})[code]}</option>`).join('');
  function grouped(records, selector = record => record.amount) {
    return records.reduce((result, record) => {
      const code = currency(record.currency);
      result[code] = finite(result[code]) + finite(selector(record));
      return result;
    }, {});
  }
  function formatTotals(totals, empty = '—') {
    const codes = Object.keys(totals).filter(isCurrency).sort((a,b) => supportedCurrencies.indexOf(a) - supportedCurrencies.indexOf(b));
    return codes.length ? codes.map(code => `${formatMoney(totals[code], code)} ${code}`).join('\n') : empty;
  }
  const monthlyAmount = record => finite(record.amount) * (record.cadence === 'weekly' ? 52 / 12 : record.cadence === 'yearly' ? 1 / 12 : 1);
  function localDate() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function returnsByCurrency(investments) {
    const costs = grouped(investments, record => record.cost);
    const values = grouped(investments, record => record.value);
    return Object.keys(costs).map(code => {
      const cost = costs[code];
      if (cost <= 0) return `${code}: —`;
      const change = (values[code] - cost) / cost * 100;
      return `${code}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    }).join('\n') || '—';
  }
  function normalizeData(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const records = name => (Array.isArray(source[name]) ? source[name] : []).filter(record => record && typeof record === 'object' && !Array.isArray(record));
    return {
      ...source,
      accounts: records('accounts').map(record => ({...record, currency: currency(record.currency), country: isCountry(record.country) ? record.country : 'US'})),
      transactions: records('transactions').map(record => ({...record, currency: currency(record.currency)})),
      investments: records('investments').map(record => ({...record, currency: currency(record.currency), country: isCountry(record.country) ? record.country : 'US'})),
      subscriptions: records('subscriptions').map(record => ({...record, currency: currency(record.currency)})),
      dividends: records('dividends').map(record => ({...record, currency: currency(record.currency)}))
    };
  }
  return { supportedCurrencies, countries, assetCategories, isCurrency, isCountry, currency, formatMoney, currencyOptions, countryOptions, grouped, formatTotals, monthlyAmount, localDate, returnsByCurrency, normalizeData };
});
