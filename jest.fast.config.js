const base = require('./jest.config');

module.exports = {
    ...base,
    displayName: 'fast',
    testPathIgnorePatterns: [
        '/node_modules/',
        '/test/.*\\.node\\.test\\.ts$',
        '/test/integration/',
        '/test/bastet/procedures/analyses/data/',
        '/test/bastet/utils/smt/',
    ],
    coverageThreshold: {
        global: {
            statements: 22,
            branches: 16,
            functions: 15,
            lines: 22,
        },
    },
};
