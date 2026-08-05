/**
 * Neutrex Theme — Core
 * Dark mode, cart, navigation, wishlist, utilities
 */
(function () {
  'use strict';

  const STORAGE = {
    theme: 'neutrex-theme',
    wishlist: 'neutrex-wishlist',
    recentlyViewed: 'neutrex-recently-viewed',
  };

  const NeutrexTheme = (window.NeutrexTheme = window.NeutrexTheme || {});

  /* -------------------------------------------------------------------------- */
  /* Utilities                                                                   */
  /* -------------------------------------------------------------------------- */

  NeutrexTheme.debounce = function debounce(fn, wait) {
    let timer;
    return function debounced(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  };

  NeutrexTheme.throttle = function throttle(fn, limit) {
    let inThrottle;
    return function throttled(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  };

  NeutrexTheme.fetchJSON = async function fetchJSON(url, options) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = response;
      throw error;
    }
    return response.json();
  };

  NeutrexTheme.getFocusable = function getFocusable(container) {
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  };

  NeutrexTheme.createFocusTrap = function createFocusTrap(container) {
    const getFocusableEls = () => NeutrexTheme.getFocusable(container);
    let previousFocus = null;

    function handleKeyDown(event) {
      if (event.key !== 'Tab') return;
      const focusable = getFocusableEls();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    return {
      activate() {
        previousFocus = document.activeElement;
        container.addEventListener('keydown', handleKeyDown);
        const focusable = getFocusableEls();
        if (focusable.length) focusable[0].focus();
      },
      deactivate() {
        container.removeEventListener('keydown', handleKeyDown);
        if (previousFocus && typeof previousFocus.focus === 'function') {
          previousFocus.focus();
        }
        previousFocus = null;
      },
    };
  };

  let scrollLockCount = 0;
  let scrollLockOffset = 0;

  NeutrexTheme.lockBodyScroll = function lockBodyScroll() {
    scrollLockCount += 1;
    if (scrollLockCount > 1) return;
    scrollLockOffset = window.scrollY;
    document.body.style.setProperty('--scroll-lock-offset', `-${scrollLockOffset}px`);
    document.body.classList.add('is-scroll-locked');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.insetBlockStart = `${-scrollLockOffset}px`;
    document.body.style.insetInline = '0';
    document.body.style.width = '100%';
  };

  NeutrexTheme.unlockBodyScroll = function unlockBodyScroll() {
    if (scrollLockCount === 0) return;
    scrollLockCount -= 1;
    if (scrollLockCount > 0) return;
    const offset = scrollLockOffset;
    document.body.classList.remove('is-scroll-locked');
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.insetBlockStart = '';
    document.body.style.insetInline = '';
    document.body.style.width = '';
    document.body.style.removeProperty('--scroll-lock-offset');
    scrollLockOffset = 0;
    window.scrollTo(0, offset);
  };

  NeutrexTheme.publish = function publish(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  };

  NeutrexTheme.on = function on(name, handler) {
    document.addEventListener(name, handler);
    return () => document.removeEventListener(name, handler);
  };

  /* -------------------------------------------------------------------------- */
  /* Dark mode                                                                   */
  /* -------------------------------------------------------------------------- */

  const DarkMode = {
    mediaQuery: window.matchMedia('(prefers-color-scheme: dark)'),

    getDefault() {
      return document.documentElement.dataset.colorSchemeDefault || 'system';
    },

    getStored() {
      try {
        return localStorage.getItem(STORAGE.theme);
      } catch {
        return null;
      }
    },

    setStored(value) {
      try {
        if (value) localStorage.setItem(STORAGE.theme, value);
        else localStorage.removeItem(STORAGE.theme);
      } catch {
        /* private browsing */
      }
    },

    resolveTheme(preference) {
      if (preference === 'system' || !preference) {
        return this.mediaQuery.matches ? 'dark' : 'light';
      }
      return preference === 'dark' ? 'dark' : 'light';
    },

    apply(resolved) {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      this.syncToggles(resolved);
    },

    syncToggles(resolved) {
      document.querySelectorAll('[data-theme-toggle]').forEach((toggle) => {
        const isDark = resolved === 'dark';
        toggle.setAttribute('aria-pressed', String(isDark));
        toggle.setAttribute('aria-label', isDark ? toggle.dataset.labelLight || 'Switch to light mode' : toggle.dataset.labelDark || 'Switch to dark mode');
      });
    },

    init() {
      const stored = this.getStored();
      const preference = stored || this.getDefault();
      this.apply(this.resolveTheme(preference));

      this.mediaQuery.addEventListener('change', () => {
        const current = this.getStored() || this.getDefault();
        if (current === 'system') this.apply(this.resolveTheme('system'));
      });
    },

    toggle() {
      const stored = this.getStored();
      const preference = stored || this.getDefault();
      const resolved = this.resolveTheme(preference);
      const next = resolved === 'dark' ? 'light' : 'dark';
      this.setStored(next);
      this.apply(next);
      NeutrexTheme.publish('neutrex:theme:changed', { theme: next });
    },

    bind() {
      document.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-theme-toggle]');
        if (!toggle) return;
        event.preventDefault();
        this.toggle();
      });
    },
  };

  NeutrexTheme.DarkMode = DarkMode;

  /* -------------------------------------------------------------------------- */
  /* Cart                                                                        */
  /* -------------------------------------------------------------------------- */

  const Cart = {
    drawer: null,
    focusTrap: null,

    getDrawer() {
      return document.querySelector('cart-drawer, [data-cart-drawer]');
    },

    async fetchCart() {
      return NeutrexTheme.fetchJSON(`${window.Shopify?.routes?.root || '/'}cart.js`);
    },

    updateCounts(count) {
      document.querySelectorAll('[data-cart-count]').forEach((el) => {
        el.textContent = count;
        el.setAttribute('aria-label', el.dataset.label ? el.dataset.label.replace('{{ count }}', count) : `Cart, ${count} items`);
        el.classList.toggle('is-empty', count === 0);
        el.toggleAttribute('hidden', count === 0 && el.dataset.hideEmpty === 'true');
      });
    },

    async refresh() {
      try {
        const cart = await this.fetchCart();
        this.updateCounts(cart.item_count);
        NeutrexTheme.publish('neutrex:cart:updated', { cart });
        return cart;
      } catch (error) {
        console.error('[Neutrex] Cart refresh failed', error);
        throw error;
      }
    },

    async add(items) {
      const payload = Array.isArray(items) ? { items } : items;
      const cart = await NeutrexTheme.fetchJSON(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await this.refresh();
      return cart;
    },

    async change(line, quantity) {
      const cart = await NeutrexTheme.fetchJSON(`${window.Shopify?.routes?.root || '/'}cart/change.js`, {
        method: 'POST',
        body: JSON.stringify({ line, quantity }),
      });
      NeutrexTheme.publish('neutrex:cart:updated', { cart });
      this.updateCounts(cart.item_count);
      return cart;
    },

    open() {
      const drawer = this.getDrawer();
      if (!drawer) {
        window.location.href = `${window.Shopify?.routes?.root || '/'}cart`;
        return;
      }
      if (typeof drawer.open === 'function') {
        drawer.open();
        return;
      }
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      NeutrexTheme.lockBodyScroll();
      this.focusTrap = NeutrexTheme.createFocusTrap(drawer);
      this.focusTrap.activate();
      NeutrexTheme.publish('neutrex:cart:open');
    },

    close() {
      const drawer = this.getDrawer();
      if (!drawer) return;
      const isOpen = drawer.classList?.contains('is-open') || drawer.hasAttribute('open');
      if (!isOpen) return;
      if (typeof drawer.close === 'function') {
        drawer.close();
        return;
      }
      drawer.classList.remove('is-open');
      drawer.removeAttribute('open');
      drawer.setAttribute('aria-hidden', 'true');
      NeutrexTheme.unlockBodyScroll();
      if (this.focusTrap) {
        this.focusTrap.deactivate();
        this.focusTrap = null;
      }
      NeutrexTheme.publish('neutrex:cart:close');
    },

    bind() {
      document.addEventListener('click', async (event) => {
        const openTrigger = event.target.closest('[data-cart-open]');
        if (openTrigger) {
          event.preventDefault();
          this.open();
          return;
        }

        const closeTrigger = event.target.closest('[data-cart-close]');
        if (closeTrigger) {
          event.preventDefault();
          this.close();
          return;
        }

        const addForm = event.target.closest('form[data-add-to-cart]');
        if (addForm && event.target.closest('[type="submit"]')) {
          event.preventDefault();
          const submitBtn = addForm.querySelector('[type="submit"]');
          submitBtn?.setAttribute('aria-busy', 'true');
          submitBtn?.classList.add('is-loading');
          try {
            const formData = new FormData(addForm);
            const id = formData.get('id');
            const quantity = parseInt(formData.get('quantity') || '1', 10);
            await this.add({ id, quantity });
            if (addForm.dataset.cartBehavior !== 'stay') this.open();
          } catch (error) {
            console.error('[Neutrex] Add to cart failed', error);
            NeutrexTheme.publish('neutrex:cart:error', { error });
          } finally {
            submitBtn?.removeAttribute('aria-busy');
            submitBtn?.classList.remove('is-loading');
          }
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          const drawer = this.getDrawer();
          if (drawer?.classList.contains('is-open') || drawer?.hasAttribute('open')) {
            this.close();
          }
        }
      });
    },

    init() {
      this.refresh().catch(() => {});
      this.bind();
    },
  };

  NeutrexTheme.Cart = Cart;

  /* -------------------------------------------------------------------------- */
  /* Wishlist                                                                    */
  /* -------------------------------------------------------------------------- */

  const Wishlist = {
    getItems() {
      try {
        const raw = localStorage.getItem(STORAGE.wishlist);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },

    setItems(items) {
      try {
        localStorage.setItem(STORAGE.wishlist, JSON.stringify(items));
      } catch {
        /* private browsing */
      }
      this.syncUI();
      NeutrexTheme.publish('neutrex:wishlist:updated', { items });
    },

    isInWishlist(handle) {
      return this.getItems().some((item) => item.handle === handle || item.id === handle);
    },

    toggle(handle, id) {
      const items = this.getItems();
      const index = items.findIndex((item) => item.handle === handle || item.id === id);
      if (index >= 0) {
        items.splice(index, 1);
      } else {
        items.push({ handle, id: id || handle });
      }
      this.setItems(items);
      return index < 0;
    },

    syncButton(btn, active) {
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
      const removeIcon = btn.querySelector('.wishlist-btn__icon--remove');
      if (removeIcon) removeIcon.hidden = !active;
      const label = active
        ? btn.dataset.labelRemove || 'Remove from wishlist'
        : btn.dataset.labelAdd || 'Add to wishlist';
      btn.setAttribute('aria-label', label);
    },

    syncUI() {
      const items = this.getItems();
      const count = items.length;

      document.querySelectorAll('[data-wishlist-toggle]').forEach((btn) => {
        const handle = btn.dataset.productHandle || btn.dataset.handle;
        const active = items.some((item) => item.handle === handle || String(item.id) === String(btn.dataset.productId));
        this.syncButton(btn, active);
      });

      document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
        el.textContent = String(count);
        el.classList.toggle('is-empty', count === 0);
        el.toggleAttribute('hidden', count === 0 && el.dataset.hideEmpty === 'true');
      });

      document.querySelectorAll('[data-wishlist-link]').forEach((link) => {
        const base = link.dataset.label || link.getAttribute('aria-label') || 'Wishlist';
        link.dataset.label = base.replace(/\s*\(\d+\)\s*$/, '') || 'Wishlist';
        link.setAttribute('aria-label', count > 0 ? `${link.dataset.label} (${count})` : link.dataset.label);
      });
    },

    bind() {
      document.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-wishlist-toggle]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const handle = btn.dataset.productHandle || btn.dataset.handle;
        const id = btn.dataset.productId;
        if (!handle && !id) return;
        const added = this.toggle(handle, id);
        this.syncButton(btn, added);
      });
    },

    init() {
      this.syncUI();
      this.bind();
    },
  };

  NeutrexTheme.Wishlist = Wishlist;

  /* -------------------------------------------------------------------------- */
  /* Share copy link                                                             */
  /* -------------------------------------------------------------------------- */

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-share-copy]');
    if (!btn) return;
    event.preventDefault();
    const url = btn.dataset.shareUrl || window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      btn.classList.add('is-copied');
      setTimeout(() => btn.classList.remove('is-copied'), 2000);
    } catch (error) {
      console.error('[Neutrex] Share copy failed', error);
    }
  });

  /* -------------------------------------------------------------------------- */
  /* Quick add (product cards — works on all templates)                          */
  /* -------------------------------------------------------------------------- */

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-quick-add]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();

    const variantId = btn.dataset.variantId;
    if (!variantId || btn.getAttribute('aria-busy') === 'true') return;

    btn.setAttribute('aria-busy', 'true');
    btn.classList.add('is-loading');

    try {
      await Cart.add({ items: [{ id: Number(variantId), quantity: 1 }] });
      btn.classList.add('is-added');
      Cart.open();
      setTimeout(() => btn.classList.remove('is-added'), 2000);
    } catch (error) {
      console.error('[Neutrex] Quick add failed', error);
    } finally {
      btn.removeAttribute('aria-busy');
      btn.classList.remove('is-loading');
    }
  });

  /* -------------------------------------------------------------------------- */
  /* Recently viewed                                                             */
  /* -------------------------------------------------------------------------- */

  const RecentlyViewed = {
    max: 12,

    getItems() {
      try {
        const raw = localStorage.getItem(STORAGE.recentlyViewed);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    },

    add(product) {
      if (!product?.handle) return;
      let items = this.getItems().filter((item) => item.handle !== product.handle);
      items.unshift({
        handle: product.handle,
        id: product.id,
        title: product.title,
        url: product.url,
        image: product.image,
        price: product.price,
      });
      items = items.slice(0, this.max);
      try {
        localStorage.setItem(STORAGE.recentlyViewed, JSON.stringify(items));
      } catch {
        /* private browsing */
      }
      NeutrexTheme.publish('neutrex:recently-viewed:updated', { items });
    },

    initFromPage() {
      const el = document.querySelector('[data-recently-viewed-source]');
      if (!el) return;
      try {
        const product = JSON.parse(el.textContent);
        this.add(product);
      } catch {
        /* invalid JSON */
      }
    },
  };

  NeutrexTheme.RecentlyViewed = RecentlyViewed;

  /* -------------------------------------------------------------------------- */
  /* Navigation — Mega menu & Mobile                                             */
  /* -------------------------------------------------------------------------- */

  const Navigation = {
    megaMenuTimer: null,

    initMegaMenu(container) {
      const items = container.querySelectorAll('[data-mega-menu-item]');
      items.forEach((item) => {
        const trigger = item.querySelector('[data-mega-menu-trigger]');
        const panel = item.querySelector('[data-mega-menu-panel]');
        if (!trigger || !panel) return;

        panel.setAttribute('role', 'region');
        panel.id = panel.id || `mega-panel-${Math.random().toString(36).slice(2, 9)}`;
        trigger.setAttribute('aria-controls', panel.id);
        trigger.setAttribute('aria-expanded', 'false');
        panel.setAttribute('aria-hidden', 'true');

        const open = () => {
          clearTimeout(this.megaMenuTimer);
          items.forEach((other) => {
            if (other === item) return;
            this.closeMegaItem(other);
          });
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          panel.setAttribute('aria-hidden', 'false');
        };

        const close = () => {
          this.megaMenuTimer = setTimeout(() => this.closeMegaItem(item), 150);
        };

        item.addEventListener('mouseenter', open);
        item.addEventListener('mouseleave', close);
        panel.addEventListener('mouseenter', () => clearTimeout(this.megaMenuTimer));
        panel.addEventListener('mouseleave', close);

        trigger.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const isOpen = item.classList.contains('is-open');
            if (isOpen) this.closeMegaItem(item);
            else open();
          }
          if (event.key === 'Escape') this.closeMegaItem(item);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            open();
            const firstLink = panel.querySelector('a, button');
            firstLink?.focus();
          }
        });
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          items.forEach((item) => this.closeMegaItem(item));
        }
      });
    },

    closeMegaItem(item) {
      const trigger = item.querySelector('[data-mega-menu-trigger]');
      const panel = item.querySelector('[data-mega-menu-panel]');
      item.classList.remove('is-open');
      trigger?.setAttribute('aria-expanded', 'false');
      panel?.setAttribute('aria-hidden', 'true');
    },

    initMobileNav(container) {
      const nav = container.querySelector('[data-mobile-nav]') || container;
      const openBtn = document.querySelector('[data-mobile-nav-open]');
      let focusTrap = null;

      const open = () => {
        nav.classList.add('is-open');
        nav.setAttribute('aria-hidden', 'false');
        openBtn?.setAttribute('aria-expanded', 'true');
        NeutrexTheme.lockBodyScroll();
        focusTrap = NeutrexTheme.createFocusTrap(nav);
        focusTrap.activate();
      };

      const close = () => {
        if (!nav.classList.contains('is-open')) return;
        nav.classList.remove('is-open');
        nav.setAttribute('aria-hidden', 'true');
        openBtn?.setAttribute('aria-expanded', 'false');
        NeutrexTheme.unlockBodyScroll();
        focusTrap?.deactivate();
        focusTrap = null;
        openBtn?.focus({ preventScroll: true });
      };

      openBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        open();
      });

      nav.querySelectorAll('[data-mobile-nav-close]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          close();
        });
      });

      nav.querySelectorAll('[data-mobile-nav-submenu-toggle]').forEach((toggle) => {
        toggle.addEventListener('click', () => {
          const submenu = toggle.closest('[data-mobile-nav-item]')?.querySelector('[data-mobile-nav-submenu]');
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
          submenu?.classList.toggle('is-open', !expanded);
        });
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && nav.classList.contains('is-open')) close();
      });

      nav._mobileNavClose = close;
    },
  };

  NeutrexTheme.Navigation = Navigation;

  /* -------------------------------------------------------------------------- */
  /* Section Rendering helper                                                    */
  /* -------------------------------------------------------------------------- */

  NeutrexTheme.fetchSection = async function fetchSection(sectionId, url) {
    const fetchUrl = new URL(url || window.location.href, window.location.origin);
    fetchUrl.searchParams.set('section_id', sectionId);
    const response = await fetch(fetchUrl.toString());
    if (!response.ok) throw new Error(`Section fetch failed: ${response.status}`);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.querySelector(`#shopify-section-${sectionId}`) || doc.body.firstElementChild;
  };

  NeutrexTheme.replaceSection = function replaceSection(sectionId, newElement) {
    const existing = document.getElementById(`shopify-section-${sectionId}`);
    if (existing && newElement) {
      existing.replaceWith(newElement);
    }
    return newElement;
  };

  /* -------------------------------------------------------------------------- */
  /* Init                                                                        */
  /* -------------------------------------------------------------------------- */

  function initSection(container) {
    const root = container || document;

    const megaMenu = root.querySelector('[data-mega-menu]');
    if (megaMenu) Navigation.initMegaMenu(megaMenu);

    const mobileNav = root.querySelector('[data-mobile-nav]');
    if (mobileNav) Navigation.initMobileNav(mobileNav);

    Wishlist.syncUI();
  }

  function init() {
    DarkMode.init();
    DarkMode.bind();
    Cart.init();
    Wishlist.init();
    RecentlyViewed.initFromPage();
    initSection(document);
  }

  NeutrexTheme.init = init;
  NeutrexTheme.initSection = initSection;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => {
    initSection(event.target);
    NeutrexTheme.publish('neutrex:section:load', { section: event.target });
  });

  document.addEventListener('shopify:section:unload', (event) => {
    NeutrexTheme.publish('neutrex:section:unload', { section: event.target });
  });
})();
