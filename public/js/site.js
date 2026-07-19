/* Mobile-first chrome: nav drawer, body scroll lock */
(function () {
  function initNav(topbar) {
    const toggle = topbar.querySelector('.nav-toggle');
    const panel = topbar.querySelector('.nav-panel');
    if (!toggle || !panel) return;

    function setOpen(open) {
      topbar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', () => {
      setOpen(!topbar.classList.contains('is-open'));
    });

    panel.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    // Close drawer when resizing to desktop nav
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
  }

  document.querySelectorAll('.topbar').forEach(initNav);
})();
