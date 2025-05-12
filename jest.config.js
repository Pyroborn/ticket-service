module.exports = {
    testEnvironment: 'node',
    moduleDirectories: ['node_modules'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1'
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
    ]
}; 