#!/usr/bin/env node
// Stubs out expo's internal undici copy after every npm install.
// undici is a Node.js HTTP client used by @expo/cli — it must not be bundled
// into the React Native app since it references DOMException and node: builtins
// that don't exist in Hermes.
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '../node_modules/expo/node_modules/undici/index.js'
);

const stub = `'use strict';\nmodule.exports = {};\n`;

if (fs.existsSync(target)) {
  fs.writeFileSync(target, stub);
  console.log('✓ Stubbed expo/node_modules/undici');
}
