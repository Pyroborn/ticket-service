const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get user service URL from environment or use default
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3003';

// JWT verification endpoint - forwards to user service
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        try {
            // Forward verification to user service
            const response = await axios.get(`${USER_SERVICE_URL}/auth/verify`, {
                headers: {
                    'Authorization': authHeader
                }
            });
            
            // Forward the verified user data from the user service
            return res.json(response.data);
        } catch (error) {
            console.error('Error forwarding verification to user service:', error.message);
            
            // Forward the error from user service
            if (error.response) {
                return res.status(error.response.status).json(error.response.data);
            }
            
            return res.status(500).json({ error: 'Failed to verify token with user service' });
        }
    } catch (error) {
        console.error('Auth verify error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router; 