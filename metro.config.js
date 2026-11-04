// Metro must resolve ONLY from apps/mobile/node_modules: this app is managed with npm and is
// deliberately excluded from the monorepo's pnpm workspace (pnpm symlinks confuse Metro).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
