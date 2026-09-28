# USG Reporter — iOS

Native UIKit + WKWebView shell around `../web` (same app as Android). Bridge: `window.AndroidBridge`
(copy / share / print / toast) is injected by `Sources/App.swift`.

## Get the .ipa
**A. On this Mac (needs Xcode):** install Xcode from the App Store, open it once (accept licence,
add the iOS platform), `sudo xcode-select -s /Applications/Xcode.app`, then `./build-ipa.sh`
→ `build/USGReporter-unsigned.ipa`.

**B. Without Xcode:** push the `USGReporter` folder to GitHub and run the "Build iOS IPA" action
(`.github/workflows/build-ipa.yml`), then download the artifact.

## Install on iPhone
An unsigned .ipa must be signed for your device. Easiest free route: **Sideloadly** (Mac/Windows)
→ drop the .ipa, sign with your Apple ID, iPhone connected by USB → install. On iPhone:
Settings → General → VPN & Device Management → trust your Apple ID; enable Developer Mode if asked.
Free Apple ID signing expires after 7 days (re-sign in Sideloadly, data is kept). A paid Apple
Developer account ($99/yr) gives 1-year signing / TestFlight:
`SIGN_ID="Apple Development: … (TEAMID)" PROFILE=USGReporter.mobileprovision ./build-ipa.sh`.

`./build-ipa.sh catalyst` compiles the same code for Mac Catalyst (works without the iOS SDK) — used to
verify the Swift and run the app on the Mac.
