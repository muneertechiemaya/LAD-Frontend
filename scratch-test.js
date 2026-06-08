const tenantId = '4646f6c9-7432-47a2-ab5e-7ce7665caba0';
const url = 'https://lad-waba-comms-develop-asia-160078175457.asia-south1.run.app/api/contacts?limit=5';

fetch(url, {
  headers: {
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json'
  }
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => {
  console.log('Response:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err);
});
