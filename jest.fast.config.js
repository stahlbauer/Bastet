const base = require('./jest.config');

module.exports = {
    ...base,
    displayName: 'fast',
    testPathIgnorePatterns: [
        '/node_modules/',
        '/test/integration/',
        '/test/bastet/procedures/analyses/data/',
        '/test/bastet/utils/smt/',
    ],
};
