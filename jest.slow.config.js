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
    testTimeout: 120000,
};
