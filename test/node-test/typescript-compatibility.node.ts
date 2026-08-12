import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ErrorWitnessStep} from '../../src/bastet/procedures/analyses/graph/witnesses/ErrorWitness';
import {
    DeclarationScopeType,
    ScopeTypeInformation,
} from '../../src/bastet/syntax/DeclarationScopes';
import {LookupTransformer} from '../../src/bastet/syntax/transformers/LookupTransformer';

test('executes current enums and parameter properties', () => {
    const scope = new ScopeTypeInformation(null, 'actor', DeclarationScopeType.ACTOR);
    const witnessStep = new ErrorWitnessStep(7);

    assert.equal(scope.scopeType, DeclarationScopeType.ACTOR);
    assert.equal(witnessStep.id, 7);
});

test('loads current ES imports and TypeScript import-equals CommonJS modules', () => {
    assert.equal(typeof ScopeTypeInformation, 'function');
    assert.equal(typeof LookupTransformer.buildGrapicPixelLookup, 'function');
});
