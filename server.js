const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

//  proxy routes for local development
if (process.env.NODE_ENV !== 'production') {
  console.log('Setting up development proxy middleware for microservices');
  
  // Proxy API requests to other services
  app.use('/api/users', createProxyMiddleware({ 
    target: 'http://localhost:3003',
    pathRewrite: {'^/api/users': ''},
    logLevel: 'debug'
  }));
  
  app.use('/api/status', createProxyMiddleware({ 
    target: 'http://localhost:4001',
    pathRewrite: {'^/api/status': ''},
    logLevel: 'debug'
  }));
  
  app.use('/api/files', createProxyMiddleware({ 
    target: 'http://localhost:3004',
    pathRewrite: {'^/api/files': ''},
    logLevel: 'debug'
  }));
}


// Fallback route handler for the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Ticket service running on port ${PORT}`);
}); 