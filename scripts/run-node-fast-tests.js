'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const testRoot = path.join(repositoryRoot, 'test');
const nativeTestSuffix = '.node.test.ts';
const slowRootPrefixes = [
    'test/bastet/procedures/analyses/data/',
    'test/bastet/utils/smt/',
    'test/integration/',
];

function isSlowTest(relativePath) {
    const normalizedPath = relativePath.split(path.sep).join('/');
    return slowRootPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}

function collectNativeTests(directory) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectNativeTests(entryPath);
        return entry.name.endsWith(nativeTestSuffix) ? [entryPath] : [];
    });
}

function relativeTestPath(testPath) {
    const absolutePath = path.resolve(repositoryRoot, testPath);
    const relativePath = path.relative(repositoryRoot, absolutePath);
    if (relativePath.startsWith('..') || !absolutePath.endsWith(nativeTestSuffix)) {
        throw new Error(`Expected a ${nativeTestSuffix} file inside the repository: ${testPath}`);
    }
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Test file does not exist: ${testPath}`);
    }
    if (isSlowTest(relativePath)) {
        throw new Error(`Expected a fast test file outside the slow-tier roots: ${testPath}`);
    }
    return relativePath;
}

function parseArguments(argv) {
    const options = {
        coverage: false,
        testNamePattern: null,
        tests: [],
        watch: false,
    };
    const args = argv.filter((argument) => argument !== '--');
    while (args.length > 0) {
        const argument = args.shift();
        if (argument === '--coverage') {
            options.coverage = true;
        } else if (argument === '--watch') {
            options.watch = true;
        } else if (argument === '--file') {
            if (args.length === 0) throw new Error('--file requires at least one test file');
            options.tests.push(...args.splice(0).map(relativeTestPath));
        } else if (argument === '--test-name-pattern') {
            if (args.length === 0) throw new Error('--test-name-pattern requires a pattern');
            options.testNamePattern = args.shift();
            options.tests.push(...args.splice(0).map(relativeTestPath));
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    if (options.watch && options.coverage) {
        throw new Error('Coverage and watch mode cannot be combined');
    }
    return options;
}

function coverageArguments() {
    return [
        '--experimental-test-coverage',
        '--test-coverage-include=src/bastet/**/*.ts',
        '--test-coverage-exclude=src/bastet/syntax/parser/grammar/**',
        '--test-coverage-exclude=src/bastet/utils/smt/z3/libz3.ts',
        '--test-coverage-exclude=src/bastet/utils/smt/z3/ctypes.ts',
        '--test-coverage-lines=22',
        '--test-coverage-branches=16',
        '--test-coverage-functions=15',
    ];
}

let options;
try {
    options = parseArguments(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exit(2);
}

const tests = options.tests.length > 0
    ? options.tests
    : collectNativeTests(testRoot)
        .sort()
        .map((testPath) => path.relative(repositoryRoot, testPath))
        .filter((testPath) => !isSlowTest(testPath));

const nodeArguments = [
    '--import',
    'tsx',
    '--test',
    '--test-concurrency=1',
    ...(options.watch ? ['--watch'] : []),
    ...(options.testNamePattern ? [`--test-name-pattern=${options.testNamePattern}`] : []),
    ...(options.coverage ? coverageArguments() : []),
    ...tests,
];

const result = spawnSync(process.execPath, nodeArguments, {
    cwd: repositoryRoot,
    env: {...process.env, CI: process.env.CI || 'true'},
    stdio: 'inherit',
});

if (result.error) {
    console.error(result.error.message);
    process.exit(1);
}
process.exit(result.status || 0);
