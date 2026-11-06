# Releasing

## A new test APK (GitHub Releases)

Every push to `main` builds and emulator-tests an APK (download it from the run's *Artifacts*). To **publish** one:

1. Raise `"version"` in `package.json` (for example `1.0.0` → `1.0.1`) and push to `main`.
   The first build of a version that has no release yet publishes **release v1.0.1** automatically.
   (Pushing a git tag `v1.0.1` does the same.)
2. GitHub Actions → **Android APK** builds it, installs it on an Android 14 emulator and attaches
   `Garowe-World-v1.0.1.apk`, `Garowe-World.apk` (stable name for the "latest" link), the checksum and emulator
   screenshots to the release. If the emulator test fails, the release is still published but marked
   **pre-release** with the report at the top, so the "latest" download link keeps pointing at the last good build.

Builds of a version that is already released are named `1.0.1-build.<run>` and stay as workflow artifacts.

Version numbers: the tag gives the visible version (`1.0.1`); the workflow run number gives Android's `versionCode`,
which only ever goes up, so each new APK installs over the previous one.

Another API server for one build: *Actions → Android APK → Run workflow → API base URL*. Permanently: repository
variable `GW_API_URL` (*Settings → Secrets and variables → Actions → Variables*).

Built-in demo stories in test APKs: repository variable `GW_DEMO_CONTENT` — `off` (the default since goworld.news went live
on 6 Nov 2026: the app shows the real site), `available` (demo stories can still be chosen in Settings) or `default` (opens with them). Google Play bundles never
include them. The stories are exported from the platform's demo seed with `scripts/export-app-demo.mjs` (platform
repository) into `src/demo/`.

## Google Play (when you are ready)

The complete listing texts, Data safety answers, graphics and the step-by-step order are in
[PLAY-STORE-LISTING.md](PLAY-STORE-LISTING.md).

Google Play needs an **Android App Bundle (.aab)** signed with your own **upload key**. The workflow builds it on
every tag once the key is stored as repository secrets; until then that job is skipped and says why.

1. Create the upload key once and keep two backups somewhere safe (losing it means asking Google for a key reset):
   ```bash
   keytool -genkeypair -v -keystore goworld-upload.jks -alias goworld-upload \
     -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Garowe World, O=Garowe World"
   base64 -w0 goworld-upload.jks > goworld-upload.jks.b64      # macOS: base64 -i goworld-upload.jks
   ```
2. Repository → *Settings → Secrets and variables → Actions → New repository secret*:
   `ANDROID_UPLOAD_KEYSTORE_BASE64` (content of the `.b64` file), `ANDROID_UPLOAD_STORE_PASSWORD`,
   `ANDROID_UPLOAD_KEY_ALIAS` (`goworld-upload`), `ANDROID_UPLOAD_KEY_PASSWORD`.
3. Push a tag. The **play-bundle** artifact of that run contains `Garowe-World-vX.Y.Z-play.aab` (built without the
   test-only server setting, with R8 code shrinking, all CPU types) and `mapping.txt` for crash de-obfuscation.
4. Google Play Console: create the app (`news.goworld.app`), enrol in **Play App Signing**, upload the .aab to the
   **Internal testing** track first, complete the store listing, Data safety form and content rating
   (checklist in [DEVELOPMENT.md](DEVELOPMENT.md#6-store-submission-checklist)).
5. Add the **Play App Signing** certificate SHA-256 (Play Console → App integrity) to the website's
   `ANDROID_CERT_SHA256` so `https://goworld.news/…` links open the app.

From then on the GitHub test APK is also signed with the upload key. Phones with an APK signed by the old test key
must uninstall it once before installing the new one.

## Push notifications

1. Expo account → `npx eas-cli init` in this folder → copy the project id into the repository **variable**
   `EAS_PROJECT_ID`.
2. Firebase console → project → add Android app `news.goworld.app` → download `google-services.json` →
   `base64 -w0 google-services.json` → repository **secret** `GOOGLE_SERVICES_JSON_BASE64`.
3. Firebase → Project settings → Service accounts → generate a key → upload it to Expo:
   `npx eas-cli credentials` → Android → FCM V1.
4. Server: the platform worker sends through the Expo Push API (configure its Expo access token as described in the
   platform's `docs/EXTERNAL-DEPENDENCIES.md`).
5. Tag a new release. In the app: *Settings → Notifications → Turn on notifications*.

Push cannot be received on an emulator; test it on the phone.

## iOS

The same source builds the iPhone app (`npx expo prebuild --platform ios`, Xcode on macOS, or `eas build -p ios`).
It needs an Apple Developer account; nothing has been built or submitted for iOS yet.
