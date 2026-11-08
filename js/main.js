// FAQ accordion — one item open at a time
document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const open = item.classList.contains('is-open');
      document.querySelectorAll('.faq-item.is-open').forEach(el => {
        el.classList.remove('is-open');
        el.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!open) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
  
  // Sidebar active state
  document.querySelectorAll('.side-menu li').forEach(li => {
    li.addEventListener('click', () => {
      document.querySelector('.side-menu .active')?.classList.remove('active');
      li.classList.add('active');
    });
  });
  
  // Draw the chart once it is visible on screen
  const chart = document.querySelector('.chart');
  if (chart) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) { chart.classList.add('in-view'); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(chart);
    } else {
      chart.classList.add('in-view');
    }
  }