/* LAVUNI Pocket 24 — interacción mínima, sin dependencias.
   El formulario de compra es el formulario nativo de Shopify (/cart/add):
   si este JS no carga, la compra sigue funcionando. */
(function () {
  'use strict';

  function money(cents, format) {
    var value = (cents / 100).toFixed(2);
    var parts = value.split('.');
    var withSep = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + parts[1];
    return (format || '{{amount_with_comma_separator}} €')
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, withSep)
      .replace(/\{\{\s*amount\s*\}\}/, value)
      .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/, parts[0])
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/, parts[0]);
  }

  function init(root) {
    var dataEl = root.querySelector('[data-lp-json]');
    var data = {};
    try { data = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (e) { data = {}; }
    var variants = data.variants || [];
    var packDiscount = Number(data.packDiscountCents || 0);
    var moneyFormat = data.moneyFormat;

    /* Galería */
    var main = root.querySelector('[data-lp-main-img]');
    root.querySelectorAll('[data-lp-thumb]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!main) return;
        main.src = btn.getAttribute('data-src');
        main.removeAttribute('srcset');
        main.alt = btn.getAttribute('data-alt') || main.alt;
        root.querySelectorAll('[data-lp-thumb]').forEach(function (b) { b.setAttribute('aria-current', 'false'); });
        btn.setAttribute('aria-current', 'true');
      });
    });

    /* Formulario: variante + oferta (1 ud. / pack de 2) */
    var form = root.querySelector('[data-lp-form]');
    var idInput = root.querySelector('[data-lp-variant-id]');
    var qtyInput = root.querySelector('[data-lp-qty]');
    var select = root.querySelector('[data-lp-variant-select]');
    var submit = root.querySelector('[data-lp-submit]');
    var priceEls = root.querySelectorAll('[data-lp-price]');
    var unitEls = root.querySelectorAll('[data-lp-unit-price]');
    var packEls = root.querySelectorAll('[data-lp-pack-price]');
    var packUnitEls = root.querySelectorAll('[data-lp-pack-unit]');

    function currentVariant() {
      var id = idInput ? Number(idInput.value) : null;
      for (var i = 0; i < variants.length; i++) if (variants[i].id === id) return variants[i];
      return variants[0];
    }
    function currentQty() {
      var checked = root.querySelector('input[name="lp-offer"]:checked');
      return checked ? Number(checked.value) : 1;
    }
    function render() {
      var v = currentVariant();
      if (!v) return;
      var qty = currentQty();
      var packTotal = v.price * 2 - packDiscount;
      var total = qty === 2 ? packTotal : v.price;
      if (qtyInput) qtyInput.value = qty;
      priceEls.forEach(function (el) { el.textContent = money(total, moneyFormat); });
      unitEls.forEach(function (el) { el.textContent = money(v.price, moneyFormat); });
      packEls.forEach(function (el) { el.textContent = money(packTotal, moneyFormat); });
      packUnitEls.forEach(function (el) { el.textContent = money(Math.round(packTotal / 2), moneyFormat); });
      if (submit) {
        submit.disabled = !v.available;
        submit.textContent = v.available ? submit.getAttribute('data-label') : submit.getAttribute('data-soldout');
      }
    }
    if (select) {
      select.addEventListener('change', function () { idInput.value = select.value; render(); });
    }
    root.querySelectorAll('input[name="lp-offer"]').forEach(function (r) { r.addEventListener('change', render); });
    render();

    /* Botones "Comprar" de otras secciones: llevan al formulario principal */
    root.querySelectorAll('[data-lp-goto-form]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (!form) return;
        e.preventDefault();
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    /* Barra fija en móvil: visible cuando el botón principal sale de pantalla */
    var sticky = root.querySelector('[data-lp-sticky]');
    if (sticky && submit && 'IntersectionObserver' in window) {
      var footerZone = root.querySelector('[data-lp-final]');
      var submitVisible = true, finalVisible = false;
      var update = function () { sticky.classList.toggle('is-visible', !submitVisible && !finalVisible); };
      new IntersectionObserver(function (entries) {
        submitVisible = entries[0].isIntersecting || entries[0].boundingClientRect.top > 0;
        update();
      }).observe(submit);
      if (footerZone) {
        new IntersectionObserver(function (entries) { finalVisible = entries[0].isIntersecting; update(); }).observe(footerZone);
      }
    }

    /* Aparición discreta de secciones */
    var reveals = root.querySelectorAll('.lp-reveal');
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -10% 0px' });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  function boot() { document.querySelectorAll('[data-lp-root]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
