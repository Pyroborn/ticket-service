// Get the actual module implementation
const actualModule = jest.requireActual('../../services/messageQueue');

// Export the actual module
module.exports = actualModule; 