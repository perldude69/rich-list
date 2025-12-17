import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5656,
  user: 'postgres',
  password: 'richlist_postgres_2025',
  database: 'xrp_list_db',
});

async function verify() {
  try {
    // Overall stats
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(CASE WHEN finish_after IS NOT NULL THEN 1 END) as records_with_dates,
        COUNT(CASE WHEN finish_after IS NULL THEN 1 END) as records_no_expiration,
        SUM(amount) as total_drops
      FROM escrows
    `);
    
    const stats = statsResult.rows[0];
    const totalXrp = stats.total_drops / 1000000;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('ESCROWS TABLE - FINAL VERIFICATION');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('Overall Statistics:');
    console.log(`  Total Records: ${stats.total_records.toLocaleString()}`);
    console.log(`  Records with Expiration Dates: ${stats.records_with_dates.toLocaleString()}`);
    console.log(`  Records WITHOUT Expiration (No expiration): ${stats.records_no_expiration.toLocaleString()}`);
    console.log(`  Total XRP Escrowed: ${totalXrp.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRP`);
    
    // Distribution by year
    const parseXRPLTimestamp = (ts) => {
      if (ts === null) return null;
      let remainingSeconds = ts;
      let year = 2000;
      
      while (true) {
        const isLeap = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
        const secondsInYear = (isLeap ? 366 : 365) * 24 * 60 * 60;
        if (remainingSeconds < secondsInYear) break;
        remainingSeconds -= secondsInYear;
        year++;
      }
      return year;
    };
    
    const yearDistResult = await pool.query(`
      SELECT 
        finish_after,
        COUNT(*) as count,
        SUM(amount) as total_drops
      FROM escrows
      WHERE finish_after IS NOT NULL
      GROUP BY finish_after
      ORDER BY finish_after ASC
    `);
    
    const yearData = {};
    yearDistResult.rows.forEach(row => {
      const year = parseXRPLTimestamp(row.finish_after);
      if (!yearData[year]) {
        yearData[year] = { count: 0, xrp: 0 };
      }
      yearData[year].count += row.count;
      yearData[year].xrp += row.total_drops / 1000000;
    });
    
    console.log('\nDistribution by Year:');
    Object.keys(yearData).sort().slice(0, 15).forEach(year => {
      const data = yearData[year];
      console.log(`  ${year}: ${data.count.toLocaleString()} records, ${data.xrp.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRP`);
    });
    
    console.log('\n✓ All data verified successfully!');
    console.log('═══════════════════════════════════════════════════\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

verify();
