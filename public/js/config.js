// Configuration for frontend services
const config = {
    services: {
        // Use path-based routing for all services
        user: '/api/users',
        status: '/api/status',
        downloader: '/api/files',
        ticket: '/api/tickets' // Already relative
    },
    auth: {
        tokenName: 'authToken',
        loginEndpoint: '/auth/login',
        verifyEndpoint: '/auth/verify'
    },
    // Service API key for service-to-service communication
    apiKey: 'microservice-internal-key'
};

// Simple debug logging of config
console.debug('Frontend config loaded:', {
    userService: config.services.user,
    statusService: config.services.status,
    downloaderService: config.services.downloader
});

// Handle environment variables from the injected values
if (window.USER_SERVICE_URL) {
    console.debug('Using injected USER_SERVICE_URL:', window.USER_SERVICE_URL);
}
if (window.STATUS_SERVICE_URL) {
    console.debug('Using injected STATUS_SERVICE_URL:', window.STATUS_SERVICE_URL);
}
if (window.DOWNLOADER_SERVICE_URL) {
    console.debug('Using injected DOWNLOADER_SERVICE_URL:', window.DOWNLOADER_SERVICE_URL);
} 