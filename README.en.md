# Ad Blocker (React Native, Android)

[Português](README.md) · **English**

An app that blocks ads and trackers **in every app on your phone**, no root required.

The app's interface is in Portuguese; this guide shows each Portuguese label followed by its English meaning.

## Download

**[⬇ Download the APK (latest version)](https://github.com/joaogabriel15/adblocker/releases/latest/download/adblocker.apk)**,
or see every version under [Releases](https://github.com/joaogabriel15/adblocker/releases).

To install on Android:

1. Open the link on your phone and download `adblocker.apk`.
2. When you open the file, Android asks to **allow installing apps from this source** (browser or
   file manager). Allow it.
3. **Play Protect** may warn that the app is unknown, because it is not on the Play Store.
   Tap "More details" > "Install anyway".
4. Open the app and turn blocking on. Android asks whether to accept the VPN connection: accept it.

New versions install over the previous one without losing your allowed domains.

> **Privacy:** the VPN only sees DNS queries (website names), and they never leave the
> phone except to the public DNS (1.1.1.1 / 8.8.8.8). The app has no server, account
> or data collection; its only own connection is downloading the list from GitHub, when you
> tap "Atualizar lista" (Update list). All the code is here. Only download the APK from this Releases page.

## How it works

The app creates a **local VPN** (nothing leaves your phone through it). This VPN only captures
DNS queries, which is when an app asks "what is the address of `ads.example.com`?".

- If the domain is on the ad/tracking list, the app answers `0.0.0.0` and the ad does not load.
- If it is not, the query is forwarded as usual to Cloudflare (1.1.1.1) or Google (8.8.8.8) DNS.

The rest of the traffic (videos, messages, etc.) **does not go** through the VPN, so it does not slow down
your internet and barely uses battery.

The list comes built in (StevenBlack hosts, ~77 thousand domains, MIT license) and can be updated
with the "Atualizar lista" (Update list) button.

## Features

- On/off button
- Counter of queries and blocks
- List of the most recently blocked domains
- Tap a blocked domain to **allow it** (useful if some app breaks)
- Works with Android's "Always-on VPN" (Settings > Network > VPN > ⚙️ > Always-on)

## Running

Requirements: Node 22+, JDK 17+, Android Studio with the Android SDK, and an Android phone
with USB debugging enabled (or an emulator).

```bash
npm install
npm start          # in one terminal (Metro)
npm run android    # in another terminal, installs on the phone
```

To build an installable APK without the computer:

```bash
cd android
./gradlew assembleRelease
# APK at android/app/build/outputs/apk/release/app-release.apk
```

> The release build uses the debug key by default (see `android/app/build.gradle`).
> That is enough for personal use; to publish on the Play Store, generate your own key.

Or build the APK in the cloud with EAS (no Android Studio; the key is stored in EAS):

```bash
npx eas-cli@latest build -p android --profile preview
# the APK link is printed at the end
```

> `eas.json` pins `"image": "latest"`: without the `expo` package, EAS would fall back to an
> old image (JDK 11 / Node 18) that cannot build React Native 0.88.

### Publishing a new version

1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. Build the APK on EAS (command above) and download it as `adblocker.apk`.
3. Create the release with the APK attached (the name `adblocker.apk` keeps the "Download" link at the top working):

```bash
gh release create v1.0.1 adblocker.apk --title "v1.0.1" --notes "What changed"
```

> Always build on EAS: the key that signs the APK is stored there. An APK signed with a different
> key does not install over the previous version. Keep a backup of the key outside the repository
> (`npx eas-cli@latest credentials -p android` > Keystore > Download).

## Important: what it blocks and what it does not

**Blocks well:** ads from networks such as Google AdMob/DoubleClick, Facebook Audience Network,
Unity Ads, AppLovin, ironSource, etc. This covers most free games and apps.

**Cannot block:**
- Ads on **YouTube, Instagram, Facebook, TikTok and Twitch**: they come from the same server as the
  content. Blocking the ad would break the whole app.
- Apps that use their own encrypted DNS (DoH) bypass the VPN.

**Turn off Android's "Private DNS"**, otherwise blocking does not work:
Settings > Network & internet > Private DNS > **Off** (or "Automatic").
In Chrome, also turn off Settings > Privacy > "Use secure DNS".

**iPhone:** Apple does not allow an app to filter other apps' DNS this way.
The app opens on iOS, but only shows a notice.

## Structure

```
App.tsx                         Screen (React Native)
src/AdBlock.ts                  JS bridge to the native module
android/app/src/main/java/com/adblocker/vpn/
  AdBlockVpnService.kt          Local VPN that intercepts DNS
  DnsPacket.kt                  Reads/writes IP/UDP/DNS packets
  Blocklist.kt                  Blocklist, download and allowed domains
  AdBlockModule.kt              Native module exposed to JS (NativeModules.AdBlock)
  AdBlockPackage.kt             Module registration
android/app/src/main/assets/hosts_basic.txt   Built-in list
```

## License

[MIT](LICENSE). The built-in blocklist is [StevenBlack/hosts](https://github.com/StevenBlack/hosts),
also MIT, and keeps its original header in `android/app/src/main/assets/hosts_basic.txt`.
