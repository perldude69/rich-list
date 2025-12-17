# Rich List - Versioning Guide

## Current Version: v2.0.0 (Node.js/Express SPA)

### Version Overview

#### v2.x Series (Current)
- **Status**: Active Development
- **Technology**: Node.js, Express, PostgreSQL 15, Socket.IO
- **Branch**: `main`
- **Documentation**: 
  - [README.md](README.md) - Quick start and overview
  - [GETTING_STARTED.md](GETTING_STARTED.md) - Detailed setup guide
  - [ARCHITECTURE_AND_OPERATIONS.md](ARCHITECTURE_AND_OPERATIONS.md) - Architecture details
  - [v2-CHANGELOG.md](v2-CHANGELOG.md) - Complete feature list and changes

#### v1.x Series (Legacy - Archived)
- **Status**: No longer maintained - archived reference only
- **Technology**: PHP, Perl, MySQL
- **Branch**: [v1-legacy](https://github.com/perldude69/rich-list/tree/v1-legacy)
- **Note**: Use v1-legacy branch if you need the original PHP implementation

### Migration from v1 to v2

#### Why Upgrade?
- Modern, maintainable codebase
- Real-time updates via WebSocket
- Better performance and scalability
- Professional UI with multiple themes
- Active development and improvements

#### Before You Start
1. Backup any v1 data you need to preserve
2. Ensure Node.js >= 18.0.0 is installed
3. Have Docker available for PostgreSQL

#### Step-by-Step Migration
```bash
# 1. Clone v2 repository
git clone https://github.com/perldude69/rich-list.git
cd rich-list

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database password and settings

# 4. Start PostgreSQL
npm run docker:start

# 5. (Optional) Restore data from v1 database
# If migrating data, use appropriate database migration tools

# 6. Start application
npm start

# App runs on http://localhost:9876
```

#### Getting Help
- See [GETTING_STARTED.md](GETTING_STARTED.md) for setup issues
- Check [README.md](README.md) for feature documentation
- View [v2-CHANGELOG.md](v2-CHANGELOG.md) for what's new

### Branch Strategy

```
main                  ← v2.0.0 (Active/Stable)
  ├─ v1-legacy        ← v1.x archived (Read-only reference)
  └─ (future: v2-develop for active feature work)
```

### Release Information

**Latest Release**: v2.0.0
- Released: 2025-12-17
- Status: Initial SPA release
- Download: [GitHub Releases](https://github.com/perldude69/rich-list/releases)

### Support Matrix

| Version | Status | Support | Node.js | Database |
|---------|--------|---------|---------|----------|
| v2.x | Active | Full | 18.0.0+ | PostgreSQL 15 |
| v1.x | Archived | Reference | N/A | MySQL 5.7 |

### FAQ

**Q: Can I still use v1?**
A: Yes, see the [v1-legacy](https://github.com/perldude69/rich-list/tree/v1-legacy) branch for the original PHP code.

**Q: Is my v1 data compatible with v2?**
A: Database structure is different. You may need data migration scripts for specific tables.

**Q: What happens to v1?**
A: v1 is archived in the `v1-legacy` branch. No further updates will be made.

**Q: When will v3 be released?**
A: No timeline for v3 yet. Focus is on v2 stability and features.
