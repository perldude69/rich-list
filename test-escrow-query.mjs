import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5656,
  user: 'postgres',
  password: 'richlist_postgres_2025',
  database: 'xrp_list_db',
});

async function testQuery() {
  try {
    // Simulate the calendar querying December 2025
    const startDate = '2025-12-01';
    const endDate = '2025-12-31';
    
    // Parse dates the same way the API does
    const parseYYYYMMDD = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(x => parseInt(x, 10));
      let daysFromEpoch = 0;
      
      for (let y = 2000; y < year; y++) {
        daysFromEpoch += (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
      }
      
      const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      for (let m = 0; m < month - 1; m++) {
        daysFromEpoch += daysInMonth[m];
      }
      
      daysFromEpoch += day - 1;
      return daysFromEpoch * 24 * 60 * 60;
    };
    
    const xrplStartTime = parseYYYYMMDD(startDate);
    const xrplEndTime = parseYYYYMMDD(endDate) + (24 * 60 * 60) - 1;
    
    console.log(`Querying for ${startDate} to ${endDate}`);
    console.log(`XRPL timestamp range: ${xrplStartTime} to ${xrplEndTime}\n`);
    
    const result = await pool.query(
      `SELECT 
        id,
        account_id,
        destination,
        amount / 1000000.0 as amount_xrp,
        finish_after
      FROM escrows
      WHERE finish_after >= $1 AND finish_after <= $2
      ORDER BY finish_after ASC
      LIMIT 10`,
      [xrplStartTime, xrplEndTime]
    );
    
    console.log(`Found ${result.rows.length} escrows in December 2025\n`);
    
    if (result.rows.length > 0) {
      console.log('Sample records:');
      result.rows.forEach(row => {
        console.log(`  ${row.account_id.substring(0, 20)}... | TS: ${row.finish_after} | ${row.amount_xrp.toLocaleString('en-US', { maximumFractionDigits: 2 })} XRP`);
      });
    }
    
    // Also check total for entire December
    const totalResult = await pool.query(
      `SELECT COUNT(*) as count, SUM(amount) as total_drops
       FROM escrows
       WHERE finish_after >= $1 AND finish_after <= $2`,
      [xrplStartTime, xrplEndTime]
    );
    
    const totalXrp = totalResult.rows[0].total_drops / 1000000;
    console.log(`\nDecember 2025 Summary:`);
    console.log(`  Total records: ${totalResult.rows[0].count}`);
    console.log(`  Total XRP: ${totalXrp.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

testQuery();
