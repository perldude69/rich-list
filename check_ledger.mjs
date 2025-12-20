import XRPLService from './services/xrplService.mjs';

(async () => {
  const xrpl = new XRPLService();
  try {
    await xrpl.connect();
    
    // Check a ledger that has a price
    const ledgerIndex = 100977217;
    console.log(`Checking ledger ${ledgerIndex} for oracle transactions...`);
    
    const priceData = await xrpl.extractPriceFromLedger(ledgerIndex);
    console.log('Price data found:', priceData);
    
    // Also check transactions
    const transactions = await xrpl.getLedgerTransactions(ledgerIndex);
    console.log(`Total transactions in ledger: ${transactions.length}`);
    
    const oracleTxs = transactions.filter(tx => 
      tx.TransactionType === 'TrustSet' && 
      tx.Account === 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx'
    );
    console.log(`Oracle TrustSet transactions: ${oracleTxs.length}`);
    if (oracleTxs.length > 0) {
      oracleTxs.forEach(tx => {
        console.log('TX:', tx.Sequence, tx.LimitAmount);
      });
    }
    
  } catch (e) {
    console.error(e.message);
  } finally {
    await xrpl.disconnect();
    process.exit(0);
  }
})();
