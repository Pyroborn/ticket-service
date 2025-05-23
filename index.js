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

// Only proxy in development mode, in Kubernetes we use Ingress
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  console.log('Setting up development proxies for microservices');
  
  // Simple proxy middleware that works with the path-based routing pattern
  const createProxy = (targetHost, targetPort) => {
    return (req, res) => {
      // Minimal logging of request
      if (!req.path.includes('/health')) {
        console.log(`[PROXY] ${req.method} ${req.path.substring(0, 30)}...`);
      }
      
      // Create options for the request
      const options = {
        hostname: targetHost,
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: { ...req.headers }
      };
      
      // Remove problematic headers
      delete options.headers.host;
      
      const isFileUpload = req.headers['content-type'] && 
                          req.headers['content-type'].includes('multipart/form-data');
                          
      const isFileDownload = req.path.includes('/download') || req.path.includes('/files/download');
      
      // For file uploads, we need special handling to avoid duplicates
      if (isFileUpload) {
        // Custom handling for file uploads (multipart/form-data)
        const proxyReq = http.request(options);
        
        proxyReq.on('error', (err) => {
          console.error('Proxy error during file upload:', err.message);
          if (!res.headersSent) {
            res.status(502).json({ error: 'Bad Gateway', message: err.message });
          }
        });
        
        // Manual handling of request data to prevent Express from double-processing
        req.on('data', (chunk) => {
          proxyReq.write(chunk);
        });
        
        req.on('end', () => {
          proxyReq.end();
        });
        
        // Process the response
        proxyReq.on('response', (proxyRes) => {
          // Copy status and headers
          res.status(proxyRes.statusCode);
          Object.keys(proxyRes.headers).forEach(key => {
            res.setHeader(key, proxyRes.headers[key]);
          });
          
          // Forward response data
          proxyRes.on('data', (chunk) => {
            res.write(chunk);
          });
          
          proxyRes.on('end', () => {
            res.end();
          });
        });
        
        return;
      }
      
      // For file downloads, use an optimized proxy that doesn't lose connection
      if (isFileDownload) {
        // Add a request ID parameter for tracking download requests
        const requestId = Date.now();
        if (options.path.includes('?')) {
          options.path += `&proxyRequestId=${requestId}`;
        } else {
          options.path += `?proxyRequestId=${requestId}`;
        }
        
        // Add header to avoid message queue processing
        options.headers['X-No-Queue'] = 'true';
        
        // Create request with callback to avoid duplicates
        const proxyReq = http.request(options, (proxyRes) => {
          // Track data transfer for debugging
          let bytesSent = 0;
          
          // Copy response headers
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          
          // Stream directly to client
          proxyRes.pipe(res);
          
          // Handle errors in the proxy response
          proxyRes.on('error', (err) => {
            console.error('Download stream error:', err.message);
            try {
              res.end();
            } catch (endError) {}
          });
          
          // Optional tracking
          proxyRes.on('data', (chunk) => {
            bytesSent += chunk.length;
          });
          
          // Log completion
          proxyRes.on('end', () => {
            // Only log summary to avoid noise
            if (proxyRes.statusCode === 200) {
              console.log(`[PROXY] Download completed: ${(bytesSent / 1024).toFixed(1)} KB`);
            } else {
              console.log(`[PROXY] Download failed: ${proxyRes.statusCode}`);
            }
          });
        });
        
        // Handle errors in the request
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
      
      // Standard request handling (JSON APIs, etc.)
      const proxyReq = http.request(options);
      
      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad Gateway', message: err.message });
        }
      });
      
      // For any request with a body (like POST/PUT)
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
        
        // Forward response data without using pipe to avoid duplicates
        proxyRes.on('data', (chunk) => {
          res.write(chunk);
        });
        
        proxyRes.on('end', () => {
          res.end();
        });
      });
    };
  };
  
  // Set up proxy routes for each service
  app.use('/api/users', createProxy('localhost', 3003));
  app.use('/api/status', createProxy('localhost', 4001));
  app.use('/api/files', createProxy('localhost', 3004));
}

// Custom middleware to serve index.html
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    let html = fs.readFileSync(indexPath, 'utf8');
    res.send(html);
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/tickets', ticketRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

let server;

// Only initialize services and connect to MongoDB if not in test environment
if (process.env.NODE_ENV !== 'test') {
    // Connect to MongoDB
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ticket-service', {})
        .then(() => console.log('Connected to MongoDB'))
        .catch(err => console.error('MongoDB connection error:', err));

    // Initialize services
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

// Only start the server if this file is run directly and not in test mode
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

    // Handle shutdown signals
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// Export for testing
module.exports = { app };