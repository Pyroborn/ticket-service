const jwt = require('jsonwebtoken');
const axios = require('axios');
const jwtConfig = require('../config/jwt');

// Get user service URL from environment or use default
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3003';

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        
        // First try local verification for better performance
        try {
            const decoded = jwtConfig.verifyToken(token);
            if (decoded) {
                // Local verification succeeded
                req.user = decoded;
                
                // Set X-User-Id header for backward compatibility
                req.headers['x-user-id'] = decoded.userId || decoded.id;
                
                next();
                return;
            }
        } catch (localError) {
            console.log('Local token verification failed, trying user service:', localError.message);
            // Continue to user service verification if local verification fails
        }
        
        try {
            // Forward token verification to user-service as fallback
            const response = await axios.get(`${USER_SERVICE_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // User service validated the token
            const userData = response.data;
            
            // Add user info to request
            req.user = userData;
            
            // Set X-User-Id header for backward compatibility
            req.headers['x-user-id'] = userData.userId || userData.id;
            
            next();
        } catch (error) {
            console.error('Token verification failed:', error.message);
            
            if (error.response) {
                // Forward the status and error message from user service
                return res.status(error.response.status).json({ 
                    error: error.response.data.error || 'Invalid token'
                });
            }
            
            return res.status(401).json({ error: 'Failed to verify token' });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

module.exports = authMiddleware; 