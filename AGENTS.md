# XRPL Rich List Analytics - AI Agent Context

## Project Overview

This is a XRPL (XRP Ledger) analytics application that provides:

- Real-time wallet statistics and rankings
- Escrow calendar with release dates
- Price tracking via Oracle integration
- Historical data backfilling

## Architecture

- **Backend**: Node.js/Express server with PostgreSQL database
- **Frontend**: Vanilla JavaScript SPA (no framework)
- **Data Sources**: XRPL servers with failover (xrplcluster.com primary, s2.ripple.com secondary, local Clio fallback), Oracle account (rXUMMaPpZqPutoRszR29jtC8amWq3APkx)
- **Database**: PostgreSQL with two databases:
  - `xrp_list_db_dev` (port 5657): Development database with imported stats/escrows/prices
  - `xrp_list_db` (port 5656): Production database with real-time ledger data (!DONT TOUCH THIS!)

## XRPL Oracle Transaction Format

The Oracle account (rXUMMaPpZqPutoRszR29jtC8amWq3APkx) posts price updates via TrustSet transactions with USD limits. Key fields for price extraction:

- `TransactionType`: "TrustSet"
- `Account`: "rXUMMaPpZqPutoRszR29jtC8amWq3APkx" (Oracle address)
- `LimitAmount`:
  - `currency`: "USD"
  - `issuer`: "r9PfV3sQpKLWxccdg3HL2FXKxGW2orAcLE" (USD issuer)
  - `value`: String representing the price (e.g., "1.90806")
- `ledger_index`: Ledger sequence number
- `date`: Ripple timestamp (seconds since 2000-01-01)
- `Sequence`: Transaction sequence

Example JSON snippet:

```json
{
  "tx_json": {
    "TransactionType": "TrustSet",
    "Account": "rXUMMaPpZqPutoRszR29jtC8amWq3APkx",
    "LimitAmount": {
      "currency": "USD",
      "issuer": "r9PfV3sQpKLWxccdg3HL2FXKxGW2orAcLE",
      "value": "1.90806"
    },
    "ledger_index": 100988034,
    "date": 819490160,
    "Sequence": 63671810
  },
  "validated": true
}
```

This format is used in backfill and subscriber logic to extract XRP/USD prices.

## Key Components

### Database Tables

- `accounts`: Wallet balances (populated by update-ledger.js)
- `escrows`: Escrow transactions with destination accounts
- `xrp_price`: Historical price data from Oracle
- `stats`: Ledger statistics summary

### Services

- `XRPLService`: Connects to Clio server for ledger data
- `OracleSubscriber`: Polls Oracle account for price updates
- `PriceBackfiller`: Backfills historical price data
- `update-ledger.js`: Populates accounts from live ledger
- `populate-escrows.mjs`: Imports escrow data from CSV
- `import-mariadb-stats.mjs`: Imports stats from MariaDB

### API Endpoints

- `/api/stats`: Ledger/network statistics
- `/api/accounts/trend`: Account creation trends
- `/api/escrows/date-range`: Escrow calendar data
- `/api/richlist`: Top wallet rankings
- `/api/search`: Individual wallet lookup
- `/api/ranking-search`: Wallet ranking by balance/amount

## Environment Configuration

# Database (from .env.dev)

DB_HOST=localhost
DB_PORT=5657 # Dev database port
POSTGRES_DB=xrp_list_db_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=richlist_postgres_2025

# XRPL Connection

RIPPLE_ENDPOINT=ws://127.0.0.1:51233

# Server

PORT=8585

## Current Data Status

- Accounts: ~7.4M real wallet records (populated by update-ledger.js)
- Escrows: ~14k records with destination accounts
- Prices: ~2.4M historical records
- Stats: Latest ledger statistics

## AI Agent Directives

### General Guidelines

- Prefer development database (`xrp_list_db_dev`) for testing
- Always check database connection before operations
- Use COALESCE for optional fields (e.g., destination accounts)
- Handle large numbers carefully (XRP amounts in drops vs XRP)

### Code Style

- ES6+ modules throughout
- Async/await for database operations
- Consistent error handling with try/catch
- Use template literals for HTML generation

### Database Operations

- Use parameterized queries to prevent SQL injection
- Batch large inserts for performance
- Check for existing records before duplicates
- Use transactions for multi-step operations
- The database is postgres in docker
- use docker compose, not docker-compose

### API Design

- Return consistent JSON format: `{success: true, data: ..., error: ...}`
- Handle pagination for large result sets
- Validate input parameters
- Provide meaningful error messages

### Modular API Structure

The API is organized into thematic modules for maintainability:

- **routes/api.js**: Main orchestrator that imports and sets up all API modules, applies session tracking middleware
- **routes/analyticsApi.js**: User analytics and session tracking (`/api/analytics/*`)
- **routes/adminApi.js**: Admin panel functionality (`/api/admin/*`)
- **routes/statsApi.js**: Ledger statistics and trends (`/api/stats/*`, `/api/accounts/trend`)
- **routes/accountsApi.js**: Wallet and rich list management (`/api/richlist`, `/api/search`, `/api/ranking-search`)
- **routes/escrowsApi.js**: Escrow data and calendar (`/api/escrows/*`)
- **routes/pricesApi.js**: Price data and charts (`/api/price/*`, `/api/graph`)
- **routes/maintenanceApi.js**: System maintenance and operations (`/api/gaps/*`, `/api/backfill/*`)

Each module exports a `setupRoutes(app)` function that registers its endpoints. When adding new endpoints:

1. Identify the appropriate thematic module
2. Add the endpoint code there
3. Ensure proper imports (each module imports only what it needs)
4. Test the endpoint functionality

### Security Considerations

- Never expose database credentials
- Validate wallet addresses (start with 'r', 25+ chars)
- Sanitize user inputs
- Use HTTPS in production

### Performance Notes

- Large datasets: Use LIMIT/OFFSET for pagination
- Complex queries: Add appropriate indexes
- Real-time updates: Use WebSocket broadcasting
- Caching: Consider Redis for frequently accessed data
- Price data sent to graph is not based on period and interval parameters

### Development Workflow

- Test API endpoints with curl before frontend integration
- Use browser dev tools for frontend debugging
- Check server logs for database query performance
- Verify data integrity after major operations
- Don't kill or pkill server.js. Search for and kill pid. The production server is running server.js
- For git push operations, use credentials from /home/jim/.github_credentials

### Common Issues & Solutions

- Database connection: Check port (5657 dev, 5656 prod)
- Clio connection: Ensure local server running on 51233
- Price data gaps: Run price backfiller
- count data missing: Run update-ledger.js
- escrow data missing: Run update-escrow.js
- Escrow destinations: Use COALESCE(destination, account_id)

### File Organization

- `/config/`: Database connection
- `/routes/`: API endpoint definitions
- `/services/`: Background services and utilities
- `/models/`: Database query functions
- `/public/js/pages/`: Frontend page components
- `/scripts/`: Database setup and maintenance
- `/migrationTools/`: Data import/export utilities

## Recent Changes

- Refactored routes/api.js into modular API structure with thematic separation
- Split large api.js (1262 lines) into 8 focused modules for better maintainability
- Added destination_account display in escrow calendar (COALESCE logic)
- Server configured for xrp_list_db_dev database
- Escrow API includes destination fields
- Frontend displays destination instead of "N/A"

## Future Considerations
