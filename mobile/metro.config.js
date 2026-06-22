// Metro config that lets the app import the raw-TS @pantrytoplate/shared package
// from the monorepo. We watch the packages dir and let Metro transpile its TS.
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

module.exports = config;
