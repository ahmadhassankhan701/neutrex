/**
 * Neutrex Theme — Appointments booking
 * Trainer, calendar, time slots, summary, WhatsApp / form submit
 */
(function () {
  'use strict';

  const NeutrexTheme = window.NeutrexTheme || {};

  class AppointmentBooking {
    constructor(container) {
      this.container = container;
      this.trainers = this.parseJSON('[data-trainers-json]', []);
      this.timeSlots = this.parseJSON('[data-time-slots-json]', {});
      this.blockedDates = this.parseJSON('[data-blocked-dates-json]', []);

      this.state = {
        trainer: null,
        date: null,
        time: null,
        duration: parseInt(container.dataset.defaultDuration || '60', 10),
        price: parseFloat(container.dataset.defaultPrice || '0'),
      };

      this.currentMonth = new Date();
      this.currentMonth.setDate(1);

      this.trainerEl = container.querySelector('[data-booking-trainers]');
      this.calendarEl = container.querySelector('[data-booking-calendar]');
      this.timesEl = container.querySelector('[data-booking-times]');
      this.summaryEl = container.querySelector('[data-booking-summary]');
      this.submitBtn = container.querySelector('[data-booking-submit]');

      this.whatsapp = container.dataset.whatsapp || '';
      this.formUrl = container.dataset.formUrl || '';
      this.submitMode = container.dataset.submitMode || 'whatsapp';
      this.weekdaysOnly = container.dataset.weekdaysOnly === 'true';

      this.render();
      this.bind();
    }

    parseJSON(selector, fallback) {
      const script = this.container.querySelector(selector);
      if (!script) return fallback;
      try {
        return JSON.parse(script.textContent);
      } catch {
        return fallback;
      }
    }

    bind() {
      this.trainerEl?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-trainer-id]');
        if (!btn) return;
        this.selectTrainer(btn.dataset.trainerId);
      });

      this.calendarEl?.addEventListener('click', (event) => {
        const day = event.target.closest('[data-calendar-day]:not([disabled])');
        if (!day || day.classList.contains('is-disabled')) return;
        this.selectDate(day.dataset.calendarDay);
      });

      this.container.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
        this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
        this.renderCalendar();
      });

      this.container.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
        this.renderCalendar();
      });

      this.timesEl?.addEventListener('click', (event) => {
        const slot = event.target.closest('[data-time-slot]:not([disabled])');
        if (!slot) return;
        this.selectTime(slot.dataset.timeSlot);
      });

      this.container.querySelectorAll('[data-duration-option]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.state.duration = parseInt(btn.dataset.durationOption, 10);
          this.state.price = parseFloat(btn.dataset.price || this.state.price);
          this.container.querySelectorAll('[data-duration-option]').forEach((b) => {
            b.classList.toggle('is-selected', b === btn);
            b.setAttribute('aria-pressed', String(b === btn));
          });
          this.updateSummary();
        });
      });

      this.submitBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        this.submit();
      });

      this.container.querySelectorAll('[data-accordion-trigger]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
          const expanded = trigger.getAttribute('aria-expanded') === 'true';
          trigger.setAttribute('aria-expanded', String(!expanded));
          const panel = trigger.nextElementSibling ||
            this.container.querySelector(`#${trigger.getAttribute('aria-controls')}`);
          panel?.classList.toggle('is-open', !expanded);
        });
      });
    }

    selectTrainer(id) {
      this.state.trainer = this.trainers.find((t) => String(t.id) === String(id)) || { id, name: id };
      this.trainerEl?.querySelectorAll('[data-trainer-id]').forEach((btn) => {
        const selected = btn.dataset.trainerId === String(id);
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-pressed', String(selected));
      });
      this.updateSummary();
    }

    selectDate(dateStr) {
      this.state.date = dateStr;
      this.state.time = null;
      this.calendarEl?.querySelectorAll('[data-calendar-day]').forEach((day) => {
        day.classList.toggle('is-selected', day.dataset.calendarDay === dateStr);
        day.setAttribute('aria-selected', String(day.dataset.calendarDay === dateStr));
      });
      this.renderTimeSlots();
      this.updateSummary();
    }

    selectTime(time) {
      this.state.time = time;
      this.timesEl?.querySelectorAll('[data-time-slot]').forEach((slot) => {
        const selected = slot.dataset.timeSlot === time;
        slot.classList.toggle('is-selected', selected);
        slot.setAttribute('aria-pressed', String(selected));
      });
      this.updateSummary();
    }

    isDateBlocked(date) {
      const iso = date.toISOString().slice(0, 10);
      const day = date.getDay();
      if (this.weekdaysOnly && (day === 0 || day === 6)) return true;
      return this.blockedDates.includes(iso) || date < this.startOfDay(new Date());
    }

    startOfDay(d) {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    }

    render() {
      this.renderTrainers();
      this.renderCalendar();
      this.updateSummary();
    }

    renderTrainers() {
      if (!this.trainerEl || this.trainerEl.children.length) return;
      this.trainers.forEach((trainer) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'booking-trainer';
        btn.dataset.trainerId = trainer.id;
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = `
          ${trainer.image ? `<img src="${trainer.image}" alt="" width="48" height="48" loading="lazy">` : ''}
          <span>${trainer.name}</span>
        `;
        this.trainerEl.appendChild(btn);
      });
    }

    renderCalendar() {
      if (!this.calendarEl) return;

      const year = this.currentMonth.getFullYear();
      const month = this.currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startPad = firstDay.getDay();
      const daysInMonth = lastDay.getDate();

      const monthLabel = this.calendarEl.querySelector('[data-calendar-month]');
      if (monthLabel) {
        monthLabel.textContent = firstDay.toLocaleDateString(document.documentElement.lang || 'en', {
          month: 'long',
          year: 'numeric',
        });
      }

      const grid = this.calendarEl.querySelector('[data-calendar-grid]');
      if (!grid) return;
      grid.innerHTML = '';

      for (let i = 0; i < startPad; i += 1) {
        const pad = document.createElement('span');
        pad.className = 'calendar-pad';
        pad.setAttribute('aria-hidden', 'true');
        grid.appendChild(pad);
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const iso = date.toISOString().slice(0, 10);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calendar-day';
        btn.dataset.calendarDay = iso;
        btn.textContent = day;
        btn.setAttribute('aria-label', date.toLocaleDateString());

        if (this.isDateBlocked(date)) {
          btn.disabled = true;
          btn.classList.add('is-disabled');
        }
        if (this.state.date === iso) {
          btn.classList.add('is-selected');
          btn.setAttribute('aria-selected', 'true');
        }

        grid.appendChild(btn);
      }
    }

    renderTimeSlots() {
      if (!this.timesEl) return;
      this.timesEl.innerHTML = '';

      const slots = this.timeSlots[this.state.date] ||
        this.timeSlots.default ||
        ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

      slots.forEach((time) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'booking-time-slot';
        btn.dataset.timeSlot = time;
        btn.textContent = time;
        btn.setAttribute('aria-pressed', String(this.state.time === time));
        if (this.state.time === time) btn.classList.add('is-selected');
        this.timesEl.appendChild(btn);
      });
    }

    updateSummary() {
      if (!this.summaryEl) return;

      const trainerName = this.state.trainer?.name || '—';
      const dateLabel = this.state.date
        ? new Date(this.state.date + 'T12:00:00').toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
        : '—';

      this.summaryEl.querySelector('[data-summary-trainer]') &&
        (this.summaryEl.querySelector('[data-summary-trainer]').textContent = trainerName);
      this.summaryEl.querySelector('[data-summary-date]') &&
        (this.summaryEl.querySelector('[data-summary-date]').textContent = dateLabel);
      this.summaryEl.querySelector('[data-summary-time]') &&
        (this.summaryEl.querySelector('[data-summary-time]').textContent = this.state.time || '—');
      this.summaryEl.querySelector('[data-summary-duration]') &&
        (this.summaryEl.querySelector('[data-summary-duration]').textContent = `${this.state.duration} min`);
      this.summaryEl.querySelector('[data-summary-price]') &&
        (this.summaryEl.querySelector('[data-summary-price]').textContent = this.formatPrice(this.state.price));

      const ready = this.state.trainer && this.state.date && this.state.time;
      if (this.submitBtn) {
        this.submitBtn.disabled = !ready;
        this.submitBtn.setAttribute('aria-disabled', String(!ready));
      }
    }

    formatPrice(amount) {
      if (window.Shopify?.formatMoney) {
        return window.Shopify.formatMoney(amount * 100, window.theme?.moneyFormat);
      }
      return amount.toFixed(2);
    }

    buildMessage() {
      const service = this.container.dataset.serviceName || 'Appointment';
      return [
        `*${service} Booking*`,
        `Trainer: ${this.state.trainer?.name || '—'}`,
        `Date: ${this.state.date}`,
        `Time: ${this.state.time}`,
        `Duration: ${this.state.duration} min`,
        `Price: ${this.formatPrice(this.state.price)}`,
      ].join('\n');
    }

    submit() {
      if (!this.state.trainer || !this.state.date || !this.state.time) return;

      if (this.submitMode === 'form' && this.formUrl) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = this.formUrl;
        form.hidden = true;

        const fields = {
          trainer: this.state.trainer.name,
          trainer_id: this.state.trainer.id,
          date: this.state.date,
          time: this.state.time,
          duration: this.state.duration,
          price: this.state.price,
          service: this.container.dataset.serviceName || '',
        };

        Object.entries(fields).forEach(([key, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        return;
      }

      const phone = this.whatsapp.replace(/\D/g, '');
      const message = encodeURIComponent(this.buildMessage());
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');

      NeutrexTheme.publish?.('neutrex:appointment:submitted', { ...this.state });
    }
  }

  function initAppointments(root) {
    (root || document).querySelectorAll('[data-appointment-booking]').forEach((el) => {
      if (el.dataset.bound) return;
      el.dataset.bound = 'true';
      new AppointmentBooking(el);
    });
  }

  NeutrexTheme.Appointments = { init: initAppointments };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAppointments(document));
  } else {
    initAppointments(document);
  }

  document.addEventListener('shopify:section:load', (event) => {
    initAppointments(event.target);
  });
})();
