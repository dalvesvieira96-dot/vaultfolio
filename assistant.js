(() => {
  const finance = window.VaultFinance;
  const $ = selector => document.querySelector(selector);
  const getData = () => {
    try { return finance.normalizeData(JSON.parse(localStorage.getItem('vaultfolio-v1') || '{}')); }
    catch { return finance.normalizeData({}); }
  };
  const totals = (records, selector) => finance.formatTotals(finance.grouped(records, selector), '0 recorded');
  const message = (text, role = 'assistant') => {
    const host = $('#assistantMessages');
    const element = document.createElement('div');
    element.className = `message ${role}`;
    element.textContent = text;
    host.append(element);
  };
  const answer = question => {
    const data = getData();
    const query = question.toLowerCase();
    if (/dividend|provento|rendimento/.test(query)) {
      const received = data.dividends.filter(record => record.status === 'received');
      const scheduled = data.dividends.filter(record => record.status === 'scheduled');
      return `Recorded dividend income: ${totals(received)}. Scheduled entries: ${totals(scheduled)}. Open Dividend income in Investments to record or update a payment. Scheduled amounts are your entries, not guaranteed future income.`;
    }
    if (/subscription|recurring|monthly|spend|assinatura|mensal/.test(query)) {
      const subscriptions = data.subscriptions.filter(record => record.active !== false);
      return subscriptions.length
        ? `Your ${subscriptions.length} active subscription${subscriptions.length === 1 ? '' : 's'} cost an estimated ${totals(subscriptions, finance.monthlyAmount)} per month. Each currency is shown separately.`
        : 'No subscriptions are currently tracked.';
    }
    if (/investment|return|portfolio|holding|investimento|carteira/.test(query)) {
      return data.investments.length
        ? `Your ${data.investments.length} tracked holding${data.investments.length === 1 ? '' : 's'} have a cost basis of ${totals(data.investments, record => record.cost)} and a current value of ${totals(data.investments, record => record.value)}. Returns: ${finance.returnsByCurrency(data.investments)}. Values are entered manually.`
        : 'No investments are tracked yet. Add a holding in Investments, with its market and valuation currency.';
    }
    if (/account|balance|total|cash|show|conta|saldo/.test(query)) {
      return data.accounts.length
        ? `Your ${data.accounts.length} account${data.accounts.length === 1 ? '' : 's'} total ${totals(data.accounts, record => record.balance)}. Different currencies are not added or converted. Open Accounts to record a movement.`
        : 'You have not added an account yet. Use Add account from Overview to start.';
    }
    if (/\b(hello|hi|help)\b|what can|ajuda|olá/.test(query)) {
      return 'I can summarize the accounts, holdings, subscriptions, and dividend payments you record in Vaultfolio. Try a quick question on the right.';
    }
    return 'Ask about your account balances, subscriptions, investments, or dividend income. I summarize only the records you add to Vaultfolio.';
  };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-assistant-open]')) {
      document.querySelectorAll('.page').forEach(element => element.classList.toggle('active', element.id === 'assistant'));
      document.querySelectorAll('.nav-link').forEach(element => element.classList.toggle('active', element.hasAttribute('data-assistant-open')));
      $('#sectionEyebrow').textContent = 'VAULT ASSISTANT';
      $('#pageTitle').textContent = 'Your financial records, clearly.';
      if (!$('#assistantMessages').children.length) message('Hello. I can summarize your saved balances, investments, subscriptions, and dividends by currency.');
      window.scrollTo({top:0, behavior:'smooth'});
    }
    const prompt = event.target.closest('[data-assistant-prompt]')?.dataset.assistantPrompt;
    if (prompt) { $('#assistantQuestion').value = prompt; $('#assistantForm').requestSubmit(); }
  });
  $('#assistantForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#assistantQuestion');
    const question = input.value.trim();
    if (!question) return;
    message(question, 'user');
    input.value = '';
    message(answer(question));
  });
})();
