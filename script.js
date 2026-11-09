const toggleButton = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const year = document.getElementById('year');

if (year) {
  year.textContent = new Date().getFullYear();
}

if (toggleButton && navLinks) {
  toggleButton.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    toggleButton.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      toggleButton.setAttribute('aria-expanded', 'false');
    });
  });
}

// Animations: reveal elements when they enter the viewport.
(function () {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const els = document.querySelectorAll('[data-animate]');
  if (!els || els.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  els.forEach((el) => io.observe(el));
})();

// Contact form UX (no backend). Creates a mailto draft.
const contactForm = document.getElementById('contactForm');
const formStatus = document.getElementById('formStatus');
const nameEl = document.getElementById('name');
const emailEl = document.getElementById('email');
const messageEl = document.getElementById('message');

function setStatus(type, text) {
  if (!formStatus) return;
  formStatus.className = `form-status ${type || ''}`.trim();
  formStatus.textContent = text || '';
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = (nameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim();
    const message = (messageEl?.value || '').trim();

    if (!name) {
      setStatus('err', 'Please enter your name.');
      nameEl?.focus();
      return;
    }

    if (!email || !isValidEmail(email)) {
      setStatus('err', 'Please enter a valid email address.');
      emailEl?.focus();
      return;
    }

    if (!message || message.length < 10) {
      setStatus('err', 'Please write a message (at least 10 characters).');
      messageEl?.focus();
      return;
    }

    setStatus('ok', 'Preparing your message…');

    const to = 'media@musamadaries.org';
    const subject = `Media Request - ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Give a tiny delay so the status renders.
    setTimeout(() => {
      window.location.href = mailto;
      setStatus('ok', 'Opening your email app.');
    }, 300);
  });
}

