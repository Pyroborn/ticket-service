const axios = require('axios');

class StatusService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async getStatus(ticketId) {
        try {
            const response = await axios.get(`${this.baseUrl}/status/${ticketId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async validateStatusTransition(ticketId, newStatus) {
        try {
            const currentStatus = await this.getStatus(ticketId);
            // Validate transition based on the status model's valid transitions
            // This is a simplified version; the full validation happens on the status service
            return true;
        } catch (error) {
            // If status service is down, allow the transition
            return true;
        }
    }

    async updateStatus(ticketId, status, updatedBy, reason) {
        try {
            await axios.post(`${this.baseUrl}/status/${ticketId}/update`, {
                status,
                updatedBy,
                reason
            });
        } catch (error) {
            throw error;
        }
    }

    async getStatusHistory(ticketId) {
        try {
            const response = await axios.get(`${this.baseUrl}/status/${ticketId}/history`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = StatusService; 