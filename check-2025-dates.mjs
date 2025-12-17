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
      SELECT wallet, expiration_date, xrp 
      FROM escrows_simple 
      WHERE EXTRACT(YEAR FROM expiration_date) = 2025
      ORDER BY expiration_date
      LIMIT 20
    `);
    
    console.log('\n2025 Escrow Records in Database:');
    console.log('==================================');
    result.rows.forEach(row => {
      const dateStr = row.expiration_date instanceof Date 
        ? row.expiration_date.toISOString().split('T')[0]
        : row.expiration_date;
      console.log(`${row.wallet.substring(0, 20)}... | ${dateStr} | ${row.xrp} XRP`);
    });

    // Count 2025 records
    const countResult = await pool.query(`
      SELECT COUNT(*) as count, SUM(xrp) as total
      FROM escrows_simple 
      WHERE EXTRACT(YEAR FROM expiration_date) = 2025
    `);
    
    console.log('\n2025 Summary:');
    console.log(`  Total records: ${countResult.rows[0].count.toLocaleString()}`);
    console.log(`  Total XRP: ${parseFloat(countResult.rows[0].total).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

    // Check the specific wallets you mentioned
    const specificWallets = [
      'rPU4HSkLo35mzTZhaTuyUX53kij4K3xZjC',
      'rE5MLbpff2SDJFSG4fFFhQf3rbr4f7CXVN',
      'rBMyQ93VUPLn8dr6LvSASSQuUkxXpkda5N'
    ];

    console.log('\n\nSpecific Wallets from your list:');
    console.log('==================================');
    for (const wallet of specificWallets) {
      const result = await pool.query(`
        SELECT wallet, expiration_date, xrp 
        FROM escrows_simple 
        WHERE wallet = $1
      `, [wallet]);
      
      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          const dateStr = row.expiration_date instanceof Date 
            ? row.expiration_date.toISOString().split('T')[0]
            : row.expiration_date;
          console.log(`${row.wallet} | ${dateStr} | ${row.xrp} XRP`);
        });
      } else {
        console.log(`${wallet} - NOT FOUND`);
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
})();
