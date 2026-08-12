import assert from 'node:assert/strict';
import {test} from 'node:test';

test('shows a representative assertion failure', () => {
    assert.equal({answer: 41}.answer, 42);
});
