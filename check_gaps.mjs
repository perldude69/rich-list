import db from './config/database.js';

(async () => {
  try {
    // Check for gaps in the last 24 hours
    const result = await db.query(`
      SELECT 
        ledger,
        time,
        LAG(time) OVER (ORDER BY time) as prev_time,
        EXTRACT(epoch FROM (time - LAG(time) OVER (ORDER BY time))) as gap_seconds
      FROM xrp_price 
      WHERE time > NOW() - INTERVAL '24 hours'
      ORDER BY time
    `);
    
    console.log('Checking for gaps in last 24 hours...');
    let gapCount = 0;
    result.rows.forEach(row => {
      if (row.gap_seconds > 120) { // > 2 minutes
        gapCount++;
        console.log(`Gap at ledger ${row.ledger}: ${row.gap_seconds}s since previous`);
      }
    });
    console.log(`Total gaps > 2min: ${gapCount}`);
    
    // Check the range that's available on server
    const minLedger = 100525623;
    const maxLedger = 100977286;
    const pricesInRange = await db.query(`
      SELECT COUNT(*) as count 
      FROM xrp_price 
      WHERE ledger BETWEEN $1 AND $2
    `, [minLedger, maxLedger]);
    
    console.log(`Prices in server available range (${minLedger} - ${maxLedger}): ${pricesInRange.rows[0].count}`);
    
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
})();
