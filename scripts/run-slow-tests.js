'use strict';

const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const slowRoots = [
    'test/bastet/procedures/analyses/data',
    'test/bastet/utils/smt',
    'test/integration',
];
const suiteTimeoutMs = 240_000;

function collectTests(directory) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectTests(entryPath);
        }
        return entry.name.endsWith('.test.ts') ? [entryPath] : [];
    });
}

const tests = slowRoots
    .flatMap((root) => collectTests(path.join(repositoryRoot, root)))
    .sort();

for (const testPath of tests) {
    const relativeTestPath = path.relative(repositoryRoot, testPath);
    console.log(`\n[slow] ${relativeTestPath}`);
    const result = spawnSync(
        'pnpm',
        [
            'exec',
            'jest',
            '--config',
            'jest.slow.config.js',
            '--runInBand',
            '--coverage=false',
            '--silent',
            '--runTestsByPath',
            relativeTestPath,
        ],
        {
            cwd: repositoryRoot,
            env: {...process.env, CI: 'true'},
            stdio: 'inherit',
            timeout: suiteTimeoutMs,
        },
    );

    if (result.error && result.error.code === 'ETIMEDOUT') {
        console.error(`[slow] Timed out after ${suiteTimeoutMs / 1000}s: ${relativeTestPath}`);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}
