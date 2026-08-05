/**
 * Neutrex Theme — Collection page
 * Filters, sort, infinite scroll, quick add, quick view
 */
(function () {
  'use strict';

  const NeutrexTheme = window.NeutrexTheme || {};
  const routes = window.Shopify?.routes?.root || '/';

  /* -------------------------------------------------------------------------- */
  /* Collection filters (Section Rendering API)                                  */
  /* -------------------------------------------------------------------------- */

  class CollectionFilters {
    constructor(container) {
      this.container = container;
      this.form = container.querySelector('[data-collection-filters]');
      this.gridContainer = document.querySelector('#ProductGridContainer') ||
        container.querySelector('[data-product-grid]');
      this.sectionId = container.dataset.sectionId;

      if (!this.form || !this.gridContainer) return;

      this.bind();
    }

    bind() {
      this.form.addEventListener('change', NeutrexTheme.debounce(() => this.submit(), 300));
      this.form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.submit();
      });

      this.container.querySelectorAll('[data-filter-remove]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          const param = btn.dataset.filterRemove;
          const input = this.form.querySelector(`[name="${param}"]`);
          if (input) {
            if (input.type === 'checkbox') input.checked = false;
            else input.value = '';
          }
          this.submit();
        });
      });

      this.container.querySelectorAll('[data-filter-clear]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          this.form.reset();
          this.submit();
        });
      });
    }

    buildURL() {
      const formData = new FormData(this.form);
      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        if (value) params.append(key, value);
      });
      const sort = this.container.querySelector('[data-collection-sort]')?.value;
      if (sort) params.set('sort_by', sort);
      return `${window.location.pathname}?${params.toString()}`;
    }

    async submit() {
      const url = this.buildURL();
      this.gridContainer.setAttribute('aria-busy', 'true');
      this.gridContainer.classList.add('is-loading');

      try {
        if (this.sectionId && NeutrexTheme.fetchSection) {
          const section = await NeutrexTheme.fetchSection(this.sectionId, url);
          const newGrid = section.querySelector('#ProductGridContainer') ||
            section.querySelector('[data-product-grid]');
          if (newGrid) {
            this.gridContainer.innerHTML = newGrid.innerHTML;
          } else {
            this.gridContainer.innerHTML = section.innerHTML;
          }
        } else {
          const response = await fetch(url);
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const newGrid = doc.querySelector('#ProductGridContainer') ||
            doc.querySelector('[data-product-grid]');
          if (newGrid) this.gridContainer.innerHTML = newGrid.innerHTML;
        }

        window.history.pushState({}, '', url);
        NeutrexTheme.publish?.('neutrex:collection:updated', { url });
        initCollectionFeatures(this.gridContainer);
      } catch (error) {
        console.error('[Neutrex] Filter update failed', error);
      } finally {
        this.gridContainer.removeAttribute('aria-busy');
        this.gridContainer.classList.remove('is-loading');
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Sort                                                                        */
  /* -------------------------------------------------------------------------- */

  function initSort(container) {
    container.querySelectorAll('[data-collection-sort]').forEach((select) => {
      if (select.dataset.bound) return;
      select.dataset.bound = 'true';

      select.addEventListener('change', () => {
        const form = container.querySelector('[data-collection-filters]');
        if (form) {
          form.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const url = new URL(window.location.href);
          url.searchParams.set('sort_by', select.value);
          window.location.href = url.toString();
        }
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Infinite scroll / Load more                                                 */
  /* -------------------------------------------------------------------------- */

  class LoadMore {
    constructor(button) {
      this.button = button;
      this.grid = document.querySelector('#ProductGridContainer') ||
        document.querySelector('[data-product-grid]');
      this.nextPage = parseInt(button.dataset.nextPage || '2', 10);
      this.loading = false;

      button.addEventListener('click', () => this.load());
    }

    async load() {
      if (this.loading || !this.grid) return;
      this.loading = true;
      this.button.setAttribute('aria-busy', 'true');

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', this.nextPage);
        const response = await fetch(url.toString());
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newGrid = doc.querySelector('#ProductGridContainer') ||
          doc.querySelector('[data-product-grid]');
        const items = newGrid?.querySelectorAll('[data-product-card]') || [];

        if (items.length) {
          items.forEach((item) => this.grid.appendChild(item));
          this.nextPage += 1;
          this.button.dataset.nextPage = this.nextPage;
          initCollectionFeatures(this.grid);
        } else {
          this.button.hidden = true;
        }

        const newLoadMore = doc.querySelector('[data-load-more]');
        if (!newLoadMore || newLoadMore.hidden) {
          this.button.hidden = true;
        }
      } catch (error) {
        console.error('[Neutrex] Load more failed', error);
      } finally {
        this.loading = false;
        this.button.removeAttribute('aria-busy');
      }
    }
  }

  function initLoadMore(container) {
    container.querySelectorAll('[data-load-more]:not([data-bound])').forEach((btn) => {
      btn.dataset.bound = 'true';
      new LoadMore(btn);
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Quick add                                                                   */
  /* -------------------------------------------------------------------------- */

  function initQuickAdd() {
    /* Quick add is handled globally in theme.js */
  }

  /* -------------------------------------------------------------------------- */
  /* Quick view modal                                                            */
  /* -------------------------------------------------------------------------- */

  class QuickView {
    constructor() {
      this.modal = document.querySelector('[data-quick-view-modal]');
      this.content = this.modal?.querySelector('[data-quick-view-content]');
      this.focusTrap = null;
      this.isOpen = false;
      this.bind();
    }

    bind() {
      document.addEventListener('click', async (event) => {
        const closeBtn = event.target.closest('[data-quick-view-close]');
        if (closeBtn && this.isOpen) {
          event.preventDefault();
          this.close();
          return;
        }

        const btn = event.target.closest('[data-quick-view]');
        if (!btn) return;
        event.preventDefault();
        event.stopPropagation();
        const productUrl = btn.dataset.productUrl || btn.getAttribute('href');
        if (!productUrl) return;
        await this.open(productUrl);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    async open(productUrl) {
      this.modal = document.querySelector('[data-quick-view-modal]');
      this.content = this.modal?.querySelector('[data-quick-view-content]');
      if (!this.modal || !this.content) {
        window.location.href = productUrl;
        return;
      }

      this.isOpen = true;
      this.modal.classList.add('is-open');
      this.modal.setAttribute('aria-hidden', 'false');
      NeutrexTheme.lockBodyScroll?.();
      this.content.setAttribute('aria-busy', 'true');
      this.content.innerHTML = '<p class="quick-view__loading">Loading…</p>';

      try {
        const url = new URL(productUrl, window.location.origin);
        url.searchParams.set('section_id', this.modal.dataset.sectionId || 'main-product');
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Quick view fetch failed');
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const section = doc.querySelector('[data-product-main]') || doc.querySelector('.pdp') || doc.body;
        this.content.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'quick-view__product';
        wrap.innerHTML = section.innerHTML;
        this.content.appendChild(wrap);
        NeutrexTheme.Product?.init(wrap);
        NeutrexTheme.Wishlist?.syncUI?.();
      } catch (error) {
        console.error('[Neutrex] Quick view failed', error);
        this.content.innerHTML = '<p role="alert">Unable to load product. <a href="' + productUrl + '">View product</a></p>';
      } finally {
        this.content.removeAttribute('aria-busy');
        this.focusTrap = NeutrexTheme.createFocusTrap?.(this.modal);
        this.focusTrap?.activate();
      }
    }

    close() {
      if (!this.modal || !this.isOpen) return;
      this.isOpen = false;
      this.modal.classList.remove('is-open');
      this.modal.setAttribute('aria-hidden', 'true');
      NeutrexTheme.unlockBodyScroll?.();
      this.focusTrap?.deactivate();
      this.focusTrap = null;
      if (this.content) this.content.innerHTML = '';
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Product card hover image                                                    */
  /* -------------------------------------------------------------------------- */

  function initHoverImages(container) {
    container.querySelectorAll('[data-product-card]').forEach((card) => {
      if (card.dataset.hoverBound) return;
      const secondary = card.querySelector('[data-product-image-secondary]');
      if (!secondary) return;
      card.dataset.hoverBound = 'true';

      card.addEventListener('mouseenter', () => card.classList.add('show-secondary'));
      card.addEventListener('mouseleave', () => card.classList.remove('show-secondary'));
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Init                                                                        */
  /* -------------------------------------------------------------------------- */

  let quickViewInstance = null;

  function initCollectionFeatures(root) {
    const container = root || document;
    initHoverImages(container);
    initLoadMore(container);
  }

  function initCollection(root) {
    const container = root || document;
    container.querySelectorAll('[data-collection-main]').forEach((el) => {
      new CollectionFilters(el);
    });
    initSort(container);
    initQuickAdd(container);
    initCollectionFeatures(container);
    if (!quickViewInstance) quickViewInstance = new QuickView();
  }

  NeutrexTheme.Collection = { init: initCollection };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initCollection(document));
  } else {
    initCollection(document);
  }

  document.addEventListener('shopify:section:load', (event) => {
    initCollection(event.target);
  });
})();
