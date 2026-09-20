# Building the Android APK

## Icon

- Final icons: `assets/icon.png` (1024×1024) and `assets/adaptive-icon.png`,
  referenced from `app.json`.
- Editable source: `assets/icon-src/*.svg`. After editing, regenerate the PNGs:
  ```bash
  node assets/icon-src/generate-icons.mjs
  ```
- To swap in your own art, just replace `assets/icon.png` + `assets/adaptive-icon.png`.

Icons are baked into the native project by `expo prebuild`, so re-run a build
after changing them.

## Release signing keystore

⚠️ **Keep the keystore safe.** The same keystore is required to ship every future
update — if you lose it, users must uninstall the old app to install a new one.

- File: `release.keystore` (in the app root, **gitignored** — never commit it)
- Alias: `smsgateway`
- Store password: `smsgateway2026`
- Key password: `smsgateway2026`

(Change these for a real release by regenerating the keystore with `keytool` and
updating `android/gradle.properties`.)

## Build a signed release APK

```bash
# 1. Apply app.json (icon, permissions) to the native project.
#    NOTE: this WIPES android/ — re-apply the signing steps below afterwards.
npx expo prebuild -p android --no-install

# 2. Ensure signing is wired (these are reset by prebuild):
#    - android/gradle.properties has the SMSGATEWAY_UPLOAD_* lines
#    - android/app/build.gradle release signingConfig uses signingConfigs.release
#    (See the committed snippets or git history if prebuild reset them.)

# 3. Build.
cd android
./gradlew :app:assembleRelease
```

Output APK:
```
android/app/build/outputs/apk/release/app-release.apk
```

Distribute that file directly — users enable "Install unknown apps" and install it.
No Play Store needed (SEND_SMS/RECEIVE_SMS are restricted there anyway).

## Notes on `expo prebuild` resetting `android/`

`expo prebuild` regenerates the whole `android/` folder, so it resets:
- the signing config in `android/app/build.gradle`
- the `SMSGATEWAY_UPLOAD_*` lines in `android/gradle.properties`
- `android/local.properties`

The `release.keystore` itself lives in the app root and is safe. For a fully
repeatable pipeline, consider EAS Build or a small config plugin — but for
occasional local builds, just re-apply the three items above.
