#!/bin/bash
# Builds USG Reporter as an iOS .ipa using only Xcode's command-line tools (no .xcodeproj needed).
#   ./build-ipa.sh                 → build/USGReporter-unsigned.ipa  (sign it with Sideloadly / AltStore / your certificate)
#   SIGN_ID="Apple Development: you@x.com (TEAMID)" PROFILE=path/to.mobileprovision ./build-ipa.sh
#                                  → build/USGReporter.ipa (signed, installs directly)
#   ./build-ipa.sh sim             → build/USGReporter-sim.app for the iOS Simulator
#   ./build-ipa.sh catalyst        → compile-check / run on this Mac via Mac Catalyst (no iOS SDK needed)
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"; WEB="$ROOT/../web"; OUT="$ROOT/build${1:+-$1}"; APP="$OUT/Payload/USGReporter.app"
rm -rf "$OUT"; mkdir -p "$APP"

if [[ "${1:-}" == "catalyst" ]]; then
  SDK="$(xcrun --sdk macosx --show-sdk-path)"
  APP="$OUT/USGReporter.app"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  xcrun swiftc -sdk "$SDK" -target arm64-apple-ios16.0-macabi -parse-as-library -O \
    -F "$SDK/System/iOSSupport/System/Library/Frameworks" -L "$SDK/System/iOSSupport/usr/lib/swift" \
    -framework UIKit -framework WebKit -o "$APP/Contents/MacOS/USGReporter" Sources/*.swift
  /usr/libexec/PlistBuddy -x -c "Print" Info.plist > "$APP/Contents/Info.plist"
  /usr/libexec/PlistBuddy -c "Delete :LSRequiresIPhoneOS" -c "Delete :CFBundleSupportedPlatforms" -c "Delete :UIRequiredDeviceCapabilities" \
    -c "Set :MinimumOSVersion 16.0" -c "Add :LSMinimumSystemVersion string 13.0" -c "Add :UIDeviceFamily:0 integer 6" "$APP/Contents/Info.plist" >/dev/null 2>&1 || true
  cp -R "$WEB" "$APP/Contents/Resources/www"
  codesign -s - --force --deep "$APP" >/dev/null 2>&1 || true
  echo "Mac Catalyst build: $APP"; exit 0
fi

if [[ "${1:-}" == "sim" ]]; then
  # iOS Simulator build (for testing): build/USGReporter-sim.app
  APP="$OUT/USGReporter-sim.app"; mkdir -p "$APP"
  xcrun -sdk iphonesimulator swiftc -target arm64-apple-ios15.0-simulator -parse-as-library -O \
    -framework UIKit -framework WebKit -o "$APP/USGReporter" Sources/*.swift
  cp Info.plist "$APP/Info.plist"; cp -R "$WEB" "$APP/www"; cp Icons/AppIcon60x60@2x.png Icons/AppIcon60x60@3x.png "$APP/"
  codesign -s - --force "$APP" >/dev/null
  echo "Simulator build: $APP"; exit 0
fi

SDK="$(xcrun --sdk iphoneos --show-sdk-path 2>/dev/null)" || { echo "ERROR: iOS SDK not found — install Xcode (App Store), open it once, then: sudo xcode-select -s /Applications/Xcode.app"; exit 1; }
echo "• Compiling Swift for arm64 iOS 15+"
xcrun -sdk iphoneos swiftc -target arm64-apple-ios15.0 -parse-as-library -O -whole-module-optimization \
  -framework UIKit -framework WebKit -o "$APP/USGReporter" Sources/*.swift

echo "• Assembling bundle"
cp Info.plist "$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Add :DTPlatformName string iphoneos" -c "Add :DTSDKName string iphoneos" "$APP/Info.plist"
cp -R "$WEB" "$APP/www"
cp Icons/AppIcon60x60@2x.png Icons/AppIcon60x60@3x.png Icons/AppIcon76x76.png Icons/AppIcon76x76@2x.png "$APP/"
# Compiled asset catalog (proper icons on iOS 17+) when actool is available
if xcrun --find actool >/dev/null 2>&1; then
  XC="$OUT/Assets.xcassets/AppIcon.appiconset"; mkdir -p "$XC"
  cp Icons/AppIcon1024.png "$XC/icon.png"
  printf '{"images":[{"filename":"icon.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}' > "$XC/Contents.json"
  xcrun actool "$OUT/Assets.xcassets" --compile "$APP" --platform iphoneos --minimum-deployment-target 15.0 \
    --app-icon AppIcon --output-partial-info-plist "$OUT/assets.plist" --target-device iphone --target-device ipad >/dev/null
fi
printf 'APPL????' > "$APP/PkgInfo"

if [[ -n "${SIGN_ID:-}" && -n "${PROFILE:-}" ]]; then
  echo "• Signing with: $SIGN_ID"
  cp "$PROFILE" "$APP/embedded.mobileprovision"
  security cms -D -i "$PROFILE" > "$OUT/profile.plist"
  /usr/libexec/PlistBuddy -x -c "Print :Entitlements" "$OUT/profile.plist" > "$OUT/ent.plist"
  codesign --force --sign "$SIGN_ID" --entitlements "$OUT/ent.plist" --timestamp=none "$APP"
  NAME="USGReporter.ipa"
else
  NAME="USGReporter-unsigned.ipa"
fi
(cd "$OUT" && zip -qry "$NAME" Payload)
echo "Done: $OUT/$NAME"
