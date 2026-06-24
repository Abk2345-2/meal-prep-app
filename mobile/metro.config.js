const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(monorepoRoot, 'packages/shared')];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

config.transformer = {
  ...config.transformer,
  unstable_transformProfile: 'hermes-stable',
};

// When Metro is bundling for iOS or Android, stub out Node.js-only packages
// that @expo/cli pulls in as dev-tool dependencies. These packages reference
// browser/Node globals (DOMException, node:util, etc.) that don't exist in
// Hermes and crash the runtime if bundled.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'ios' || platform === 'android') {
    if (
      moduleName === 'undici' ||
      moduleName.startsWith('undici/') ||
      moduleName.startsWith('node:')
    ) {
      return { type: 'empty' };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
