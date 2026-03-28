'use strict';
// Generates a 1024×1024 book icon PNG for the macOS app (Launchpad / Applications).
// Run: node generate-icon.js
// Output: shell/icon.png  (referenced in package.json "mac.icon")
const fs = require('fs');
const path = require('path');
const { makeBookIcon } = require('../icon-generator');

const size = 1024;
// Green — matches the "synced" tray state color (#32d74b)
const buf = makeBookIcon(0x32, 0xd7, 0x4b, size);
const dest = path.join(__dirname, 'icon.png');
fs.writeFileSync(dest, buf);
console.log(`icon.png written (${buf.length} bytes, ${size}×${size}px)`);
