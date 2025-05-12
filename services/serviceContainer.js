'use strict';

const messageQueue = require('./messageQueue');
const StatusService = require('./statusService');

class ServiceContainer {
    constructor() {
        if (!ServiceContainer.instance) {
            this.messageQueue = messageQueue;
            
            // Determine status service URL based on environment
            const isLocal = process.env.IS_LOCAL === 'true';
            const statusServiceUrl = isLocal 
                ? process.env.LOCAL_STATUS_SERVICE_URL || 'http://localhost:4001'
                : process.env.STATUS_SERVICE_URL || 'http://status-service:4001';
            
            console.log(`Using status service at: ${statusServiceUrl}`);
            this.statusService = new StatusService(statusServiceUrl);
            
            ServiceContainer.instance = this;
        }
        return ServiceContainer.instance;
    }

    async init() {
        try {
            await this.messageQueue.init();
            
            // Verify status service connectivity
            try {
                const statusServiceUrl = this.statusService.baseUrl;
                console.log(`Verifying status service connectivity at ${statusServiceUrl}...`);
                
                // Try to hit the health endpoint
                const axios = require('axios');
                const response = await axios.get(`${statusServiceUrl}/health`);
                
                if (response.status === 200) {
                    console.log('Status service is available and healthy');
                } else {
                    console.warn(`Status service returned non-200 status: ${response.status}`);
                }
            } catch (error) {
                console.warn(`Status service connectivity check failed: ${error.message}`);
                console.warn('Service will continue but status functionality may be limited');
            }
        } catch (error) {
            console.warn('Failed to initialize message queue:', error.message);
            console.warn('Service will continue without message queue functionality');
        }
    }

    async close() {
        try {
            await this.messageQueue.close();
        } catch (error) {
            console.warn('Error while closing message queue:', error.message);
        }
    }
}

// Export a singleton instance
module.exports = new ServiceContainer(); 