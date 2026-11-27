// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Machine Learning Price Target Prediction Signals [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/3MHPrjD5-Machine-Learning-Price-Target-Prediction-Signals-AlgoAlpha/
// Adaptation : textes du tableau en francais ; pas d'erreur bloquante quand la source n'a pas de volume (runtime.error du script).
import { creerObjets } from '../academyscript/objets.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const T = 'Tendance des signaux', R = 'Régression à noyau', S = 'Style';
const ST = 'SuperTrend', HM = 'HMA (Increasing or Decreasing)', EC = 'EMA Cross (Fast Slow)';
const INPUTS = [
  { id: 'methode', name: 'Tendance lue sur', type: 'select', default: EC, group: T,
    options: [{ label: 'Supertrend', value: ST }, { label: 'Pente de la moyenne de Hull', value: HM }, { label: 'Croisement de deux moyennes exponentielles', value: EC }] },
  { id: 'longueurHull', name: 'Longueur de la moyenne de Hull', type: 'number', entier: true, default: 93, min: 2, max: 1000, step: 1, group: T },
  { id: 'emaRapide', name: 'Moyenne exponentielle rapide', type: 'number', entier: true, default: 50, min: 1, max: 1000, step: 1, group: T },
  { id: 'emaLente', name: 'Moyenne exponentielle lente', type: 'number', entier: true, default: 200, min: 1, max: 2000, step: 1, group: T },
  { id: 'facteur', name: 'Facteur du Supertrend', type: 'number', default: 3, min: 0.1, max: 50, step: 0.1, group: T },
  { id: 'longueurAtr', name: 'ATR du Supertrend', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: T },
  { id: 'largeur', name: 'Largeur du noyau', type: 'number', default: 5, min: 2, max: 100, step: 0.5, group: R,
    description: 'Plus elle est grande, plus les tendances passées éloignées de la situation actuelle comptent dans l’estimation.' },
  { id: 'masquerNa', name: 'Masquer les signaux sans estimation', type: 'boolean', default: true, group: R },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const fini = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------------------
// ta.* de la plateforme (academyscript/ta.js) recrits BARRE PAR BARRE, memes
// operations dans le meme ordre : chaque barre close est calculee une fois, la
// barre en cours seule a chaque tick (le script recalcule ~30 series ; en entier
// a chaque tick, 23 ms a 20 000 bougies). Etats en donnees simples (copiables).
// ---------------------------------------------------------------------------

/** _lisser de ta.js (ema / rma) : amorce = moyenne des `n` premieres valeurs non na, na rend na. */
const lisseur = () => ({ p: null, s: 0, c: 0 });
function lisser(st, v, n, ema) {
  if (nul(v) || !Number.isFinite(v)) return null;
  if (st.p === null) {
    st.s += v; st.c++;
    if (st.c === n) { st.p = st.s / n; return st.p; }
    return null;
  }
  if (ema) { const a = 2 / (n + 1); st.p = a * v + (1 - a) * st.p; } else st.p = (st.p * (n - 1) + v) / n;
  return st.p;
}

/** ta.sma : somme glissante (ajout puis retrait) des `n` dernieres valeurs non na ; barre na = valeur precedente. */
const moyenneSimple = () => ({ r: [], s: 0, j: 0, v: null });
function sma(st, v, n) {
  if (nul(v) || !Number.isFinite(v)) return st.j >= n ? st.v : null;
  const k = st.j % n, ancien = st.r[k];
  st.s += v;
  if (st.j >= n) st.s -= ancien;
  st.r[k] = v; st.j++;
  if (st.j >= n) st.v = fini(st.s / n);
  return st.j >= n ? st.v : null;
}

/** ta.wma : poids n..1, une barre na rend na, la fenetre lit la derniere valeur non na. */
const moyennePonderee = () => ({ r: [], d: null, i: 0 });
function wma(st, v, n) {
  const ok = !nul(v) && Number.isFinite(v);
  if (ok) st.d = v;
  const i = st.i++;
  st.r[i % n] = st.d;
  if (i < n - 1 || !ok) return null;
  let s = 0;
  for (let k = 0; k < n; k++) { const x = st.r[(i - k) % n]; if (x === null) return null; s += x * (n - k); }
  return s / ((n * (n + 1)) / 2);
}

/** ta.rsi : change na sur la 1re barre et autour d'un na, deux rma. */
const etatRsi = () => ({ prec: null, u: lisseur(), d: lisseur() });
function rsi(st, v, n) {
  const p = st.prec;
  st.prec = v;
  if (nul(v) || nul(p) || !Number.isFinite(v) || !Number.isFinite(p)) return null;
  const delta = v - p;
  const g = lisser(st.u, delta > 0 ? delta : 0, n, false), l = lisser(st.d, delta < 0 ? -delta : 0, n, false);
  if (g === null || l === null) return null;
  if (l === 0) return 100;
  if (g === 0) return 0;
  return 100 - 100 / (1 + g / l);
}

/** ta.highest / ta.lowest : fenetre des n dernieres barres, lecture arretee au premier na. */
const etatExtreme = () => ({ q: [], t: 0, na: -1 });
function extreme(st, src, i, n, haut) {
  const v = src[i];
  if (nul(v)) { st.na = i; st.q = []; st.t = 0; return null; }
  const q = st.q;
  while (q.length > st.t && (haut ? src[q[q.length - 1]] <= v : src[q[q.length - 1]] >= v)) q.pop();
  q.push(i);
  const debut = Math.max(i - n + 1, st.na + 1);
  while (q[st.t] < debut) st.t++;
  if (st.t > 64) { st.q = q.slice(st.t); st.t = 0; }
  return i >= n - 1 ? src[st.q[st.t]] : null;
}

/** ta.cross / crossover / crossunder avec 0 : derniere barre ou la serie etait definie. */
function croisement(st, a) {
  if (nul(a)) return [false, false];
  const pa = st.pa;
  st.pa = a;
  if (pa === null) return [false, false];
  return [pa <= 0 && a > 0, pa >= 0 && a < 0];
}

function creer() {
  const sorties = {};
  for (const k of ['h14', 'l14', 'x3', 'x4', 'tr', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'signe', 'xo', 'xu', 'duree', 'mouvement', 'estim', 'sl', 'atr14', 'trade', 'alertes']) sorties[k] = [];
  return {
    o: creerObjets({ maxBoites: 500 }),
    ta: {
      eH: etatExtreme(), eL: etatExtreme(), r1: etatRsi(), r2: etatRsi(), r7: etatRsi(),
      v3: moyenneSimple(), vs3: lisseur(), vss4: lisseur(), lo3: etatExtreme(), hi3: etatExtreme(), lo4: etatExtreme(), hi4: etatExtreme(),
      s5: lisseur(), l5: lisseur(), som: 0, atr14: lisseur(), atrSt: lisseur(),
      e1: lisseur(), e2: lisseur(), hDemi: moyennePonderee(), hPlein: moyennePonderee(), hBrut: moyennePonderee(),
      st: { bas: null, haut: null, prec: null }, x: { pa: null }, dernier: null, maxH: null, minB: null,
    },
    cibles: [], appris: [], actuelles: null, estimation: null, total: 0, justes: 0, inTrade: 0, tpHit: false, slHit: false, tp: null, sl: null,
    sorties,
  };
}

function signe(p, e, d, i) {
  const t = e.ta, b = d[i], c1 = i > 0 ? d[i - 1].close : null;
  if (p.methode === ST) {
    const tr = c1 === null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - c1), Math.abs(b.low - c1));
    const a = lisser(t.atrSt, tr, p.longueurAtr, false);
    if (a === null) return null;
    const milieu = (b.high + b.low) / 2, s = t.st;
    let bas = milieu - p.facteur * a, haut = milieu + p.facteur * a;
    if (s.bas !== null && !(bas > s.bas || (c1 !== null && c1 < s.bas))) bas = s.bas;
    if (s.haut !== null && !(haut < s.haut || (c1 !== null && c1 > s.haut))) haut = s.haut;
    const dir = s.prec === null ? 1 : s.prec === s.haut ? (b.close > haut ? -1 : 1) : (b.close < bas ? 1 : -1);
    s.prec = dir === -1 ? bas : haut; s.bas = bas; s.haut = haut;
    return -dir;
  }
  if (p.methode === HM) {
    const L = p.longueurHull;
    const dm = wma(t.hDemi, b.close, Math.floor(L / 2)), pl = wma(t.hPlein, b.close, L);
    const h = wma(t.hBrut, dm === null || pl === null ? null : 2 * dm - pl, Math.floor(Math.sqrt(L)));
    const h1 = t.hPrec === undefined ? null : t.hPrec;
    t.hPrec = h;
    return i > 0 && !nul(h) && !nul(h1) && h > h1 ? 1 : -1;
  }
  const a = lisser(t.e1, b.close, p.emaRapide, true), c = lisser(t.e2, b.close, p.emaLente, true);
  return !nul(a) && !nul(c) && a > c ? 1 : -1;
}

function etape(p, e, d, i) {
  const t = e.ta, S = e.sorties, b = d[i], c = b.close;
  // --- caracteristiques
  S.h14[i] = b.high; S.l14[i] = b.low;
  const hh = extreme(t.eH, S.h14, i, 14, true), ll = extreme(t.eL, S.l14, i, 14, false);
  S.f1[i] = rsi(t.r1, nul(hh) ? null : (hh - c) / hh, 14);
  S.f2[i] = rsi(t.r2, nul(ll) ? null : (c - ll) / ll, 14);
  const v3 = sma(t.v3, b.high - b.low, 40), vs3 = lisser(t.vs3, v3, 20, true);
  const x3 = nul(v3) || nul(vs3) ? null : v3 - vs3;
  S.x3[i] = x3;
  const lo3 = extreme(t.lo3, S.x3, i, 1000, false), hi3 = extreme(t.hi3, S.x3, i, 1000, true);
  S.f3[i] = nul(x3) || nul(lo3) || nul(hi3) ? null : fini(((x3 - lo3) / (hi3 - lo3)) * 100);
  const vss4 = lisser(t.vss4, x3, 10, true);
  const x4 = nul(x3) || nul(vss4) ? null : x3 - vss4;
  S.x4[i] = x4;
  const lo4 = extreme(t.lo4, S.x4, i, 1000, false), hi4 = extreme(t.hi4, S.x4, i, 1000, true);
  S.f4[i] = nul(x4) || nul(lo4) || nul(hi4) ? null : fini(((x4 - lo4) / (hi4 - lo4)) * 100);
  const s5 = lisser(t.s5, b.volume, 7, true), l5 = lisser(t.l5, b.volume, 14, true);
  S.f5[i] = nul(s5) || nul(l5) ? null : fini((100 * (s5 - l5)) / l5);
  const c1 = i > 0 ? d[i - 1].close : null;
  const tr = c1 === null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - c1), Math.abs(b.low - c1));
  S.tr[i] = tr; // ta.atr(1) = tr exactement (rma de longueur 1)
  t.som += tr;
  if (i >= 14) t.som -= S.tr[i - 14];
  const som = i >= 13 ? t.som : null;
  if (nul(som) || nul(hh) || nul(ll)) S.f6[i] = null;
  else { const q = som / (hh - ll); S.f6[i] = q > 0 && Number.isFinite(q) ? (100 * Math.log10(q)) / Math.log10(14) : null; }
  S.f7[i] = rsi(t.r7, c, 14);
  S.atr14[i] = lisser(t.atr14, tr, 14, false);
  // --- signal de tendance, croisements, duree, mouvement depuis le croisement
  const si = signe(p, e, d, i);
  S.signe[i] = si;
  S.f8[i] = si === 1 ? 1 : si === -1 ? 0 : null;
  const [xo, xu] = croisement(t.x, si), xx = xo || xu;
  S.xo[i] = xo; S.xu[i] = xu;
  if (xx) t.dernier = i;
  const dd = t.dernier === null ? null : i - t.dernier;
  S.duree[i] = dd;
  const c0 = nul(dd) ? null : d[i - dd].close;
  const hp = nul(c0) ? null : (b.high - c0) / c0, bp = nul(c0) ? null : (b.low - c0) / c0;
  let runup, drawdown;
  if (nul(dd) || dd === 0) { runup = hp; drawdown = bp; t.maxH = null; t.minB = null; } else {
    t.maxH = t.maxH === null || hp > t.maxH ? hp : t.maxH;
    t.minB = t.minB === null || bp < t.minB ? bp : t.minB;
    runup = t.maxH; drawdown = t.minB;
  }
  const m = si > 0 ? runup : drawdown;
  S.mouvement[i] = nul(m) ? null : Math.abs(m);
  // --- apprentissage et regression (ne changent qu'aux croisements)
  const feats = [S.f1, S.f2, S.f3, S.f4, S.f5, S.f6, S.f7, S.f8];
  const s1 = i > 0 ? S.signe[i - 1] : null;
  const lb = i > 0 && !nul(S.duree[i - 1]) ? S.duree[i - 1] + 1 : null;
  if (xx && !nul(s1)) {
    const m1 = S.mouvement[i - 1];
    const passees = feats.map((f) => (nul(lb) ? null : f[i - lb]));
    if (!nul(m1) && passees.slice(0, 7).every((v) => !nul(v))) { e.cibles.unshift(m1); e.appris.unshift(passees); }
  }
  if (xx) {
    e.actuelles = feats.map((f) => f[i]);
    let sk = 0, swt = 0;
    for (let k = 0; k < e.cibles.length; k++) {
      let d2 = 0;
      for (let j = 0; j < 8; j++) { const a = e.appris[k][j], x = e.actuelles[j]; d2 = nul(d2) || nul(a) || nul(x) ? null : d2 + Math.pow(a - x, 2); }
      const kv = nul(d2) ? null : Math.exp(-Math.pow(Math.sqrt(d2) / p.largeur, 2));
      swt = nul(swt) || nul(kv) ? null : swt + kv * e.cibles[k]; sk = nul(sk) || nul(kv) ? null : sk + kv;
    }
    e.estimation = !nul(sk) && sk !== 0 && !nul(swt) ? swt / sk : null;
  }
  S.estim[i] = e.estimation;
  const pm = e.estimation, pm1 = i > 0 ? S.estim[i - 1] : null;
  if (xx && !nul(pm1)) { e.total++; if (!nul(S.mouvement[i - 1]) && S.mouvement[i - 1] > pm1) e.justes++; }
  const win = e.total === 0 ? null : e.justes / e.total;
  const rr = nul(win) || win === 0 ? null : 1 / win - 1;
  const tp = nul(pm) ? null : si > 0 ? c + c * pm : c - c * pm;
  const sl = nul(pm) || nul(rr) || rr === 0 ? null : si > 0 ? c - (c * pm) / rr : c + (c * pm) / rr;
  S.sl[i] = sl;
  // --- objectif et stop
  if (xx && (p.masquerNa ? !nul(pm) : true)) {
    const hb = (a, x) => (nul(a) || nul(x) ? [null, null] : [Math.max(a, x), Math.min(a, x)]);
    const [th, tb] = hb(c, tp), [sh, sb] = hb(c, sl);
    e.tp = e.o.boite({ gauche: i, haut: th, droite: i + 1, bas: tb, couleurBordure: transparence(p.couleurHausse, 100), fond: transparence(p.couleurHausse, 80) });
    e.sl = e.o.boite({ gauche: i, haut: sh, droite: i + 1, bas: sb, couleurBordure: transparence(p.couleurBaisse, 100), fond: transparence(p.couleurBaisse, 80) });
    e.inTrade = 1;
  }
  const memeSens = !nul(si) && !nul(s1) && si === s1;
  // [FIX 2026-11-26] Ecart volontaire au script : ses tp_hit / sl_hit sont des `var`
  // jamais remis a faux, l'alerte "objectif / stop atteint" tirait alors a CHAQUE
  // barre apres le premier franchissement. Elle ne vaut plus que la barre du franchissement.
  e.tpHit = false; e.slHit = false;
  if (e.tp) {
    const up = e.tp.haut, low = e.tp.bas;
    if ((si > 0 && !nul(up) && b.high < up) || (si < 0 && !nul(low) && b.low > low) || !memeSens) e.tp.droite = i;
    else { e.tpHit = true; e.tp.droite = i; e.sl.droite = i; e.tp = null; e.sl = null; e.inTrade = 0; }
  }
  if (e.sl) {
    const up = e.sl.haut, low = e.sl.bas;
    if ((si > 0 && !nul(low) && b.low > low) || (si < 0 && !nul(up) && b.high < up) || !memeSens) e.sl.droite = i;
    else { e.slHit = true; e.sl.droite = i; e.tp = null; e.sl = null; e.inTrade = 0; }
  }
  S.trade[i] = e.inTrade;
  S.alertes[i] = (xo ? 1 : 0) | (xu ? 2 : 0) | (e.tpHit ? 4 : 0) | (e.slHit ? 8 : 0) || null;
}

function rendre(p, e, d, env) {
  const n = d.length, S = e.sorties, o = e.o;
  for (let i = 0; i < n; i++) {
    const signal = p.masquerNa ? !nul(S.estim[i]) : true;
    if (!signal || nul(S.sl[i]) || nul(S.atr14[i])) continue;
    if (S.xo[i]) o.etiquette({ x: i, y: S.sl[i] - S.atr14[i], texte: '▲', style: 'label_up', couleur: p.couleurHausse, couleurTexte: env.texte, taille: 'small' });
    if (S.xu[i]) o.etiquette({ x: i, y: S.sl[i] + S.atr14[i], texte: '▼', style: 'label_down', couleur: p.couleurBaisse, couleurTexte: env.texte, taille: 'small' });
  }
  const last = n - 1, pm = S.estim[last];
  const win = e.total === 0 ? null : e.justes / e.total;
  const rr = nul(win) || win === 0 ? null : 1 / win - 1;
  const fmt = (v, suffixe = '') => (nul(v) ? 'NaN' : formaterMotif(v, '#.##')) + suffixe;
  const t = o.tableau({ position: 'top_right', colonnes: 2, lignes: 6, fond: env.fond, bordure: 1, couleurBordure: env.texte, couleurCadre: env.texte, epaisseurCadre: 1 });
  const cel = (c, l, texte, autres = {}) => t.cellule(c, l, { texte, taille: 'tiny', couleurTexte: env.texte, alignTexte: c === 0 && l > 0 ? 'left' : 'center', ...autres });
  cel(0, 0, 'Mesures'); cel(1, 0, 'Valeur');
  cel(0, 1, 'Tendances apprises'); cel(1, 1, String(e.cibles.length));
  cel(0, 2, 'Mouvement estimé'); cel(1, 2, fmt(nul(pm) ? null : pm * 100, '%'));
  cel(0, 3, 'Part des tendances passées ayant \natteint l’estimation'); cel(1, 3, fmt(nul(win) ? null : win * 100, '%'));
  cel(0, 4, 'Rapport gain / risque suggéré'); cel(1, 4, fmt(rr));
  const tr = S.trade[last], si = S.signe[last];
  cel(0, 5, 'Trade en cours'); cel(1, 5, tr !== 0 ? 'Oui' : 'Non', { fond: tr === 0 ? GRIS : si > 0 ? transparence(p.couleurHausse, 70) : transparence(p.couleurBaisse, 70) });
  return {
    bougies: d.map((b, i) => ({ time: b.time, value: 1, color: S.trade[i] === 0 ? GRIS : S.signe[i] > 0 ? p.couleurHausse : p.couleurBaisse })),
    alertes: d.map((b, i) => ({ time: b.time, value: S.alertes[i] })),
    objets: o.resultat(),
  };
}

const ALERTES = [['signal_haussier', 'Signal haussier', 1], ['signal_baissier', 'Signal baissier', 2], ['objectif_atteint', 'Objectif atteint', 4], ['stop_atteint', 'Stop atteint', 8]];

export default class ObjectifsRegressionNoyauIndicator {
  static metadata = {
    id: 'objectifs_regression_noyau',
    name: 'Objectifs estimés par régression à noyau',
    shortName: 'OBJ-NOYAU',
    description: 'objectifs_regression_noyau',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['objectif', 'stop', 'regression a noyau', 'tendance', 'apprentissage'],
    inputs: INPUTS,
    outputs: [
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'alertes', name: 'Alertes', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00ffbb', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title, masque]) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && (pt.value & masque) !== 0,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { bougies: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ObjectifsRegressionNoyauIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer,
      etape: (etat, d, i) => etape(p, etat, d, i),
      rendre: (etat, d) => rendre(p, etat, d, env),
    });
  }
}
