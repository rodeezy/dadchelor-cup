// In-app purchases.
//
// On a phone (Capacitor build) this uses cordova-plugin-purchase, which talks
// to Google Play Billing and Apple StoreKit. In a regular browser it falls
// back to a simulated store so you can test the whole flow without money.
//
// Usage: const store = await createStore({ onGrant, ui });
//        await store.purchase('gems_medium');

import { PRODUCTS } from '../economy.js';

const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

export async function createStore(opts) {
  if (isNative()) {
    if (!window.CdvPurchase) await waitForDeviceReady();
    if (window.CdvPurchase) {
      try { return await NativeStore.create(opts); } catch (e) { console.warn('Native store failed', e); }
    }
    // Never fall back to the simulator on a real device: it would hand out
    // paid items for free.
    return new UnavailableStore(opts);
  }
  return new SimulatedStore(opts);
}

function waitForDeviceReady() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    document.addEventListener('deviceready', finish, { once: true });
    setTimeout(finish, 3000);
  });
}

// ── Native (Google Play / App Store) ──────────────────────────────
class NativeStore {
  static async create(opts) {
    const s = new NativeStore(opts);
    await s.init();
    return s;
  }

  constructor({ onGrant }) {
    this.onGrant = onGrant;
    this.simulated = false;
    this.pending = new Map(); // productId -> resolve
  }

  async init() {
    const { store, ProductType, Platform, LogLevel } = window.CdvPurchase;
    this.store = store;
    this.platform = window.Capacitor.getPlatform() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
    store.verbosity = LogLevel.WARNING;

    store.register(PRODUCTS.map((p) => ({
      id: p.id,
      platform: this.platform,
      type: p.type === 'consumable' ? ProductType.CONSUMABLE : ProductType.NON_CONSUMABLE,
    })));

    // For extra fraud protection, configure a receipt validator here
    // (e.g. store.validator = 'https://validator.iaptic.com/v1/validate?appName=...')
    // and switch to: .approved(t => t.verify()).verified(r => r.finish()).
    store.when()
      .approved((transaction) => {
        for (const p of transaction.products) this.onGrant(p.id, transaction.transactionId);
        transaction.finish();
        for (const p of transaction.products) this.resolvePending(p.id, true);
      })
      .productUpdated((product) => {
        // Restores owned non-consumables (e.g. after reinstall).
        if (product.owned) this.onGrant(product.id, `owned:${product.id}`);
      });

    store.error((err) => {
      console.warn('Store error', err);
      for (const id of this.pending.keys()) this.resolvePending(id, false);
    });

    await store.initialize([this.platform]);
  }

  resolvePending(id, ok) {
    const r = this.pending.get(id);
    if (r) { this.pending.delete(id); r(ok); }
  }

  price(id) {
    const p = this.store.get(id, this.platform);
    return p?.pricing?.price || PRODUCTS.find((x) => x.id === id)?.price || '';
  }

  owned(id) { return this.store.owned(id); }

  /** Resolves true when the purchase is approved and granted. */
  purchase(id) {
    const product = this.store.get(id, this.platform);
    const offer = product?.getOffer();
    if (!offer) return Promise.resolve(false);
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      offer.order().then((err) => {
        // err is set when the user cancels or the order fails to start
        if (err) this.resolvePending(id, false);
      });
      // Safety net so the UI never hangs (e.g. pending payments).
      setTimeout(() => this.resolvePending(id, false), 120000);
    });
  }

  async restore() {
    await this.store.restorePurchases();
    return true;
  }
}

// ── Simulator (web / development) ──────────────────────────────────
class SimulatedStore {
  constructor({ onGrant, ui }) {
    this.onGrant = onGrant;
    this.ui = ui;
    this.simulated = true;
  }

  price(id) { return PRODUCTS.find((p) => p.id === id)?.price || ''; }

  async purchase(id) {
    const product = PRODUCTS.find((p) => p.id === id);
    const ok = await this.ui.confirm({
      title: `${product.title} · ${product.price}`,
      body: 'Test purchase. No money is charged in the web version. In the store build, this button opens Google Play or App Store checkout.',
      ok: 'Simulate purchase',
      cancel: 'Cancel',
    });
    if (!ok) return false;
    this.onGrant(id, `sim:${id}:${Date.now()}`);
    return true;
  }

  async restore() { return true; }
}

// ── Native build where the billing plugin could not start ─────────
class UnavailableStore {
  constructor({ ui }) { this.ui = ui; this.simulated = false; }
  price(id) { return PRODUCTS.find((p) => p.id === id)?.price || ''; }
  async purchase() {
    this.ui.toast('The store is not available right now. Check your connection and try again.');
    return false;
  }
  async restore() { return false; }
}
