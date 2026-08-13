import assert from 'node:assert/strict';
import {test} from 'node:test';
import path from 'node:path';
import {Bastet} from '../../src/bastet/Bastet';
import {MultiPropertyAnalysisResult} from '../../src/bastet/procedures/AnalysisProcedure';

test('verifies an asynchronous SAFE fixture', {timeout: 120_000}, async () => {
    const result = await new Bastet().runFor(
        [path.resolve('config/default.json'), path.resolve('config/ci.delta.json')],
        path.resolve('src/public/library.sc'),
        path.resolve('test/programs/language-coverage/expr-bool-call-1_SAFE.sc'),
        path.resolve('test/specs/empty.sc'),
    ) as MultiPropertyAnalysisResult;

    assert.ok(result.satisfied.size > 0);
});
