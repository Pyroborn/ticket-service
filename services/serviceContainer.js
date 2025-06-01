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
        console.log('Initializing services...');
        let initSuccesses = [];
        let initErrors = [];

        try {
            await this.messageQueue.init();
            console.log('Message queue initialized successfully');
            initSuccesses.push('messageQueue');
        } catch (error) {
            console.error('Failed to initialize message queue:', error.message);
            initErrors.push({ service: 'messageQueue', error: error.message });
        }
            
        // Verify status service connectivity
        try {
            const statusServiceUrl = this.statusService.baseUrl;
            console.log(`Verifying status service connectivity at ${statusServiceUrl}...`);
            
            // Try to hit the health endpoint
            const axios = require('axios');
            const response = await axios.get(`${statusServiceUrl}/health`);
            
            if (response.status === 200) {
                console.log('Status service is available and healthy');
                initSuccesses.push('statusService');
            } else {
                console.warn(`Status service returned non-200 status: ${response.status}`);
                initErrors.push({ service: 'statusService', error: `Status service returned ${response.status}` });
            }
        } catch (error) {
            console.warn(`Status service connectivity check failed: ${error.message}`);
            console.warn('Service will continue but status functionality may be limited');
            initErrors.push({ service: 'statusService', error: error.message });
        }

        // Initialize RabbitMQ for status service
        try {
            await this.statusService.setupRabbitMQ();
            console.log('Status service RabbitMQ connected successfully');
            initSuccesses.push('statusServiceRabbitMQ');
        } catch (error) {
            console.error('Failed to initialize status service RabbitMQ:', error.message);
            initErrors.push({ service: 'statusServiceRabbitMQ', error: error.message });
        }

        if (initErrors.length > 0) {
            console.warn(`Services initialized with warnings: ${initErrors.length} errors, ${initSuccesses.length} successes`);
        } else {
            console.log('Services initialized successfully');
        }

        return {
            success: initSuccesses.length > 0,
            successes: initSuccesses,
            errors: initErrors
        };
    }

    async close() {
        let closeErrors = [];
        
        try {
            await this.messageQueue.close();
            console.log('Message queue connections closed');
        } catch (error) {
            console.warn('Error while closing message queue:', error.message);
            closeErrors.push({ service: 'messageQueue', error: error.message });
        }
        
        try {
            await this.statusService.close();
            console.log('Status service connections closed');
        } catch (error) {
            console.warn('Error while closing status service:', error.message);
            closeErrors.push({ service: 'statusService', error: error.message });
        }
        
        if (closeErrors.length > 0) {
            console.warn(`Services closed with warnings: ${closeErrors.length} errors`);
        } else {
            console.log('All services closed successfully');
        }

        return {
            success: closeErrors.length === 0,
            errors: closeErrors
        };
    }

    // Check if critical services are ready
    isReady() {
        // Check message queue readiness
        const isMessageQueueReady = this.messageQueue && this.messageQueue.isConnected;
        
        // Add any other critical service checks here
        const isStatusServiceReady = this.statusService !== undefined;
        
        // Return true only if all critical services are ready
        return isMessageQueueReady && isStatusServiceReady;
    }
}

// Export a singleton instance
module.exports = new ServiceContainer(); 