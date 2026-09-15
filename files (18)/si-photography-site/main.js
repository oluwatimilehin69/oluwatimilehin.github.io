// Sticky nav
const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

// Mobile menu (simple toggle -> reuse primary nav as dropdown)
const burger = document.getElementById('burger');
const nav = document.querySelector('.primary-nav');
burger.addEventListener('click', () => {
  const open = nav.style.display === 'flex';
  nav.style.cssText = open ? '' : 'display:flex;flex-direction:column;position:fixed;top:64px;left:0;right:0;background:#000;padding:24px;border-bottom:1px solid #2A2A2A;gap:20px;';
});
