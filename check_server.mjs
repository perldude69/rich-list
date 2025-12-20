import XRPLService from './services/xrplService.mjs';

(async () => {
  const xrpl = new XRPLService();
  try {
    await xrpl.connect();
    const response = await xrpl.request({ command: 'server_info' });
    const info = response.result.info;
    console.log('Current ledger:', info.validated_ledger.seq);
    console.log('Complete ledgers:', info.complete_ledgers);
    console.log('Server state:', info.server_state);
  } catch (e) {
    console.error(e.message);
  } finally {
    await xrpl.disconnect();
    process.exit(0);
  }
})();
