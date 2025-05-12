'use strict';

const amqp = require('amqplib');

// Private variables
let channel = null;
let connection = null;
const exchangeName = 'ticket_events';
const url = process.env.RABBITMQ_URL;

// Initialize the connection
const init = async () => {
    try {
        if (!url) {
            throw new Error('RABBITMQ_URL environment variable is not set');
        }
        connection = await amqp.connect(url);
        channel = await connection.createChannel();
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        return true;
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        // Schedule reconnection
        setTimeout(() => init(), 5000);
        return false;
    }
};

// Helper function to publish events
const publishEvent = async (routingKey, data) => {
    if (!channel) {
        throw new Error('RabbitMQ channel not initialized');
    }

    const message = Buffer.from(JSON.stringify(data));
    return channel.publish(exchangeName, routingKey, message, {
        persistent: true,
        contentType: 'application/json'
    });
};

// Public functions
const publishTicketCreated = async (ticket) => {
    return publishEvent('ticket.created', {
        id: ticket._id,
        title: ticket.title,
        status: ticket.status,
        createdBy: ticket.createdBy
    });
};

const publishTicketUpdated = async (ticket, previousStatus) => {
    if (ticket.status !== previousStatus) {
        return publishEvent('ticket.status_changed', {
            id: ticket._id,
            title: ticket.title,
            previousStatus,
            newStatus: ticket.status
        });
    }
};

const publishTicketDeleted = async (ticketId) => {
    return publishEvent('ticket.deleted', {
        id: ticketId
    });
};

const close = async () => {
    let channelError = null;
    let connectionError = null;

    // Try to close channel
    if (channel) {
        try {
            await channel.close();
        } catch (error) {
            channelError = error;
            console.error('Error closing RabbitMQ channel:', error);
        } finally {
            channel = null;
        }
    }

    // Try to close connection
    if (connection) {
        try {
            await connection.close();
        } catch (error) {
            connectionError = error;
            console.error('Error closing RabbitMQ connection:', error);
        } finally {
            connection = null;
        }
    }

    // If either operation failed, throw combined error
    if (channelError || connectionError) {
        console.error('Error closing RabbitMQ connections:', { channelError, connectionError });
    }
};

// Export public functions and properties
module.exports = {
    init,
    publishTicketCreated,
    publishTicketUpdated,
    publishTicketDeleted,
    close,
    // Properties for testing
    get url() { return url; },
    get exchangeName() { return exchangeName; }
}; 