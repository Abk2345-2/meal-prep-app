const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Watch the shared package for changes.
config.watchFolders = [path.resolve(monorepoRoot, 'packages/shared')];

// Resolve modules from both the app and the monorepo root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Use hermes-stable transform profile so Metro transpiles ES2022 private
// fields (#foo) in node_modules down to something Hermes can parse.
config.transformer = {
  ...config.transformer,
  unstable_transformProfile: 'hermes-stable',
};

// Block Node.js-only packages that should never be bundled into a RN app.
// undici is @expo/cli's HTTP client — it's a dev tool that gets accidentally
// pulled into the bundle via dynamic require() calls.
const BLOCKED_MODULES = new Set([
  'undici',
  'node:util',
  'node:assert',
  'node:stream',
  'node:buffer',
  'node:url',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:crypto',
  'node:path',
  'node:fs',
  'node:os',
  'node:events',
  'node:zlib',
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Block by exact name
  if (BLOCKED_MODULES.has(moduleName)) {
    return { type: 'empty' };
  }
  // Block undici by path (expo bundles its own copy)
  if (
    moduleName.startsWith('undici/') ||
    moduleName.includes('/undici/')
  ) {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
