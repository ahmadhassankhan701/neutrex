/**
 * Neutrex Theme — Predictive Search
 * Custom element with keyboard navigation & debounced fetch
 */
(function () {
  'use strict';

  const NeutrexTheme = window.NeutrexTheme || {};
  const routes = window.Shopify?.routes?.root || '/';

  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      this.input = this.querySelector('[data-predictive-search-input]');
      this.results = this.querySelector('[data-predictive-search-results]');
      this.form = this.querySelector('form') || this.input?.closest('form');
      this.openBtn = document.querySelector('[data-predictive-search-open]');
      this.closeBtns = this.querySelectorAll('[data-predictive-search-close]');

      this.debounceMs = parseInt(this.dataset.debounce || '280', 10);
      this.minChars = parseInt(this.dataset.minChars || '2', 10);
      this.trending = this.parseTrending();
      this.activeIndex = -1;
      this.abortController = null;
      this.focusTrap = null;

      this.bind();
      this.renderTrending();
    }

    parseTrending() {
      try {
        return JSON.parse(this.dataset.trending || '[]');
      } catch {
        return [];
      }
    }

    bind() {
      this.input?.addEventListener('input', NeutrexTheme.debounce(() => this.onInput(), this.debounceMs));
      this.input?.addEventListener('keydown', (event) => this.onKeyDown(event));
      this.input?.addEventListener('focus', () => this.open());

      this.form?.addEventListener('submit', (event) => {
        if (!this.input?.value.trim()) event.preventDefault();
      });

      this.openBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        this.open();
        this.input?.focus();
      });

      this.closeBtns.forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });

      document.addEventListener('click', (event) => {
        if (!this.contains(event.target) && !this.openBtn?.contains(event.target)) {
          this.close();
        }
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.classList.contains('is-open')) {
          this.close();
        }
      });
    }

    open() {
      this.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      NeutrexTheme.lockBodyScroll?.();
      this.focusTrap = NeutrexTheme.createFocusTrap?.(this);
      this.focusTrap?.activate();
    }

    close() {
      this.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      this.activeIndex = -1;
      NeutrexTheme.unlockBodyScroll?.();
      this.focusTrap?.deactivate();
      this.focusTrap = null;
      this.abortController?.abort();
    }

    async onInput() {
      const query = this.input?.value.trim() || '';
      if (query.length < this.minChars) {
        this.renderTrending();
        return;
      }
      await this.search(query);
    }

    async search(query) {
      this.abortController?.abort();
      this.abortController = new AbortController();
      this.results?.setAttribute('aria-busy', 'true');

      try {
        const url = `${routes}search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product,collection,query&resources[limit]=6&resources[options][unavailable_products]=hide`;
        const data = await NeutrexTheme.fetchJSON(url, { signal: this.abortController.signal });
        this.renderResults(data, query);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('[Neutrex] Predictive search failed', error);
        }
      } finally {
        this.results?.removeAttribute('aria-busy');
      }
    }

    renderTrending() {
      if (!this.results || !this.trending.length) return;

      this.results.innerHTML = `
        <div class="predictive-search__section" role="group" aria-label="Trending searches">
          <p class="predictive-search__heading">${this.dataset.trendingLabel || 'Trending'}</p>
          <ul class="predictive-search__list" role="listbox">
            ${this.trending.map((term, i) => `
              <li role="option" id="ps-option-${i}">
                <a href="${routes}search?q=${encodeURIComponent(term)}" class="predictive-search__item" data-search-item tabindex="-1">
                  ${this.escape(term)}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
      this.activeIndex = -1;
    }

    renderResults(data, query) {
      if (!this.results) return;

      const products = data.resources?.results?.products || [];
      const collections = data.resources?.results?.collections || [];
      const queries = data.resources?.results?.queries || [];

      if (!products.length && !collections.length && !queries.length) {
        this.results.innerHTML = `
          <p class="predictive-search__empty" role="status">
            ${this.dataset.emptyLabel || 'No results found'}
          </p>
        `;
        return;
      }

      let html = '';
      let index = 0;

      if (queries.length) {
        html += `<div class="predictive-search__section" role="group" aria-label="Suggestions">
          <p class="predictive-search__heading">${this.dataset.suggestionsLabel || 'Suggestions'}</p>
          <ul class="predictive-search__list" role="listbox">`;
        queries.forEach((q) => {
          html += `<li role="option" id="ps-option-${index}">
            <a href="${routes}search?q=${encodeURIComponent(q.text)}" class="predictive-search__item" data-search-item tabindex="-1">
              ${this.escape(q.text)}
            </a></li>`;
          index += 1;
        });
        html += '</ul></div>';
      }

      if (products.length) {
        html += `<div class="predictive-search__section" role="group" aria-label="Products">
          <p class="predictive-search__heading">${this.dataset.productsLabel || 'Products'}</p>
          <ul class="predictive-search__list predictive-search__list--products" role="listbox">`;
        products.forEach((product) => {
          html += `<li role="option" id="ps-option-${index}">
            <a href="${product.url}" class="predictive-search__item predictive-search__product" data-search-item tabindex="-1">
              ${product.featured_image?.url ? `<img src="${product.featured_image.url}&width=80" alt="" width="40" height="40" loading="lazy">` : ''}
              <span>
                <span class="predictive-search__title">${this.highlight(product.title, query)}</span>
                ${product.price ? `<span class="predictive-search__price">${product.price}</span>` : ''}
              </span>
            </a></li>`;
          index += 1;
        });
        html += '</ul></div>';
      }

      if (collections.length) {
        html += `<div class="predictive-search__section" role="group" aria-label="Collections">
          <p class="predictive-search__heading">${this.dataset.collectionsLabel || 'Collections'}</p>
          <ul class="predictive-search__list" role="listbox">`;
        collections.forEach((collection) => {
          html += `<li role="option" id="ps-option-${index}">
            <a href="${collection.url}" class="predictive-search__item" data-search-item tabindex="-1">
              ${collection.featured_image?.url ? `<img src="${collection.featured_image.url}&width=80" alt="" width="40" height="40" loading="lazy">` : ''}
              ${this.escape(collection.title)}
            </a></li>`;
          index += 1;
        });
        html += '</ul></div>';
      }

      html += `<a href="${routes}search?q=${encodeURIComponent(query)}" class="predictive-search__view-all" data-search-item tabindex="-1">
        ${this.dataset.viewAllLabel || 'View all results'}
      </a>`;

      this.results.innerHTML = html;
      this.activeIndex = -1;
    }

    getItems() {
      return Array.from(this.results?.querySelectorAll('[data-search-item]') || []);
    }

    onKeyDown(event) {
      const items = this.getItems();
      if (!items.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
        this.focusItem(items);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, 0);
        this.focusItem(items);
      } else if (event.key === 'Enter' && this.activeIndex >= 0) {
        event.preventDefault();
        items[this.activeIndex].click();
      }
    }

    focusItem(items) {
      items.forEach((item, i) => {
        item.tabIndex = i === this.activeIndex ? 0 : -1;
        if (i === this.activeIndex) item.focus();
      });
      this.input?.setAttribute('aria-activedescendant', items[this.activeIndex]?.closest('[role="option"]')?.id || '');
    }

    escape(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    highlight(text, query) {
      const escaped = this.escape(text);
      const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return escaped.replace(pattern, '<mark>$1</mark>');
    }
  }

  if (!customElements.get('predictive-search')) {
    customElements.define('predictive-search', PredictiveSearch);
  }

  NeutrexTheme.PredictiveSearch = PredictiveSearch;

  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll('predictive-search:not([data-initialized])').forEach((el) => {
      el._initialized = false;
      el.connectedCallback?.();
    });
  });
})();
