# Vaultfolio

A calm, local-first private wealth desk. It tracks manual account balances, transactions, investments, subscriptions, and QR account records. The Vault Assistant answers questions about records stored inside the app; it cannot access the user's computer, files, passwords, bank logins, or camera without a separate action the user initiates.

## U.S. and Brazilian portfolios

Accounts and holdings include their market and valuation currency. The app supports ISO currency codes, including USD and BRL; totals remain separate by currency. It does not invent exchange rates. Existing records created in the original USD-only version retain their amounts and use USD.

Holdings can track U.S. and Brazilian stocks, ETFs, FIIs, REITs, bonds, crypto, and currency positions. These categories organize manual holdings and do not assert that a particular asset is available through a connected broker. Crypto positions use a ticker/quantity and a fiat valuation currency.

The Investments page contains a Dividend income section for scheduled and received payments. Recording a dividend does not credit a bank account, and scheduled payments are user-entered expectations rather than guaranteed income.

## Privacy and safety

- Data is stored only in the browser using `localStorage`.
- No bank credentials or card numbers are stored.
- QR codes share only an account label, institution, type, and balance.
- This release does not connect to banks/brokers and does not execute investments or trades.

## Run locally

Open `index.html` in a modern browser. Camera QR scanning requires a secure origin such as GitHub Pages (HTTPS); paste-based QR import works anywhere.
