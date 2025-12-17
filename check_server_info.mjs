import XRPLService from './services/xrplService.mjs';

const xrpl = new XRPLService();

(async () => {
  try {
    await xrpl.connect();
    
    const response = await xrpl.request({
      command: 'server_info'
    });
    
    console.log(JSON.stringify(response.result.info, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
