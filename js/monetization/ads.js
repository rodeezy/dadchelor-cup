// Ads: rewarded videos (opt-in, player chooses to watch for a reward) and
// interstitials (shown between runs, removable with the Remove Ads purchase).
//
// On a phone this uses @capacitor-community/admob. In a browser it shows a
// short placeholder so the reward flow can be tested.

import { AD_UNITS, ADS_TESTING } from '../config.js';

export async function createAds({ ui }) {
  if (window.Capacitor?.isNativePlatform?.()) {
    const AdMob = window.Capacitor.Plugins?.AdMob;
    if (AdMob) {
      try {
        const a = new NativeAds(AdMob);
        await a.init();
        return a;
      } catch (e) { console.warn('AdMob init failed', e); }
    }
    return new NoAds();
  }
  return new SimulatedAds(ui);
}

class NativeAds {
  constructor(AdMob) {
    this.AdMob = AdMob;
    this.simulated = false;
    const platform = window.Capacitor.getPlatform();
    this.units = AD_UNITS[platform === 'ios' ? 'ios' : 'android'];
    this.rewardedReady = false;
    this.interstitialReady = false;
  }

  async init() {
    const A = this.AdMob;
    await A.initialize({ initializeForTesting: ADS_TESTING });

    // GDPR / UMP consent (required for EU users).
    try {
      const info = await A.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') await A.showConsentForm();
    } catch { /* consent API unavailable */ }

    // iOS App Tracking Transparency prompt.
    try {
      const st = await A.trackingAuthorizationStatus();
      if (st.status === 'notDetermined') await A.requestTrackingAuthorization();
    } catch { /* android or older plugin */ }

    this.prepareRewarded();
    this.prepareInterstitial();
  }

  prepareRewarded() {
    this.AdMob.prepareRewardVideoAd({ adId: this.units.rewarded, isTesting: ADS_TESTING })
      .then(() => { this.rewardedReady = true; })
      .catch(() => { this.rewardedReady = false; setTimeout(() => this.prepareRewarded(), 30000); });
  }

  prepareInterstitial() {
    this.AdMob.prepareInterstitial({ adId: this.units.interstitial, isTesting: ADS_TESTING })
      .then(() => { this.interstitialReady = true; })
      .catch(() => { this.interstitialReady = false; setTimeout(() => this.prepareInterstitial(), 30000); });
  }

  rewardedAvailable() { return this.rewardedReady; }

  /** Resolves true only if the player earned the reward. */
  async showRewarded() {
    if (!this.rewardedReady) return false;
    this.rewardedReady = false;
    const A = this.AdMob;
    let rewarded = false;
    const handles = [];
    const done = new Promise((resolve) => {
      handles.push(A.addListener('onRewardedVideoAdReward', () => { rewarded = true; }));
      handles.push(A.addListener('onRewardedVideoAdDismissed', () => resolve()));
      handles.push(A.addListener('onRewardedVideoAdFailedToShow', () => resolve()));
      setTimeout(resolve, 120000);
    });
    try {
      const item = await A.showRewardVideoAd();
      if (item && item.amount) rewarded = true;
      await done;
    } catch { /* failed to show */ }
    for (const h of handles) (await h)?.remove?.();
    this.prepareRewarded();
    return rewarded;
  }

  async showInterstitial() {
    if (!this.interstitialReady) return false;
    this.interstitialReady = false;
    try { await this.AdMob.showInterstitial(); } catch { /* ignore */ }
    this.prepareInterstitial();
    return true;
  }
}

class SimulatedAds {
  constructor(ui) { this.ui = ui; this.simulated = true; }
  rewardedAvailable() { return true; }
  showRewarded() { return this.ui.fakeAd({ rewarded: true }); }
  showInterstitial() { return this.ui.fakeAd({ rewarded: false }); }
}

// Native build without a working ad SDK: rewards are simply unavailable.
class NoAds {
  constructor() { this.simulated = false; }
  rewardedAvailable() { return false; }
  async showRewarded() { return false; }
  async showInterstitial() { return false; }
}
