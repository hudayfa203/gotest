/**
 * Generates Expo Router typed-route declarations (.expo/types/router.d.ts + expo-env.d.ts)
 * without starting the dev server, so `npm run typecheck` works in CI.
 */
const path = require('path');
const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);
const { startTypescriptTypeGenerationAsync } = require('@expo/cli/build/src/start/server/type-generation/startTypescriptTypeGeneration');
startTypescriptTypeGenerationAsync({ projectRoot, metro: null, server: null })
  .then(() => console.log('Typed routes generated in .expo/types'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
