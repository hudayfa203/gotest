# Backend / API / CMS connection

The app shows what the Garowe World newsroom publishes. It has no content of its own: everything comes from the
Garowe World API (`/api/v1`), which is part of the Garowe World platform (website + newsroom dashboard/CMS +
API + background worker on PostgreSQL). Editors publish in the dashboard; the app reads the published result through
the API within seconds.

```
 Newsroom dashboard (CMS) ──► PostgreSQL ◄── API /api/v1 (website server) ◄── this app
 admin.goworld.news            published-only views     goworld.news/api/v1         (HTTPS, JSON)
```

## Current status

| Piece | State |
|---|---|
| App ↔ API code | Complete. Every screen uses the real endpoints in [api/openapi.yaml](api/openapi.yaml); no mock data is bundled in the app. |
| API / CMS source | Complete and tested in the platform repository (delivered separately as the Garowe World platform source; it is not in this app repository). |
| **Deployed backend** | **None yet.** The platform has not been deployed to any server, and `goworld.news` is not connected to it. |
| Address built into the APK | `https://goworld.news/api/v1` (repository variable `GW_API_URL` overrides it). |
| Built-in demo stories | Test APKs open with fictional, DEMO-labelled sample content exported from the platform's demo seed (`src/demo`), so the app can be tried today. Store builds never contain it. |

So today the installed app shows the built-in demo stories. It shows real news as soon as a deployed API is reachable:
**Settings → Content source → Use the default server**, or any address typed there. When the real server is the
normal source, set the repository variable `GW_DEMO_CONTENT` to `available` (demo still selectable) or `off`.

## What it takes to bring the backend online (needs the owner's authorization)

These steps create paid or public resources, so they are not done without your go-ahead. Full instructions are in the
platform repository's `docs/DEPLOYMENT.md`; in short:

1. **Database** — a managed PostgreSQL 16 (e.g. Neon). Run the migrations, create the four login roles.
2. **Website + API** — deploy the website app (e.g. Vercel, or a small VM with the included Caddy/systemd templates).
   This serves both goworld.news and `/api/v1`.
3. **Dashboard + worker** — the newsroom dashboard and the background worker (scheduled publishing, cache refresh,
   push sending).
4. **Domain** — point `goworld.news` (and `admin.goworld.news`) at the hosts. Until then a staging address such as
   `https://goworld-staging.example.com` works the same way.
5. **Content** — create the first administrator, then publish. For a test you can load the clearly labelled
   demonstration content (every demo item shows a **DEMO** badge in the app) and remove it before launch.

Then either set the repository variable **`GW_API_URL`** to the new address and tag a new release (the APK will use it
by default), or keep the current APK and enter the address under *Settings → Server*.

## What the app needs from the server

- **HTTPS** with a valid certificate. Android release builds refuse plain `http://`.
- The endpoints in [api/API.md](api/API.md): `/config`, `/home`, `/articles`, `/articles/{id}`, `/categories`,
  `/navigation`, `/authors/{slug}`, `/tags/{slug}`, `/search`, `/live`, `/live/archive`, `/live/{id}`, `/alerts`, `/resolve`, `/sync`, `/devices`,
  `/push/*`, `/events`, `/auth/*`, `/me/*`, `/newsletter`, `/podcasts`, `/ads/*`.
- Media URLs reachable from phones (`/media/…` on the website host, or the configured CDN).
- `/pulse` for the World Pulse map, and the app's ad placements (created by platform migration 0015:
  `app_home_top`, `app_feed_3`, `app_feed_6`, `app_list_inline`, `app_article_inline_1`, `app_article_end`,
  `app_article_sticky`). Editors attach campaigns to them in Dashboard → Ads; a slot without a campaign shows nothing.
- For links like `https://goworld.news/world/some-story-abc123defg` to open in the app (Android App Links), the
  website must serve `/.well-known/assetlinks.json` with the app's signing-certificate SHA-256. Each GitHub release
  lists that fingerprint; the platform serves the file once `ANDROID_CERT_SHA256` is set.

## Security model

- The app holds **no** database keys, service credentials or API secrets. It only knows the public API address.
- Each install registers itself (`POST /devices`) and receives a device token, stored in the Android Keystore
  (expo-secure-store) and sent as `X-Device-Token`.
- Readers may sign in (optional, passwordless email link); the session token is stored the same way and sent as
  `Authorization: Bearer …`. Reader data is protected by row-level security on the server.
- The newsroom dashboard is a separate website with staff accounts and two-step verification; the app has no staff
  functions.

## Test credentials

**None are needed to test the app.** Reading, search, live coverage, saving stories and settings work without an
account. The optional reader sign-in sends a one-time link by email, so it only works once the server has its email
service configured (the server says so honestly when it is not). Newsroom (CMS) staff accounts are created on the
server with the platform's `bootstrap` command; they are not used in the app.
