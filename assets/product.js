/**
 * Neutrex Theme — Product page
 * Variants, gallery, sticky ATC, quantity, accordion, 360 viewer
 */
(function () {
  'use strict';

  const NeutrexTheme = window.NeutrexTheme || {};
  const routes = window.Shopify?.routes?.root || '/';

  /* -------------------------------------------------------------------------- */
  /* Product form / variants                                                     */
  /* -------------------------------------------------------------------------- */

  class ProductForm {
    constructor(container) {
      this.container = container;
      this.form = container.querySelector('form[data-product-form]') || container.querySelector('form[action*="/cart/add"]');
      this.productData = this.parseProductJSON();
      if (!this.form || !this.productData) return;

      this.variantInput = this.form.querySelector('[name="id"]');
      this.optionInputs = Array.from(this.form.querySelectorAll('[data-option-input]'));
      this.priceEls = Array.from(container.querySelectorAll('[data-product-price]'));
      this.compareEls = Array.from(container.querySelectorAll('[data-product-compare-price]'));
      this.availabilityEl = container.querySelector('[data-product-availability]');
      this.stockEl = container.querySelector('[data-stock-indicator]');
      this.skuEl = container.querySelector('[data-product-sku]');
      this.submitBtn = this.form.querySelector('[type="submit"]');
      this.mediaGallery = container.querySelector('[data-product-gallery]');
      this.lowStockThreshold = parseInt(container.dataset.lowStockThreshold || this.stockEl?.dataset.lowStockThreshold || '5', 10);

      this.bind();
      this.updateFromOptions();
    }

    parseProductJSON() {
      const script = this.container.querySelector('[data-product-json]');
      if (!script) return null;
      try {
        return JSON.parse(script.textContent);
      } catch {
        return null;
      }
    }

    bind() {
      this.optionInputs.forEach((input) => {
        input.addEventListener('change', () => this.updateFromOptions());
      });

      this.form.querySelectorAll('[data-option-select]').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const name = btn.dataset.optionName;
          const value = btn.dataset.optionValue;
          if (!name || value == null || value === '') return;

          const input = this.findOptionInput(name);
          if (input) input.value = value;

          const groupLabel = btn.closest('[data-variant-option]')?.querySelector('[data-option-label]');
          if (groupLabel) groupLabel.textContent = value;

          this.syncOptionButtons(name, value);
          this.updateFromOptions();
        });
      });
    }

    findOptionInput(nameOrIndex) {
      return this.optionInputs.find((input) => {
        if (input.name === nameOrIndex) return true;
        if (input.dataset.optionName === nameOrIndex) return true;
        if (String(input.dataset.optionIndex) === String(nameOrIndex)) return true;
        return false;
      });
    }

    syncOptionButtons(name, value) {
      this.form.querySelectorAll('[data-option-select]').forEach((btn) => {
        if (btn.dataset.optionName !== name) return;
        const selected = btn.dataset.optionValue === value;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
      });
    }

    getSelectedOptions() {
      const options = [];
      (this.productData.options || []).forEach((optionName, index) => {
        const input =
          this.findOptionInput(index) ||
          this.findOptionInput(`options[${optionName}]`) ||
          this.findOptionInput(optionName);
        options.push(input ? input.value : this.productData.variants[0]?.options?.[index]);
      });
      return options;
    }

    findVariant() {
      const selected = this.getSelectedOptions();
      return (this.productData.variants || []).find((variant) => {
        const values = variant.options || [variant.option1, variant.option2, variant.option3].filter(Boolean);
        return values.every((opt, i) => opt === selected[i]);
      });
    }

    updateFromOptions() {
      const variant = this.findVariant();
      if (!variant) {
        this.setUnavailable();
        return;
      }

      if (this.variantInput) this.variantInput.value = variant.id;
      this.updatePrice(variant);
      this.updateAvailability(variant);
      this.updateStock(variant);
      this.updateSKU(variant);
      this.updateURL(variant);
      this.updateMedia(variant);
      this.syncAllOptionButtons();
      NeutrexTheme.publish?.('neutrex:variant:change', { variant, product: this.productData });
    }

    syncAllOptionButtons() {
      (this.productData.options || []).forEach((name, index) => {
        const input =
          this.findOptionInput(index) ||
          this.findOptionInput(`options[${name}]`) ||
          this.findOptionInput(name);
        if (input) this.syncOptionButtons(input.name || `options[${name}]`, input.value);
      });
    }

    formatMoney(cents) {
      const format = window.theme?.moneyFormat || window.Shopify?.money_format;
      if (window.Shopify?.formatMoney) {
        return window.Shopify.formatMoney(cents, format);
      }
      return (Number(cents) / 100).toFixed(2);
    }

    updatePrice(variant) {
      const price = variant.price;
      const compare = variant.compare_at_price;
      const onSale = compare && compare > price;

      this.priceEls.forEach((el) => {
        el.textContent = this.formatMoney(price);
        el.classList.toggle('is-on-sale', Boolean(onSale));
        el.classList.toggle('price__current--sale', Boolean(onSale));
      });

      this.compareEls.forEach((el) => {
        if (onSale) {
          el.textContent = this.formatMoney(compare);
          el.hidden = false;
          el.removeAttribute('hidden');
        } else {
          el.hidden = true;
          el.setAttribute('hidden', '');
        }
      });
    }

    updateAvailability(variant) {
      const available = Boolean(variant.available);
      if (this.availabilityEl) {
        this.availabilityEl.textContent = available
          ? this.availabilityEl.dataset.inStock || 'In stock'
          : this.availabilityEl.dataset.outOfStock || 'Sold out';
        this.availabilityEl.classList.toggle('is-available', available);
        this.availabilityEl.classList.toggle('is-unavailable', !available);
      }
      if (this.submitBtn) {
        this.submitBtn.disabled = !available;
        this.submitBtn.textContent = available
          ? this.submitBtn.dataset.addText || 'Add to cart'
          : this.submitBtn.dataset.soldOutText || 'Sold out';
      }
    }

    updateStock(variant) {
      if (!this.stockEl) return;
      const textEl = this.stockEl.querySelector('.stock-indicator__text') || this.stockEl;
      const qty = variant.inventory_quantity;
      const tracked = variant.inventory_management === 'shopify';
      let status = 'in';
      let message = this.stockEl.dataset.inStock || 'In stock';

      if (!variant.available) {
        status = 'out';
        message = this.stockEl.dataset.outOfStock || 'Out of stock';
      } else if (tracked && typeof qty === 'number' && qty > 0 && qty <= this.lowStockThreshold) {
        status = 'low';
        const template = this.stockEl.dataset.lowStock || 'Only {{ count }} left';
        message = template
          .replace(/\{\{\s*count\s*\}\}/g, String(qty))
          .replace(/___/g, String(qty));
      }

      this.stockEl.classList.remove('stock-indicator--in', 'stock-indicator--low', 'stock-indicator--out');
      this.stockEl.classList.add(`stock-indicator--${status}`);
      this.stockEl.dataset.variantId = variant.id;
      textEl.textContent = message;
    }

    updateSKU(variant) {
      if (this.skuEl) {
        this.skuEl.textContent = variant.sku || '—';
        this.skuEl.closest('[data-product-sku-wrapper]')?.toggleAttribute('hidden', !variant.sku);
      }
    }

    updateURL(variant) {
      if (!variant.id || !window.history?.replaceState) return;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({ variant: variant.id }, '', url.toString());
      } catch {
        /* ignore */
      }
    }

    updateMedia(variant) {
      if (!this.mediaGallery || !variant.featured_media) return;
      const mediaId = variant.featured_media.id || variant.featured_media;
      const thumb = this.mediaGallery.querySelector(`[data-media-id="${mediaId}"]`);
      if (!thumb) return;
      const gallery = this.mediaGallery._galleryInstance;
      if (gallery?.selectMedia) {
        gallery.selectMedia(thumb);
      } else {
        thumb.dispatchEvent(new Event('click', { bubbles: false }));
      }
    }

    setUnavailable() {
      if (this.submitBtn) {
        this.submitBtn.disabled = true;
        this.submitBtn.textContent = this.submitBtn.dataset.unavailableText || 'Unavailable';
      }
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Media gallery                                                               */
  /* -------------------------------------------------------------------------- */

  class ProductGallery {
    constructor(container) {
      this.container = container;
      this.main = container.querySelector('[data-gallery-main]');
      this.thumbs = container.querySelectorAll('[data-gallery-thumb]');
      this.zoomEnabled = container.dataset.zoom === 'true';
      container._galleryInstance = this;

      if (!this.main) return;
      this.bind();
      if (this.zoomEnabled && window.matchMedia('(min-width: 990px)').matches) {
        this.initZoom();
      }
    }

    bind() {
      this.thumbs.forEach((thumb) => {
        thumb.addEventListener('click', (event) => {
          event.preventDefault();
          this.selectMedia(thumb);
        });
      });
    }

    selectMedia(thumb) {
      const mediaId = thumb.dataset.mediaId;
      const src = thumb.dataset.mediaSrc || thumb.querySelector('img')?.src;
      const alt = thumb.querySelector('img')?.alt || '';

      this.thumbs.forEach((t) => {
        t.classList.toggle('is-active', t === thumb);
        t.setAttribute('aria-selected', t === thumb ? 'true' : 'false');
        t.setAttribute('aria-current', t === thumb ? 'true' : 'false');
      });

      const mainImg = this.main.querySelector('img');
      if (mainImg && src) {
        const wideSrc = src.includes('width=') ? src.replace(/width=\d+/, 'width=1200') : src;
        mainImg.src = wideSrc;
        mainImg.srcset = '';
        mainImg.alt = alt;
      }

      this.main.dataset.mediaId = mediaId;
      NeutrexTheme.publish?.('neutrex:gallery:changed', { mediaId });
    }

    initZoom() {
      const img = this.main.querySelector('img');
      if (!img) return;

      this.main.addEventListener('mousemove', (event) => {
        const rect = this.main.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = 'scale(1.75)';
      });

      this.main.addEventListener('mouseleave', () => {
        img.style.transform = '';
        img.style.transformOrigin = 'center center';
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Sticky add to cart                                                          */
  /* -------------------------------------------------------------------------- */

  class StickyATC {
    constructor(container) {
      this.bar = container;
      this.target = document.querySelector('[data-product-form-anchor]') ||
        document.querySelector('[data-product-form]') ||
        document.querySelector('form[data-product-form]');

      if (!this.target) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          this.bar.classList.toggle('is-visible', !entry.isIntersecting);
          this.bar.setAttribute('aria-hidden', String(entry.isIntersecting));
        },
        { threshold: 0, rootMargin: '0px 0px -20% 0px' }
      );

      observer.observe(this.target);

      this.bar.querySelector('[data-sticky-atc-trigger]')?.addEventListener('click', () => {
        this.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.target.querySelector('[type="submit"]')?.focus({ preventScroll: true });
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Quantity stepper                                                            */
  /* -------------------------------------------------------------------------- */

  function initQuantitySteppers(root) {
    (root || document).querySelectorAll('[data-quantity-stepper]').forEach((stepper) => {
      if (stepper.dataset.bound) return;
      stepper.dataset.bound = 'true';

      const input = stepper.querySelector('[data-quantity-input]');
      const minus = stepper.querySelector('[data-quantity-minus]');
      const plus = stepper.querySelector('[data-quantity-plus]');
      const min = parseInt(input?.min || '1', 10);
      const max = parseInt(input?.max || '999', 10);

      minus?.addEventListener('click', () => {
        const next = Math.max(min, parseInt(input.value || min, 10) - 1);
        input.value = next;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      plus?.addEventListener('click', () => {
        const next = Math.min(max, parseInt(input.value || min, 10) + 1);
        input.value = next;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Accordion                                                                   */
  /* -------------------------------------------------------------------------- */

  function initAccordions(root) {
    (root || document).querySelectorAll('[data-accordion]').forEach((accordion) => {
      if (accordion.dataset.bound) return;
      accordion.dataset.bound = 'true';
      const single = accordion.dataset.accordion === 'single';

      accordion.querySelectorAll('[data-accordion-trigger]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
          const panel =
            document.getElementById(trigger.getAttribute('aria-controls')) ||
            trigger.nextElementSibling;
          const expanded = trigger.getAttribute('aria-expanded') === 'true';

          if (single && !expanded) {
            accordion.querySelectorAll('[data-accordion-trigger]').forEach((other) => {
              if (other === trigger) return;
              other.setAttribute('aria-expanded', 'false');
              const otherPanel =
                document.getElementById(other.getAttribute('aria-controls')) ||
                other.nextElementSibling;
              if (otherPanel) otherPanel.hidden = true;
            });
          }

          trigger.setAttribute('aria-expanded', String(!expanded));
          if (panel) panel.hidden = expanded;
        });
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Buy now                                                                     */
  /* -------------------------------------------------------------------------- */

  function initBuyNow(root) {
    (root || document).querySelectorAll('[data-buy-now]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = 'true';
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const form = btn.closest('form') || document.querySelector('form[data-product-form]');
        if (!form) return;
        const id = form.querySelector('[name="id"]')?.value;
        const quantity = parseInt(form.querySelector('[name="quantity"]')?.value || '1', 10);
        if (!id) return;
        try {
          await NeutrexTheme.Cart?.add({ items: [{ id: Number(id), quantity }] });
          window.location.href = `${routes}checkout`;
        } catch (error) {
          console.error('[Neutrex] Buy now failed', error);
        }
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 360 spin                                                                    */
  /* -------------------------------------------------------------------------- */

  function initSpin360(root) {
    (root || document).querySelectorAll('[data-spin-360]').forEach((viewer) => {
      if (viewer.dataset.bound) return;
      viewer.dataset.bound = 'true';
      const frameScript = viewer.querySelector('[data-spin-360-frames]');
      if (!frameScript) return;
      let frames = [];
      try {
        frames = JSON.parse(frameScript.textContent);
      } catch {
        return;
      }
      if (!frames.length) return;

      const img = viewer.querySelector('img') || document.createElement('img');
      if (!img.parentNode) viewer.appendChild(img);

      let frameIndex = 0;
      let isDragging = false;
      let startX = 0;

      function setFrame(index) {
        frameIndex = ((index % frames.length) + frames.length) % frames.length;
        img.src = frames[frameIndex];
      }

      viewer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        viewer.setAttribute('aria-grabbed', 'true');
      });

      window.addEventListener('mouseup', () => {
        isDragging = false;
        viewer.setAttribute('aria-grabbed', 'false');
      });

      viewer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const delta = e.clientX - startX;
        if (Math.abs(delta) > 8) {
          setFrame(frameIndex + (delta > 0 ? 1 : -1));
          startX = e.clientX;
        }
      });

      viewer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
      }, { passive: true });

      viewer.addEventListener('touchmove', (e) => {
        const delta = e.touches[0].clientX - startX;
        if (Math.abs(delta) > 8) {
          setFrame(frameIndex + (delta > 0 ? 1 : -1));
          startX = e.touches[0].clientX;
        }
      }, { passive: true });

      setFrame(0);
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Init                                                                        */
  /* -------------------------------------------------------------------------- */

  function initProduct(root) {
    const container = root || document;
    container.querySelectorAll('[data-product-main]').forEach((el) => {
      new ProductForm(el);
      const gallery = el.querySelector('[data-product-gallery]');
      if (gallery) new ProductGallery(gallery);
    });

    container.querySelectorAll('[data-sticky-atc]').forEach((el) => new StickyATC(el));
    initQuantitySteppers(container);
    initAccordions(container);
    initBuyNow(container);
    initSpin360(container);
  }

  NeutrexTheme.Product = { init: initProduct, ProductForm, ProductGallery };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initProduct(document));
  } else {
    initProduct(document);
  }

  document.addEventListener('shopify:section:load', (event) => {
    initProduct(event.target);
  });
})();
