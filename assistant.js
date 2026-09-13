(() => {
  const $ = (s) => document.querySelector(s);
  const money = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n || 0));
  const getData = () => JSON.parse(localStorage.getItem('vaultfolio-v1') || '{"accounts":[],"investments":[],"subscriptions":[]}');
  const message = (text, role = 'assistant') => { const host = $('#assistantMessages'); const el = document.createElement('div'); el.className = `message ${role}`; el.textContent = text; host.append(el); host.scrollTop = host.scrollHeight; };
  const answer = (question) => {
    const data = getData(), q = question.toLowerCase();
    const balance = data.accounts.reduce((n,a) => n + Number(a.balance || 0), 0);
    const subs = data.subscriptions.filter(s => s.active !== false);
    const monthly = subs.reduce((n,s) => n + Number(s.amount || 0) / (s.cadence === 'yearly' ? 12 : s.cadence === 'weekly' ? .25 : 1), 0);
    const cost = data.investments.reduce((n,i) => n + Number(i.cost || 0), 0), value = data.investments.reduce((n,i) => n + Number(i.value || 0), 0);
    if (/hello|hi|help|what can/.test(q)) return 'I can summarize the accounts, investment positions, and recurring charges that you have added. Try a quick question on the right.';
    if (/account|balance|total|cash|show/.test(q)) return data.accounts.length ? `Your accounts total ${money(balance)} across ${data.accounts.length} record${data.accounts.length === 1 ? '' : 's'}. Open Accounts to update a balance or record a movement.` : 'You have not added an account yet. Use Add account from Overview to start.';
    if (/subscription|recurring|monthly|spend/.test(q)) return subs.length ? `You have ${subs.length} active subscription${subs.length === 1 ? '' : 's'}, estimated at ${money(monthly)} per month and ${money(monthly * 12)} per year.` : 'No subscriptions are currently tracked.';
    if (/investment|return|portfolio|holding/.test(q)) { if (!data.investments.length) return 'No investments are tracked yet. Add a holding manually in Investments.'; const r = cost ? ((value-cost)/cost*100) : 0; return `Your ${data.investments.length} tracked holding${data.investments.length === 1 ? '' : 's'} have a cost basis of ${money(cost)} and a current value of ${money(value)} (${r >= 0 ? '+' : ''}${r.toFixed(1)}%). This is tracking only, not investment advice.`; }
    return 'I can help you understand the data in Vaultfolio. Ask about your total balance, subscriptions, or investments.';
  };
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-assistant-open]')) { document.querySelectorAll('.page').forEach(x => x.classList.toggle('active', x.id === 'assistant')); document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('active', x.hasAttribute('data-assistant-open'))); $('#sectionEyebrow').textContent = 'VAULT ASSISTANT'; $('#pageTitle').textContent = 'Private financial guidance.'; if (!$('#assistantMessages').children.length) message('Hello. I can summarize the balances, investments, and recurring charges that you save in Vaultfolio.'); window.scrollTo({top:0,behavior:'smooth'}); }
    const prompt = event.target.closest('[data-assistant-prompt]')?.dataset.assistantPrompt; if (prompt) { $('#assistantQuestion').value = prompt; $('#assistantForm').requestSubmit(); }
  });
  $('#assistantForm').addEventListener('submit', (event) => { event.preventDefault(); const input = $('#assistantQuestion'), q = input.value.trim(); if (!q) return; message(q,'user'); input.value = ''; setTimeout(() => message(answer(q)), 140); });
})();
