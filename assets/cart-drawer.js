/**
 * Neutrex Theme — Cart Drawer
 * Custom element: line items, shipping bar, note, cart events
 */
(function () {
  'use strict';

  const NeutrexTheme = window.NeutrexTheme || {};
  const routes = window.Shopify?.routes?.root || '/';

  class CartDrawer extends HTMLElement {
    connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      this.overlay = this.querySelector('[data-cart-drawer-overlay]');
      this.panel = this.querySelector('[data-cart-drawer-panel]') || this;
      this.itemsContainer = this.querySelector('[data-cart-items]');
      this.subtotalEl = this.querySelector('[data-cart-subtotal]');
      this.countEl = this.querySelector('[data-cart-drawer-count]');
      this.noteField = this.querySelector('[data-cart-note]');
      this.shippingBar = this.querySelector('[data-free-shipping-bar]');
      this.emptyEl = this.querySelector('[data-cart-empty]');
      this.footerEl = this.querySelector('[data-cart-footer]');

      this.threshold = parseFloat(this.dataset.freeShippingThreshold || '0') * 100;
      this.moneyFormat = this.dataset.moneyFormat || window.theme?.moneyFormat || window.Shopify?.money_format || '{{amount}}';
      this.focusTrap = null;
      this.noteDebounce = NeutrexTheme.debounce((note) => this.updateNote(note), 500);

      this.bind();
      this.refresh();
      NeutrexTheme.on?.('neutrex:cart:updated', (event) => this.render(event.detail?.cart));
    }

    bind() {
      this.querySelectorAll('[data-cart-close]').forEach((btn) => {
        btn.addEventListener('click', () => this.close());
      });

      this.overlay?.addEventListener('click', () => this.close());

      this.addEventListener('click', async (event) => {
        const minus = event.target.closest('[data-cart-qty-minus]');
        const plus = event.target.closest('[data-cart-qty-plus]');
        const remove = event.target.closest('[data-cart-remove]');

        if (minus || plus) {
          event.preventDefault();
          const line = parseInt((minus || plus).dataset.line, 10);
          const input = this.querySelector(`[data-cart-qty-input][data-line="${line}"]`);
          let qty = parseInt(input?.value || '1', 10);
          qty = minus ? Math.max(0, qty - 1) : qty + 1;
          await this.changeLine(line, qty);
        }

        if (remove) {
          event.preventDefault();
          const line = parseInt(remove.dataset.line, 10);
          await this.changeLine(line, 0);
        }
      });

      this.noteField?.addEventListener('input', () => {
        this.noteDebounce(this.noteField.value);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.classList.contains('is-open')) {
          this.close();
        }
      });
    }

    open() {
      this.classList.add('is-open');
      this.setAttribute('open', '');
      this.setAttribute('aria-hidden', 'false');
      NeutrexTheme.lockBodyScroll?.();
      this.focusTrap = NeutrexTheme.createFocusTrap?.(this.panel);
      this.focusTrap?.activate();
      this.refresh();
      NeutrexTheme.publish?.('neutrex:cart:open');
    }

    close() {
      this.classList.remove('is-open');
      this.removeAttribute('open');
      this.setAttribute('aria-hidden', 'true');
      NeutrexTheme.unlockBodyScroll?.();
      this.focusTrap?.deactivate();
      this.focusTrap = null;
      NeutrexTheme.publish?.('neutrex:cart:close');
    }

    async refresh() {
      try {
        const cart = await NeutrexTheme.Cart?.fetchCart() || await NeutrexTheme.fetchJSON(`${routes}cart.js`);
        this.render(cart);
        NeutrexTheme.Cart?.updateCounts(cart.item_count);
      } catch (error) {
        console.error('[Neutrex] Cart drawer refresh failed', error);
      }
    }

    async changeLine(line, quantity) {
      const row = this.querySelector(`[data-cart-item][data-line="${line}"]`);
      row?.setAttribute('aria-busy', 'true');

      try {
        const cart = await NeutrexTheme.fetchJSON(`${routes}cart/change.js`, {
          method: 'POST',
          body: JSON.stringify({ line, quantity }),
        });
        this.render(cart);
        NeutrexTheme.Cart?.updateCounts(cart.item_count);
        NeutrexTheme.publish?.('neutrex:cart:updated', { cart });
      } catch (error) {
        console.error('[Neutrex] Line update failed', error);
      } finally {
        row?.removeAttribute('aria-busy');
      }
    }

    async updateNote(note) {
      try {
        await NeutrexTheme.fetchJSON(`${routes}cart/update.js`, {
          method: 'POST',
          body: JSON.stringify({ note }),
        });
      } catch (error) {
        console.error('[Neutrex] Cart note update failed', error);
      }
    }

    render(cart) {
      if (!cart) return;

      const isEmpty = cart.item_count === 0;

      if (this.countEl) this.countEl.textContent = cart.item_count;
      if (this.subtotalEl) {
        this.subtotalEl.textContent = this.formatMoney(cart.total_price);
      }

      this.setHidden(this.emptyEl, !isEmpty);
      this.setHidden(this.footerEl, isEmpty);
      this.setHidden(this.itemsContainer, isEmpty);

      const noteWrap = this.querySelector('[data-cart-note-wrap]');
      if (noteWrap) {
        noteWrap.classList.toggle('visually-hidden', isEmpty);
      }

      if (this.itemsContainer && cart.items) {
        this.itemsContainer.innerHTML = cart.items.map((item, index) => this.renderItem(item, index + 1)).join('');
      }

      this.updateShippingBar(cart.total_price);
    }

    setHidden(el, hidden) {
      if (!el) return;
      if (hidden) {
        el.setAttribute('hidden', '');
      } else {
        el.removeAttribute('hidden');
      }
    }

    renderItem(item, line) {
      const img = item.image ? `<img src="${item.image}&width=120" alt="" width="72" height="72" loading="lazy">` : '';
      const options = item.options_with_values
        ?.filter((o) => o.value !== 'Default Title')
        .map((o) => `<span class="cart-item__option">${this.escape(o.name)}: ${this.escape(o.value)}</span>`)
        .join('') || '';

      return `
        <div class="cart-item" data-cart-item data-line="${line}" data-key="${item.key}">
          <a href="${item.url}" class="cart-item__media">${img}</a>
          <div class="cart-item__details">
            <a href="${item.url}" class="cart-item__title">${this.escape(item.product_title)}</a>
            ${item.variant_title && item.variant_title !== 'Default Title' ? `<p class="cart-item__variant">${this.escape(item.variant_title)}</p>` : ''}
            ${options}
            <p class="cart-item__price">${this.formatMoney(item.final_line_price)}</p>
            <div class="cart-item__qty" data-quantity-stepper>
              <button type="button" class="cart-item__qty-btn" data-cart-qty-minus data-line="${line}" aria-label="Decrease quantity">−</button>
              <input type="number" class="cart-item__qty-input" data-cart-qty-input data-line="${line}" value="${item.quantity}" min="0" readonly aria-label="Quantity">
              <button type="button" class="cart-item__qty-btn" data-cart-qty-plus data-line="${line}" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <button type="button" class="cart-item__remove" data-cart-remove data-line="${line}" aria-label="Remove ${this.escape(item.product_title)}">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      `;
    }

    updateShippingBar(totalCents) {
      if (!this.shippingBar || !this.threshold) return;

      const progress = Math.min(100, (totalCents / this.threshold) * 100);
      const remaining = Math.max(0, this.threshold - totalCents);
      const fill = this.shippingBar.querySelector('[data-shipping-progress]');
      const message = this.shippingBar.querySelector('[data-shipping-message]');

      if (fill) {
        fill.style.width = `${progress}%`;
        fill.setAttribute('aria-valuenow', Math.round(progress));
      }

      if (message) {
        if (remaining <= 0) {
          message.textContent = this.decodeEntities(
            this.shippingBar.dataset.qualifiedMessage || "You've unlocked free shipping"
          );
        } else {
          const template = this.decodeEntities(
            this.shippingBar.dataset.remainingMessage || 'Spend {{ amount }} more for free shipping'
          );
          message.textContent = template.replace(/\{\{\s*amount\s*\}\}/g, this.formatMoney(remaining));
        }
      }

      this.shippingBar.classList.toggle('is-qualified', remaining <= 0);
      this.shippingBar.classList.toggle('is-complete', remaining <= 0);
    }

    formatMoney(cents) {
      const format = this.moneyFormat || window.theme?.moneyFormat || window.Shopify?.money_format;
      if (window.Shopify?.formatMoney && format) {
        return window.Shopify.formatMoney(cents, format);
      }
      if (format) {
        const amount = (Number(cents) / 100).toFixed(2);
        return format
          .replace(/\{\{\s*amount\s*\}\}/g, amount)
          .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, String(Math.round(Number(cents) / 100)))
          .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, amount.replace('.', ','));
      }
      return (Number(cents) / 100).toFixed(2);
    }

    decodeEntities(value) {
      if (!value || !/[&][#a-zA-Z0-9]+;/.test(value)) return value || '';
      const textarea = document.createElement('textarea');
      textarea.innerHTML = value;
      return textarea.value;
    }

    escape(str) {
      const div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    }
  }

  if (!customElements.get('cart-drawer')) {
    customElements.define('cart-drawer', CartDrawer);
  }

  NeutrexTheme.CartDrawer = CartDrawer;

  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll('cart-drawer:not([data-initialized])').forEach((el) => {
      el._initialized = false;
      el.connectedCallback?.();
    });
  });
})();
