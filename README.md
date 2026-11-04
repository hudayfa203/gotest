<p align="center">
  <img src="assets/images/logo-primary.png" alt="GO World News" width="320">
</p>

<h3 align="center">Breaking News. Beyond Borders.</h3>

<p align="center">
  <a href="https://github.com/hudayfa203/gotest/releases/latest/download/GO-World-News.apk"><b>⬇ Download the latest Android APK</b></a>
  &nbsp;·&nbsp; <a href="https://github.com/hudayfa203/gotest/releases">All releases</a>
  &nbsp;·&nbsp; <a href="docs/INSTALL-SAMSUNG.md">Install on Samsung</a>
  &nbsp;·&nbsp; <a href="docs/TESTING.md">Test report</a>
</p>

---

# GO World News — Android app

The native GO World News app for Android (and iOS), built with **Expo SDK 58 / React Native 0.88** (new architecture,
Hermes). Screens are native views, not a website in a WebView. It reads the same API as the goworld.news website and
the newsroom dashboard.

Every push to `main` builds a release APK in GitHub Actions and installs it on an Android emulator. Each new app
version (`"version"` in `package.json`, or a `vX.Y.Z` tag) is published with its APK under
**[Releases](https://github.com/hudayfa203/gotest/releases)** — see [docs/RELEASING.md](docs/RELEASING.md).

## Install on your phone

1. On the phone, open **[GO-World-News.apk](https://github.com/hudayfa203/gotest/releases/latest/download/GO-World-News.apk)**
   (always the newest release) and download it.
2. Open the download. When Android asks, allow your browser (or *My Files*) to **install unknown apps**.
3. Tap **Install**, then **Open**.

Samsung-specific settings (Auto Blocker, Play Protect, updating, uninstalling) are covered step by step in
**[docs/INSTALL-SAMSUNG.md](docs/INSTALL-SAMSUNG.md)**. Android 7.0 or newer; 64-bit and 32-bit ARM phones.

> **Test build.** The APK on GitHub is for side-loading and testing. It is signed with a test key, not the Google Play
> key, and it has a *Settings → Server* option for pointing the app at a staging server. The Google Play build is
> produced separately (see [docs/RELEASING.md](docs/RELEASING.md)).

## Important: the app needs the GO World News backend

All news, live coverage, search and notifications come from the GO World News API (`/api/v1`). **The backend has not
been deployed to the internet yet**, so a freshly installed APK shows *"Couldn't load this — the server could not be
reached"* instead of stories. That is the honest state of the app, not a bug in the APK.

As soon as the backend runs somewhere with HTTPS, the installed app can use it without a new APK:
**Settings → Server (test build) → type the address → Test and use this server.** Details, including what the server
must provide, are in **[docs/BACKEND.md](docs/BACKEND.md)**.

## What is in the app

| Area | What it does |
|---|---|
| Home | Lead story, top stories, latest, regional/editors' picks/investigations carousels, video, opinion, podcasts, trending, newsletter promo; red **BREAKING** banner and the separate **LIVE UPDATES** strip |
| Latest · Explore · Video · Saved | Infinite lists, sections and search with filters, native video and podcast player, saved stories readable offline (SQLite) |
| Articles | Native renderer for every content block (text, quotes, lists, images with zoom, video, embeds, tables, related coverage), corrections, sources, topics, share, save, text size |
| Live Updates | Live hub, live-coverage timeline refreshing every 20 s, pinned key updates, "N new updates" pill, ENDED state, archive |
| Settings | Push notification preferences, light/dark/system theme, text size, anonymous-statistics opt-out, optional passwordless account with bookmark sync, account deletion |
| Offline | Last feeds and opened articles cached on the phone; offline banner |
| Deep links | `goworldnews://…` and `https://goworld.news/…` article/live links open in the app |

<p>
  <img src="docs/screenshots/home-live-updates.jpg" width="200" alt="Home with breaking banner and LIVE UPDATES">
  <img src="docs/screenshots/live-hub.jpg" width="200" alt="Live hub">
  <img src="docs/screenshots/live-coverage.jpg" width="200" alt="Live coverage timeline">
  <img src="docs/screenshots/article.jpg" width="200" alt="Article">
</p>

<sub>Screens rendered from this source with the backend's clearly labelled <b>DEMO</b> content (web preview at phone
size). Real phone screenshots from each build's emulator test are attached to every release.</sub>

## Repository layout

```
app/                     screens (Expo Router: tabs, article, live, section, author, topic, settings, sign-in)
src/api/                 API client, endpoints, offline query cache
src/components/          UI, article block renderer, live-coverage components
src/features/ src/lib/   app logic (sync, deep links, live merge logic, analytics, formatting)
src/push/ src/storage/   notifications; SecureStore / SQLite / AsyncStorage
src/state/               settings, theme, server choice (test builds)
assets/                  approved GO World News logo, app icons, splash, fonts
plugins/                 Expo config plugin: Android release signing
app.config.ts            app identity, version, permissions, deep links, API address
.github/workflows/       android-apk.yml — build, emulator test, GitHub Release
docs/                    install guide, backend/API, testing report, releasing
e2e/                     visual checks of the web preview (Playwright)
```

The `android/` project is **generated** from `app.config.ts` by `npx expo prebuild` on every build (Expo's Continuous
Native Generation), so it is not committed. Package name: **`news.goworld.app`** · URL scheme: **`goworldnews`**.

## Build it yourself

Requirements: Node 22, JDK 17, Android SDK (Android Studio). Then:

```bash
npm ci
npm run typecheck && npm test                      # TypeScript + 95 unit tests
EXPO_PUBLIC_API_URL=https://your-server/api/v1 \
EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE=1 npm run build:apk
# → android/app/build/outputs/apk/release/app-release.apk
```

Development on a phone or emulator: `npx expo run:android`. More in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Configuration

| Setting | Where | Default / purpose |
|---|---|---|
| API server | repository variable `GW_API_URL`, or the *Run workflow* field | `https://goworld.news/api/v1` |
| Version | `package.json` version (or tag `vX.Y.Z`) → versionName; workflow run number → versionCode | `1.0.0` |
| Push notifications | variable `EAS_PROJECT_ID`, secret `GOOGLE_SERVICES_JSON_BASE64` | off until configured |
| Google Play signing | secrets `ANDROID_UPLOAD_KEYSTORE_BASE64`, `…_STORE_PASSWORD`, `…_KEY_ALIAS`, `…_KEY_PASSWORD` | test key until configured |

No secret is stored in this repository; database keys and other server credentials never ship in the app.

## Documentation

- [docs/INSTALL-SAMSUNG.md](docs/INSTALL-SAMSUNG.md) — install, update and remove the APK on a Samsung phone
- [docs/BACKEND.md](docs/BACKEND.md) — how the app connects to the GO World News API/CMS, and what is still needed
- [docs/TESTING.md](docs/TESTING.md) — what was tested, how, and known issues
- [docs/RELEASING.md](docs/RELEASING.md) — new versions, signing key, Google Play bundle, push setup
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — app architecture and feature reference
- [docs/api/API.md](docs/api/API.md) · [docs/api/openapi.yaml](docs/api/openapi.yaml) — API reference (OpenAPI 3.1)
