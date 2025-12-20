import XRPLService from './services/xrplService.mjs';

(async () => {
  const xrpl = new XRPLService();
  try {
    await xrpl.connect();
    
    const ledgerIndex = 100977217;
    console.log(`Checking ledger ${ledgerIndex} details...`);
    
    const response = await xrpl.request({
      command: 'ledger',
      ledger_index: ledgerIndex,
      accounts: false,
      expand: true,
      transactions: true,
    });
    
    console.log('Ledger response keys:', Object.keys(response.result));
    console.log('Ledger seq:', response.result.ledger.ledger_index);
    console.log('Transactions count:', response.result.ledger.transactions?.length || 0);
    
    if (response.result.ledger.transactions) {
      response.result.ledger.transactions.forEach((tx, i) => {
        if (i < 3) { // Show first 3
          console.log(`TX ${i+1}:`, typeof tx, tx.TransactionType || tx.hash || tx);
        }
      });
    }
    
  } catch (e) {
    console.error(e.message);
  } finally {
    await xrpl.disconnect();
    process.exit(0);
  }
})();
