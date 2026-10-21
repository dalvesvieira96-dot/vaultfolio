# Live connection implementation boundary

The current deployed app stores manual records on the user's device. This update adds multi-currency holdings and dividend records. No financial provider credentials, tokens, live feeds, or order execution endpoints are configured.

## Provider selection

Select actual bank and broker connections after the user supplies institution names and establishes account eligibility with the provider. Country of the institution alone does not determine brokerage access.

- U.S. financial-data candidate: [Plaid](https://plaid.com/docs/api/). Product and institution coverage must be checked; investment data is not trading permission.
- Brazil financial-data candidate: [Pluggy](https://docs.pluggy.ai/en/docs/get-started/faq). Open Finance/connector support and authorization methods depend on the institution and production configuration.
- Brokerage execution candidate: [Alpaca Connect](https://docs.alpaca.markets/us/docs/about-connect-api), for eligible accounts and supported assets. Third-party live access needs application approval.
- International brokerage candidate: [IBKR third-party API](https://ibkrcampus.com/docs/web-api/trading/getting-started/trading-access-for-third-parties). Entity onboarding and approval are required. Its [B3 access page](https://www.interactivebrokers.com/en/trading/b3-exchange-brazil.php) restricts the described access to clients outside Brazil.

These are integration candidates, not investment recommendations, universal coverage claims, or enabled connections.

## Server requirements before live authorization

1. Add individual user authentication and a database with records isolated per user.
2. Keep provider client secrets and encrypted access tokens on the server. Never place these in client JavaScript, browser storage, QR codes, Git, screenshots, or logs.
3. Generate short-lived connection sessions server-side and validate OAuth state/callbacks. Bank consent happens with the institution/provider.
4. Normalize incoming accounts, balances, transactions, holdings, and income while retaining provider identifiers, currency, source, last-sync time, and manual/provider provenance. Avoid importing duplicates.
5. Verify webhook signatures, implement bounded retries and reconnect/revoke handling, and expose synchronization state accurately.
6. Treat order execution as a separate capability: broker-approved scope, supported assets/currencies, explicit order details and user review, broker eligibility checks, and idempotent order submission. Do not infer permission to submit trades from bank-data consent.

Until the provider configuration and user authorization exist, the UI must continue to describe these records as manual and must not display a false Connected state.
