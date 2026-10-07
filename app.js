'use strict';

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
if (menuButton && navigation) {
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
    menuButton.querySelector('span').textContent = open ? '−' : '+';
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) {
      menuButton.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
      menuButton.querySelector('span').textContent = '+';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      menuButton.click();
      menuButton.focus();
    }
  });
}

const views = {
  mechanical: { image: 'line-follower.webp', alt: 'CAD render of the Group 13 line-following robot showing chassis, motors and front sensor board', top: 'CUSTOM MECHANICAL DESIGN', bottom: 'BARE-METAL CONTROL · ≈500 Hz', caption: 'Autonomous line follower / Group 13' },
  electronics: { image: 'sensor-pcb.webp', alt: 'Group 13 custom sensor PCB layout with ATmega4808 microcontroller and infrared sensor connections', top: 'CUSTOM SENSOR PCB', bottom: 'ATMEGA4808 · TCRT5000 ARRAY', caption: 'Sensor electronics / Actual KiCad layout' },
  control: { image: 'pid-tuner.webp', alt: 'Python desktop application for wireless Bayesian optimisation of robot PID gains', top: 'WIRELESS PID OPTIMISATION', bottom: 'PYTHON ↔ ESP32 ↔ EMBEDDED C', caption: 'Bayesian PID tuner / Project application' }
};
document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    const view = views[button.dataset.view];
    document.querySelectorAll('[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const image = document.querySelector('#hero-image');
    image.src = `assets/${view.image}`;
    image.alt = view.alt;
    image.closest('.art-stage').dataset.view = button.dataset.view;
    document.querySelector('#view-number').textContent = button.dataset.view.toUpperCase();
    document.querySelector('#art-label-top').textContent = view.top;
    document.querySelector('#art-label-bottom').textContent = view.bottom;
    document.querySelector('#view-caption').textContent = view.caption;
  });
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelectorAll('[data-categories]').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && !card.dataset.categories.split(' ').includes(button.dataset.filter);
    });
  });
});

// Content remains visible if JavaScript, animation or IntersectionObserver is unavailable.
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}

const lightbox = document.querySelector('#lightbox');
if (lightbox && typeof lightbox.showModal === 'function') {
  document.querySelectorAll('.gallery-button').forEach(button => {
    button.addEventListener('click', () => {
      const image = button.querySelector('img');
      const caption = button.closest('figure').querySelector('figcaption').textContent;
      lightbox.querySelector('img').src = image.src;
      lightbox.querySelector('img').alt = image.alt;
      lightbox.querySelector('p').textContent = caption;
      lightbox.showModal();
    });
  });
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) {
      const rect = lightbox.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) lightbox.close();
    }
  });
}
