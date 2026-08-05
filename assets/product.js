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
      this.optionInputs = this.form.querySelectorAll('[data-option-input]');
      this.priceEl = container.querySelector('[data-product-price]');
      this.compareEl = container.querySelector('[data-product-compare-price]');
      this.availabilityEl = container.querySelector('[data-product-availability]');
      this.skuEl = container.querySelector('[data-product-sku]');
      this.submitBtn = this.form.querySelector('[type="submit"]');
      this.mediaGallery = container.querySelector('[data-product-gallery]');

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

          const input = this.form.querySelector(`[data-option-input][name="${name}"]`);
          if (input) {
            input.value = value;
          }

          const groupLabel = btn.closest('[data-variant-option]')?.querySelector('[data-option-label]');
          if (groupLabel) groupLabel.textContent = value;

          this.syncOptionButtons(name, value);
          this.updateFromOptions();
        });
      });
    }

    syncOptionButtons(name, value) {
      this.form.querySelectorAll(`[data-option-select][data-option-name="${name}"]`).forEach((btn) => {
        const selected = btn.dataset.optionValue === value;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
      });
    }

    getSelectedOptions() {
      const options = [];
      this.productData.options.forEach((optionName, index) => {
        const input = this.form.querySelector(`[data-option-input][data-option-index="${index}"]`) ||
          this.form.querySelector(`[data-option-input][name="options[${optionName}]"]`);
        options.push(input ? input.value : this.productData.variants[0]?.options[index]);
      });
      return options;
    }

    findVariant() {
      const selected = this.getSelectedOptions();
      return this.productData.variants.find((variant) =>
        variant.options.every((opt, i) => opt === selected[i])
      );
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
      this.updateSKU(variant);
      this.updateURL(variant);
      this.updateMedia(variant);
      this.syncAllOptionButtons();
    }

    syncAllOptionButtons() {
      this.productData.options.forEach((name) => {
        const input = this.form.querySelector(`[data-option-input][name="options[${name}]"]`) ||
          this.form.querySelector(`[data-option-input][data-option-name="${name}"]`);
        if (input) this.syncOptionButtons(name, input.value);
      });
    }

    formatMoney(cents) {
      if (window.Shopify?.formatMoney) {
        return window.Shopify.formatMoney(cents, window.theme?.moneyFormat);
      }
      return (cents / 100).toFixed(2);
    }

    updatePrice(variant) {
      if (this.priceEl) {
        this.priceEl.textContent = this.formatMoney(variant.price);
        this.priceEl.classList.toggle('is-on-sale', variant.compare_at_price > variant.price);
      }
      if (this.compareEl) {
        if (variant.compare_at_price > variant.price) {
          this.compareEl.textContent = this.formatMoney(variant.compare_at_price);
          this.compareEl.hidden = false;
        } else {
          this.compareEl.hidden = true;
        }
      }
    }

    updateAvailability(variant) {
      const available = variant.available;
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

    updateSKU(variant) {
      if (this.skuEl) {
        this.skuEl.textContent = variant.sku || '—';
        this.skuEl.closest('[data-product-sku-wrapper]')?.toggleAttribute('hidden', !variant.sku);
      }
    }

    updateURL(variant) {
      if (!variant.id) return;
      const url = new URL(window.location.href);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url.toString());
    }

    updateMedia(variant) {
      if (!this.mediaGallery || !variant.featured_media) return;
      const mediaId = variant.featured_media.id || variant.featured_media;
      const thumb = this.mediaGallery.querySelector(`[data-media-id="${mediaId}"]`);
      if (thumb) thumb.click();
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
        t.setAttribute('aria-current', t === thumb ? 'true' : 'false');
      });

      const mainImg = this.main.querySelector('img');
      if (mainImg && src) {
        mainImg.src = src.replace(/width=\d+/, 'width=1200');
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
        this.target.querySelector('[type="submit"]')?.focus();
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
        const val = parseInt(input.value, 10) || min;
        input.value = Math.max(min, val - 1);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      plus?.addEventListener('click', () => {
        const val = parseInt(input.value, 10) || min;
        input.value = Math.min(max, val + 1);
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
        const panel = trigger.nextElementSibling || accordion.querySelector(`#${trigger.getAttribute('aria-controls')}`);
        if (!panel) return;

        trigger.addEventListener('click', () => {
          const expanded = trigger.getAttribute('aria-expanded') === 'true';

          if (single) {
            accordion.querySelectorAll('[data-accordion-trigger]').forEach((other) => {
              if (other === trigger) return;
              other.setAttribute('aria-expanded', 'false');
              const otherPanel = other.nextElementSibling;
              otherPanel?.classList.remove('is-open');
            });
          }

          trigger.setAttribute('aria-expanded', String(!expanded));
          panel.classList.toggle('is-open', !expanded);
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

        btn.setAttribute('aria-busy', 'true');
        try {
          const formData = new FormData(form);
          await NeutrexTheme.fetchJSON(`${routes}cart/add.js`, {
            method: 'POST',
            body: JSON.stringify({
              items: [{ id: formData.get('id'), quantity: parseInt(formData.get('quantity') || '1', 10) }],
            }),
          });
          window.location.href = `${routes}checkout`;
        } catch (error) {
          console.error('[Neutrex] Buy now failed', error);
        } finally {
          btn.removeAttribute('aria-busy');
        }
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* 360 viewer hook                                                             */
  /* -------------------------------------------------------------------------- */

  function initSpin360(root) {
    (root || document).querySelectorAll('[data-spin-360]').forEach((viewer) => {
      if (viewer.dataset.bound) return;
      viewer.dataset.bound = 'true';

      const framesScript = viewer.querySelector('[data-spin-360-frames]');
      if (!framesScript) return;

      let frames;
      try {
        frames = JSON.parse(framesScript.textContent);
      } catch {
        return;
      }

      if (!frames.length) return;

      const img = viewer.querySelector('img') || document.createElement('img');
      if (!img.parentElement) viewer.appendChild(img);

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

  NeutrexTheme.Product = { init: initProduct };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initProduct(document));
  } else {
    initProduct(document);
  }

  document.addEventListener('shopify:section:load', (event) => {
    initProduct(event.target);
  });
})();
