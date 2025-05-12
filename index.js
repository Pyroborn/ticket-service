require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const ticketRoutes = require('./routes/ticketRoutes');
const services = require('./services/serviceContainer');

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/tickets', ticketRoutes);

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
        .then(() => console.log('Services initialized'))
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