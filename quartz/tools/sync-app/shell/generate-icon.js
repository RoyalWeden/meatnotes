'use strict';
const path = require('path');
const fs = require('fs');
// Require from the REPO's icon-generator (this shell/ dir is the wrapper)
const { makeAppIcon } = require(path.join(__dirname, '..', 'icon-generator'));

const buf = makeAppIcon(1024);
const out = path.join(__dirname, 'icon.png');
fs.writeFileSync(out, buf);
console.log('Generated icon.png at', out, `(${buf.length} bytes)`);
