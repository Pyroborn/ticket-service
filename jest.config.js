module.exports = {
    // Use Node.js environment for tests
    testEnvironment: 'node',
    moduleDirectories: ['node_modules'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^amqplib$': '<rootDir>/tests/__mocks__/amqplib.js',
    },
    // Don't auto-mock our modules
    automock: false,
    // Clear mocks before each test
    clearMocks: true,
    // The root directory that Jest should scan for tests and modules
    rootDir: '.',
    // Setup files
    setupFilesAfterEnv: ['./tests/setup.js'],
    // Coverage configuration
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/setup.js'
    ],
    // Ignore these directories during testing
    testPathIgnorePatterns: [
        '/node_modules/'
        // Remove the skipped test directories to enable them
    ],
    // Increase timeout for slower machines
    testTimeout: 10000,
    // Allow real tear down of resources
    forceExit: true,
    // Use watchman for file watching during tests
    watchman: true,
    // Handle global teardown
    globalTeardown: '<rootDir>/tests/teardown.js',
    // Don't run tests from node_modules folder
    transformIgnorePatterns: ['/node_modules/'],
    // Silent console output during tests
    silent: true
}; 