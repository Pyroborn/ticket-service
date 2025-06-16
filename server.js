const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

// Development proxy configuration
if (process.env.NODE_ENV !== 'production') {
  console.log('Setting up development proxy middleware for microservices');
  
  // API service proxies
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


// SPA fallback route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Ticket service running on port ${PORT}`);
}); 