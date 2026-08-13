const base = require('./jest.config');

module.exports = {
    ...base,
    displayName: 'slow',
    collectCoverage: false,
    testMatch: [
        '**/test/integration/**/*.test.(ts|js)',
        '**/test/bastet/procedures/analyses/data/**/*.test.(ts|js)',
        '**/test/bastet/utils/smt/**/*.test.(ts|js)',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/test/.*\\.node\\.test\\.ts$',
    ],
    testTimeout: 120000,
};
