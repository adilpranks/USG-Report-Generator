# USG Reporter

Structured ultrasound report builder — Abdomen & Pelvis, KUB, Pelvis, Thyroid/Neck, Carotid–Vertebral Doppler.
Tap findings (graded fatty liver, GB calculus/polyp, renal calculi/HUN, fibroids, O-RADS ovarian lesions,
ACR TI-RADS nodules, SRU carotid stenosis…) and the report + impression are written in house-template wording.
Fully offline; patient data never leaves the device.

**Use it:** web / iPhone home-screen app → https://adilpranks.github.io/USG-Report-Generator/ ·
iOS `.ipa` and Android `.apk` → [Releases](https://github.com/adilpranks/USG-Report-Generator/releases) / Actions artifacts.

| Folder | What |
|---|---|
| `web/` | The app (HTML/JS) — single source for every platform |
| `android/` | Android WebView shell → APK (`./gradlew :app:assembleDebug`, copy `web/` into `app/src/main/assets/` first) |
| `ios/` | iOS UIKit/WKWebView shell → `.ipa` (`ios/build-ipa.sh`, see `ios/README.md`) |
| `.github/workflows/` | `build-apps.yml` (iOS .ipa + Android .apk; tagged versions → Release) · `pages.yml` (web app on GitHub Pages) |

Findings library: `web/data.js`. Report engine: `web/engine.js`. UI: `web/app.js`.
Clinical decision support only — the reporting radiologist is responsible for the final report.
