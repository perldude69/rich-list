# Rich List v2 - Changelog

## v2.0.0 (2025-12-17) - Complete Rewrite

### Architecture Transformation
- **Technology Stack**: Migrated from PHP/Perl/MySQL to Node.js/Express/PostgreSQL
- **Frontend**: New Single Page Application (SPA) with vanilla JavaScript
- **Backend**: Modern Express.js server with Socket.IO real-time updates
- **Database**: PostgreSQL 15 in Docker (replaces MySQL)

### Major Features (v2)
- 7-page Single Page Application (SPA)
  - Dashboard - Network overview and key metrics
  - Search - Wallet address lookup with details
  - Rich List - Top 100 wallet holders
  - Price Chart - XRP/USD price history and analysis
  - Statistics - Real-time ledger metrics
  - Historical Data - Time-based wallet analysis
  - Escrow Calendar - Upcoming escrow releases

- Real-time Updates
  - Socket.IO WebSocket connection for live data
  - Multiple subscription channels (stats, price, ledger, escrows)
  - Auto-reconnection with exponential backoff

- User Experience
  - 6 Professional Themes (Plain, Crypto Classic, Data Minimalist, Night Market, Ocean, Forest)
  - Responsive design for all screen sizes
  - Advanced search and filtering capabilities
  - Data caching for performance

### Backup & Restore Improvements
- **Enhanced backup-xrp-price.js**
  - Automatic schema extraction (not hard-coded)
  - Excludes id column from backups (20% size reduction)
  - Gzip compression for efficient storage
  
- **Enhanced restore-xrp-price.js**
  - Extracts schema directly from backup file
  - Auto-generates sequential IDs on restore
  - Optimized batch INSERT (1000 rows/statement)
  - Atomic table swaps for zero-downtime restores
  - Handles both COPY and INSERT formats
  - Row count validation with verification

- **Performance**: 2.4M+ row table restored in ~10 seconds

### Infrastructure
- **Backend**: Express.js + Node.js >= 18.0.0
- **Database**: PostgreSQL 15 (Docker)
- **Real-time**: Socket.IO v4.7.2
- **Frontend**: Vanilla JavaScript (no framework)
- **Package Manager**: npm

### Breaking Changes from v1
- **Node.js Required**: Requires Node.js >= 18.0.0 (v1 was PHP)
- **Database**: PostgreSQL 15 required (v1 used MySQL)
- **API Different**: New REST API endpoints (not compatible with v1)
- **Frontend**: Complete rewrite (v1 was server-rendered PHP)

### Upgrade Path from v1
```bash
# 1. Prerequisites
# - Install Node.js >= 18.0.0
# - Have Docker installed for PostgreSQL

# 2. Setup
git clone https://github.com/perldude69/rich-list.git
cd rich-list
npm install

# 3. Configuration
cp .env.example .env
# Edit .env with your database password

# 4. Start Database
npm run docker:start

# 5. Start Application
npm start
# Server runs on http://localhost:9876
```

### API Endpoints (v2)
- `GET /api/health` - Server health check
- `GET /api/stats` - Ledger statistics
- `GET /api/richlist?limit=100&offset=0` - Top wallets
- `GET /api/search?account=rN...` - Search account
- `GET /api/graph?timeframe=1d` - Price chart data
- `GET /api/escrows?limit=100&offset=0` - Escrow list
- `GET /api/price/latest` - Current XRP price
- `GET /api/price/history?start=...&end=...` - Price history

### Database Schema
Tables:
- `accounts` - Wallet information and balances
- `escrows` - Escrow entries and releases
- `price_history` - Historical XRP price data (OHLCV)
- `ledger_stats` - Ledger index and metrics
- `transactions` - Transaction records
- `currency_lines` - Trust lines and currency balances
- `offers` - Decentralized exchange offers
- `xrp_price` - Real-time XRP price tracking

### Known Issues
- None currently documented

### Future Roadmap
- TypeScript migration for type safety
- Enhanced caching strategies (Redis)
- GraphQL API endpoint
- Mobile native applications
- Advanced analytics dashboard
- Automated deployment pipeline

### Version Comparison

| Feature | v1 (PHP) | v2 (Node.js) |
|---------|----------|-------------|
| Language | PHP/Perl | Node.js/Express |
| Database | MySQL | PostgreSQL |
| Frontend | Server-rendered | Single Page App |
| Real-time | Polling | WebSocket (Socket.IO) |
| Themes | 1 | 6 themes |
| Pages | ~3 | 7 pages |
| Performance | Good | Excellent |
| Maintainability | Legacy | Modern |

### Support
- For issues: Check [GETTING_STARTED.md](GETTING_STARTED.md)
- For detailed architecture: See [ARCHITECTURE_AND_OPERATIONS.md](ARCHITECTURE_AND_OPERATIONS.md)
- For v1: Visit [v1-legacy](https://github.com/perldude69/rich-list/tree/v1-legacy) branch
