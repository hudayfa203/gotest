# Google Play — listing, forms and release steps (GO World News)

Everything Google Play asks for, ready to paste. Nothing here has been submitted: the app is published only when
the owner says so. Package `news.goworld.app` and the app name cannot be changed after the first release.

## 1. Store listing (Grow → Store presence → Main store listing)

| Field | Text |
|---|---|
| App name (≤ 30) | **GO World News** |
| Short description (≤ 80) | International breaking news, live updates and video from Somalia and the world. |
| App icon | `docs/store/GOWorldNews_Play_Icon_512.png` (512 × 512) |
| Feature graphic | `docs/store/GOWorldNews_Play_FeatureGraphic_1024x500.png` (1024 × 500) |
| Phone screenshots (2–8) | the emulator screenshots attached to each GitHub Release (`emulator-01-home.png` …) show the live app; take more on a phone with *Power + Volume down* |
| Category | News & Magazines |
| Contact email | info@goworld.news |
| Website | https://goworld.news |
| Privacy policy | https://goworld.news/privacy-policy (publish it in Dashboard → Pages first) |

**Full description (≤ 4000):**

> GO World News is the international English-language news service of Garowe World, a publication of Garowe Online
> Media Group. Breaking News. Beyond Borders.
>
> Follow the stories that shape Somalia, the Horn of Africa and the world — reported, verified and corrected by our
> newsroom.
>
> • Breaking news and the day's top stories, updated as they happen
> • Live updates: follow developing events minute by minute
> • World, Africa, Somalia, Horn of Africa, politics, business and opinion
> • Video and podcasts
> • Save stories to read later, also offline
> • Optional account (no password — a sign-in link by email) to sync saved stories with goworld.news
> • Newsletters: The World Briefing, a weekly review and breaking-news emails
> • Breaking-news notifications you control, with quiet hours
> • Light and dark themes, adjustable text size, screen-reader support
>
> Our editorial standards and corrections policy are at goworld.news/editorial-standards and
> goworld.news/corrections-policy. Contact: info@goworld.news.

## 2. App content (Policy → App content)

**Privacy policy:** https://goworld.news/privacy-policy

**Ads:** answer according to Settings → Advertising on the website (*No* while advertising is off; house ads only,
no ad SDK, if switched on).

**App access:** *All functionality is available without special access* (sign-in is optional).

**Content rating (IARC questionnaire):** category *Reference, News, or Educational*; violence/sex/language/drugs:
*No* except "news reporting may describe real violence" → answer *Yes* where the questionnaire asks about news
content describing real-world violence; user interaction: *No* (no chat, no user posts); shares location: *No*;
digital purchases: *No*.

**Target audience:** 18 and over (news for adults; not designed for children).

**News app declaration:** *Yes, this is a news app*. Publisher: Garowe Online Media Group; contact info@goworld.news;
website goworld.news (About screen in the app names the publisher and links the website).

**Data safety** (what the app actually does):

| Data | Collected | Shared | Purpose | Optional |
|---|---|---|---|---|
| Email address | Yes — only if the reader creates an account or signs up for a newsletter | No | Account management, communications | Yes |
| User content: saved stories (bookmarks) | Yes — only with an account, to sync | No | App functionality | Yes |
| App activity: page views/reads | Yes — anonymous, random per-session id, can be switched off in Settings | No | Analytics | Yes |
| Device or other IDs: push token + app install id | Yes | No | App functionality (notifications, saved settings) | Yes (notifications) |

Encrypted in transit: **Yes**. Readers can delete their data: **Yes** — Settings → Delete account (in the app), or
email info@goworld.news. No location, contacts, photos, microphone, advertising ID or tracking.

## 3. Upload key (once — keep the file and passwords safe; losing them means a support request to Google)

On any computer with Java (`sudo apt-get install -y openjdk-17-jre-headless` on the server, or a Mac with Java):
```bash
keytool -genkeypair -v -storetype JKS -keystore goworld-upload.jks -alias goworld-upload \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=GO World News, O=Garowe Online Media Group, L=Garowe, C=SO"
base64 -w0 goworld-upload.jks > goworld-upload.jks.b64   # macOS: base64 -i goworld-upload.jks -o goworld-upload.jks.b64
```
GitHub → this repository → Settings → Secrets and variables → Actions → *New repository secret*:
`ANDROID_UPLOAD_KEYSTORE_BASE64` (contents of the .b64 file), `ANDROID_UPLOAD_STORE_PASSWORD`,
`ANDROID_UPLOAD_KEY_ALIAS` (`goworld-upload`), `ANDROID_UPLOAD_KEY_PASSWORD`. Never paste them into chat or email.
The next release (`version` bump in package.json) then also produces **`Garowe-World-vX.Y.Z-play.aab`** (Actions →
the run → Artifacts → *play-bundle*): that file is what goes to Play Console.

## 4. Push notifications (Firebase — free, no Expo account)

1. console.firebase.google.com → *Add project* "GO World News" (Analytics not needed).
2. *Add app* → Android → package `news.goworld.app` → download **google-services.json**.
   `base64 -w0 google-services.json` → GitHub secret `GOOGLE_SERVICES_JSON_BASE64` (app builds use it).
3. Project settings → *Service accounts* → *Generate new private key* → a JSON file. On the server:
   `sudo install -o root -g goworld -m 640 <file> /etc/goworld/fcm-service-account.json`, check that
   `/etc/goworld/production.env` has `FCM_SERVICE_ACCOUNT_FILE="/etc/goworld/fcm-service-account.json"`, then
   `sudo systemctl restart goworld-web goworld-admin goworld-worker`. Dashboard → Settings shows *Android push (Firebase)* as configured.

## 5. Release order

1. DUNS → Play Console organisation account verified.
2. Upload key + Firebase secrets (above); bump `version`; the workflow builds the APK, tests it on an emulator and builds the `.aab`.
3. Play Console → *Create app* (name **GO World News**, app, free) → fill sections 1–2 → *Testing → Internal testing* →
   upload the `.aab` → add testers' emails → test on phones.
4. Setup → App integrity → copy the **app signing key SHA-256** → server `/etc/goworld/production.env`:
   `ANDROID_CERT_SHA256="<that>,<upload key SHA-256>"` → restart → `https://goworld.news/.well-known/assetlinks.json` lists them (links open in the app).
5. **Production** release — only after the owner's approval.
