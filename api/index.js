const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const { url, method } = req;
  if (method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Match /api/lines/line1, /api/lines/line2, /api/lines/line4
  const match = url.match(/^\/api\/lines\/(line[124])$/);
  if (match) {
    const lineFile = match[1] + '.json';
    const filePath = path.join(__dirname, '../lines', lineFile);
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(data);
    } catch (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Line not found' }));
    }
    return;
  }

  // Not found
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
};

function fetchStatusAndAlerts() {
  fetch('/api/status')
    .then(r => r.json())
    .then(data => {
      // Update your sidebar or map with status/alerts
      // Example: document.getElementById('status').innerText = data.status;
    })
    .catch(err => {
      // Handle error
    });
} 