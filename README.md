# Rich List v2 - Modern SPA

A modern Single Page Application for monitoring the XRP Ledger's richest wallets and network statistics.

> **v2.0.0** (2025-12-17) - Complete rewrite with Node.js/Express + PostgreSQL
> 
> **[v1-legacy](https://github.com/perldude69/rich-list/tree/v1-legacy)** - Original PHP implementation (archived)

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker (for PostgreSQL)

### Installation

```bash
cd /opt/rich-list
npm install
```

### Configuration

Copy `.env` template (already created) and update if needed:
```bash
cat .env
```

### Start PostgreSQL Database

```bash
npm run docker:start
# or manually:
bash scripts/start-postgres.sh
```

### Start the Application

```bash
npm start
# Server runs on http://localhost:9876
```

### Access the Application

Open your browser and navigate to: **http://localhost:9876**

## Features

### Pages
- **Search** - Wallet address lookup with detailed information
- **Dashboard** - Overview of monitored wallets and statistics
- **Price Chart** - XRP/USD price analysis and history
- **Rich List** - Top 100 wallet holders
- **Statistics** - Real-time ledger metrics
- **Historical Data** - Time-based wallet data analysis
- **Escrow Calendar** - Upcoming escrow releases

### Real-Time Updates
- Socket.IO connection for live data streaming
- Multiple subscription channels (stats, price, ledger, escrows)
- Auto-reconnection with exponential backoff

### Themes
1. **Plain** - Default light theme
2. **Crypto Classic** - Dark theme with orange accents
3. **Data Minimalist** - Black and white minimalist design
4. **Night Market** - Purple dark mode
5. **Ocean** - Blue gradient theme
6. **Forest** - Green natural theme

### Database
PostgreSQL 15 running in Docker on port 5656

**Connection Details:**
- Host: localhost
- Port: 5656
- User: postgres
- Database: xrp_list_db

## Project Structure

```
/opt/rich-list/
├── config/              # Configuration modules
│   └── database.js      # PostgreSQL connection setup
├── public/              # Static frontend files
│   ├── css/             # Stylesheets (main.css, themes.css)
│   ├── js/              # Frontend JavaScript
│   │   ├── main.js      # App initialization
│   │   ├── router.js    # Client-side routing
│   │   ├── store.js     # State management
│   │   ├── pages/       # Page components (7 pages)
│   │   └── services/    # API & Socket.IO services
│   └── index.html       # Main HTML entry point
├── scripts/             # Shell scripts for DB operations
│   ├── backup-db.sh     # Database backup
│   ├── restore-db.sh    # Database restore
│   ├── start-postgres.sh # Start PostgreSQL
│   └── init-db.sql      # Database schema
├── server.js            # Express.js server
├── docker-compose.yml   # Docker configuration
└── package.json         # Node.js dependencies
```

## Available Commands

### Server
```bash
npm start              # Start development server
npm run dev            # Same as npm start
npm run update-ledger  # (Not implemented yet)
```

### Database
```bash
npm run docker:start   # Start PostgreSQL container
npm run docker:stop    # Stop PostgreSQL container
npm run docker:logs    # View PostgreSQL logs
npm run db:backup      # Create database backup
npm run db:restore     # Restore from backup
```

### Testing
```bash
npm test                    # Run all E2E tests (Playwright)
npm run test:grep "pattern" # Run specific tests
```

## Architecture

### Frontend (Vanilla JavaScript)
- **No Framework** - Pure JavaScript with HTML/CSS
- **Client-Side Routing** - History API for navigation
- **State Management** - Custom reactive store
- **API Service** - Fetch wrapper with caching
- **Real-Time** - Socket.IO for live updates

### Backend (Node.js/Express)
- **Express.js** - Lightweight HTTP server
- **Socket.IO** - WebSocket communication
- **PostgreSQL** - Data persistence
- **JSON API** - RESTful endpoints

### Database Schema
Tables:
- `accounts` - Wallet information and balances
- `escrows` - Escrow entries and releases
- `price_history` - Historical XRP price data (OHLCV)
- `ledger_stats` - Ledger index and metrics
- `transactions` - Transaction records
- `currency_lines` - Trust lines and currency balances
- `offers` - Decentralized exchange offers

## API Endpoints

### Health & Status
- `GET /api/health` - Server health check

### Data Endpoints
- `GET /api/stats` - Ledger statistics
- `GET /api/richlist?limit=100&offset=0` - Top wallets
- `GET /api/search?account=rN...` - Search account
- `GET /api/graph?timeframe=1d` - Price chart data
- `GET /api/escrows?limit=100&offset=0` - Escrow list
- `GET /api/price/latest` - Current XRP price
- `GET /api/price/history?start=...&end=...` - Price history

### Account Details (Phase 3+)
- `GET /account/:id` - Account details
- `GET /account/:id/transactions` - Account transactions

## Socket.IO Events

### Client → Server
- `subscribe:stats` - Subscribe to statistics updates
- `subscribe:price` - Subscribe to price updates
- `subscribe:ledger` - Subscribe to ledger updates
- `subscribe:escrow` - Subscribe to escrow updates
- `subscribe:transactions` - Subscribe to transaction updates

### Server → Client
- `stats:update` - Statistics update
- `price:update` - Price update
- `ledger:update` - Ledger update
- `escrow:update` - Escrow update
- `transaction:update` - Transaction update

## Development

### Adding a New Page
1. Create component in `public/js/pages/MyPage.js`
2. Register route in `public/js/router.js`
3. Add navigation link in page components

### Adding API Endpoints
1. Create route handler in appropriate file
2. Add to `/api/` pattern in `server.js`
3. Document in API endpoints section

### Debugging
Access debug info via browser console:
```javascript
window.richListApp.store.getState()
window.richListApp.api.getCacheInfo()
window.richListApp.socket.getStatus()
window.richListApp.router.getCurrentRoute()
```

## Database Operations

### Create Backup
```bash
npm run db:backup
# Backup saved to /opt/rich-list/backups/
```

### Restore from Backup
```bash
npm run db:restore /opt/rich-list/backups/rich-list_YYYYMMDD_HHMMSS.sql.gz
```

### Daily Automatic Backups
```bash
bash scripts/setup-cron.sh
# Runs daily at 2:00 AM
# Keeps 30-day rolling retention
```

## Performance

- Page load time: < 2 seconds
- Real-time update latency: < 500ms
- Database query caching: 5 minutes
- WebSocket ping interval: 25 seconds

## Troubleshooting

### PostgreSQL Connection Failed
```bash
# Check if container is running
docker ps | grep postgres

# Start container
npm run docker:start

# View logs
npm run docker:logs
```

### Socket.IO Not Connecting
- Check browser console for WebSocket errors
- Verify firewall allows port 9876
- Check network tab in browser dev tools

### API Requests Timing Out
- Check server is running: `npm start`
- Verify database connection: `npm run docker:start`
- Check network connectivity

## Phase Completion

### Phase 0 ✅ Complete
- ✅ Directory structure created
- ✅ Docker PostgreSQL configured
- ✅ Database schema initialized
- ✅ Backup/restore scripts ready
- ✅ Environment configuration done
- ✅ Express server scaffolding
- ✅ Frontend infrastructure (router, store, API)
- ✅ 7 page components (placeholders)
- ✅ Dependencies installed
- ✅ npm scripts configured

### Phase 1 (In Progress)
- Building core SPA infrastructure
- Testing router and state management

### Phase 2 (Pending)
- PostgreSQL setup and data migration
- Database population from rich-gamma

### Phase 3+ (Pending)
- Backend API implementation
- Real-time Socket.IO updates
- Component enhancements
- Testing and deployment

## License

MIT

## Support

For issues or questions, check `/opt/rich-gamma/FINAL_EXECUTION_PLAN.md` for the complete implementation roadmap.
