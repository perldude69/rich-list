import XRPLService from './services/xrplService.mjs';

(async () => {
  const xrpl = new XRPLService();
  try {
    await xrpl.connect();
    
    console.log('Checking recent oracle transactions...');
    
    const response = await xrpl.request({
      command: 'account_tx',
      account: 'rXUMMaPpZqPutoRszR29jtC8amWq3APkx',
      limit: 5
    });
    
    const transactions = response.result.transactions || [];
    console.log(`Found ${transactions.length} transactions`);
    
    transactions.forEach((txObj, i) => {
      const tx = txObj.tx_json || txObj.tx;
      console.log(`${i+1}. Hash: ${txObj.hash}`);
      console.log(`   Type: ${tx.TransactionType}`);
      console.log(`   Ledger: ${txObj.ledger_index || tx.ledger_index}`);
      if (tx.LimitAmount) {
        console.log(`   LimitAmount: ${tx.LimitAmount.value} ${tx.LimitAmount.currency}`);
      }
      console.log(`   Date: ${tx.date}`);
      console.log('');
    });
    
  } catch (e) {
    console.error(e.message);
  } finally {
    await xrpl.disconnect();
    process.exit(0);
  }
})();
