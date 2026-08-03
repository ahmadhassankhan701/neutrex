/**
 * Neutrex Theme — Animations
 * Reveal, counters, parallax, tilt, ripple
 */
(function () {
  'use strict';

  const NeutrexTheme = window.NeutrexTheme || {};

  if (document.documentElement.dataset.animations === 'false') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* -------------------------------------------------------------------------- */
  /* Scroll reveal                                                               */
  /* -------------------------------------------------------------------------- */

  function initReveal(root) {
    const elements = (root || document).querySelectorAll('[data-animate]:not(.is-visible)');
    if (!elements.length) return;

    if (prefersReducedMotion) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const delay = el.dataset.animateDelay;
            if (delay) el.style.transitionDelay = `${delay}ms`;
            el.classList.add('is-visible');
            observer.unobserve(el);
          }
        });
      },
      {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.12,
      }
    );

    elements.forEach((el) => observer.observe(el));
  }

  /* -------------------------------------------------------------------------- */
  /* Animated counters                                                           */
  /* -------------------------------------------------------------------------- */

  function animateCounter(el) {
    const target = parseFloat(el.dataset.counter || el.textContent.replace(/[^\d.-]/g, ''));
    if (Number.isNaN(target)) return;

    const duration = parseInt(el.dataset.counterDuration || '2000', 10);
    const prefix = el.dataset.counterPrefix || '';
    const suffix = el.dataset.counterSuffix || el.textContent.replace(/[\d.-]/g, '').trim();
    const decimals = parseInt(el.dataset.counterDecimals || '0', 10);
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      el.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
    }

    requestAnimationFrame(tick);
  }

  function initCounters(root) {
    const counters = (root || document).querySelectorAll('[data-counter]:not(.is-counted)');
    if (!counters.length) return;

    if (prefersReducedMotion) {
      counters.forEach((el) => {
        el.classList.add('is-counted');
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            el.classList.add('is-counted');
            animateCounter(el);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  /* -------------------------------------------------------------------------- */
  /* Parallax                                                                    */
  /* -------------------------------------------------------------------------- */

  const parallaxElements = [];
  let parallaxTicking = false;

  function initParallax(root) {
    if (prefersReducedMotion) return;

    const elements = (root || document).querySelectorAll('[data-parallax]');
    elements.forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || '0.15');
      if (!parallaxElements.includes(el)) {
        parallaxElements.push({ el, speed });
      }
    });

    if (parallaxElements.length && !parallaxTicking) {
      window.addEventListener('scroll', onParallaxScroll, { passive: true });
      onParallaxScroll();
    }
  }

  function onParallaxScroll() {
    if (parallaxTicking) return;
    parallaxTicking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;
      parallaxElements.forEach(({ el, speed }) => {
        const rect = el.getBoundingClientRect();
        const offset = (rect.top + scrollY - window.innerHeight * 0.5) * speed;
        el.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
      parallaxTicking = false;
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Card tilt                                                                   */
  /* -------------------------------------------------------------------------- */

  function initTilt(root) {
    if (prefersReducedMotion) return;

    (root || document).querySelectorAll('[data-tilt]').forEach((card) => {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = 'true';

      const max = parseFloat(card.dataset.tiltMax || '8');

      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -max;
        const rotateY = ((x - centerX) / centerX) * max;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Button ripple                                                               */
  /* -------------------------------------------------------------------------- */

  function initRipple() {
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('.btn');
      if (!btn || prefersReducedMotion) return;

      const rect = btn.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      btn.style.setProperty('--ripple-x', `${x}px`);
      btn.style.setProperty('--ripple-y', `${y}px`);
      btn.classList.remove('is-rippling');
      void btn.offsetWidth;
      btn.classList.add('is-rippling');
    });
  }

  /* -------------------------------------------------------------------------- */
  /* Init                                                                        */
  /* -------------------------------------------------------------------------- */

  function initAnimations(root) {
    initReveal(root);
    initCounters(root);
    initParallax(root);
    initTilt(root);
  }

  function init() {
    initAnimations(document);
    initRipple();
  }

  NeutrexTheme.Animations = { init: initAnimations };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => {
    initAnimations(event.target);
  });
})();
