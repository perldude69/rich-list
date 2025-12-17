import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5656,
  user: 'postgres',
  password: 'richlist_postgres_2025',
  database: 'xrp_list_db',
});

(async () => {
  try {
    // Check 2025 records
    const result = await pool.query(`
      SELECT account_id, destination, amount, finish_after 
      FROM escrows 
      WHERE finish_after >= 1735689600 AND finish_after < 1767225600
      ORDER BY finish_after
      LIMIT 10
    `);
    
    console.log('\nSample 2025 Escrow Records from Main Table:');
    console.log('===========================================');
    result.rows.forEach(row => {
      const dateObj = new Date(row.finish_after * 1000);
      const dateStr = dateObj.toISOString().split('T')[0];
      const xrp = row.amount / 1000000;
      console.log(`${row.account_id.substring(0, 20)}... | ${dateStr} | ${xrp.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRP`);
    });

    // Get statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_drops,
        MIN(finish_after) as earliest_ts,
        MAX(finish_after) as latest_ts
      FROM escrows
    `);
    
    const stats = statsResult.rows[0];
    const earliestDate = new Date(stats.earliest_ts * 1000).toISOString().split('T')[0];
    const latestDate = new Date(stats.latest_ts * 1000).toISOString().split('T')[0];
    const totalXrp = stats.total_drops / 1000000;

    console.log('\nEscrows Table Statistics:');
    console.log('===========================================');
    console.log(`  Total Records: ${stats.total_records.toLocaleString()}`);
    console.log(`  Total XRP: ${totalXrp.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    console.log(`  Date Range: ${earliestDate} to ${latestDate}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
