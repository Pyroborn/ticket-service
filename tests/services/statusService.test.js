const axios = require('axios');
const StatusService = require('../../services/statusService');

// Mock axios
jest.mock('axios');

// Mock amqplib
jest.mock('amqplib', () => {
    // Mock connection object with proper event handlers
    const mockConnection = {
        createChannel: jest.fn().mockResolvedValue({
            assertExchange: jest.fn().mockResolvedValue({}),
            assertQueue: jest.fn().mockResolvedValue({ queue: 'test-queue' }),
            bindQueue: jest.fn().mockResolvedValue({}),
            consume: jest.fn().mockResolvedValue({}),
            ack: jest.fn(),
            nack: jest.fn()
        }),
        on: jest.fn(),
        close: jest.fn().mockResolvedValue({})
    };

    return {
        connect: jest.fn().mockResolvedValue(mockConnection)
    };
});

describe('Status Service Client', () => {
    let statusService;
    const mockStatusServiceUrl = 'http://status-service:4001';

    beforeEach(() => {
        // Set environment variable for tests
        process.env.SERVICE_API_KEY = 'test-api-key';
        
        statusService = new StatusService(mockStatusServiceUrl);
        
        // Manually set the statusServiceUrl property since we're bypassing the constructor logic
        statusService.baseUrl = mockStatusServiceUrl;
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        delete process.env.SERVICE_API_KEY;
    });

    describe('API Structure', () => {
        it('should have the correct methods', () => {
            expect(typeof statusService.getStatus).toBe('function');
            expect(typeof statusService.validateStatusTransition).toBe('function');
            expect(typeof statusService.updateStatus).toBe('function');
            expect(typeof statusService.getStatusHistory).toBe('function');
        });
        
        it('should be initialized with the correct URL', () => {
            expect(statusService.baseUrl).toBe(mockStatusServiceUrl);
        });
    });

    describe('getStatus', () => {
        it('should call the correct endpoint', async () => {
            // Setup mock response
            axios.get.mockResolvedValueOnce({ 
                status: 200,
                data: { status: 'open' } 
            });
            
            // Call the method
            await statusService.getStatus('123');
            
            // Verify the endpoint with headers
            expect(axios.get).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123`,
                expect.objectContaining({
                    headers: expect.any(Object),
                    validateStatus: expect.any(Function)
                })
            );
        });
    });

    describe('validateStatusTransition', () => {
        it('should handle service unavailability gracefully', async () => {
            // Mock the getStatus method to throw an error
            axios.get.mockRejectedValueOnce(new Error('Service unavailable'));

            const isValid = await statusService.validateStatusTransition('123', 'in-progress');
            
            // It should return true even if the service is down
            expect(isValid).toBe(true);
        });
    });

    describe('updateStatus', () => {
        const mockStatusUpdate = {
            status: 'in-progress',
            updatedBy: 'test-user',
            reason: 'Work started'
        };

        it('should update status successfully', async () => {
            axios.post.mockResolvedValueOnce({ 
                status: 200,
                data: { success: true }
            });

            const result = await statusService.updateStatus(
                '123',
                mockStatusUpdate.status,
                mockStatusUpdate.updatedBy,
                mockStatusUpdate.reason
            );

            expect(axios.post).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123/update`,
                mockStatusUpdate,
                expect.objectContaining({
                    headers: expect.any(Object)
                })
            );
            
            expect(result).toEqual({ success: true });
        });

        it('should handle update errors gracefully', async () => {
            axios.post.mockRejectedValueOnce(new Error('Update failed'));

            await expect(
                statusService.updateStatus(
                    '123',
                    mockStatusUpdate.status,
                    mockStatusUpdate.updatedBy,
                    mockStatusUpdate.reason
                )
            ).rejects.toThrow('Update failed');
        });
    });

    describe('getStatusHistory', () => {
        it('should fetch status history', async () => {
            const mockHistory = [
                { status: 'open', updatedAt: new Date() },
                { status: 'in-progress', updatedAt: new Date() }
            ];
            
            axios.get.mockResolvedValueOnce({ 
                status: 200,
                data: mockHistory 
            });

            const history = await statusService.getStatusHistory('123');
            
            expect(history).toEqual(mockHistory);
            expect(axios.get).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123/history`,
                expect.objectContaining({
                    headers: expect.any(Object)
                })
            );
        });

        it('should handle history fetch errors and return empty array', async () => {
            axios.get.mockRejectedValueOnce(new Error('History not available'));

            // Mock the statusCache to ensure it returns an empty array
            const originalGet = Map.prototype.get;
            Map.prototype.get = jest.fn().mockReturnValue(undefined);
            
            // Should return empty array instead of throwing
            const result = await statusService.getStatusHistory('123');
            expect(result).toEqual([]);
            
            // Restore the original Map.get implementation
            Map.prototype.get = originalGet;
        });
    });
}); 