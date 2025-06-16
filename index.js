require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const ticketRoutes = require('./routes/ticketRoutes');
const services = require('./services/serviceContainer');
const authRoutes = require('./routes/auth');

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Development proxy configuration
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  console.log('Setting up development proxies for microservices');
  
  // Path-based routing proxy middleware
  const createProxy = (targetHost, targetPort) => {
    return (req, res) => {
      // Request logging
      if (!req.path.includes('/health')) {
        console.log(`[PROXY] ${req.method} ${req.path.substring(0, 30)}...`);
      }
      
      // Request options
      const options = {
        hostname: targetHost,
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers }
      };
      
      // Remove host header
      delete options.headers.host;
      
      const isFileUpload = req.headers['content-type'] && 
                          req.headers['content-type'].includes('multipart/form-data');
                          
      const isFileDownload = req.path.includes('/download') || req.path.includes('/files/download');
      
      // File upload handling
      if (isFileUpload) {
        // Create request for file upload
        const proxyReq = http.request(options);
        
        proxyReq.on('error', (err) => {
          console.error('Proxy error during file upload:', err.message);
          if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway', message: err.message });
          }
        });
        
        // Stream request data
        req.on('data', (chunk) => {
          proxyReq.write(chunk);
        });
        
        req.on('end', () => {
          proxyReq.end();
        });
        
        // Process response
        proxyReq.on('response', (proxyRes) => {
          // Copy status and headers
          res.status(proxyRes.statusCode);
          Object.keys(proxyRes.headers).forEach(key => {
            res.setHeader(key, proxyRes.headers[key]);
          });
          
          // Stream response data
          proxyRes.on('data', (chunk) => {
            res.write(chunk);
          });
          
          proxyRes.on('end', () => {
            res.end();
          });
        });
        
        return;
      }
      
      // File download handling
      if (isFileDownload) {
        // Add request tracking ID
        const requestId = Date.now();
        if (options.path.includes('?')) {
          options.path += `&proxyRequestId=${requestId}`;
        } else {
          options.path += `?proxyRequestId=${requestId}`;
        }
        
        // Bypass message queue
        options.headers['X-No-Queue'] = 'true';
        
        // Create download request
        const proxyReq = http.request(options, (proxyRes) => {
          // Track data transfer
          let bytesSent = 0;
          
          // Copy response headers
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          
          // Stream directly to client
          proxyRes.pipe(res);
          
          // Handle response errors
          proxyRes.on('error', (err) => {
            console.error('Download stream error:', err.message);
            try {
              res.end();
            } catch (endError) {}
          });
          
          // Monitor data transfer
          proxyRes.on('data', (chunk) => {
            bytesSent += chunk.length;
          });
          
          // Log completion
          proxyRes.on('end', () => {
            // Summary logging
            if (proxyRes.statusCode === 200) {
              console.log(`[PROXY] Download completed: ${(bytesSent / 1024).toFixed(1)} KB`);
            } else {
              console.log(`[PROXY] Download failed: ${proxyRes.statusCode}`);
            }
          });
        });
        
        // Handle request errors
        proxyReq.on('error', (err) => {
          console.error('Proxy error during file download:', err.message);
          if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway', message: err.message });
          } else {
            try { res.end(); } catch (e) {}
          }
        });
        
        // Complete the request
        proxyReq.end();
        
        return;
      }
      
      // Standard API request handling
      const proxyReq = http.request(options);
      
      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad Gateway', message: err.message });
        }
      });
      
      // Handle request body for POST/PUT
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
      
      proxyReq.end();
      
      // Process the response
      proxyReq.on('response', (proxyRes) => {
        // Copy status and headers
        res.status(proxyRes.statusCode);
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        
        console.log(`[PROXY] Response: ${proxyRes.statusCode}`);
        
        // Forward response data
        proxyRes.on('data', (chunk) => {
          res.write(chunk);
        });
        
        proxyRes.on('end', () => {
          res.end();
        });
      });
    };
  };
  
  // Service proxy routes
  app.use('/api/users', createProxy('localhost', 3003));
  app.use('/api/status', createProxy('localhost', 4001));
  app.use('/api/files', createProxy('localhost', 3004));
}

// Index HTML server
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    res.send(html);
});

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ticket-service' });
});

// Kubernetes liveness probe
app.get('/health/live', (req, res) => {
    console.log('Liveness probe called');
    res.status(200).json({ status: 'live', service: 'ticket-service' });
});

// Kubernetes readiness probe
app.get('/health/ready', (req, res) => {
    // Check MongoDB connection
    const isMongoConnected = mongoose.connection.readyState === 1;
    
    // Check message queue status
    const isMessageQueueReady = services.isReady ? services.isReady() : true;
    
    if (isMongoConnected && isMessageQueueReady) {
        console.log('Readiness probe: service is ready');
        res.status(200).json({ 
            status: 'ready', 
            service: 'ticket-service',
            mongo: isMongoConnected,
            services: isMessageQueueReady
        });
    } else {
        console.log('Readiness probe: service not ready', { 
            mongo: isMongoConnected, 
            services: isMessageQueueReady 
        });
        res.status(503).json({ 
            status: 'not ready', 
            mongo: isMongoConnected,
            services: isMessageQueueReady
        });
    }
});

let server;

// Database and service initialization
if (process.env.NODE_ENV !== 'test') {
    // MongoDB connection
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ticket-service', {})
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));

    // Service initialization
    services.init()
        .then(result => {
            if (result.success) {
                console.log(`Services initialized successfully: ${result.successes.join(', ')}`);
                if (result.errors.length > 0) {
                    console.warn('Some services had initialization errors:');
                    result.errors.forEach(err => {
                        console.warn(`- ${err.service}: ${err.error}`);
                    });
                }
            } else {
                console.error('Failed to initialize critical services');
            }
        })
        .catch(err => console.error('Service initialization error:', err));
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Server startup for non-test environments
if (require.main === module && process.env.NODE_ENV !== 'test') {
    server = app.listen(port, () => {
        console.log(`Ticket service listening on port ${port}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('Shutting down gracefully...');
        
        if (server) {
            server.close(() => {
                console.log('HTTP server closed');
            });
        }
        
        try {
            await services.close();
            await mongoose.connection.close();
            console.log('Connections closed');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    };

    // Signal handlers
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// Export for testing
module.exports = { app };
