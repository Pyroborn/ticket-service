'use strict';

const amqp = require('amqplib');

// Private variables
let channel = null;
let connection = null;
const EXCHANGE_NAME = 'ticket_events';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

// Initialize connection to RabbitMQ
async function init() {
    try {
        if (channel) {
            console.log('RabbitMQ connection already established.');
            return;
        }

        console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        
        // Create a durable topic exchange for ticket events
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        
        console.log('Successfully connected to RabbitMQ and created exchange.');

        // Add connection event handlers for recovery
        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err);
            channel = null;
            setTimeout(init, 5000);
        });

        connection.on('close', () => {
            console.log('RabbitMQ connection closed');
            channel = null;
            setTimeout(init, 5000);
        });
        
        return channel;
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        channel = null;
        setTimeout(init, 5000);
    }
}

// Helper function to publish events
async function publishEvent(routingKey, data) {
    try {
        if (!channel) {
            await init();
        }
        
        const success = channel.publish(
            EXCHANGE_NAME,
            routingKey,
            Buffer.from(JSON.stringify(data)),
            { persistent: true }
        );
        
        if (success) {
            console.log(`Published event to ${routingKey}:`, data);
        } else {
            console.error(`Failed to publish event to ${routingKey}`);
        }
        
        return success;
    } catch (error) {
        console.error(`Error publishing to ${routingKey}:`, error);
        return false;
    }
}

// Publish ticket created event
async function publishTicketCreated(ticket) {
    return publishEvent('ticket.created', {
        type: 'ticket.created',
        data: {
            id: ticket._id.toString(),
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            assignedTo: ticket.assignedTo,
            createdBy: ticket.createdBy,
            createdAt: ticket.createdAt,
            userId: ticket.userId,
            timestamp: new Date().toISOString()
        }
    });
}

// Publish ticket updated event with update reason
async function publishTicketUpdated(ticket, previousStatus, reason = 'General update') {
    return publishEvent('ticket.updated', {
        type: 'ticket.updated',
        data: {
            id: ticket._id.toString(),
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            assignedTo: ticket.assignedTo, 
            updatedBy: ticket.updatedBy,
            previousStatus,
            currentStatus: ticket.status,
            reason: reason,
            timestamp: new Date().toISOString()
        }
    });
}

// Publish ticket status change event
async function publishTicketStatusChanged(ticketId, previousStatus, newStatus, updatedBy, reason) {
    return publishEvent('ticket.status.changed', {
        type: 'ticket.status.changed',
        data: {
            id: ticketId,
            previousStatus,
            currentStatus: newStatus,
            updatedBy,
            reason,
            timestamp: new Date().toISOString()
        }
    });
}

// Publish ticket assigned event
async function publishTicketAssigned(ticket, assignedBy, previousAssignee = null) {
    return publishEvent('ticket.assigned', {
        type: 'ticket.assigned',
        data: {
            id: ticket._id.toString(),
            title: ticket.title,
            assignedTo: ticket.assignedTo,
            assignedBy: assignedBy,
            previousAssignee,
            timestamp: new Date().toISOString()
        }
    });
}

// Publish ticket resolved event
async function publishTicketResolved(ticket, resolvedBy, reason = 'Issue resolved') {
    return publishEvent('ticket.resolved', {
        type: 'ticket.resolved',
        data: {
            id: ticket._id.toString(),
            title: ticket.title,
            resolvedBy,
            reason,
            timestamp: new Date().toISOString()
        }
    });
}

// Publish ticket deleted event
async function publishTicketDeleted(ticketId) {
    return publishEvent('ticket.deleted', {
        type: 'ticket.deleted',
        data: {
            id: ticketId,
            timestamp: new Date().toISOString()
        }
    });
}

// Close RabbitMQ connections
async function close() {
    try {
        if (channel) {
            await channel.close();
        }
        if (connection) {
            await connection.close();
        }
        console.log('RabbitMQ connections closed');
    } catch (error) {
        console.error('Error closing RabbitMQ connections:', error);
    } finally {
        channel = null;
        connection = null;
    }
}

module.exports = {
    init,
    publishTicketCreated,
    publishTicketUpdated,
    publishTicketStatusChanged,
    publishTicketAssigned,
    publishTicketResolved,
    publishTicketDeleted,
    close,
    get isConnected() {
        return channel !== null && connection !== null;
    }
}; 