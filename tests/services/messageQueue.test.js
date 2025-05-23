const amqp = require('amqplib');

// Mock environment variables
process.env.RABBITMQ_URL = 'amqp://localhost:5672';

// Import message queue service
const MessageQueue = require('../../services/messageQueue').MessageQueue;

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
    connect: jest.fn().mockResolvedValue({})
}));

describe('Message Queue Service', () => {
    let messageQueue;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock successful connection
        amqp.connect.mockResolvedValue(mockConnection);
        
        // Create a new instance for each test
        messageQueue = new MessageQueue();
        
        // Manually set properties that would be initialized during init()
        messageQueue.connection = mockConnection;
        messageQueue.channel = mockChannel;
        messageQueue.isInitialized = true;
        messageQueue.exchangeName = 'tickets';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Message Queue API', () => {
        it('should have required methods', () => {
            expect(typeof messageQueue.init).toBe('function');
            expect(typeof messageQueue.publishTicketCreated).toBe('function');
            expect(typeof messageQueue.publishTicketUpdated).toBe('function');
            expect(typeof messageQueue.publishTicketDeleted).toBe('function');
            expect(typeof messageQueue.close).toBe('function');
        });
        
        it('should have the correct exchange name', () => {
            expect(messageQueue.exchangeName).toBe('tickets');
        });
    });

    describe('Event methods', () => {
        it('should have publishing methods', () => {
            // Basic API test
            const ticket = { _id: '123', title: 'Test Ticket' };
            
            // These should not throw errors
            expect(() => messageQueue.publishTicketCreated(ticket)).not.toThrow();
            expect(() => messageQueue.publishTicketUpdated(ticket, 'old-status')).not.toThrow();
            expect(() => messageQueue.publishTicketDeleted('123')).not.toThrow();
        });
    });
}); 
 