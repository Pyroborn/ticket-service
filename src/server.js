const { createProxyMiddleware } = require('http-proxy-middleware');



// Add proxy routes for local development - Insert this after the middleware setup but before routes
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
