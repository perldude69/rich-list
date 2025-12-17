import db from './config/database.js';

(async () => {
  try {
    console.log('🔍 Verifying Price Backfill to Database\n');

    // Get price statistics
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_prices,
        MIN(ledger) as min_ledger,
        MAX(ledger) as max_ledger,
        MIN(price) as lowest_price,
        MAX(price) as highest_price,
        AVG(price) as average_price
      FROM xrp_price
    `);

    const stats = statsResult.rows[0];
    console.log('📊 PRICE TABLE STATISTICS:');
    console.log(`   Total Prices: ${stats.total_prices}`);
    console.log(`   Ledger Range: ${stats.min_ledger} → ${stats.max_ledger}`);
    console.log(`   Lowest Price: $${parseFloat(stats.lowest_price).toFixed(6)}`);
    console.log(`   Highest Price: $${parseFloat(stats.highest_price).toFixed(6)}`);
    console.log(`   Average Price: $${parseFloat(stats.average_price).toFixed(6)}\n`);

    // Get recent prices
    const recentResult = await db.query(`
      SELECT price, ledger, "time" 
      FROM xrp_price 
      ORDER BY ledger DESC 
      LIMIT 10
    `);

    console.log('📈 MOST RECENT PRICES:');
    recentResult.rows.forEach((row, idx) => {
      const date = new Date(row.time).toLocaleString();
      console.log(`   ${idx + 1}. Ledger ${row.ledger}: $${parseFloat(row.price).toFixed(6)} (${date})`);
    });
    console.log('');

    // Check for gaps
    const gapResult = await db.query(`
      WITH ledger_gaps AS (
        SELECT 
          ledger,
          LAG(ledger) OVER (ORDER BY ledger) as prev_ledger,
          ledger - LAG(ledger) OVER (ORDER BY ledger) as gap_size
        FROM xrp_price
        ORDER BY ledger
      )
      SELECT COUNT(*) as gap_count, AVG(gap_size) as avg_gap_size
      FROM ledger_gaps
      WHERE gap_size > 100
    `);

    const gaps = gapResult.rows[0];
    console.log('🔍 GAP ANALYSIS:');
    console.log(`   Gaps > 100 ledgers: ${gaps.gap_count}`);
    console.log(`   Average gap size: ${gaps.avg_gap_size ? Math.round(gaps.avg_gap_size) : 0} ledgers\n`);

    // Check insertion source distribution
    const sourceResult = await db.query(`
      SELECT 
        COUNT(CASE WHEN sequence IS NOT NULL THEN 1 END) as from_transactions,
        COUNT(CASE WHEN sequence IS NULL THEN 1 END) as from_backfill
      FROM xrp_price
    `);

    const source = sourceResult.rows[0];
    console.log('📍 DATA SOURCE DISTRIBUTION:');
    console.log(`   From Transactions (has sequence): ${source.from_transactions}`);
    console.log(`   From Backfill (no sequence): ${source.from_backfill}\n`);

    // Sample backfilled prices
    const sampleResult = await db.query(`
      SELECT ledger, price, "time"
      FROM xrp_price
      WHERE sequence IS NULL
      ORDER BY ledger DESC
      LIMIT 5
    `);

    if (sampleResult.rows.length > 0) {
      console.log('🎯 SAMPLE BACKFILLED PRICES (sequence = NULL):');
      sampleResult.rows.forEach((row, idx) => {
        const date = new Date(row.time).toLocaleString();
        console.log(`   Ledger ${row.ledger}: $${parseFloat(row.price).toFixed(6)} (${date})`);
      });
      console.log('');
    }

    // Determine status
    if (stats.total_prices > 100) {
      console.log('✅ BACKFILL STATUS: SUCCESSFUL');
      console.log(`   Database contains ${stats.total_prices} price records`);
      console.log(`   Covering ${stats.max_ledger - stats.min_ledger} ledgers`);
      console.log(`   Price range: $${parseFloat(stats.lowest_price).toFixed(6)} → $${parseFloat(stats.highest_price).toFixed(6)}\n`);
    } else if (stats.total_prices > 0) {
      console.log('⚠️  BACKFILL STATUS: IN PROGRESS');
      console.log(`   Database contains ${stats.total_prices} price records so far\n`);
    } else {
      console.log('❌ BACKFILL STATUS: NOT STARTED');
      console.log('   Database is empty\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
