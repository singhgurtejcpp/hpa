const http = require('http');

const PORT = process.env.PORT || 3000;

function add(a, b) {
  return a + b;
}

function greet(name) {
  if (!name) {
    return 'Hello, stranger!';
  }
  return `Hello, ${name}!`;
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: greet('DevOps Change Velocity'),
    version: process.env.APP_VERSION || 'dev',
    timestamp: new Date().toISOString(),
  }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
  });
}

module.exports = { add, greet, server };
