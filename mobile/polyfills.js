// Polyfill DOMException for packages like undici that reference it at module
// load time. Hermes doesn't expose DOMException as a global.
if (typeof DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'DOMException';
    }
  };
}
