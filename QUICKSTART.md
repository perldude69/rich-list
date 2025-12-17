# Rich-List SPA - Quick Start Guide

Welcome to Rich-List! This guide will get you up and running in 5 minutes.

## Prerequisites Check ✅

Make sure you have:
- Node.js 18+ (check: `node --version`)
- npm 9+ (check: `npm --version`)
- Docker installed (check: `docker --version`)

## Step 1: Start PostgreSQL (Terminal 1)

```bash
cd /opt/rich-list
npm run docker:start
```

Expected output:
```
[timestamp] Starting PostgreSQL container...
PostgreSQL container started.
```

Wait 10 seconds for the database to be ready.

Verify:
```bash
docker ps | grep postgres
npm run docker:logs  # View database logs
```

## Step 2: Start the Server (Terminal 2)

```bash
cd /opt/rich-list
npm start
```

Expected output:
```
╔════════════════════════════════════════╗
║       Rich-List SPA Server Started      ║
╚════════════════════════════════════════╝

Server:     http://localhost:9876
Environment: development
Database:   localhost:5656
WebSocket:  WS://localhost:9876
```

## Step 3: Open in Browser (Terminal 3)

Open your browser and go to:
```
http://localhost:9876
```

You should see:
- Navigation bar with 6 page links
- Search page (currently active)
- Search form ready for input

## First Test: Search a Wallet

1. Enter any valid XRPL address in the search box
2. Click "Search" or press Enter
3. You should see account details (when connected to database)

## Navigation

Click on any nav link to test page routing:
- **Search** - Wallet lookup (currently on this page)
- **Dashboard** - Overview metrics
- **Rich List** - Top 100 wallets
- **Price Chart** - Price analysis
- **Stats** - Ledger statistics
- **Escrow** - Escrow schedule

All pages load instantly without full page refreshes!

## Theme Switcher

Look for the circular button in the bottom-right corner (after Phase 5 implementation).

Available themes:
- Plain
- Crypto Classic
- Data Minimalist
- Night Market
- Ocean
- Forest

## Database Operations

### Create a Backup
```bash
npm run db:backup
# Saves to /opt/rich-list/backups/rich-list_YYYYMMDD_HHMMSS.sql.gz
```

### View Backups
```bash
ls -lh /opt/rich-list/backups/
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

## Check Server Health

```bash
curl http://localhost:9876/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T21:30:00.000Z",
  "database": true,
  "uptime": 123.456
}
```

## Debugging

### Browser Console
Open browser DevTools (F12) and run:

```javascript
// Check app state
window.richListApp.store.getState()

// Check API cache
window.richListApp.api.getCacheInfo()

// Check Socket.IO status
window.richListApp.socket.getStatus()

// Check current route
window.richListApp.router.getCurrentRoute()
```

### Server Logs
Watch server output in Terminal 2 for:
- API requests
- Database queries
- Socket.IO connections
- Errors

### Database Logs
View PostgreSQL logs:
```bash
npm run docker:logs
```

## Stopping Everything

### Stop Server (Terminal 2)
```
Press Ctrl+C
```

### Stop PostgreSQL (Terminal 1)
```bash
npm run docker:stop
```

### Clean Up Volumes (optional)
```bash
rm -rf /opt/rich-list/postgres-data/*
```

## Common Issues

### "Cannot connect to database"
- Make sure PostgreSQL is running: `npm run docker:start`
- Check logs: `npm run docker:logs`
- Verify port 5656 is free: `lsof -i :5656`

### "Port 9876 is already in use"
- Kill existing process: `lsof -i :9876` then `kill -9 <PID>`
- Or use different port: Edit `.env` and set `PORT=9877`

### "Socket.IO not connecting"
- Check browser console for errors
- Verify server is running
- Check firewall allows port 9876
- Try: `npm start` again

### "Database schema not initialized"
- Schema is auto-created when PostgreSQL starts
- Verify: `docker logs rich-list-postgres`
- Manual init: `psql -h localhost -p 5656 -U postgres -d xrp_list_db -f scripts/init-db.sql`

## Next Steps

### Phase 1: Test Infrastructure
- Navigate between pages
- Test state management
- Verify API caching
- Check Socket.IO events

### Phase 2: Database Setup
- Populate database with real data
- Test backup/restore
- Verify performance

### Phase 3: API Endpoints
- Implement data endpoints
- Add Socket.IO broadcasting
- Test real-time updates

### Phase 4-8: Full Application
- Enhance components
- Add charts and visualizations
- Implement real-time features
- Deploy to production

## Documentation

Full documentation available in:
- `README.md` - Complete feature guide
- `PHASE_0_COMPLETE.md` - What was built
- `/opt/rich-gamma/FINAL_EXECUTION_PLAN.md` - Full implementation plan

## Support

For issues:
1. Check the troubleshooting section above
2. Review server/database logs
3. Check browser console (F12)
4. Consult documentation files

## What's Working Now

✅ **Fully Functional:**
- SPA routing (7 pages)
- State management
- CSS framework with themes
- API client with caching
- Socket.IO infrastructure
- Database connection
- Docker PostgreSQL
- Backup/restore scripts

🚧 **In Progress:**
- API endpoint implementation
- Real-time data updates
- Page component enhancements
- Chart visualizations

## Time to First Page

From startup to first load:
1. PostgreSQL: 3-5 seconds
2. Server: 1-2 seconds
3. Page load: < 1 second

**Total: ~5 seconds from zero to running!**

---

**Questions?** Check the README or FINAL_EXECUTION_PLAN.md!

**Ready?** Keep Terminal 1 and 2 running and start building! 🚀
