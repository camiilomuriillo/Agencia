// Lenguaje: todo entra enfocándose despacio (lujo, calma) y sale fundiéndose.
const EASE = "power2.out";

function entra(sel, t, d = 0.9, extra = {}) {
  tl.fromTo(sel, { opacity: 0, filter: "blur(14px)", y: 18 },
    Object.assign({ opacity: 1, filter: "blur(0px)", y: 0, duration: d, ease: EASE }, extra), t);
}
function sale(sel, t, d = 0.35) {
  tl.to(sel, { opacity: 0, filter: "blur(8px)", duration: d, ease: "power1.in" }, t);
}

// Cámara: empuje lento y continuo en cada plano; en los cortes secos, un asentamiento suave.
const planos = ["fuego", "pala", "lechazo", "asador", "morcilla", "camara", "parrilla", "corte", "galeria", "vino", "chuletillas", "cierre"];
const fundidos = { asador: 0.35, galeria: 0.35, cierre: 0.35 };
planos.forEach((id) => {
  const p = P[id];
  const a = fundidos[id] || 0;
  if (a) {
    tl.fromTo("#plano-" + id, { opacity: 0 }, { opacity: 1, duration: a, ease: "sine.inOut" }, p.ini - a);
    tl.fromTo("#cam-" + id, { scale: 1.0 }, { scale: 1.06, duration: p.dur + a, ease: "none" }, p.ini - a);
  } else {
    tl.fromTo("#cam-" + id, { scale: 1.035 }, { scale: 1.0, duration: 0.5, ease: "expo.out" }, p.ini);
    tl.to("#cam-" + id, { scale: 1.045, duration: p.dur - 0.5, ease: "none", immediateRender: false }, p.ini + 0.5);
  }
});

// Velo: más denso al principio (gancho en la oscuridad del horno)
tl.fromTo("#velo", { opacity: 1 }, { opacity: 0.85, duration: 2, ease: "none" }, 0);

// 1 · Gancho
tl.fromTo("#gancho .w", { opacity: 0, filter: "blur(12px)", y: 14 },
  { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.7, stagger: 0.16, ease: EASE }, 0.15);
sale("#gancho", P.fuego.fin - 0.3, 0.3);

// 2 · Marca en la caída
tl.fromTo("#brillo", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, P.pala.ini);
tl.fromTo("#mono", { opacity: 0, scale: 1.25, filter: "blur(10px)" },
  { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, P.pala.ini);
tl.fromTo("#nombre .l", { opacity: 0, x: (i, el, a) => (i - (a.length - 1) / 2) * 26, filter: "blur(8px)" },
  { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" }, P.pala.ini + 0.12);
entra("#debur", P.pala.ini + PULSO, 0.7);
tl.fromTo("#filete1", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, P.pala.ini + PULSO * 1.5);
entra("#k-asador", P.pala.ini + PULSO * 2, 0.7);
sale("#marca", P.pala.fin - 0.35);

// 3 · Lechazo
entra("#b-lechazo .kicker", P.lechazo.ini + 0.1, 0.7);
tl.fromTo("#b-lechazo .w", { opacity: 0, filter: "blur(12px)", y: 16 },
  { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.8, stagger: 0.14, ease: EASE }, P.lechazo.ini + 0.25);
sale("#b-lechazo", P.lechazo.fin - 0.3);

// 4 · Capítulo I
entra("#b-asador .numeral", P.asador.ini - 0.1, 0.8);
tl.fromTo("#b-asador .capitulo .l", { opacity: 0, filter: "blur(10px)" },
  { opacity: 1, filter: "blur(0px)", duration: 0.6, stagger: 0.045, ease: EASE }, P.asador.ini + 0.05);
tl.fromTo("#b-asador .filete", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, P.asador.ini + 0.5);
entra("#b-asador .sub", P.asador.ini + 0.7, 0.8);
sale("#b-asador", P.asador.fin - 0.3);

// 5 · Morcilla (plano corto)
entra("#b-morcilla", P.morcilla.ini + 0.05, 0.45);
sale("#b-morcilla", P.morcilla.fin - 0.2, 0.2);

// 6 · 45 días
entra("#b-camara .cifra", P.camara.ini + 0.1, 0.9);
entra("#b-camara .kicker", P.camara.ini + PULSO, 0.7);
sale("#b-camara", P.camara.fin - 0.3);

// 7 · Premio
entra("#b-premio .kicker", P.parrilla.ini + 0.1, 0.7);
tl.fromTo("#b-premio .laurel path", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" }, P.parrilla.ini + 0.3);
tl.fromTo("#b-premio .laurel circle", { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)", transformOrigin: "50% 50%" }, P.parrilla.ini + 0.9);
tl.fromTo("#b-premio .titulo .l", { opacity: 0, filter: "blur(12px)", y: 20 },
  { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.7, stagger: 0.05, ease: EASE }, P.parrilla.ini + 0.55);
entra("#b-premio .sub", P.parrilla.ini + 1.3, 0.8);
sale("#b-premio", P.parrilla.fin - 0.35);

// 8 · Cita
tl.fromTo("#b-cita .w", { opacity: 0, filter: "blur(12px)", y: 14 },
  { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.7, stagger: 0.11, ease: EASE }, P.corte.ini + 0.1);
entra("#b-cita .kicker", P.corte.ini + 0.9, 0.7);
sale("#b-cita", P.corte.fin - 0.3);

// 9 · Capítulo II
entra("#b-galeria .numeral", P.galeria.ini - 0.1, 0.8);
tl.fromTo("#b-galeria .capitulo .l", { opacity: 0, filter: "blur(10px)" },
  { opacity: 1, filter: "blur(0px)", duration: 0.6, stagger: 0.045, ease: EASE }, P.galeria.ini + 0.05);
tl.fromTo("#b-galeria .filete", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" }, P.galeria.ini + 0.5);
entra("#b-galeria .sub", P.galeria.ini + 0.7, 0.8);
sale("#b-galeria", P.galeria.fin - 0.3);

// 11 · Chuletillas (plano corto)
entra("#b-chuletillas", P.chuletillas.ini + 0.05, 0.45);
sale("#b-chuletillas", P.chuletillas.fin - 0.2, 0.2);

// 12 · Cierre
const c = P.cierre.ini;
tl.fromTo("#telon", { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "sine.inOut" }, c + 0.6);
tl.fromTo("#c-mono", { opacity: 0, scale: 1.2, filter: "blur(10px)" },
  { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "expo.out" }, c + 1.1);
entra("#c-nombre", c + 1.3, 1.0);
entra("#c-debur", c + 1.6, 0.8);
entra("#c-lema", c + 2.2, 0.9);
tl.fromTo("#c-cta", { opacity: 0, scale: 0.94, filter: "blur(10px)" },
  { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.8, ease: "power3.out" }, c + 2.9);
tl.fromTo("#c-cta", { boxShadow: "0 0 0px rgba(240,42,33,0)" },
  { boxShadow: "0 0 46px rgba(240,42,33,.45)", duration: 0.8, ease: "sine.inOut", immediateRender: false }, c + 3.6);
entra("#c-datos", c + 3.4, 0.9);
