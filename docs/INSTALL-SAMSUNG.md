# Install GO World News on a Samsung phone (APK from GitHub)

Works on any Samsung Galaxy phone or tablet with **Android 7.0 or newer** (One UI 1 and later). Other Android
phones work the same way; only the menu names differ slightly.

**Direct download (always the newest release):**
https://github.com/hudayfa203/gotest/releases/latest/download/GO-World-News.apk

A specific version, its checksum and the emulator screenshots are on
[the Releases page](https://github.com/hudayfa203/gotest/releases).

---

## 1. Before the first install (once)

**Auto Blocker (One UI 6 and newer).** Samsung's Auto Blocker refuses every app that does not come from Galaxy Store
or Google Play. If it is on, the install button does nothing or you see *"Blocked by Auto Blocker"*.

1. *Settings → Security and privacy → Auto Blocker*
2. Switch it **off** while you install. You can switch it on again afterwards; the installed app keeps working (it
   only blocks new installs and updates from outside the stores, so turn it off again before installing an update).

## 2. Download

1. Open the link above **on the phone** in Chrome or Samsung Internet.
2. If the browser warns *"File might be harmful"*, tap **Download anyway**. (Every APK from outside Google Play gets
   this warning.)
3. Wait until the download is finished (about 60–80 MB).

## 3. Install

1. Tap the finished download in the notification shade, or open **My Files → Downloads → GO-World-News…apk**.
2. The first time, Android says *"For your security, your phone is not allowed to install unknown apps from this
   source"*. Tap **Settings**, switch **Allow from this source** on, and go back. (Samsung path, if you need it later:
   *Settings → Apps → ⋮ → Special access → Install unknown apps → Chrome / Samsung Internet / My Files*.)
3. Tap **Install**.
4. **Google Play Protect** may show *"Unsafe app blocked"* or *"App scan recommended"*, because it does not know the
   test signing key. Tap **More details → Install anyway** (or **Scan app**, then install). This is expected for a
   side-loaded test build and does not appear for the Google Play version.
5. Tap **Open**. The GO World News splash screen appears, then Home.

## 4. First start — what you should see

- **If the GO World News backend is online:** Home loads with stories, the red BREAKING banner (when there is breaking
  news) and the LIVE UPDATES strip (when coverage is live).
- **If it is not online yet** (the situation today — see [BACKEND.md](BACKEND.md)): screens show *"Couldn't load
  this — the server could not be reached"* and, because this is a test build, the server address and a pointer to
  *Settings → Server*. The app itself is working; it has no news source yet.

### Pointing the app at a server (test builds only)

1. Tap the ⚙ (top right on Home) → scroll to **Server (test build)**.
2. Type the server address, e.g. `staging.example.com` — `https://` and `/api/v1` are added automatically.
3. Tap **Test and use this server**. The app checks that the address answers like a GO World News API before
   switching; then pull down to refresh, or close and reopen the app.
4. **Back to the default server** returns to the address the APK was built with.

Changing the server signs you out and clears cached stories (they belonged to the other server). Saved stories stay.

### Notifications

Android 13+ asks for permission only when you turn notifications on in *Settings → Notifications* inside the app.
Push delivery also needs the server-side setup in [RELEASING.md](RELEASING.md#push-notifications); until then the app
explains that this build cannot receive push notifications.

## 5. Updating to a newer version

Download the new APK the same way and install it **over** the existing app — your saved stories and settings stay.
This works because every GitHub build is signed with the same key and has a higher version code.

You must uninstall first only if Android says *"App not installed — package conflicts with an existing package"*.
That happens when the signing key changes (for example after the owner adds the Google Play upload key to the
build, or when switching between the GitHub APK and a Google Play install).

## 6. Uninstalling

*Settings → Apps → GO World News → Uninstall*, or long-press the icon → *Uninstall*.

## 7. Checking the file (optional)

Each release lists the APK's **SHA-256** and the signing certificate's SHA-256, and includes a `.sha256` file.
On a computer: `sha256sum GO-World-News-v1.0.0.apk` (Linux), `shasum -a 256 …` (macOS) or
`Get-FileHash … -Algorithm SHA256` (Windows) must print the same value.

## Troubleshooting

| What you see | What to do |
|---|---|
| Nothing happens when tapping Install | Auto Blocker is on (step 1), or the download is incomplete — download again |
| "App not installed" | Free some storage (the app needs ~200 MB during install); if a GO World News app from another source is installed, uninstall it first |
| "There was a problem parsing the package" | The file is incomplete or the phone runs Android 6 or older |
| Stories never load | The backend is not reachable — see [BACKEND.md](BACKEND.md); check *Settings → Server → Test connection* |
| "The server sent an answer that is not GO World News data" | You are on public Wi-Fi that needs a browser sign-in, or the server address is wrong |
