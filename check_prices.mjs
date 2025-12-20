import db from './config/database.js';

(async () => {
  try {
    const result = await db.query('SELECT COUNT(*) as total FROM xrp_price');
    console.log('Total prices:', result.rows[0].total);
    
    const recent = await db.query('SELECT ledger, time, price FROM xrp_price ORDER BY time DESC LIMIT 5');
    console.log('Recent prices:');
    recent.rows.forEach(r => console.log(`Ledger ${r.ledger}: $${r.price} at ${r.time}`));
    
    const oldest = await db.query('SELECT ledger, time FROM xrp_price ORDER BY time ASC LIMIT 1');
    if (oldest.rows.length > 0) {
      console.log('Oldest price: Ledger', oldest.rows[0].ledger, 'at', oldest.rows[0].time);
    }
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
})();
