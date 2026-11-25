// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Momentum Ghost Machine [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/GGVVdaUk-Momentum-Ghost-Machine-ChartPrime/
// Adaptation : les deux colonnes projetees (plot offset 1 et 2, show_last = 1) sont dessinees en traits verticaux epais dans les barres a venir.
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer, contexte, tracer, transparence, remplir, suiteVide } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const STYLES = [{ label: 'Exponentielle', value: 'EMA' }, { label: 'Double exponentielle', value: 'DEMA' }, { label: 'Triple exponentielle', value: 'TEMA' }, { label: 'Pondérée', value: 'WMA' }, { label: 'Simple', value: 'SMA' }];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'longueur', name: 'Longueur du momentum', type: 'number', entier: true, default: 50, min: 1, max: 500, step: 1, group: P,
    description: 'Le momentum est l’écart entre le prix et un filtre sinc fenêtré (Blackman) de deux fois cette longueur.' },
  { id: 'lissageMomentum', name: 'Lissage du filtre', type: 'number', default: 50, min: 1, max: 1000, step: 1, group: P,
    description: 'Plus il est grand, plus le filtre est lisse : à augmenter avec la longueur.' },
  { id: 'lissage', name: 'Lissage final', type: 'number', entier: true, default: 4, min: 1, max: 100, step: 1, group: P },
  { id: 'styleLissage', name: 'Type du lissage final', type: 'select', default: 'WMA', options: STYLES, group: P },
  { id: 'longueurMoyenne', name: 'Longueur de la moyenne', type: 'number', entier: true, default: 24, min: 2, max: 500, step: 1, group: P },
  { id: 'styleMoyenne', name: 'Type de la moyenne', type: 'select', default: 'EMA', options: STYLES, group: P },
  { id: 'projection', name: 'Projection (deux barres)', type: 'boolean', default: true, group: S },
  { id: 'opacite', name: 'Transparence de l’écart', type: 'number', entier: true, default: 25, min: 0, max: 100, step: 5, group: S },
  { id: 'bougies', name: 'Couleur des bougies', type: 'select', default: 'Both', group: S,
    options: [{ label: 'Selon l’écart à la moyenne', value: 'MA' }, { label: 'Selon le momentum', value: 'Direct' }, { label: 'Les deux', value: 'Both' }, { label: 'Aucune', value: 'None' }] },
  { id: 'couleurMomentum', name: 'Momentum', type: 'color', default: '#ffffff', group: S },
  { id: 'couleurMoyenne', name: 'Moyenne', type: 'color', default: '#f7a000', group: S },
  { id: 'hausseForte', name: 'Hausse qui s’accentue', type: 'color', default: '#2ac075', group: S },
  { id: 'hausseFaible', name: 'Hausse qui faiblit', type: 'color', default: '#d5fce9', group: S },
  { id: 'baisseForte', name: 'Baisse qui s’accentue', type: 'color', default: '#f82934', group: S },
  { id: 'baisseFaible', name: 'Baisse qui faiblit', type: 'color', default: '#ffc8cb', group: S },
  { id: 'lueur', name: 'Lueur', type: 'boolean', default: true, group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const at = (s, i) => (i >= 0 ? s[i] : null);
const moins = (a, b) => (nul(a) || nul(b) ? null : a - b);

/**
 * Filtres du script (ema / dema / tema / wma / sma recodes, pas ceux de ta.*), BARRE PAR BARRE :
 * un etat par site d'appel (donnees simples, copiables), historiques dans S (partages). Une barre
 * close est calculee une fois, la barre en cours seule au tick (42 ms par tick a 20 000 bougies
 * avec les series refaites).
 */
const etatFiltre = () => ({ e1: null, e2: null, e3: null, cum: 0 });
function emaPas(prec, x, n) {
  const a = 2 / (n + 1), base = nul(prec) ? x : prec; // nz(smoothed[1], source)
  return nul(x) || nul(base) ? null : a * x + (1.0 - a) * base;
}
function filtrer(st, H, i, x, n, style) {
  if (!(n > 1)) return x;
  if (style === 'EMA') { st.e1 = emaPas(st.e1, x, n); return st.e1; }
  if (style === 'DEMA') { st.e1 = emaPas(st.e1, x, n); st.e2 = emaPas(st.e2, st.e1, n); return nul(st.e1) || nul(st.e2) ? null : 2.0 * st.e1 - st.e2; }
  if (style === 'TEMA') {
    st.e1 = emaPas(st.e1, x, n); st.e2 = emaPas(st.e2, st.e1, n); st.e3 = emaPas(st.e3, st.e2, n);
    return nul(st.e1) || nul(st.e2) || nul(st.e3) ? null : (st.e1 - st.e2) * 3.0 + st.e3;
  }
  H.x[i] = x;
  if (style === 'WMA') {
    let t = 0;
    for (let k = 0; k < n; k++) { const v = at(H.x, i - k); if (nul(v)) return null; t += v * (n - k); }
    return t / (n * 0.5 * (n + 1));
  }
  // sma : ta.cum (une barre na rend na et n'ajoute rien)
  if (nul(x)) H.c[i] = null; else { st.cum += x; H.c[i] = st.cum; }
  const c = H.c[i];
  if (i < n - 1) return nul(c) ? null : c / (i + 1);
  const c0 = at(H.c, i - n);
  return nul(c) || nul(c0) ? null : (c - c0) / n;
}

const sinc = (x) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const blackman = (n, L) => 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (L - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (L - 1));

/** Coefficients de sinc_coefficients(length, fc) et leur somme. */
function coefficients(L, fc) {
  const mid = Math.trunc((L - 1) / 2), coupure = 1 / fc, coef = [];
  for (let i = 0; i < L; i++) coef.push(L % 2 === 0 ? sinc(2 * coupure * (i - mid)) * blackman(i + 0.5, L) : sinc(2 * coupure * (i - mid)) * blackman(i, L));
  let norme = 0;
  for (const c of coef) norme += c;
  return { coef, norme };
}

function rgb(c) {
  const m = String(c).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const r = String(c).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : [0, 0, 0];
}
/** color_changer du script : eclaircit (vers le blanc d'un tiers) ou assombrit (/ 1,5). */
function changer(c, eclaircir) {
  const [r, g, b] = rgb(c);
  const f = eclaircir ? (x) => (255 - x) / 3 + x : (x) => x / 1.5;
  return `rgba(${Math.round(f(r))}, ${Math.round(f(g))}, ${Math.round(f(b))}, 1)`;
}

const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

const projete = (s, i) => { const a = moins(s[i], at(s, i - 1)), b = moins(s[i], at(s, i - 2)); return nul(a) || nul(b) ? null : (a + b / 2) / 2; };

function creer() {
  const S = {};
  for (const k of ['delta', 'ma', 'momo', 'cMomo', 'bougies', 'fond', 'lf']) S[k] = [];
  return {
    o: creerObjets({ maxLignes: 50, maxPolylignes: 500 }), fond: suiteVide(),
    fPost: etatFiltre(), fIn: etatFiltre(), fOut: etatFiltre(), cm: null, cd: null, pma1: null, pm1: null, pma2: null, pm2: null,
    h: { post: { x: [], c: [] }, in: { x: [], c: [] }, out: { x: [], c: [] } },
    sorties: S,
  };
}

function etape(p, e, d, i, derniere, s) {
  const S = e.sorties, L = p.longueur * 2, src = choix[p.source];
  let sincV = null;
  // lti_sinc : convolution des L dernieres valeurs (la plus recente d'abord), apres la barre L.
  if (i > L) { let t = 0; for (let c = 0; c < L; c++) t += s.coef[c] * src(d[i - c]); sincV = t / s.norme; }
  const brut = nul(sincV) ? null : (src(d[i]) - sincV) / Math.trunc((L - 1) / 2);
  const dl = filtrer(e.fPost, e.h.post, i, brut, p.lissage, p.styleLissage);
  const ma = filtrer(e.fOut, e.h.out, i, filtrer(e.fIn, e.h.in, i, dl, 2, p.styleMoyenne), p.longueurMoyenne, p.styleMoyenne);
  S.delta[i] = dl; S.ma[i] = ma;
  const m = moins(dl, ma), m1 = at(S.momo, i - 1), dl1 = at(S.delta, i - 1);
  S.momo[i] = m;
  if (!nul(m) && m > 0) e.cm = !nul(m1) && m > m1 ? p.hausseForte : p.hausseFaible;
  else e.cm = !nul(m) && !nul(m1) && m < m1 ? p.baisseForte : p.baisseFaible;
  if (p.bougies === 'Both') {
    if (!nul(dl) && dl > 0) e.cd = !nul(m) && m < 0 ? changer(e.cm, true) : e.cm;
    else e.cd = !nul(m) && m > 0 ? changer(e.cm, false) : e.cm;
  } else if (!nul(dl) && dl > 0) e.cd = !nul(dl1) && dl > dl1 ? p.hausseForte : p.hausseFaible;
  else e.cd = !nul(dl) && !nul(dl1) && dl < dl1 ? p.baisseForte : p.baisseFaible;
  S.cMomo[i] = e.cm;
  S.bougies[i] = p.bougies === 'MA' ? e.cm : p.bougies === 'None' ? null : e.cd;
  S.fond[i] = transparence(!nul(dl) && !nul(ma) && dl > ma ? p.couleurMomentum : p.couleurMoyenne, 90);
  if (p.projection) {
    const pjM = projete(S.ma, i), pjD = projete(S.delta, i);
    e.pma1 = nul(ma) || nul(pjM) ? null : ma + pjM; e.pm1 = nul(dl) || nul(pjD) ? null : dl + pjD;
    e.pma2 = nul(ma) || nul(pjM) ? null : ma + pjM * 2; e.pm2 = nul(dl) || nul(pjD) ? null : dl + pjD * 2;
    S.lf[i] = transparence(!nul(e.pma2) && !nul(e.pm2) && e.pma2 > e.pm2 ? p.couleurMoyenne : p.couleurMomentum, 90);
  }
  if (p.lueur) remplir(e.o, e.fond, S.ma, S.delta, i, S.fond[i], derniere);
}

function rendre(p, e, d) {
  const n = d.length, o = e.o, last = n - 1, S = e.sorties;
  const mL = S.momo[last], d1 = moins(e.pm1, e.pma1), d2 = moins(e.pm2, e.pma2);
  const dc1 = !nul(d1) && d1 > 0 ? (!nul(mL) && d1 > mL ? p.hausseForte : p.hausseFaible) : (!nul(d1) && !nul(mL) && d1 < mL ? p.baisseForte : p.baisseFaible);
  const dc2 = !nul(d2) && d2 > 0 ? (!nul(d1) && d2 > d1 ? p.hausseForte : p.hausseFaible) : (!nul(d2) && !nul(d1) && d2 < d1 ? p.baisseForte : p.baisseFaible);
  const s = { ...S, d1, d2, dc1, dc2, finMa: [S.ma[last], e.pma2], finDelta: [S.delta[last], e.pm2] };
  if (p.projection) {
    const lD = o.ligne({ x1: last, y1: s.finDelta[0], x2: last + 2, y2: s.finDelta[1], couleur: p.couleurMomentum, style: 'dotted' });
    const lM = o.ligne({ x1: last, y1: s.finMa[0], x2: last + 2, y2: s.finMa[1], couleur: p.couleurMoyenne, style: 'dotted' });
    // linefill.new a chaque barre entre les deux memes lignes : les 50 derniers restent (max_lines_count par defaut).
    for (let i = Math.max(0, n - 50); i < n; i++) o.remplissage(lD, lM, { couleur: s.lf[i] });
    if (!nul(s.d1)) o.ligne({ x1: last + 1, y1: 0, x2: last + 1, y2: s.d1, couleur: transparence(s.dc1, 60), epaisseur: 6 });
    if (!nul(s.d2)) o.ligne({ x1: last + 2, y1: 0, x2: last + 2, y2: s.d2, couleur: transparence(s.dc2, 60), epaisseur: 6 });
  }
  const vide = d.map((b) => ({ time: b.time, value: null }));
  const col = (k) => { const cache = new Map(); return s.cMomo.map((c) => { let v = cache.get(c); if (v === undefined) { v = transparence(c, k); cache.set(c, v); } return v; }); };
  const ecart = col(p.opacite), lueurEcart = col(p.opacite + (100 - p.opacite) / 2);
  const plein = (c) => new Array(n).fill(c);
  return {
    ecart: d.map((b, i) => ({ time: b.time, value: nul(s.momo[i]) ? null : s.momo[i], color: ecart[i] })),
    ecartLueur: p.lueur ? d.map((b, i) => ({ time: b.time, value: nul(s.momo[i]) ? null : s.momo[i], color: lueurEcart[i] })) : vide,
    moyenne: tracer(d, s.ma, plein(p.couleurMoyenne)),
    moyenneLueur: p.lueur ? tracer(d, s.ma, plein(transparence(p.couleurMoyenne, 80))) : vide,
    momentum: tracer(d, s.delta, plein(p.couleurMomentum)),
    momentumLueur: p.lueur ? tracer(d, s.delta, plein(transparence(p.couleurMomentum, 80))) : vide,
    bougies: d.map((b, i) => ({ time: b.time, value: s.bougies[i] ? 1 : null, color: s.bougies[i] })),
    objets: o.resultat(),
  };
}

export default class MomentumProjectionIndicator {
  static metadata = {
    id: 'momentum_projection',
    name: 'Momentum filtré et sa projection',
    shortName: 'MOM-PROJ',
    description: 'momentum_projection',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['momentum', 'filtre sinc', 'moyenne', 'projection', 'ecart'],
    inputs: INPUTS,
    outputs: [
      { id: 'ecart', name: 'Écart momentum - moyenne', type: 'histogram', color: '#2ac075' },
      { id: 'ecartLueur', name: 'Lueur de l’écart', type: 'histogram', color: 'rgba(42, 192, 117, 0.375)' },
      { id: 'moyenne', name: 'Moyenne', type: 'line', color: '#f7a000', lineWidth: 1 },
      { id: 'moyenneLueur', name: 'Lueur de la moyenne', type: 'line', color: 'rgba(247, 160, 0, 0.2)', lineWidth: 4 },
      { id: 'momentum', name: 'Momentum', type: 'line', color: '#ffffff', lineWidth: 1 },
      { id: 'momentumLueur', name: 'Lueur du momentum', type: 'line', color: 'rgba(255, 255, 255, 0.2)', lineWidth: 4 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    levels: [{ value: 0, color: '#787B86', style: 'dashed' }],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#2ac075', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { ecart: [] };
    const p = this.params;
    contexte(data, ctx);
    return executer(MomentumProjectionIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: () => coefficients(p.longueur * 2, p.lissageMomentum),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
