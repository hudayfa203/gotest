# GO World News app — development reference

Native React Native app built with **Expo SDK 58** (React Native 0.88, new architecture, Hermes) and
**Expo Router**. It is a real native app — screens are rendered with native views, not a WebView of the
website — and it reads the same API as goworld.news ([api/API.md](api/API.md)).

> The test APK is built and published by GitHub Actions (see the main README and [TESTING.md](TESTING.md)). Nothing has
> been submitted to Google Play or the App Store yet; that needs the owner's store accounts ([RELEASING.md](RELEASING.md)).

---

## 1. Run it

Requirements: Node 22+, npm 10+. For simulators/devices: Xcode 16+ (macOS) and/or Android Studio with an SDK + emulator.

```bash
npm ci
npm run typecheck      # generates typed routes, then tsc --noEmit
npm test               # Jest (jest-expo)
```

### Development build (recommended)
The app uses native modules that Expo Go may not include in the exact versions, and **push notifications do
not work in Expo Go**. Use a development build:

```bash
npx expo run:ios        # needs Xcode on macOS
npx expo run:android    # needs Android SDK
# or in the cloud (Expo account): eas build --profile development --platform ios|android
npx expo start --dev-client
```

### Pointing the app at an API
| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `https://goworld.news/api/v1` | API base. Inlined at bundle time, also stored in `extra.apiUrl` (app.config.ts). |
| `EAS_PROJECT_ID` | – | Expo/EAS project id (after `eas init`). Required for Expo push tokens. |
| `EXPO_OWNER` | – | Expo account/organisation that owns the project (optional). |
| `GOOGLE_SERVICES_JSON` | – | Path to Firebase `google-services.json` (Android push). |
| `EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE` | – | `1` in GitHub test APKs: adds *Settings → Server (test build)* to switch servers at runtime. Never set for store builds. |
| `GW_VERSION_NAME` / `GW_VERSION_CODE` | `1.0.0` / `1` | versionName and versionCode (CI: tag and run number). |
| `GW_UPLOAD_STORE_FILE`, `GW_UPLOAD_STORE_PASSWORD`, `GW_UPLOAD_KEY_ALIAS`, `GW_UPLOAD_KEY_PASSWORD` | – | Android upload key for release signing (`plugins/withAndroidReleaseSigning.js`); without them release builds use the debug keystore. |

On a phone, `localhost` is the phone itself. For a local API use your computer's LAN address:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api/v1 npx expo start --dev-client
```
Article links on the configured API host are treated like goworld.news links (opened in-app).

### Web preview (for screenshots only)
`react-native-web` is installed only so screens can be checked in a browser. Native-only modules have web
fallbacks (`*.web.ts`: SecureStore/SQLite → localStorage, push → "not available"); native behaviour is
unchanged. The web preview does not register a device, send analytics or count ad events.

```bash
EXPO_PUBLIC_API_URL=http://localhost:3100/api/v1 npm run export:web
npx playwright install chromium && npm run test:visual   # needs a running GO World News API
```
Reader endpoints (`POST /devices`, `/auth/*`, `/me/*`, `/events`, `/ads/event`) do not send CORS headers, so
they fail in a browser preview. Native apps do not use CORS — this is a web-preview limitation only.

### Scripts
| Script | What it does |
|---|---|
| `npm run typecheck` | typed-route generation (`scripts/typegen.js`) + `tsc --noEmit` |
| `npm test` | unit tests (sync, API client, deep links, block helpers, version gate, block renderer) |
| `npm run export:ios` / `export:android` | production JS bundles (Hermes bytecode) — proves the native bundles compile |
| `npm run prebuild:native` | generates `ios/` and `android/` from `app.config.ts` (`expo prebuild --clean --no-install`) |
| `npm run build:apk` | prebuild + `./gradlew assembleRelease` (needs JDK 17 + Android SDK) |
| `npm run test:visual` | Playwright screenshots of the web preview at 390×844 |

---

## 2. What is in the app

| Area | Implementation |
|---|---|
| Tabs | Home (GET /home rendered per layout: lead, top stories, latest, region/editors' picks/investigations carousels, video strip, opinion, podcasts, "Recent stories"/trending, newsletter promo, `app_feed_3` native ad, breaking banner with live pulse + the separate LIVE UPDATES entry — see *Live coverage*), Latest (keyset pagination), Explore (GET /navigation?menu=app_explore + search with type/section/sort filters, recent searches), Video (type=video + inline/fullscreen native player + podcast episodes), Saved (SQLite, swipe to delete, works in airplane mode) |
| Article `/article/[id]` | native renderer for every `Block` type (paragraph marks + links, headings 2–4, quote, lists, image + caption/credit + pinch-zoom lightbox, video file → expo-video / YouTube & Vimeo → external, embed → link card, table with horizontal scroll, related, ad slot, newsletter prompt); labels, Demo banner, byline → author, dates, corrections box, sources, topics → topic; share sheet, save offline, A−/A+ text size, open in browser; collapsing header with reading progress; live coverage (type `live`) becomes the coverage screen — see *Live coverage*; editor-chosen `relatedArticles` as "Related coverage" on every article; 410 → withdrawal notice + offline copy deleted |
| Live `/live` | Live hub: GET /live (live now with latest-update preview, recently ended) + GET /live/archive (infinite scroll), pull-to-refresh, skeletons, honest empty states |
| Lists | `/section/[slug]`, `/author/[slug]`, `/topic/[slug]` with pagination |
| Settings | notifications (explain → permission → Expo push token → PUT /devices/me/preferences; breaking, daily briefing, follow sections, quiet hours), appearance (system/light/dark), text size, "Share anonymous usage statistics", account (passwordless sign-in, bookmark sync, sign out, delete account), About/Editorial standards/Privacy/Terms from GET /config, contact and tips email, version/build |
| Start-up | fonts, device registration once (`X-Device-Token` in SecureStore), GET /config → blocking "Update required" when below `minSupportedAppVersion`, explicit `/sync` on launch and every foreground (`src/lib/sync.ts`, unit-tested) |
| Push | foreground banners, tap → article + POST /push/opened, cold start from a notification, Android channel `breaking` |
| Deep links | `goworldnews://article/{id}`, `goworldnews://auth?token=…`, `https://goworld.news/{section}/{slug}-{id}` (id = last 10 chars), `goworldnews://live` and `https://goworld.news/live[/archive]` → Live hub, `goworldnews://live/{id}` → coverage, other site paths via GET /resolve (`app/+native-intent.tsx`, `src/lib/deeplink.ts`) |
| Analytics | POST /events batched: article_view, engaged_30s, read_complete, share, video_play, audio_play, search; push opens are recorded by POST /push/opened. Random session id per app session; honours the opt-out toggle |
| Offline | TanStack Query cache persisted to AsyncStorage (home, lists, opened articles, live feeds); saved articles stored in full in SQLite (live coverage: plus its last fetched updates, table `saved_live_feeds`); offline banner (NetInfo) |
| Honesty rules | `isDemo` → visible "Demo" label on cards, lists and the article screen; ads always labelled "Advertisement" (or "Sponsored"); no placeholder content; nothing claims an email was sent when `emailDelivered` is false |

Code map: `app/` (routes), `src/api` (client, endpoints, query cache), `src/lib` (pure logic: sync, deep links,
block helpers, formatting, analytics), `src/components` (UI + article renderer), `src/storage` (SecureStore,
SQLite, AsyncStorage + web fallbacks), `src/push`, `src/theme.ts` (mirrors the platform's design tokens),
`src/types.ts` (mirrors the platform's API contracts). Logos and fonts are the approved GO World News brand files.

Identifiers (change before the first store submission if needed — they cannot change afterwards):
**iOS bundle id `news.goworld.app`**, **Android package `news.goworld.app`**, URL scheme `goworldnews`.

### Live coverage (LIVE UPDATES)
Live coverage and breaking-news alerts are **separate features** and never share UI:
the red banner shows `GET /home` `breaking` alerts only; the navy **LIVE UPDATES** entry directly under it shows
`GET /home` `liveNow` only (ongoing coverage). Either can appear without the other.

| Piece | Implementation |
|---|---|
| Home entry | `src/components/live/LiveUpdatesEntry.tsx` — pulsing red dot, "LIVE UPDATES", "N live" when more than one, time of the latest update, top headline, Demo badge; attaches to the breaking banner's card when both show. Rendered only for `state === 'live'` items, and hidden when the home data is older than 15 min (e.g. a cache restored offline) → tap opens `/live` |
| Live hub `app/live/index.tsx` | live now (lead card with latest-update preview + "updated N min ago"), recently ended (ENDED), archive of all completed coverage (deduplicated against the sections above, `nextCursor` infinite scroll). Refetches every 60 s while focused; offline note when showing old data |
| Coverage screen | the article route for `type: 'live'`: status banner (LIVE · updated N min ago / "not refreshed since …" when offline or unconfirmed / ENDED with end time and duration / from the live archive), Key updates (pinned), timeline newest first with time, headline, any block (images, video, embeds, links via the existing renderer), author, "Edited HH:MM", "New" markers, "show earlier" paging (25 at a time), start/end markers, Related coverage |
| Refresh | `src/features/live.ts`: GET /live/{id} once, then `?since=<serverTime>` every **20 s** while live, the screen is focused and the app is in the foreground (React Query `refetchInterval` + AppState focus manager). Polling stops when the feed reports `ended`. New updates below the reader's position → "N new updates" pill |
| Merge logic | `src/lib/live.ts` (pure, unit-tested): reducer for full / incremental responses — new and edited updates upserted, `removedIds` dropped, order pinned → newest; status rules (an `ended` feed is never overridden by a later, possibly cached, article response; data that can't be confirmed is never shown as LIVE) |
| Cards | `StatusLabels`: LIVE (pulsing) only when `live.state === 'live'`, ENDED for ended coverage; a bare `live` label without live state is not shown |
| Offline | the feed is in the persisted query cache; saving live coverage also stores its updates in SQLite and keeps them current while the screen is open, after /sync refreshes the article, and after bookmark downloads |

---

## 3. Configure EAS (Expo Application Services)

1. Create/sign in to the publisher's Expo account (owned by Garowe Online Media Group).
2. `npm i -g eas-cli && eas login`
3. `eas init` — creates the EAS project and prints its **projectId**.
   Set it for builds: `eas env:create --name EAS_PROJECT_ID --value <id> --environment production` (and
   `preview`, `development`), or export `EAS_PROJECT_ID` locally. `app.config.ts` puts it into
   `extra.eas.projectId`, which push registration needs. Without it, Settings explains that this build cannot
   receive push notifications.
4. Credentials: `eas credentials` (or let `eas build` create them): iOS distribution certificate +
   provisioning profile (Apple Developer account), Android upload keystore (keep the backup safe).
5. Builds: `eas build --profile development|preview|production --platform ios|android` (profiles in `eas.json`;
   all point at `https://goworld.news/api/v1`).
6. Submit: `eas submit --profile production --platform ios|android` after filling `ascAppId` and
   `appleTeamId` in `eas.json`; the first Android upload is usually done manually in Play Console.

## 4. Push notifications
- **iOS (APNs):** in Apple Developer → Keys, create an APNs key (.p8). Upload it with `eas credentials` →
  iOS → Push Notifications. The `aps-environment` entitlement is set by the expo-notifications plugin
  (development builds use the sandbox, store builds production).
- **Android (FCM v1):** create a Firebase project for `news.goworld.app`, add an Android app, download
  `google-services.json` (provide its path as `GOOGLE_SERVICES_JSON` — an EAS "file" environment variable —
  which app.config.ts passes to `android.googleServicesFile`) and upload a FCM v1 service-account key with
  `eas credentials` → Android → FCM V1.
- **Server:** the backend sends to the stored `ExponentPushToken[…]` via the Expo Push API with
  `channelId: "breaking"` and `data: { articleId, url, campaignId, revision }` (contracts `PushPayload`).
- Push cannot be tested in a simulator, Expo Go or the web preview — use a development build on a phone.

## 5. Universal Links / App Links
The website must serve these files (HTTPS, `Content-Type: application/json`, no redirects) at
`https://goworld.news/.well-known/` and `https://www.goworld.news/.well-known/`.

**`apple-app-site-association`** (no file extension). Replace `TEAMID` with the Apple Developer Team ID:
```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.news.goworld.app"],
        "components": [
          { "/": "/api/*", "exclude": true, "comment": "API" },
          { "/": "/media/*", "exclude": true, "comment": "media files" },
          { "/": "/account/*", "exclude": true, "comment": "website sign-in pages" },
          { "/": "/newsletters*", "exclude": true, "comment": "newsletter signup stays on the web" },
          { "/": "/*/*-??????????", "comment": "articles: /{section}/{slug}-{10-char id}" }
        ],
        "paths": ["NOT /api/*", "NOT /media/*", "NOT /account/*", "NOT /newsletters*", "/*/*-??????????"]
      }
    ]
  }
}
```

**`assetlinks.json`**. Use the SHA-256 of the **Play App Signing** key (Play Console → Setup → App
integrity) and, for internal/preview builds, the upload/EAS keystore fingerprint (`eas credentials`):
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "news.goworld.app",
      "sha256_cert_fingerprints": [
        "REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT",
        "REPLACE_WITH_UPLOAD_OR_EAS_KEYSTORE_SHA256_FINGERPRINT"
      ]
    }
  }
]
```
The app side is already configured: iOS `associatedDomains` (`applinks:goworld.news`, `applinks:www.goworld.news`)
and an Android `autoVerify` intent filter for article paths (`/{section}/{slug}-{id}`).

## 6. Store submission checklist
- **Remove all demo content** from the production database (`pnpm demo:clear` in the platform repository) before review — reviewers reject placeholder content.
- Apple: App Store Connect app record for `news.goworld.app`; privacy "nutrition label" (email address if a
  reader signs in; product interaction/analytics not linked to identity; no tracking, no ad identifiers);
  in-app account deletion exists (Settings → Delete account); export compliance = standard HTTPS only
  (`usesNonExemptEncryption: false`); screenshots for 6.9"/6.5" iPhone and iPad (supportsTablet is on).
- Google Play: Data safety form (same data as above), content rating, target audience, app access notes,
  App Links verified with `assetlinks.json`, internal testing track first.
- Privacy policy and terms URLs: the texts come from GET /config and are marked DRAFT in the database —
  they must be approved by legal counsel before launch.

## 7. What needs the owner's accounts
| Needed | Why |
|---|---|
| Apple Developer Program (Organization, D-U-N-S) | signing, TestFlight, App Store, APNs key, Team ID for universal links |
| Google Play Console | publishing, Play App Signing fingerprint for App Links |
| Expo account + `eas init` | projectId (push tokens), EAS Build/Submit, credentials storage |
| Firebase project | FCM v1 credentials for Android push |
| Store listing assets & legal texts | screenshots, descriptions, approved privacy policy/terms |

## 8. Verification
See [TESTING.md](TESTING.md): what runs on every GitHub build (typecheck, unit tests, release build, APK checks,
emulator install/launch test) and what was verified during development.
