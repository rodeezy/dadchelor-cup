// Central place for everything you'll want to tweak before shipping.

export const GAME_TITLE = 'Bloop Drop';
export const VERSION = '1.0.0';

// ── Ads ─────────────────────────────────────────────────────────────
// These are Google's official AdMob TEST unit IDs. They are safe to use
// during development. Replace them with your own IDs from
// https://admob.google.com before you publish, and set ADS_TESTING = false.
export const ADS_TESTING = true;
export const AD_UNITS = {
  android: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
};

// Interstitial ("forced") ads are kept gentle on purpose: players who get
// spammed with ads uninstall, and installs are what earn you money.
export const INTERSTITIAL = {
  graceRuns: 3,          // no interstitials during a player's first N runs
  everyNRuns: 3,         // then at most one every N runs...
  minSecondsBetween: 150 // ...and never more often than this
};

// ── Economy knobs ───────────────────────────────────────────────────
export const REVIVE_GEM_COST = 10;
export const FREE_GEMS_AD = { gems: 5, perDay: 3 };

// Link shown in Settings. App stores require a privacy policy when you
// show ads or sell in-app purchases.
export const PRIVACY_POLICY_URL = 'https://example.com/privacy';
