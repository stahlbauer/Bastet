'use strict';

const path = require('path');
const {spawnSync} = require('child_process');
const {performance} = require('perf_hooks');

const repositoryRoot = path.resolve(__dirname, '..');
const suiteTimeoutMs = 240_000;
const probeTimeoutMs = 1_000;
const representativeSuites = [
    'test/node-test/optional.node.ts',
    'test/node-test/parser-transformation.node.ts',
    'test/node-test/typescript-compatibility.node.ts',
    'test/node-test/verifier-fixture.node.ts',
    'test/node-test/z3-solver.node.ts',
];

function run(command, args, options = {}) {
    return spawnSync(command, args, {
        cwd: repositoryRoot,
        encoding: options.capture ? 'utf8' : undefined,
        env: {...process.env, CI: 'true'},
        stdio: options.capture ? 'pipe' : 'inherit',
        timeout: options.timeout || suiteTimeoutMs,
    });
}

function failForResult(label, result, timeoutMs = suiteTimeoutMs) {
    if (result.error && result.error.code === 'ETIMEDOUT') {
        console.error(`[node:test spike] Timed out after ${timeoutMs / 1000}s: ${label}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function testArgs(testPaths, useTsx) {
    return [
        ...(useTsx ? ['--import', 'tsx'] : []),
        '--test',
        '--test-concurrency=1',
        ...testPaths,
    ];
}

function runRepresentativeSuites(compiled) {
    const startedAt = performance.now();
    for (const suite of representativeSuites) {
        const testPath = compiled
            ? path.join('.node-test-dist', suite.replace(/\.ts$/, '.js'))
            : suite;
        console.log(`\n[node:test spike] ${testPath}`);
        const result = run(process.execPath, testArgs([testPath], !compiled));
        failForResult(testPath, result);
    }
    console.log(`\n[node:test spike] ${compiled ? 'precompiled' : 'tsx'} total: ${((performance.now() - startedAt) / 1000).toFixed(3)}s`);
}

function runCoverage() {
    const args = [
        '--import',
        'tsx',
        '--test',
        '--test-concurrency=1',
        '--experimental-test-coverage',
        '--test-coverage-include=src/bastet/**/*.ts',
        '--test-coverage-exclude=src/bastet/syntax/parser/grammar/**',
        '--test-coverage-exclude=src/bastet/utils/smt/z3/libz3.ts',
        '--test-coverage-exclude=src/bastet/utils/smt/z3/ctypes.ts',
        '--test-coverage-lines=22',
        '--test-coverage-branches=16',
        '--test-coverage-functions=15',
        ...representativeSuites,
    ];
    const result = run(process.execPath, args);
    failForResult('coverage run', result);
}

function probeTimeout() {
    const fixture = 'test/node-test/fixtures/stuck-solver.node.js';
    const result = run(process.execPath, testArgs([fixture], false), {timeout: probeTimeoutMs, capture: true});
    if (!result.error || result.error.code !== 'ETIMEDOUT') {
        console.error('[node:test spike] The stuck-solver probe was not terminated by the outer deadline.');
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
        process.exit(1);
    }
    console.log(`[node:test spike] Outer deadline terminated the deliberately stuck solver fixture after ${probeTimeoutMs / 1000}s.`);
}

function probeDiagnostics() {
    const nativeFixture = 'test/node-test/fixtures/failing.node.ts';
    const jestFixture = 'test/node-test/fixtures/failing.jest-spike.ts';
    const nativeResult = run(process.execPath, testArgs([nativeFixture], true), {capture: true});
    const jestResult = run(
        path.join(repositoryRoot, 'node_modules/.bin/jest'),
        [
            '--config',
            'jest.fast.config.js',
            '--coverage=false',
            '--runInBand',
            '--runTestsByPath',
            jestFixture,
            '--testMatch=**/*.jest-spike.ts',
        ],
        {capture: true},
    );
    const nativeOutput = `${nativeResult.stdout || ''}${nativeResult.stderr || ''}`;
    const jestOutput = `${jestResult.stdout || ''}${jestResult.stderr || ''}`;

    if (nativeResult.status === 0
        || jestResult.status === 0
        || !nativeOutput.includes('41 !== 42')
        || !nativeOutput.includes('failing.node.ts:5')
        || !jestOutput.includes('Expected: 42')
        || !jestOutput.includes('Received: 41')) {
        console.error('[node:test spike] A diagnostic probe did not produce the expected failure.');
        process.exit(1);
    }

    console.log('\n[node:test diagnostic probe]\n');
    console.log('--- node:test ---');
    process.stdout.write(nativeResult.stdout || '');
    process.stderr.write(nativeResult.stderr || '');
    console.log('\n--- Jest ---');
    process.stdout.write(jestResult.stdout || '');
    process.stderr.write(jestResult.stderr || '');
}

const mode = process.argv[2];
switch (mode) {
    case '--tsx':
        runRepresentativeSuites(false);
        break;
    case '--compiled':
        runRepresentativeSuites(true);
        break;
    case '--coverage':
        runCoverage();
        break;
    case '--probe-timeout':
        probeTimeout();
        break;
    case '--probe-diagnostics':
        probeDiagnostics();
        break;
    default:
        console.error('Usage: node scripts/run-node-test-spike.js --tsx|--compiled|--coverage|--probe-timeout|--probe-diagnostics');
        process.exit(2);
}
