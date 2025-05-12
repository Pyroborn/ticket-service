const amqp = require('amqplib');

// Mock environment variables
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

// Import the actual module implementation
const messageQueue = jest.requireActual('../../services/messageQueue');

// Debug what we're importing
console.log('Imported messageQueue:', {
    functions: Object.keys(messageQueue),
    hasInit: typeof messageQueue.init === 'function',
    hasClose: typeof messageQueue.close === 'function'
});

// Create mock channel and connection
const mockChannel = {
    assertExchange: jest.fn().mockResolvedValue({}),
    publish: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue({})
};

const mockConnection = {
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    close: jest.fn().mockResolvedValue({})
};

// Mock amqplib
jest.mock('amqplib', () => ({
    connect: jest.fn().mockImplementation(() => Promise.resolve(mockConnection))
}));

describe('Message Queue Service', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock timer functions
        jest.useFakeTimers();
        
        // Setup amqp mock
        amqp.connect.mockResolvedValue(mockConnection);
    });

    afterEach(async () => {
        // Clean up after each test
        await messageQueue.close();
        jest.useRealTimers();
    });

    describe('initialization', () => {
        it('should connect to RabbitMQ and create a channel', async () => {
            await messageQueue.init();
            
            expect(amqp.connect).toHaveBeenCalledWith(process.env.RABBITMQ_URL);
            expect(mockConnection.createChannel).toHaveBeenCalled();
            expect(mockChannel.assertExchange).toHaveBeenCalledWith(
                messageQueue.exchangeName,
                'topic',
                { durable: true }
            );
        });

        it('should retry connection on failure', async () => {
            const error = new Error('Connection failed');
            amqp.connect
                .mockRejectedValueOnce(error)
                .mockResolvedValueOnce(mockConnection);
            
            // Start initialization
            const initPromise = messageQueue.init();
            
            // Fast-forward past the retry timeout
            await jest.advanceTimersByTimeAsync(5000);
            
            // Wait for init to complete
            await initPromise;
            
            expect(amqp.connect).toHaveBeenCalledTimes(2);
            expect(amqp.connect).toHaveBeenCalledWith(process.env.RABBITMQ_URL);
        });
    });

    describe('event publishing', () => {
        beforeEach(async () => {
            // Initialize the queue and wait for connection
            await messageQueue.init();
            // Clear the initialization calls
            jest.clearAllMocks();
        });

        it('should publish ticket created event', async () => {
            const ticket = {
                _id: '123',
                title: 'Test Ticket',
                status: 'open',
                createdBy: 'user1'
            };

            await messageQueue.publishTicketCreated(ticket);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                messageQueue.exchangeName,
                'ticket.created',
                expect.any(Buffer),
                expect.objectContaining({
                    persistent: true,
                    contentType: 'application/json'
                })
            );
        });

        it('should publish ticket updated event with status change', async () => {
            const ticket = {
                _id: '123',
                title: 'Test Ticket',
                status: 'in-progress'
            };

            await messageQueue.publishTicketUpdated(ticket, 'open');

            expect(mockChannel.publish).toHaveBeenCalledWith(
                messageQueue.exchangeName,
                'ticket.status_changed',
                expect.any(Buffer),
                expect.objectContaining({
                    persistent: true,
                    contentType: 'application/json'
                })
            );
        });

        it('should not publish update event if status has not changed', async () => {
            const ticket = {
                _id: '123',
                title: 'Test Ticket',
                status: 'open'
            };

            await messageQueue.publishTicketUpdated(ticket, 'open');

            expect(mockChannel.publish).not.toHaveBeenCalled();
        });

        it('should publish ticket deleted event', async () => {
            const ticketId = '123';

            await messageQueue.publishTicketDeleted(ticketId);

            expect(mockChannel.publish).toHaveBeenCalledWith(
                messageQueue.exchangeName,
                'ticket.deleted',
                expect.any(Buffer),
                expect.objectContaining({
                    persistent: true,
                    contentType: 'application/json'
                })
            );
        });
    });

    describe('cleanup', () => {
        beforeEach(async () => {
            // Initialize the queue and wait for connection
            await messageQueue.init();
            // Clear the initialization calls
            jest.clearAllMocks();
        });

        it('should close channel and connection', async () => {
            await messageQueue.close();
            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
        });

        it('should handle errors during closure gracefully', async () => {
            // First ensure we have an active connection
            await messageQueue.init();
            
            // Setup error mocks
            const error = new Error('Close failed');
            mockChannel.close.mockRejectedValueOnce(error);
            mockConnection.close.mockRejectedValueOnce(error);

            // Clear previous calls
            jest.clearAllMocks();

            // Attempt to close
            await messageQueue.close();

            // Verify both close methods were called despite errors
            expect(mockChannel.close).toHaveBeenCalled();
            expect(mockConnection.close).toHaveBeenCalled();
        });
    });
}); 
 