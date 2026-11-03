# Bloop Drop

A one-thumb mobile arcade game. You drag left and right to steer Bloop through an endless fall: thread the gaps, grab coins, and chain close calls into **Frenzy** mode, where you smash through everything for double coins.

It runs in any phone browser today, and ships to **Google Play** and the **App Store** through [Capacitor](https://capacitorjs.com) with real in-app purchases and AdMob ads.

## What keeps players coming back

| Loop | What it does |
| --- | --- |
| **Core run** (30–90 s) | Speed and gap size ramp up. Five zones (Cloud Layer → The Void) each get a banner, so players always have a next milestone. |
| **Close calls → Frenzy** | Barely scraping past a gate fills the Frenzy meter faster, which rewards risky play and makes every run feel different. |
| **Revive** | Once per run, continue by watching an ad or spending 10 gems. |
| **Coins → upgrades & skins** | 5 upgrades × 5 levels, 13 skins. The game-over screen shows progress toward the next skin. |
| **Missions** | 3 at a time, scaled to the player's level. Toasts fire mid-run the moment one completes. |
| **Levels / XP** | Every point scored is XP. Each level pays coins, every 5th pays gems, and levels 8 and 15 unlock skins. |
| **Daily reward** | 7-day streak, with gems on day 7. Badged on the home screen and shown automatically once a day. |

## How it makes money

| Source | Type | Where it lives |
| --- | --- | --- |
| Gem packs ($0.99 / $4.99 / $9.99) | Consumable IAP | Shop → Gems |
| Starter Pack ($1.99, one time) | Non-consumable IAP | Shop → Gems, Royal skin card |
| Remove Ads ($2.99) | Non-consumable IAP | Shop → Gems |
| Coin Doubler ($3.99) | Non-consumable IAP | Shop → Gems |
| Rewarded video ads | Opt-in (revive, 2× coins, free gems ×3/day) | Revive, game over, shop |
| Interstitial ads | Between runs, removed by Remove Ads | After game over |

Gems buy premium skins, revives, or convert to coins for upgrades.

**Deliberate choices:**
- Everything for sale is cosmetic or a time-saver. Nothing is pay-to-win.
- No loot boxes. Randomized paid rewards need published odds on both stores, are restricted or banned in several countries, and invite refunds.
- Interstitials are paced: none in a player's first 3 runs, then at most every 3rd run and 2.5 minutes apart. None are shown after a run where the player already watched a rewarded ad.

Ad-heavy games lose players fast, and installs are what earn money. All of these knobs live in [`js/config.js`](js/config.js) and [`js/economy.js`](js/economy.js).

## Play it now

```bash
npm start
```

Open http://localhost:8080. To try it on your phone, open the second URL it prints while the phone is on the same Wi-Fi. In a browser, purchases and ads are **simulated**: you get a "Simulate purchase" dialog and a placeholder ad, and nothing is charged.

Desktop controls: drag with the mouse, or use ← → / A D.

## Ship it to the app stores

### 1. Accounts you need
- **Google Play Console**: $25 one-time — https://play.google.com/console
- **Apple Developer Program**: $99/year, and you need a Mac with Xcode for iOS — https://developer.apple.com/programs/
- **AdMob** (free): https://admob.google.com. Create an app for each platform, then one *Rewarded* and one *Interstitial* ad unit for each.

### 2. Name your app
In [`capacitor.config.json`](capacitor.config.json), change `appId` (e.g. `com.yourname.bloopdrop`) and `appName`. The appId is permanent once you publish.

### 3. Create the native projects
```bash
npm install
npm run cap:add:android   # creates android/
npm run cap:add:ios       # creates ios/ (Mac only)
```
Commit the generated `android/` and `ios/` folders, because you will edit files in them.

### 4. Register AdMob in the native projects
**Android**: in `android/app/src/main/AndroidManifest.xml`, inside `<application>`:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
```
**iOS**: in `ios/App/App/Info.plist`:
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-3940256099942544~1458002511</string>
<key>NSUserTrackingUsageDescription</key>
<string>This lets us show you more relevant ads.</string>
```
Also add Google's `SKAdNetworkItems` list to Info.plist (see the [AdMob iOS guide](https://developers.google.com/admob/ios/quick-start)).

The values above are Google's **test** app IDs. Swap in your real AdMob app IDs before release.

### 5. Create the in-app products
Create these product IDs in **Play Console → Monetize → Products → In-app products** and in **App Store Connect → your app → In-App Purchases**. They must match [`js/economy.js`](js/economy.js) exactly:

| Product ID | App Store type | Suggested price |
| --- | --- | --- |
| `gems_small` | Consumable | $0.99 |
| `gems_medium` | Consumable | $4.99 |
| `gems_large` | Consumable | $9.99 |
| `starter_pack` | Non-Consumable | $1.99 |
| `remove_ads` | Non-Consumable | $2.99 |
| `coin_doubler` | Non-Consumable | $3.99 |

On device, the store's localized price replaces the fallback labels automatically.

### 6. Switch ads to production
In [`js/config.js`](js/config.js), paste your real ad unit IDs and set `ADS_TESTING = false`. Set `PRIVACY_POLICY_URL` to a real page. Both stores require one for apps with ads or purchases, and free generators exist.

### 7. Build, test, upload
```bash
npm run android   # builds www/, syncs, opens Android Studio
npm run ios       # same for Xcode
```
- **Test purchases without paying**: add your Google account under Play Console → Settings → *License testing*, and use a *Sandbox* tester in App Store Connect.
- Upload to Play's **Internal testing** track first. Apple's equivalent is **TestFlight**.
- Fill in Play's *Data safety* form and Apple's *App Privacy* section. AdMob collects device identifiers for advertising.

### Optional hardening
- **Receipt validation**: purchases are currently trusted on-device. For fraud protection, set up a validator (e.g. [iaptic](https://www.iaptic.com)) and follow the comment in [`js/monetization/store.js`](js/monetization/store.js).
- **Cloud saves**: progress lives on the device. Non-consumable purchases come back via *Restore purchases*, but coins and gems don't survive a reinstall.

## Tuning cheatsheet

| Want to… | Change |
| --- | --- |
| Make it easier or harder | `spawnRow()` and `rowSpacing()` in [`js/game.js`](js/game.js), the speed curve in `update()` |
| Pay out more or fewer coins | Upgrade costs, skin prices, `DAILY_REWARDS`, mission rewards in [`js/economy.js`](js/economy.js) |
| Show more or fewer ads | `INTERSTITIAL` in [`js/config.js`](js/config.js) |
| Change prices | Store consoles (real prices) and `PRODUCTS` in [`js/economy.js`](js/economy.js) (web fallback labels) |
| Add a skin | Add an entry to `SKINS`. `color`, `color2`, `trail`, and optional `pattern` / `accessory` / `rainbow` drive the look. |

Open the game with `?debug` to get `window.bloop` in the console, for example `bloop.save.coins = 99999; bloop.refresh()`.

## Project layout

```
index.html               screens and modals
css/style.css            UI styling
js/main.js               UI controller: screens, shop, missions, daily, IAP/ad wiring
js/game.js               game engine: generation, physics, collisions, rendering, HUD
js/bloop.js              character renderer (shared by game and shop previews)
js/economy.js            skins, upgrades, products, missions, daily rewards, XP
js/save.js               local save data
js/audio.js              synthesized sound effects (no audio files)
js/config.js             ad unit IDs, ad pacing, prices, links
js/monetization/store.js Google Play / App Store purchases (+ web simulator)
js/monetization/ads.js   AdMob rewarded and interstitial ads (+ web simulator)
scripts/                 dev server and the www/ build used by Capacitor
```

The Nunito font is used under the SIL Open Font License; see [`fonts/OFL.txt`](fonts/OFL.txt).
