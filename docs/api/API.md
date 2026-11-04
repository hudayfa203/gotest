# GO World News API v1 — reference

One API serves **goworld.news** and the **iPhone/Android apps**. It is implemented as Next.js route
handlers in `apps/web/app/api/v1/**` on top of `@goworld/core` (content reads use the published-only
`public_api` views; reader writes use row-level security).

- Base URL: `https://goworld.news/api/v1` (production) · `http://localhost:3000/api/v1` (development).
  A dedicated `api.goworld.news` host can be added later as a rewrite to the same handlers.
- JSON everywhere. Dates are ISO-8601 UTC. Article ids are 10-character public ids (Crockford base32), never database ids.
- Errors: `{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "…" } }` with the HTTP status (400, 401, 403, 404, 410, 413, 429, 500).
- Caching: content `GET`s send `Cache-Control: public, s-maxage=15…60, stale-while-revalidate` so a CDN can serve them; reader endpoints are `private, no-store`.
- Shapes are defined once in `packages/contracts/src/schemas.ts` (Zod): `ArticleSummary`, `Article`, `Block`, `Tombstone`, `Homepage`, `SyncChanges`, `PushPayload`.
- **Demo content:** every `ArticleSummary` has `isDemo`. Clients must show a visible "Demo" label when it is true.

## Authentication

| Who | How |
|---|---|
| Anonymous readers | nothing |
| App install (device) | `POST /devices` returns `deviceToken`; send it as **`X-Device-Token`** header. Store it in the secure keychain. |
| Signed-in reader (website) | httpOnly cookie `gw_reader`, set by `POST /auth/verify` |
| Signed-in reader (apps) | `Authorization: Bearer <sessionToken>` from `POST /auth/verify` with `{ app: true }` |
| Newsroom staff | not part of this API — the dashboard at admin.goworld.news |

Cookie-authenticated `POST/PUT/DELETE` calls from browsers are refused if the `Origin` is another site.

## Content (public, cacheable)

| Method & path | Returns |
|---|---|
| `GET /home` | `{ generatedAt, breaking: Alert[], sections: { key, title?, layout, items: ArticleSummary[], moreUrl? }[] }` — layouts: `lead, top_stories, latest, editors_picks, region, investigations, opinion, video, podcasts, trending, newsletter, ad` |
| `GET /articles?category&tag&author&type&label&cursor&pageSize` | `{ items: ArticleSummary[], pageSize, nextCursor }` — keyset pagination; pass `nextCursor` back as `cursor`. `category` includes child categories. |
| `GET /articles/{id}` | `Article` (body is a `Block[]` tree; media URLs absolute). **410** with `{ tombstone }` when withdrawn — apps must delete any offline copy. |
| `GET /articles/{id}/live?since=ISO` | legacy live-blog list: `LiveUpdate[]` `{ id, articleId, at, pinned, headline?, body: Block[], updatedAt?, author? }` pinned first, then newest — prefer `GET /live/{id}` |
| `GET /resolve?path=/section/slug-id` | `{ kind: 'article'|'redirect'|'gone', canonicalPath, status, articleId? }` — for deep links and old URLs |
| `GET /alerts` | active breaking banners `{ id, headline, level: breaking|developing, startsAt, endsAt, articleId?, url?, isDemo }[]` — alerts end automatically when their story is withdrawn |
| `GET /categories` | `{ id, slug, name, parentSlug, description? }[]` |
| `GET /navigation?menu=web_main|web_footer|app_explore|app_tabs` | `{ label, href, children: { label, href }[] }[]` in display order (edited in the dashboard) |
| `GET /authors/{slug}` | `{ author: { slug, name, role?, bio?, avatarUrl?, links, isDemo }, articles: Page }` |
| `GET /tags/{slug}` | `{ tag: { slug, name }, articles: Page }` |
| `GET /search?q&category&author&tag&type&from&to&sort=relevance|newest&page&pageSize` | `{ items, page, pageSize, total, nextCursor: null }` (rate-limited 60/min/IP) |
| `GET /pulse` | `ArticleSummary[]` that have a `location {name, lat, lng}` — the World Pulse map |
| `GET /podcasts?series=` | episodes `{ seriesSlug, seriesTitle, articleId, title, description, publishedAt, audioUrl, audioType, durationSeconds, episodeNo, seasonNo, isDemo }[]` |
| `GET /corrections` | public corrections log `{ articleId, headline, url, note, at }[]` |
| `GET /config` | `{ siteName, tagline, minSupportedAppVersion, adsEnabled, storeUrls, social, contactEmail, tipsEmail, pages: { about, editorialStandards, privacy, terms } }` |
| `GET /ads?placement=web_home_top|web_article_inline_1|web_sidebar|app_feed_3|app_article_inline_1` | `{ placement, ad: null | { campaignId, advertiser, sponsored, clickUrl, image: { url, width, height, alt }, headline, text } }` |
| `POST /ads/event` | `{ campaignId, placement, kind: 'impression'|'click' }` → 204 (count only when actually shown/clicked) |

## Live coverage (separate from breaking alerts)

A live coverage is a story of type `live` with a coverage state: **live** (ongoing) → **ended** (event over) → optionally
**archived** (kept public in the archive). It is managed in the dashboard's Live Updates module and is independent of the
breaking-news alerts (`GET /alerts`), which are short banner headlines.

| Method & path | Returns |
|---|---|
| `GET /live` | `{ active: LiveCoverage[], recent: LiveCoverage[] (ended, not archived), archive: { items, nextCursor } }` |
| `GET /live/archive?cursor=&pageSize=` | `{ items: LiveCoverage[], nextCursor }` — all completed coverage (ended + archived), newest end first |
| `GET /live/{id}?since=` | `{ coverage: LiveCoverage, updates: LiveUpdate[], removedIds: string[], serverTime, relatedArticles: ArticleSummary[] }`. Without `since`: all published updates, pinned first then newest. With `since` = the previous `serverTime`: only updates published **or edited** since then, plus the ids **deleted** since then. 404 if not a public live coverage, 410 + tombstone if withdrawn. |
| `GET /home` → `liveNow` | `LiveCoverage[]` that are live right now (drives the LIVE UPDATES entry) |

`LiveCoverage = { id, url, path, headline, standfirst?, category{slug,name}, image?, state: 'live'|'ended', archived, startedAt, endedAt, lastUpdateAt, updateCount, latestUpdate?{headline?, text}, location?, isDemo }`.
`LiveUpdate = { id, articleId, at, pinned, headline?, body: Block[], updatedAt? (edited), author?{name, slug?} }`.
`ArticleSummary.live = { state, startedAt, endedAt, archived }` on live coverage (show **LIVE** only when `state === 'live'`, **ENDED** otherwise);
`Article.live = { status, state, updatesUrl, feedUrl, startedAt, endedAt, archived }`; `Article.relatedArticles` = editor-chosen related stories.
Recommended client refresh: every 15–30 s while the coverage is live and visible; stop when `coverage.state` becomes `ended`.
Ending a coverage increments the article revision, so `/sync` reports it.

## Sync for the apps

`GET /sync?cursor=<string>&limit=200` → `{ cursor, updated: { id, revision, updatedAt }[], withdrawn: Tombstone[], hasMore }`.
Start with `cursor=0`; store the returned cursor. For each `updated` id whose `revision` is newer than the
offline copy, refetch `/articles/{id}`. For each `withdrawn` id, delete the offline copy and saved entry.
Push notifications and caches are not guaranteed — apps call `/sync` on launch and on foreground.

## Devices & notifications (header `X-Device-Token`)

| Method & path | Body / returns |
|---|---|
| `POST /devices` | `{ platform: 'ios'|'android'|'web', appVersion?, locale?, timezone? }` → **201** `{ deviceId, deviceToken }` (20 per hour per IP) |
| `GET /devices/me/preferences` | `{ notificationsEnabled, hasPushToken, breaking, dailyBriefing, categorySlugs, quietHours }` |
| `PUT /devices/me/preferences` | any of `{ pushToken (ExponentPushToken[…]), notificationsEnabled, breaking, dailyBriefing, categorySlugs[], quietHours: {start:'22:00', end:'07:00'} | null }` → same shape |
| `POST /push/opened` | `{ campaignId, articleId?, platform }` → 204 (marks the delivery opened + analytics) |

Push payload (Expo → APNs/FCM): `{ title, body, data: { articleId, url, campaignId, revision } }`. Android channel id: `breaking`.

## Reader accounts (optional, passwordless)

| Method & path | Body / returns |
|---|---|
| `POST /auth/request` | `{ email, app?: boolean, returnTo?: '/path' }` → 202 `{ ok, emailDelivered }`. Website link: `/account/verify?token=…`; app link: `goworldnews://auth?token=…` |
| `POST /auth/verify` | `{ token, app?: boolean }` → website sets cookie; app receives `{ sessionToken }`. If `X-Device-Token` is sent, the device is linked to the reader. |
| `POST /auth/logout` | → 204 |
| `GET /me` | `{ signedIn }` |
| `DELETE /me` | deletes the reader account, sessions and saved articles → 204 |
| `GET /me/bookmarks` | `{ savedAt, article: ArticleSummary-like }[]` |
| `PUT /me/bookmarks/{id}` / `DELETE /me/bookmarks/{id}` | → 204 |

## Newsletters (double opt-in)

| Method & path | Body / returns |
|---|---|
| `POST /newsletter/subscribe` | `{ email, lists: ['daily'|'weekly'|'breaking'], consent: true, source? }` → 202 `{ status: 'confirmation_sent'|'already_subscribed', emailDelivered }` |
| `POST /newsletter/confirm` | `{ token }` → `{ confirmed }` |
| `POST /newsletter/unsubscribe` | `{ token }` → 204 |

`emailDelivered: false` means no email provider is configured (development writes the email to the `.mail/` folder) — the UI must not claim an email was sent in that case.

## Analytics

`POST /events` `{ events: [{ event, platform: web|ios|android, articleId?, sessionId, path?, referrer?, props? }] }` → 202 `{ accepted }`.
Events: `page_view, article_view, engaged_30s, read_complete, share, push_open, video_play, audio_play, newsletter_signup, search`.
No IP addresses are stored; `sessionId` is hashed with a daily-rotating salt; requests with `DNT: 1` or `Sec-GPC: 1` are accepted but not recorded.

## Website-only endpoints

- `POST /api/revalidate` — worker → website cache refresh (`Authorization: Bearer $REVALIDATE_SECRET`, body `{ paths: string[] }`).
- `GET /media/{key}` — serves public media from local storage (only keys of public assets; supports `Range` for audio/video). In production with R2, `MEDIA_PUBLIC_URL` points at the bucket's CDN domain instead.
