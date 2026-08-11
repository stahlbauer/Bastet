module.exports = {
    moduleFileExtensions: ['ts', 'js'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {tsconfig: 'tsconfig.json'}],
    },
    testMatch: ['**/test/**/*.test.(ts|js)'],
    testEnvironment: 'node',
    watchman: false,
    collectCoverageFrom: [
        'src/bastet/**/*.ts',
        '!src/bastet/syntax/parser/grammar/**',
        '!src/bastet/utils/smt/z3/libz3.ts',
        '!src/bastet/utils/smt/z3/ctypes.ts',
    ],
    coveragePathIgnorePatterns: [
        '/src/bastet/syntax/parser/grammar/',
        '/src/bastet/utils/smt/z3/libz3.ts$',
        '/src/bastet/utils/smt/z3/ctypes.ts$',
    ],
}
