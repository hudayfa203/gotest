#!/usr/bin/env bash
# Emulator smoke test for the GO World News APK, run by .github/workflows/android-apk.yml.
#
#   android-smoke-test.sh <apk> <output-dir>
#
# Installs the APK on the running emulator, cold-starts it, opens the main screens through the app's own deep links
# (goworldnews://latest, ://live, ://settings), and records for each screen: a screenshot, the visible text (from
# uiautomator) and whether the app process is still alive. Fails on install errors, crashes and dead processes.
# Network-dependent content is reported, not judged: the emulator may not be able to reach the configured API server.
set -uo pipefail

APK="$1"
OUT="$2"
PKG="news.goworld.app"
mkdir -p "$OUT"
REPORT="$OUT/smoke-report.md"
: > "$REPORT"
STATUS="pass"

say() { printf '%s\n' "$*" | tee -a "$REPORT"; }
fail() { STATUS="fail"; say "- ❌ $*"; }
adbs() { adb shell "$@" 2>/dev/null | tr -d '\r'; }

alive() { [ -n "$(adbs pidof "$PKG")" ]; }

# visible text of the current screen (text + accessibility labels), de-duplicated, one line
screen_text() {
  local xml="$OUT/$1.xml"
  if timeout 45 adb shell uiautomator dump /sdcard/gw-ui.xml >/dev/null 2>&1 && adb pull /sdcard/gw-ui.xml "$xml" >/dev/null 2>&1; then
    grep -oE '(text|content-desc)="[^"]+"' "$xml" | sed -E 's/^(text|content-desc)="(.*)"$/\2/' \
      | sed -e 's/&amp;/\&/g' -e "s/&apos;/'/g" -e 's/&quot;/"/g' -e 's/&#10;/ /g' \
      | awk 'length($0) > 1 && !seen[$0]++' | head -n 40 | paste -sd '|' - | sed 's/|/ · /g'
  else
    echo "(uiautomator could not read this screen)"
  fi
}

capture() { # name, title
  local name="$1" title="$2"
  adb exec-out screencap -p > "$OUT/$name.png" 2>/dev/null || true
  local txt
  txt="$(screen_text "$name")"
  if alive; then
    say "- ✅ **$title** — app running. Visible: ${txt:0:900}"
  else
    fail "**$title** — the app process is not running (crash?). Visible: ${txt:0:400}"
  fi
}

open_link() { # url, name, title, wait
  adb shell am start -W -a android.intent.action.VIEW -d "$1" "$PKG" >/dev/null 2>&1 || true
  sleep "${4:-10}"
  capture "$2" "$3"
}

adb wait-for-device
for s in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global "$s" 0 >/dev/null 2>&1 || true; done

say "### Emulator smoke test"
say "- Device: Android $(adbs getprop ro.build.version.release) (API $(adbs getprop ro.build.version.sdk)), $(adbs getprop ro.product.cpu.abi), screen $(adbs wm size | awk '{print $NF}' | tail -1)"

adb logcat -c || true
if adb install -r "$APK" > "$OUT/install.txt" 2>&1; then
  say "- ✅ Installed $(basename "$APK") ($(du -h "$APK" | cut -f1))"
else
  fail "Install failed: $(tail -n 2 "$OUT/install.txt" | tr '\n' ' ')"
  echo "$STATUS" > "$OUT/status"
  exit 0
fi
# avoid the Android 13+ permission sheet covering screenshots (the in-app explanation flow is still in the APK)
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true

START="$(adb shell am start -W -n "$PKG/.MainActivity" 2>&1 | tr -d '\r')"
TOTAL="$(printf '%s\n' "$START" | awk -F': ' '/TotalTime/ {print $2}')"
say "- Cold start: ${TOTAL:-?} ms to first frame (emulator, software rendering)"
sleep 25
capture "01-home" "Home (cold start)"
open_link "goworldnews://latest" "02-latest" "Latest" 10
open_link "goworldnews://live" "03-live" "Live Updates" 10
open_link "goworldnews://settings" "04-settings" "Settings" 8
adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
sleep 3
alive || fail "The app stopped after pressing Back"

adb logcat -d > "$OUT/logcat-full.txt" 2>/dev/null || true
PID="$(adbs pidof "$PKG")"
[ -n "$PID" ] && adb logcat -d --pid="$PID" > "$OUT/logcat-app.txt" 2>/dev/null || true

if grep -q "FATAL EXCEPTION" "$OUT/logcat-full.txt" && grep -A3 "FATAL EXCEPTION" "$OUT/logcat-full.txt" | grep -q "$PKG"; then
  fail "Crash in logcat: $(grep -A4 'FATAL EXCEPTION' "$OUT/logcat-full.txt" | grep -m1 -E 'Exception|Error' | cut -c1-300)"
else
  say "- ✅ No crash (no FATAL EXCEPTION for $PKG in logcat)"
fi
JS_ERRORS="$(grep -E ' E ReactNativeJS' "$OUT/logcat-full.txt" | sed -E 's/.*ReactNativeJS: //' | awk '!seen[$0]++' | head -n 5)"
if [ -n "$JS_ERRORS" ]; then
  say "- ⚠️ JavaScript errors logged (first 5):"
  printf '%s\n' "$JS_ERRORS" | cut -c1-300 | sed 's/^/  - /' | tee -a "$REPORT"
else
  say "- ✅ No JavaScript errors logged"
fi
NET="$(grep -cE 'Network request failed|could not be reached|took too long' "$OUT/logcat-full.txt" || true)"
[ "${NET:-0}" != "0" ] && say "- ℹ️ $NET network-failure log lines: the configured API server did not answer from the emulator (see the backend notes)."

say "- Result: **$STATUS**"
echo "$STATUS" > "$OUT/status"
exit 0
