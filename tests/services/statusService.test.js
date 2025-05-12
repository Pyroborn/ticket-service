const axios = require('axios');
const StatusService = require('../../services/statusService');

// Mock axios
jest.mock('axios');

describe('Status Service Client', () => {
    let statusService;
    const mockStatusServiceUrl = 'http://status-service:4001';

    beforeEach(() => {
        statusService = new StatusService(mockStatusServiceUrl);
        jest.clearAllMocks();
    });

    describe('getStatus', () => {
        it('should fetch current status', async () => {
            const mockStatus = { status: 'open', updatedAt: new Date() };
            axios.get.mockResolvedValueOnce({ data: mockStatus });

            const status = await statusService.getStatus('123');
            expect(status).toEqual(mockStatus);
            expect(axios.get).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123`
            );
        });

        it('should handle errors gracefully', async () => {
            axios.get.mockRejectedValueOnce(new Error('Service unavailable'));

            await expect(statusService.getStatus('123')).rejects.toThrow('Service unavailable');
        });
    });

    describe('validateStatusTransition', () => {
        it('should validate status transition', async () => {
            const mockStatus = { status: 'open' };
            axios.get.mockResolvedValueOnce({ data: mockStatus });

            const isValid = await statusService.validateStatusTransition('123', 'in-progress');
            
            expect(isValid).toBe(true);
            expect(axios.get).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123`
            );
        });

        it('should return true for any transition when status service is down', async () => {
            axios.get.mockRejectedValueOnce(new Error('Service unavailable'));

            const isValid = await statusService.validateStatusTransition('123', 'in-progress');
            
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
            axios.post.mockResolvedValueOnce({ data: { success: true } });

            await statusService.updateStatus(
                '123',
                mockStatusUpdate.status,
                mockStatusUpdate.updatedBy,
                mockStatusUpdate.reason
            );

            expect(axios.post).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123/update`,
                mockStatusUpdate
            );
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
            axios.get.mockResolvedValueOnce({ data: mockHistory });

            const history = await statusService.getStatusHistory('123');
            
            expect(history).toEqual(mockHistory);
            expect(axios.get).toHaveBeenCalledWith(
                `${mockStatusServiceUrl}/status/123/history`
            );
        });

        it('should handle history fetch errors', async () => {
            axios.get.mockRejectedValueOnce(new Error('History not available'));

            await expect(statusService.getStatusHistory('123')).rejects.toThrow('History not available');
        });
    });
}); 