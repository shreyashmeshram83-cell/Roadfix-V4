const http = require('http');

const data = JSON.stringify({
  email: 'admin@roadfix.com',
  password: 'admin123'
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const json = JSON.parse(body);
    const token = json.token;
    console.log('Got token, proceeding to trigger a complaint update...');
    
    // Attempt update
    const updateData = JSON.stringify({ status: 'in_progress', remarks: 'test' });
    const ureq = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/complaints/123/status', // wait, I need a valid ID
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }, (ures) => {
      let ubody = '';
      ures.on('data', chunk => ubody += chunk);
      ures.on('end', () => console.log('UPDATE RESPONSE:', ures.statusCode, ubody));
    });
    ureq.write(updateData);
    ureq.end();
  });
});

req.write(data);
req.end();
