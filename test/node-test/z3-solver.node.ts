import assert from 'node:assert/strict';
import {before, test} from 'node:test';
import {AnalysisStatistics} from '../../src/bastet/procedures/analyses/AnalysisStatistics';
import {SMTFactory, Z3SMT} from '../../src/bastet/utils/smt/z3/Z3SMT';

let smt: Z3SMT;

before(async () => {
    smt = await SMTFactory.createZ3();
}, {timeout: 120_000});

test('executes the native Z3 solver', {timeout: 120_000}, () => {
    const context = smt.createContext();
    const theories = smt.createTheories(context);
    const prover = smt.createProver(context, new AnalysisStatistics('node:test spike', {}));

    prover.assert(theories.boolTheory.falseBool());
    assert.equal(prover.isUnsat(), true);
});
