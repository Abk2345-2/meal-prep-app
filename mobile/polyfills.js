// Must run before any other module. Defines globals that Node.js/browser
// packages reference at import time but don't exist in Hermes/React Native.

if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'DOMException';
      this.code = 0;
    }
  };
}

if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('expo-modules-core');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
