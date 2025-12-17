import db from './config/database.js';

(async () => {
  try {
    // Check if backfilled prices were added (sequence = NULL)
    const result = await db.query(`
      SELECT COUNT(*) as backfilled_count
      FROM xrp_price
      WHERE sequence IS NULL
    `);
    
    console.log('Backfilled prices (sequence = NULL):', result.rows[0].backfilled_count);
    
    // Check most recent prices
    const recent = await db.query(`
      SELECT price, ledger, "time", sequence
      FROM xrp_price
      WHERE ledger >= 100525623 AND ledger <= 100733413
      ORDER BY ledger DESC
      LIMIT 5
    `);
    
    console.log('\nRecent prices in backfill range (100525623 - 100733413):');
    if (recent.rows.length === 0) {
      console.log('  No prices found in this range yet');
    } else {
      recent.rows.forEach(row => {
        console.log(`  Ledger ${row.ledger}: $${row.price} (seq: ${row.sequence})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
