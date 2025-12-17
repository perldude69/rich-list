import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5656,
  user: 'postgres',
  password: 'richlist_postgres_2025',
  database: 'xrp_list_db',
});

// XRPL epoch offset: 946684800 seconds between 1970-01-01 and 2000-01-01
const XRPL_EPOCH_OFFSET = 946684800;

async function fixTimestamps() {
  try {
    console.log('Converting Unix timestamps to XRPL timestamps...');
    
    // Update all escrows with finish_after values
    const result = await pool.query(`
      UPDATE escrows 
      SET finish_after = finish_after - $1
      WHERE finish_after IS NOT NULL
    `, [XRPL_EPOCH_OFFSET]);
    
    console.log(`✓ Updated ${result.rowCount} escrow records`);
    
    // Verify the conversion
    const verifyResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        MIN(finish_after) as min_ts,
        MAX(finish_after) as max_ts
      FROM escrows
      WHERE finish_after IS NOT NULL
    `);
    
    const data = verifyResult.rows[0];
    console.log(`\nVerification:`);
    console.log(`  Total records with dates: ${data.total}`);
    console.log(`  Min XRPL timestamp: ${data.min_ts}`);
    console.log(`  Max XRPL timestamp: ${data.max_ts}`);
    
    // Sample some 2025 records
    const sampleResult = await pool.query(`
      SELECT account_id, amount, finish_after
      FROM escrows
      WHERE finish_after >= 809811200 AND finish_after < 841433199
      LIMIT 5
    `);
    
    console.log(`\nSample 2025 records (should show XRPL timestamps ~809M):`);
    sampleResult.rows.forEach(row => {
      const xrp = row.amount / 1000000;
      console.log(`  ${row.account_id.substring(0, 20)}... | TS: ${row.finish_after} | ${xrp.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRP`);
    });
    
    console.log('\n✓ Timestamp conversion complete!');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixTimestamps();
