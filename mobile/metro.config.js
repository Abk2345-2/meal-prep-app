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
// fields (#foo) in node_modules down to something Hermes can actually parse.
config.transformer = {
  ...config.transformer,
  unstable_transformProfile: 'hermes-stable',
};

module.exports = config;
