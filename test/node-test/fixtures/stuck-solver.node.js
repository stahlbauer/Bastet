'use strict';

const {test} = require('node:test');

test('simulates a synchronous native solver hang', () => {
    while (true) {
        // A synchronous native call cannot observe node:test's cooperative timeout.
    }
});
