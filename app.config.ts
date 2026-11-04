import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * GO World News — native app configuration.
 *
 * Identifiers below (bundle id / package) are the proposed defaults and can be changed before the
 * first store submission. After an app is published, they can never change for that store listing.
 *
 * Environment variables (read at build/bundle time):
 *   EXPO_PUBLIC_API_URL   API base, default https://goworld.news/api/v1
 *   EAS_PROJECT_ID        Expo/EAS project id (set after `eas init`; needed for Expo push tokens)
 *   GOOGLE_SERVICES_JSON  path to google-services.json (Firebase, Android push via FCM v1)
 *   GW_VERSION_NAME       user-visible version, e.g. 1.0.0 (CI: from the git tag)
 *   GW_VERSION_CODE       Android versionCode / iOS build number, must only ever increase (CI: the workflow run number)
 *   GW_UPLOAD_*           Android upload-key signing, see plugins/withAndroidReleaseSigning.js
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://goworld.news/api/v1';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const VERSION_NAME: string = process.env.GW_VERSION_NAME || require('./package.json').version;
const VERSION_CODE = Math.max(1, Number.parseInt(process.env.GW_VERSION_CODE ?? '', 10) || 1);
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

const DEEP_NAVY = '#061A40';
const NAVY = '#0B2A5E';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GO World News',
  slug: 'goworld-news',
  version: VERSION_NAME,
  orientation: 'portrait',
  scheme: 'goworldnews',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  backgroundColor: DEEP_NAVY,
  primaryColor: NAVY,
  description: 'Breaking News. Beyond Borders. International news from GO World News.',
  ios: {
    bundleIdentifier: 'news.goworld.app',
    buildNumber: String(VERSION_CODE),
    supportsTablet: true,
    associatedDomains: ['applinks:goworld.news', 'applinks:www.goworld.news'],
    // standard HTTPS only → exempt from export-compliance paperwork
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'news.goworld.app',
    versionCode: VERSION_CODE,
    // Firebase config for FCM push (EAS file env var or local path); not committed
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-foreground.png',
      backgroundImage: './assets/images/adaptive-background.png',
      monochromeImage: './assets/images/adaptive-monochrome.png',
      backgroundColor: NAVY,
    },
    // Only what the app needs: network + notifications. No location, camera or microphone.
    permissions: ['android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS', 'android.permission.VIBRATE'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    predictiveBackGestureEnabled: false,
    intentFilters: [
      {
        // Android App Links: https://goworld.news/{section}/{slug}-{id} open the article in the app.
        // Requires https://goworld.news/.well-known/assetlinks.json (see README).
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: [
          { scheme: 'https', host: 'goworld.news', pathAdvancedPattern: '/[a-z0-9-]+/[a-z0-9-]+-[0-9a-hjkmnp-tv-z]{10}' },
          { scheme: 'https', host: 'goworld.news', pathPattern: '/.*/.*-.*' },
          { scheme: 'https', host: 'www.goworld.news', pathAdvancedPattern: '/[a-z0-9-]+/[a-z0-9-]+-[0-9a-hjkmnp-tv-z]{10}' },
          // live coverage hub and archive open the app's Live screens
          { scheme: 'https', host: 'goworld.news', path: '/live' },
          { scheme: 'https', host: 'goworld.news', path: '/live/archive' },
        ],
      },
    ],
  },
  web: {
    favicon: './assets/images/favicon.png',
    bundler: 'metro',
    output: 'single',
    name: 'GO World News (app preview)',
    themeColor: NAVY,
    backgroundColor: DEEP_NAVY,
  },
  plugins: [
    // one bundle on every platform (native default; the web preview would otherwise lazy-load routes and fail offline)
    ['expo-router', { asyncRoutes: { web: false, default: false } }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-logo.png',
        imageWidth: 220,
        resizeMode: 'contain',
        backgroundColor: DEEP_NAVY,
        dark: { image: './assets/images/splash-logo.png', backgroundColor: DEEP_NAVY },
        // Android 12+ masks the splash icon to a 192dp circle inside a 288dp box: keep the logo inside it
        android: { image: './assets/images/splash-logo.png', imageWidth: 140, backgroundColor: DEEP_NAVY, dark: { image: './assets/images/splash-logo.png', backgroundColor: DEEP_NAVY } },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#E1141E',
        defaultChannel: 'breaking',
        enableBackgroundRemoteNotifications: false,
      },
    ],
    'expo-font',
    'expo-image',
    ['expo-video', { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    // Podcast playback only: no microphone, no recording, no background service.
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }],
    'expo-localization',
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-sqlite',
    'expo-web-browser',
    'expo-asset',
    'expo-status-bar',
    // release signing from GW_UPLOAD_* (upload key for Google Play); falls back to the debug keystore for test APKs
    './plugins/withAndroidReleaseSigning',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: API_URL,
    router: {},
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
  owner: process.env.EXPO_OWNER,
});
