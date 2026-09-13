# Vaultfolio

A calm, local-first private wealth desk. It tracks manual account balances, transactions, investments, subscriptions, and QR account records. The Vault Assistant answers questions about records stored inside the app; it cannot access the user's computer, files, passwords, bank logins, or camera without a separate action the user initiates.

## Privacy and safety

- Data is stored only in the browser using `localStorage`.
- No bank credentials or card numbers are stored.
- QR codes share only an account label, institution, type, and balance.
- This release does not connect to banks/brokers and does not execute investments or trades.

## Run locally

Open `index.html` in a modern browser. Camera QR scanning requires a secure origin such as GitHub Pages (HTTPS); paste-based QR import works anywhere.
