const axios = require('axios');
const amqp = require('amqplib');
const jwt = require('jsonwebtoken');

// In-memory cache for status history
const statusCache = new Map();
const statusUpdateListeners = new Map();

class StatusService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.channel = null;
        this.connection = null;
        this.token = null; // Service token for authentication
        this.setupRabbitMQ();
    }

    async setupRabbitMQ() {
        try {
            // Don't reconnect if already connected
            if (this.channel) {
                console.log('Already connected to RabbitMQ');
                return this.channel;
            }
            
            console.log('Setting up RabbitMQ for StatusService');
            const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
            console.log(`Connecting to RabbitMQ at ${rabbitUrl}`);
            
            this.connection = await amqp.connect(rabbitUrl);
            this.channel = await this.connection.createChannel();
            
            // Setup exchange and queue
            const EXCHANGE_NAME = 'ticket_events';
            const QUEUE_NAME = 'ticket_service_status_updates';
            const STATUS_ROUTING_KEY = 'ticket.status.updated';
            
            await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
            const q = await this.channel.assertQueue(QUEUE_NAME, { durable: true });
            
            await this.channel.bindQueue(q.queue, EXCHANGE_NAME, STATUS_ROUTING_KEY);
            
            console.log('StatusService: Connected to RabbitMQ, waiting for messages...');
            
            // Set up message handling
            this.channel.consume(q.queue, (msg) => {
                if (msg !== null) {
                    try {
                        const content = JSON.parse(msg.content.toString());
                        console.log('Received status update:', content);
                        
                        if (content.type === 'ticket.status.updated' && content.data) {
                            this.handleStatusUpdate(content.data);
                        }
                        
                        this.channel.ack(msg);
                    } catch (error) {
                        console.error('Error processing status update message:', error);
                        // Reject and don't requeue if it's a parsing error
                        this.channel.nack(msg, false, false);
                    }
                }
            });
            
            // Set up connection event handlers
            this.connection.on('close', () => {
                console.log('RabbitMQ connection closed, attempting to reconnect...');
                this.channel = null;
                this.connection = null;
                setTimeout(() => this.setupRabbitMQ(), 5000);
            });
            
            this.connection.on('error', (error) => {
                console.error('RabbitMQ connection error:', error);
                this.channel = null;
                this.connection = null;
                setTimeout(() => this.setupRabbitMQ(), 5000);
            });
            
            return this.channel;
        } catch (error) {
            console.error('Error setting up RabbitMQ:', error);
            this.channel = null;
            this.connection = null;
            setTimeout(() => this.setupRabbitMQ(), 5000);
            return null;
        }
    }
    
    handleStatusUpdate(data) {
        if (!data.ticketId) {
            console.error('Invalid status update data, missing ticketId:', data);
            return;
        }
        
        // Update the status cache
        const ticketId = data.ticketId;
        let history = statusCache.get(ticketId) || [];
        
        // Add the new status update to history
        history.push({
            status: data.status,
            timestamp: data.timestamp || new Date().toISOString(),
            updatedBy: data.updatedBy || 'system',
            reason: data.reason || 'Status updated'
        });
        
        // Limit history size (keep last 10 updates)
        if (history.length > 10) {
            history = history.slice(-10);
        }
        
        // Update cache
        statusCache.set(ticketId, history);
        
        // Notify any registered listeners
        if (statusUpdateListeners.has(ticketId)) {
            const listeners = statusUpdateListeners.get(ticketId);
            for (const callback of listeners) {
                try {
                    callback({
                        ticketId,
                        currentStatus: data.status,
                        updatedAt: data.timestamp,
                        reason: data.reason,
                        updatedBy: data.updatedBy
                    });
                } catch (error) {
                    console.error('Error calling status update listener:', error);
                }
            }
        }
    }

    // Set the service token for authentication
    setToken(token) {
        this.token = token;
        console.log('StatusService: Token set for authentication');
    }

    // Get authentication headers for requests
    getAuthHeaders() {
        // First, try to use the service API key for service-to-service communication
        if (process.env.SERVICE_API_KEY) {
            return { Authorization: `ApiKey ${process.env.SERVICE_API_KEY}` };
        }
        
        // If service has a token, use that
        if (this.token) {
            return { Authorization: `Bearer ${this.token}` };
        }
        
        // For client-side, get token from storage if available
        if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
            if (token) {
                return { Authorization: `Bearer ${token}` };
            }
        }
        
        console.warn('StatusService: No authentication token available');
        return {};
    }

    // Get the current status for a ticket
    async getStatus(ticketId) {
        try {
            console.log(`Getting status for ticket ${ticketId} from ${this.baseUrl}/status/${ticketId}`);
            
            // Check cache first
            if (statusCache.has(ticketId)) {
                const history = statusCache.get(ticketId);
                const lastEntry = history[history.length - 1];
                console.log(`Using cached status for ticket ${ticketId}: ${lastEntry.status}`);
                
                return {
                    ticketId,
                    currentStatus: lastEntry.status,
                    lastUpdated: lastEntry.timestamp,
                    history: history
                };
            }
            
            // Fetch from API if not in cache
            console.log(`Fetching status for ticket ${ticketId} from API`);
            const response = await axios.get(`${this.baseUrl}/status/${ticketId}`, {
                headers: this.getAuthHeaders(),
                validateStatus: (status) => status < 500 // Don't throw for 4xx errors
            });
            
            if (response.status === 404) {
                console.log(`No status found for ticket ${ticketId}, returning default status`);
                return { currentStatus: 'open', history: [] };
            }
            
            if (response.status !== 200) {
                throw new Error(`Failed to fetch status: ${response.statusText}`);
            }
            
            // Update cache
            if (response.data.history) {
                statusCache.set(ticketId, response.data.history);
            }
            
            return {
                ticketId,
                currentStatus: response.data.currentStatus,
                lastUpdated: response.data.lastUpdated,
                history: response.data.history || []
            };
        } catch (error) {
            console.error(`Error fetching status for ticket ${ticketId}:`, error.message);
            
            // Return cached data if available, even if the request failed
            if (statusCache.has(ticketId)) {
                const history = statusCache.get(ticketId);
                const lastEntry = history[history.length - 1];
                
                return {
                    ticketId,
                    currentStatus: lastEntry.status,
                    lastUpdated: lastEntry.timestamp,
                    history: history,
                    fromCache: true
                };
            }
            
            // Default fallback
            return { currentStatus: 'open', history: [] };
        }
    }

    // Get status history for a ticket
    async getStatusHistory(ticketId, options = {}) {
        try {
            const { limit, startDate, endDate } = options;
            let url = `${this.baseUrl}/status/${ticketId}/history`;
            
            // Add query parameters if present
            const params = new URLSearchParams();
            if (limit) params.append('limit', limit);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            console.log(`Fetching status history for ticket ${ticketId} from ${url}`);
            
            const response = await axios.get(url, {
                headers: this.getAuthHeaders(),
                validateStatus: (status) => status < 500
            });
            
            if (response.status === 404) {
                console.log(`No history found for ticket ${ticketId}`);
                return [];
            }
            
            if (response.status !== 200) {
                throw new Error(`Failed to fetch status history: ${response.statusText}`);
            }
            
            // Update cache with the full history
            statusCache.set(ticketId, response.data);
            
            return response.data;
        } catch (error) {
            console.error(`Error fetching status history for ticket ${ticketId}:`, error.message);
            
            // Return cached history if available
            return statusCache.get(ticketId) || [];
        }
    }

    // Check if a status transition is valid
    async validateStatusTransition(ticketId, newStatus) {
        try {
            const { currentStatus } = await this.getStatus(ticketId);
            
            // Implement proper status transition validation
            const validTransitions = {
                'open': ['in-progress', 'closed'],
                'in-progress': ['resolved', 'closed'],
                'resolved': ['closed', 'in-progress'],
                'closed': []
            };
            
            return validTransitions[currentStatus]?.includes(newStatus) ?? false;
        } catch (error) {
            console.error(`Error validating status transition for ticket ${ticketId}:`, error.message);
            return false;
        }
    }

    // Update status for a ticket
    async updateStatus(ticketId, status, updatedBy, reason) {
        try {
            console.log(`Updating status for ticket ${ticketId} to ${status}`);
            
            const response = await axios.post(`${this.baseUrl}/status/${ticketId}/update`, {
                status,
                updatedBy,
                reason
            }, {
                headers: this.getAuthHeaders()
            });
            
            if (response.status !== 200) {
                throw new Error(`Failed to update status: ${response.statusText}`);
            }
            
            // Update cache with the new status
            if (response.data.history) {
                statusCache.set(ticketId, response.data.history);
            }
            
            console.log(`Successfully updated status for ticket ${ticketId} to ${status}`);
            return response.data;
        } catch (error) {
            console.error(`Error updating status for ticket ${ticketId}:`, error.message);
            throw error;
        }
    }

    // Get real-time status updates for multiple tickets since a specific time
    async getStatusUpdates(ticketIds, since = null) {
        try {
            console.log(`Fetching status updates for ${ticketIds.length} tickets since ${since || 'beginning'}`);
            
            const response = await axios.post(`${this.baseUrl}/status/updates`, {
                ticketIds
            }, {
                headers: this.getAuthHeaders(),
                params: since ? { since } : {}
            });
            
            if (response.status !== 200) {
                throw new Error(`Failed to fetch status updates: ${response.statusText}`);
            }
            
            // Update cache with any new status updates
            const { updates, timestamp } = response.data;
            
            updates.forEach(update => {
                let history = statusCache.get(update.ticketId) || [];
                
                // Only add the latest history if it's not already in the cache
                if (update.latestHistory && (!history.length || 
                    history[history.length - 1].timestamp !== update.latestHistory.timestamp)) {
                    history.push(update.latestHistory);
                    statusCache.set(update.ticketId, history);
                }
            });
            
            console.log(`Received ${updates.length} status updates`);
            return { updates, timestamp };
        } catch (error) {
            console.error('Error fetching status updates:', error.message);
            return { updates: [], timestamp: new Date().toISOString() };
        }
    }

    // Get batch status for multiple tickets
    async getBatchStatus(ticketIds) {
        try {
            console.log(`Fetching batch status for ${ticketIds.length} tickets`);
            
            const response = await axios.post(`${this.baseUrl}/status/batch`, {
                ticketIds
            }, {
                headers: this.getAuthHeaders()
            });
            
            if (response.status !== 200) {
                throw new Error(`Failed to fetch batch status: ${response.statusText}`);
            }
            
            console.log(`Received batch status for ${Object.keys(response.data).length} tickets`);
            return response.data;
        } catch (error) {
            console.error('Error fetching batch status:', error.message);
            
            // Construct response from cache as fallback
            const result = {};
            ticketIds.forEach(ticketId => {
                if (statusCache.has(ticketId)) {
                    const history = statusCache.get(ticketId);
                    const lastEntry = history[history.length - 1];
                    result[ticketId] = {
                        currentStatus: lastEntry.status,
                        lastUpdated: lastEntry.timestamp
                    };
                } else {
                    result[ticketId] = {
                        currentStatus: 'unknown',
                        lastUpdated: null
                    };
                }
            });
            
            return result;
        }
    }

    // Subscribe to real-time status updates for a ticket
    subscribeToStatusUpdates(ticketId, callback) {
        if (!statusUpdateListeners.has(ticketId)) {
            statusUpdateListeners.set(ticketId, new Set());
        }
        
        statusUpdateListeners.get(ticketId).add(callback);
        console.log(`Subscribed to status updates for ticket ${ticketId}`);
        
        return () => {
            if (statusUpdateListeners.has(ticketId)) {
                statusUpdateListeners.get(ticketId).delete(callback);
                console.log(`Unsubscribed from status updates for ticket ${ticketId}`);
            }
        };
    }

    // Close any open connections
    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            console.log('StatusService: RabbitMQ connections closed');
        } catch (error) {
            console.error('Error closing StatusService connections:', error);
        } finally {
            this.channel = null;
            this.connection = null;
        }
    }
}

module.exports = StatusService; 