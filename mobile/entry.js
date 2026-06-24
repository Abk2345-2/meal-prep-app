// Load polyfills before anything else so globals are available when
// node_modules like undici initialize themselves.
import './polyfills';
import 'expo-router/entry';
