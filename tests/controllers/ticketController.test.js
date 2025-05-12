const request = require('supertest');
const mongoose = require('mongoose');
const Ticket = require('../../models/ticket');

// Mock the service container
jest.mock('../../services/serviceContainer', () => ({
    statusService: {
        validateStatusTransition: jest.fn().mockResolvedValue(true),
        updateStatus: jest.fn().mockResolvedValue({ status: 'open' }),
        getStatus: jest.fn().mockResolvedValue({ status: 'open' }),
        getStatusHistory: jest.fn().mockResolvedValue([{ status: 'open', updatedAt: new Date() }])
    },
    messageQueue: {
        publishTicketCreated: jest.fn().mockResolvedValue(true),
        publishTicketUpdated: jest.fn().mockResolvedValue(true),
        publishTicketDeleted: jest.fn().mockResolvedValue(true)
    },
    init: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true)
}));

// Import the app and services
const services = require('../../services/serviceContainer');

// Import app after mocking services to avoid initialization
const { app } = require('../../index');

describe('Ticket Controller', () => {
    beforeAll(async () => {
        // Use the MongoDB memory server connection from setup.js
        // No need to create a new connection here
    });

    afterAll(async () => {
        // Connection cleanup is handled in setup.js
    });

    const sampleTicket = {
        title: 'Test Ticket',
        description: 'Test Description',
        status: 'open',
        priority: 'medium',
        createdBy: 'test-user'
    };

    beforeEach(async () => {
        await Ticket.deleteMany({});
        jest.clearAllMocks();

        // Reset mock implementations
        services.messageQueue.publishTicketCreated.mockImplementation(ticket => Promise.resolve(ticket));
        services.messageQueue.publishTicketUpdated.mockImplementation((ticket, prevStatus) => Promise.resolve({ ticket, prevStatus }));
        services.messageQueue.publishTicketDeleted.mockImplementation(id => Promise.resolve(id));
        services.statusService.validateStatusTransition.mockResolvedValue(true);
        services.statusService.updateStatus.mockResolvedValue({ status: 'open' });
        services.statusService.getStatus.mockResolvedValue({ status: 'open' });
        services.statusService.getStatusHistory.mockResolvedValue([{ status: 'open', updatedAt: new Date() }]);
    });

    describe('POST /api/tickets', () => {
        it('should create a new ticket', async () => {
            const response = await request(app)
                .post('/api/tickets')
                .send(sampleTicket)
                .expect(201);

            expect(response.body).toMatchObject({
                title: sampleTicket.title,
                description: sampleTicket.description,
                status: sampleTicket.status
            });

            // Verify service interactions
            expect(services.statusService.updateStatus).toHaveBeenCalledWith(
                expect.any(String),
                'open',
                'test-user',
                'Ticket created'
            );

            // Verify the message queue was called with the correct data
            expect(services.messageQueue.publishTicketCreated).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: sampleTicket.title,
                    status: sampleTicket.status,
                    createdBy: sampleTicket.createdBy
                })
            );
        });

        it('should handle validation errors', async () => {
            const invalidTicket = { title: 'Test' }; // Missing required fields
            const response = await request(app)
                .post('/api/tickets')
                .send(invalidTicket)
                .expect(400);

            expect(response.body).toHaveProperty('message');
            expect(response.body).toHaveProperty('details');
        });
    });

    describe('GET /api/tickets', () => {
        it('should get all tickets', async () => {
            const ticket = new Ticket(sampleTicket);
            await ticket.save();

            const response = await request(app)
                .get('/api/tickets')
                .expect(200);

            expect(response.body).toHaveLength(1);
            expect(response.body[0]).toMatchObject({
                title: sampleTicket.title,
                status: sampleTicket.status
            });
        });
    });

    describe('GET /api/tickets/:id', () => {
        it('should get a ticket by id', async () => {
            const ticket = new Ticket(sampleTicket);
            await ticket.save();

            const response = await request(app)
                .get(`/api/tickets/${ticket._id}`)
                .expect(200);

            expect(response.body).toMatchObject({
                title: sampleTicket.title,
                status: sampleTicket.status
            });
        });

        it('should return 404 for non-existent ticket', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            await request(app)
                .get(`/api/tickets/${nonExistentId}`)
                .expect(404);
        });
    });

    describe('PUT /api/tickets/:id', () => {
        it('should update a ticket', async () => {
            const ticket = new Ticket(sampleTicket);
            await ticket.save();

            const updateData = {
                title: 'Updated Title',
                status: 'in-progress',
                updatedBy: 'test-user'
            };

            const response = await request(app)
                .put(`/api/tickets/${ticket._id}`)
                .send(updateData)
                .expect(200);

            expect(response.body).toMatchObject(updateData);
            
            // Verify service calls
            expect(services.statusService.validateStatusTransition).toHaveBeenCalledWith(
                ticket._id.toString(),
                updateData.status
            );

            // Verify the published event data matches what we expect
            const [updatedTicket, previousStatus] = services.messageQueue.publishTicketUpdated.mock.calls[0];
            expect(updatedTicket).toMatchObject({
                _id: ticket._id,
                title: updateData.title,
                status: updateData.status
            });
            expect(previousStatus).toBe('open');
        });

        it('should return 404 for non-existent ticket', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            await request(app)
                .put(`/api/tickets/${nonExistentId}`)
                .send({ title: 'Updated' })
                .expect(404);
        });
    });

    describe('DELETE /api/tickets/:id', () => {
        it('should delete a ticket', async () => {
            const ticket = new Ticket(sampleTicket);
            await ticket.save();

            await request(app)
                .delete(`/api/tickets/${ticket._id}`)
                .expect(200);

            const deletedTicket = await Ticket.findById(ticket._id);
            expect(deletedTicket).toBeNull();

            expect(services.messageQueue.publishTicketDeleted).toHaveBeenCalledWith(
                ticket._id.toString()
            );
        });

        it('should return 404 for non-existent ticket', async () => {
            const nonExistentId = new mongoose.Types.ObjectId();
            await request(app)
                .delete(`/api/tickets/${nonExistentId}`)
                .expect(404);
        });
    });
}); 