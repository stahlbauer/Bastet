'use strict';

const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');

fs.cpSync(
    path.join(repositoryRoot, 'src/lib'),
    path.join(repositoryRoot, '.node-test-dist/src/lib'),
    {recursive: true},
);
