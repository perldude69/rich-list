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
    // Test query
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        SUM(xrp) as total_xrp,
        MIN(expiration_date) as earliest_date,
        MAX(expiration_date) as latest_date
      FROM escrows_simple
    `);
    
    const row = result.rows[0];
    console.log('\n✓ Database Query Results:');
    console.log('  Total Records:', row.total_records.toLocaleString());
    console.log('  Total XRP:', parseFloat(row.total_xrp).toLocaleString('en-US', { maximumFractionDigits: 2 }));
    console.log('  Earliest Expiration:', row.earliest_date);
    console.log('  Latest Expiration:', row.latest_date);
    
    // Check for records with no expiration
    const noExpResult = await pool.query(`
      SELECT COUNT(*) as count FROM escrows_simple WHERE expiration_date IS NULL
    `);
    console.log('  Records with no expiration:', noExpResult.rows[0].count);
    
    // Sample dates
    const dateDistribution = await pool.query(`
      SELECT 
        EXTRACT(YEAR FROM expiration_date) as year,
        COUNT(*) as count,
        SUM(xrp) as total_xrp
      FROM escrows_simple
      GROUP BY year
      ORDER BY year
      LIMIT 10
    `);
    
    console.log('\n✓ Escrows by Year:');
    dateDistribution.rows.forEach(row => {
      console.log(`  ${parseInt(row.year)}: ${row.count.toLocaleString()} records, ${parseFloat(row.total_xrp).toLocaleString('en-US', { maximumFractionDigits: 2 })} XRP`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
