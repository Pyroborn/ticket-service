const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// Increase timeout for slow operations
jest.setTimeout(30000);

// Mock RabbitMQ connection
jest.mock('../services/messageQueue', () => {
    const mockInstance = {
        init: jest.fn().mockResolvedValue(undefined),
        publishTicketCreated: jest.fn().mockResolvedValue(undefined),
        publishTicketUpdated: jest.fn().mockResolvedValue(undefined),
        publishTicketDeleted: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined)
    };

    return {
        instance: mockInstance,
        MessageQueue: jest.fn().mockImplementation(() => mockInstance)
    };
});

beforeAll(async () => {
    // Close any existing connections
    await mongoose.disconnect();
    
    // Create new in-memory database
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    
    // Connect with updated options
    await mongoose.connect(uri);
});

beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany();
    }
});

afterAll(async () => {
    // Close mongoose connection and stop mongod
    await mongoose.disconnect();
    await mongod.stop();
}); 