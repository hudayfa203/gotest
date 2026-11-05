/**
 * Expo config plugin: release signing for android/app/build.gradle (applied on every `expo prebuild`).
 *
 * - When an upload keystore is provided, release builds (APK and AAB) are signed with it. This is the key you
 *   register with Google Play (Play App Signing re-signs for distribution).
 *     GW_UPLOAD_STORE_FILE      absolute path to the .jks / .keystore file
 *     GW_UPLOAD_STORE_PASSWORD  keystore password
 *     GW_UPLOAD_KEY_ALIAS       key alias
 *     GW_UPLOAD_KEY_PASSWORD    key password (defaults to the store password)
 *   Each can be an environment variable or a Gradle property (-PGW_UPLOAD_STORE_FILE=… or ~/.gradle/gradle.properties).
 * - Without them, release builds fall back to the React Native template's debug keystore. That is fine for a
 *   side-loaded test APK (the signature stays the same between builds, so updates install over each other) but such
 *   a build must never be uploaded to Google Play.
 *
 * Secrets are never written into the project: build.gradle only reads them at build time.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @goworld-news release-signing';

function addReleaseSigning(src) {
  if (src.includes(MARKER)) return src;

  // 1. read the upload-key settings once, before the android { } block
  const androidBlock = /\nandroid\s*\{/;
  if (!androidBlock.test(src)) throw new Error('[withAndroidReleaseSigning] top-level android { } block not found in app/build.gradle');
  src = src.replace(
    androidBlock,
    `
${MARKER}
def gwSetting = { String name -> System.getenv(name) ?: (project.hasProperty(name) ? project.property(name) : null) }
def gwUploadStoreFile = gwSetting('GW_UPLOAD_STORE_FILE')
if (gwUploadStoreFile && !file(gwUploadStoreFile).exists()) {
    throw new GradleException("GW_UPLOAD_STORE_FILE points to a missing file: " + gwUploadStoreFile)
}
println(gwUploadStoreFile ? "Garowe World: release builds are signed with the upload key" : "Garowe World: no upload key configured - release builds use the debug keystore (side-load testing only, not for Google Play)")

android {`,
  );

  // 2. declare signingConfigs.release only when a keystore is configured
  const signingConfigs = /signingConfigs\s*\{(\s*\n)(\s*)debug\s*\{/;
  if (!signingConfigs.test(src)) throw new Error('[withAndroidReleaseSigning] signingConfigs { debug { … } } not found in app/build.gradle');
  src = src.replace(
    signingConfigs,
    (_m, nl, indent) =>
      `signingConfigs {${nl}${indent}if (gwUploadStoreFile) {
${indent}    release {
${indent}        storeFile file(gwUploadStoreFile)
${indent}        storePassword gwSetting('GW_UPLOAD_STORE_PASSWORD')
${indent}        keyAlias gwSetting('GW_UPLOAD_KEY_ALIAS')
${indent}        keyPassword(gwSetting('GW_UPLOAD_KEY_PASSWORD') ?: gwSetting('GW_UPLOAD_STORE_PASSWORD'))
${indent}    }
${indent}}
${indent}debug {`,
  );

  // 3. the release build type uses it
  const releaseType = /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
  if (!releaseType.test(src)) throw new Error('[withAndroidReleaseSigning] buildTypes.release signingConfig not found in app/build.gradle');
  src = src.replace(releaseType, '$1signingConfig(gwUploadStoreFile ? signingConfigs.release : signingConfigs.debug)');
  return src;
}

const withAndroidReleaseSigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('[withAndroidReleaseSigning] expected a Groovy app/build.gradle');
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });

module.exports = withAndroidReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
