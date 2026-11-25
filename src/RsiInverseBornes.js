// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trending RSI [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/qe0D9HM1-Trending-RSI-ChartPrime/
// Adaptation : textes des divergences en francais ; la ligne de divergence (plot.style_line decale de `right` barres, qui relie
// deux pivots et n'est visible que si le second est une divergence) devient un segment entre ces deux pivots ; l'histogramme
// de hauteur nulle sur la ligne zero n'est pas dessine ; les fill() en degrade vertical prennent la couleur a mi-hauteur.
// Une division par zero suit l'arithmetique flottante (le RSI des premieres barres peut valoir 100). Calcul barre par barre.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, transparence, milieu, remplir, suiteVide, pointsStables, bit, TRANSPARENT } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', LI = 'Lissage', DV = 'Divergences', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P },
  { id: 'borneHaute', name: 'Borne haute (RSI)', type: 'number', default: 70, min: 50, max: 99, step: 1, group: P,
    description: 'Valeur du RSI que représente la borne haute.' },
  { id: 'borneBasse', name: 'Borne basse (RSI)', type: 'number', default: 30, min: 1, max: 50, step: 1, group: P },
  { id: 'moyenne', name: 'Moyenne binomiale', type: 'boolean', default: false, group: P },
  { id: 'longueurMoyenne', name: 'Longueur de la moyenne', type: 'number', entier: true, default: 30, min: 0, max: 100, step: 1, group: P, legende: false },
  { id: 'lissage', name: 'Lissage du signal', type: 'number', entier: true, default: 1, min: 1, max: 200, step: 1, group: LI, legende: false,
    description: 'Nombre de barres du filtre (1 = aucun lissage).' },
  { id: 'vitesse', name: 'Vitesse du lissage du signal', type: 'number', default: 3.7, min: -100, max: 100, step: 0.1, group: LI, legende: false },
  { id: 'prefiltre', name: 'Préfiltre du signal', type: 'number', default: 0.7, min: 0.5, max: 1, step: 0.1, group: LI, legende: false,
    description: '1 = aucun préfiltre, 0,5 = préfiltre maximal.' },
  { id: 'lissageBornes', name: 'Lissage des bornes', type: 'number', entier: true, default: 40, min: 1, max: 200, step: 1, group: LI, legende: false },
  { id: 'vitesseBornes', name: 'Vitesse du lissage des bornes', type: 'number', default: 3.7, min: -100, max: 100, step: 0.1, group: LI, legende: false },
  { id: 'prefiltreBornes', name: 'Préfiltre des bornes', type: 'number', default: 0.5, min: 0.5, max: 1, step: 0.1, group: LI, legende: false },
  { id: 'gauche', name: 'Barres à gauche', type: 'number', entier: true, default: 15, min: 1, max: 100, step: 1, group: DV, legende: false },
  { id: 'droite', name: 'Barres à droite (confirmation)', type: 'number', entier: true, default: 15, min: 1, max: 100, step: 1, group: DV, legende: false },
  { id: 'ecartMin', name: 'Écart minimal entre pivots', type: 'number', entier: true, default: 5, min: 1, max: 1000, step: 1, group: DV, legende: false },
  { id: 'ecartMax', name: 'Écart maximal entre pivots', type: 'number', entier: true, default: 60, min: 1, max: 1000, step: 1, group: DV, legende: false },
  { id: 'dessin', name: 'Dessin', type: 'select', default: 'Line', group: DV,
    options: [{ label: 'Ligne', value: 'Line' }, { label: 'Étiquette', value: 'Label' }, { label: 'Ligne et étiquette', value: 'Line and Label' }] },
  { id: 'divHaussiere', name: 'Divergences haussières', type: 'boolean', default: false, group: DV },
  { id: 'divBaissiere', name: 'Divergences baissières', type: 'boolean', default: false, group: DV },
  { id: 'halo', name: 'Halo', type: 'boolean', default: true, group: S },
  { id: 'couleurRsi', name: 'RSI', type: 'color', default: '#ffffff', group: S },
  { id: 'couleurMoyenne', name: 'Moyenne', type: 'color', default: '#FFEE54', group: S },
  { id: 'couleurFond', name: 'Fond entre les bornes', type: 'color', default: '#7E57C21A', group: S },
  { id: 'couleurHaute', name: 'Borne haute', type: 'color', default: '#a222e283', group: S },
  { id: 'couleurBasse', name: 'Borne basse', type: 'color', default: '#e5b60c83', group: S },
  { id: 'centreHausseMonte', name: 'Centre positif qui monte', type: 'color', default: '#21a110', group: S },
  { id: 'centreHausseBaisse', name: 'Centre positif qui baisse', type: 'color', default: '#005e05', group: S },
  { id: 'centreBaisseMonte', name: 'Centre négatif qui monte', type: 'color', default: '#FCA0A9', group: S },
  { id: 'centreBaisseBaisse', name: 'Centre négatif qui baisse', type: 'color', default: '#FB3E38', group: S },
  { id: 'couleurDivHaussiere', name: 'Divergence haussière', type: 'color', default: '#00B374', group: S },
  { id: 'couleurDivBaissiere', name: 'Divergence baissière', type: 'color', default: '#F03042', group: S },
  { id: 'couleurTexteDiv', name: 'Texte des divergences', type: 'color', default: '#FEFEFE', group: S },
  { id: 'couleurZero', name: 'Ligne zéro', type: 'color', default: '#9E9E9E', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

/** precalculate_phi_coefficients(length, phase) : poids et leur somme. */
function coefficients(L, phase) {
  const c = new Array(L), SQ = Math.sqrt(2.0 * Math.PI), MU = -0.5 / 0.93, L2 = L * 0.52353;
  let E = 0.0;
  for (let i = 0; i <= L - 1; i++) {
    const alpha = (i + phase - L2) * MU, beta = 1.0 / (0.2316419 * Math.abs(alpha) + 1.0);
    let phi = (Math.exp(Math.pow(alpha, 2) * -0.5) * -0.398942280) * beta
      * (0.319381530 + beta * (-0.356563782 + beta * (1.781477937 + beta * (-1.821255978 + beta * 1.330274429)))) + 1.011;
    if (alpha < 0.0) phi = 1.0 - phi;
    const w = phi / SQ;
    E += w;
    c[i] = w;
  }
  return { c, E };
}

/** Poids de la moyenne binomiale : convolve(h, h, length * 10 - 1) puis truncate_weights (a partir du maximum). */
const BINOMES = new Map();
function binomes(L) {
  if (BINOMES.has(L)) return BINOMES.get(L);
  const h = [0.5, 0.5];
  let conv = h.slice();
  for (let it = 0; it < L * 10 - 1; it++) {
    const t = [];
    for (let i = 0; i <= conv.length + h.length - 2; i++) {
      let s = 0.0;
      for (let j = 0; j <= h.length - 1; j++) { const k = i - j; if (k >= 0 && k < conv.length) s += conv[k] * h[j]; }
      t.push(s);
    }
    conv = t;
  }
  let mx = conv[0];
  for (const v of conv) if (v > mx) mx = v;
  const w = conv.slice(conv.indexOf(mx));
  if (BINOMES.size > 16) BINOMES.clear();
  BINOMES.set(L, w);
  return w;
}

const SMO = ['haut', 'bas', 'centre', 'hautHalo', 'basHalo', 'rsi'];

function creer(p) {
  const S = { src: [], rev: [], sig: [], top: [], bot: [], cen: [], tg: [], bg: [], ma: [], pre: [], cc: [], m: [] };
  for (const k of SMO) S[`s2${k}`] = [];
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500, maxPolylignes: 500 }), sorties: S, f1: suiteVide(), f2: suiteVide(), f3: suiteVide(),
    cs: coefficients(p.lissage, p.vitesse), cb: coefficients(p.lissageBornes, p.vitesseBornes), w: p.moyenne ? binomes(p.longueurMoyenne) : null,
    m: { rma: A.ema(p.longueur, { rma: true }), pre: A.sma(S, 2), x: Array.from({ length: 16 }, (_, k) => A.croisement(k % 2 === 0 ? 1 : -1)) },
    up: null, dn: null, gU: 0, gD: 0, rU: 0, rD: 0, x1: {}, src1: null,
    vw: { plS: [], plP: [], phS: [], phP: [] }, plPrec: null, phPrec: null,
  };
}

/** phi_smoother : sma2 = x a + nz(x[1], x) b, puis somme ponderee des `L` dernieres sma2 / E (L = 1 : x). */
function phi(e, S, k, i, x, co, hf) {
  const x1 = e.x1[k], a = Math.min(Math.max(0.5, hf), 1), b = Math.max(Math.min(0.5, 1 - hf), 0);
  const s2 = nul(x) ? null : x * a + (nul(x1) ? x : x1) * b;
  e.x1[k] = x;
  const H = S[`s2${k}`];
  H[i] = nul(s2) ? null : s2;
  const L = co.c.length;
  if (!(L > 1)) return x;
  let W = 0.0;
  for (let j = 0; j <= L - 1; j++) { const v = i - j >= 0 ? H[i - j] : null; if (nul(v)) return null; W += co.c[j] * v; }
  return W / co.E;
}

function pivot(V, i, g, d, haut) {
  const c = i - d;
  if (c - g < 0) return false;
  const v = V[c];
  if (nul(v)) return false;
  for (let j = 1; j <= g; j++) { const w = V[c - j]; if (nul(w) || (haut ? w > v : w < v)) return false; }
  for (let j = 1; j <= d; j++) { const w = V[c + j]; if (nul(w) || (haut ? w >= v : w <= v)) return false; }
  return true;
}

function etape(p, e, d, i, derniere) {
  const S = e.sorties, M = e.m, o = e.o, b = d[i], L = p.longueur, source = choix[p.source](b);
  S.src[i] = source;
  // reverse_rsi : src normalise et compteurs (communs a tous les appels, seule la valeur cible change).
  const r = A.pas(S, M.rma, i, source);
  const src = nul(r) ? null : (source - r) / (L / 2);
  const s1 = e.src1;
  e.src1 = src;
  const al = 1 / L, monte = gt(src, s1);
  const pU = nul(e.up) ? 1 : e.up, pD = nul(e.dn) ? 1 : e.dn;
  e.up = monte ? al * (src - s1) + (1 - al) * pU : (1 - al) * pU;
  e.dn = monte ? (1 - al) * pD : (nul(src) || nul(s1) ? null : al * (s1 - src) + (1 - al) * pD);
  const rev = (val) => {
    if (nul(val) || nul(src) || nul(e.dn) || nul(e.up)) return null;
    const rv = (L - 1) * (e.dn * val / (100 - val) - e.up);
    const out = rv >= 0 ? src + rv : src + rv * (100 - val) / val;
    return Number.isFinite(out) ? out : null;
  };
  // rsi() du script : rma maison partant de 0 (nz), sur les hausses et baisses de la source.
  const sp = i > 0 ? S.src[i - 1] : null;
  const upv = nul(sp) ? null : Math.max(source - sp, 0), dnv = nul(sp) ? null : Math.max(sp - source, 0);
  const a2 = 1 / L;
  e.gU = nul(upv) ? null : a2 * upv + (1 - a2) * (nul(e.gU) ? 0 : e.gU);
  e.gD = nul(dnv) ? null : a2 * dnv + (1 - a2) * (nul(e.gD) ? 0 : e.gD);
  const rs = nul(e.gU) || nul(e.gD) ? null : e.gU / e.gD;
  const rsiBrut = nul(rs) ? null : 100 - 100 / (1 + rs);
  const top = phi(e, S, 'haut', i, rev(p.borneHaute), e.cb, p.prefiltreBornes);
  const bot = phi(e, S, 'bas', i, rev(p.borneBasse), e.cb, p.prefiltreBornes);
  const cen = phi(e, S, 'centre', i, rev(50), e.cs, p.prefiltre);
  const tg = phi(e, S, 'hautHalo', i, rev(Math.min(p.borneHaute + 4, 99)), e.cb, p.prefiltreBornes);
  const bg = phi(e, S, 'basHalo', i, rev(Math.max(p.borneBasse - 4, 1)), e.cb, p.prefiltreBornes);
  const rsi = phi(e, S, 'rsi', i, rev(Number.isFinite(rsiBrut) ? rsiBrut : null), e.cs, p.prefiltre);
  S.top[i] = top; S.bot[i] = bot; S.cen[i] = cen; S.tg[i] = p.halo ? tg : null; S.bg[i] = p.halo ? bg : null; S.sig[i] = rsi;
  // binomia_ma : ta.sma(rsi, 2) a chaque barre ; somme ponderee si la moyenne est active.
  const pre = A.pas(S, M.pre, i, rsi);
  S.pre[i] = pre;
  let ma = null;
  if (p.moyenne && !nul(rsi)) {
    const W = e.w;
    let s = 0, w = 0;
    for (let k = 0; k <= Math.min(W.length - 1, i); k++) {
      const pk = S.pre[i - k], rk = S.sig[i - k];
      w += W[k]; s += (nul(pk) ? (nul(rk) ? 0 : rk) : pk) * W[k];
    }
    ma = s / w;
  }
  S.ma[i] = ma;
  const c1 = i > 0 ? S.cen[i - 1] : null, delta = nul(cen) || nul(c1) ? null : cen - c1;
  S.cc[i] = !nul(cen) && cen >= 0 ? (gt(delta, 0) ? p.centreHausseMonte : p.centreHausseBaisse) : (gt(delta, 0) ? p.centreBaisseMonte : p.centreBaisseBaisse);
  // Remplissages : halo haut, halo bas, fond entre les bornes.
  const cH = p.couleurHaute, cB = p.couleurBasse;
  remplir(o, e.f1, S.tg, S.top, i, milieu(transparence(cH, 100), transparence(cH, 80)), derniere);
  remplir(o, e.f2, S.bot, S.bg, i, milieu(transparence(cB, 80), transparence(cB, 100)), derniere);
  remplir(o, e.f3, S.top, S.bot, i, p.couleurFond, derniere);
  // find_divergence(rsi, left, right, lower, upper).
  const R = p.droite, G = p.gauche, so = i - R >= 0 ? S.sig[i - R] : null;
  const pl = pivot(S.sig, i, G, R, false), ph = pivot(S.sig, i, G, R, true);
  const lowR = i - R >= 0 ? d[i - R].low : null, highR = i - R >= 0 ? d[i - R].high : null;
  // ta.valuewhen(cond, x, 1) : valeur a la deuxieme occurrence la plus recente (barre courante comprise).
  const quand = (occ, cond, v) => { if (cond) { occ.unshift(v); if (occ.length > 2) occ.pop(); } return occ.length > 1 ? occ[1] : null; };
  const vwS = quand(e.vw.plS, pl, so), vwP = quand(e.vw.plP, pl, lowR);
  const vhS = quand(e.vw.phS, ph, so), vhP = quand(e.vw.phP, ph, highR);
  // in_range(pl[1], lower, upper) : barssince de la barre qui suit le dernier pivot anterieur.
  const dansPl = e.plPrec !== null && p.ecartMin <= i - (e.plPrec + 1) && i - (e.plPrec + 1) <= p.ecartMax;
  const dansPh = e.phPrec !== null && p.ecartMin <= i - (e.phPrec + 1) && i - (e.phPrec + 1) <= p.ecartMax;
  if (pl) e.plPrec = i;
  if (ph) e.phPrec = i;
  const bull = lt(lowR, vwP) && gt(so, vwS) && dansPl && pl;
  const bear = gt(highR, vhP) && lt(so, vhS) && dansPh && ph;
  let dv = { piv: false, div: false, pol: null, lvl: null, col: TRANSPARENT };
  if (bull) dv = { piv: true, div: true, pol: true, lvl: so, col: p.couleurDivHaussiere };
  else if (pl) dv = { piv: true, div: false, pol: true, lvl: so, col: p.couleurDivHaussiere };
  if (bear) dv = { piv: true, div: true, pol: false, lvl: so, col: p.couleurDivBaissiere };
  else if (ph) dv = { piv: true, div: false, pol: false, lvl: so, col: p.couleurDivBaissiere };
  const ligne = p.dessin.includes('Line'), etiq = p.dessin.includes('Label');
  const cote = (haussiere, actif, cle, style, texte) => {
    const piv = actif && dv.piv && dv.pol === haussiere, div = actif && dv.div && dv.pol === haussiere;
    if (piv && ligne && !nul(dv.lvl)) {
      const prec = e[cle];
      if (prec && div) o.ligne({ x1: prec.x, y1: prec.y, x2: i - R, y2: dv.lvl, couleur: dv.col, epaisseur: 2 });
      e[cle] = { x: i - R, y: dv.lvl };
    }
    if (div && etiq && !nul(dv.lvl)) o.etiquette({ x: i - R, y: dv.lvl, style, texte, couleur: dv.col, couleurTexte: p.couleurTexteDiv });
  };
  cote(true, p.divHaussiere, 'dernierBas', 'label_up', 'Haussière');
  cote(false, p.divBaissiere, 'dernierHaut', 'label_down', 'Baissière');
  // 16 alertcondition().
  const X = M.x, conds = [
    A.pas(S, X[0], i, rsi, cen), A.pas(S, X[1], i, rsi, cen), A.pas(S, X[3], i, rsi, top), A.pas(S, X[2], i, rsi, top),
    A.pas(S, X[4], i, rsi, bot), A.pas(S, X[5], i, rsi, bot), A.pas(S, X[6], i, rsi, ma), A.pas(S, X[7], i, rsi, ma),
    A.pas(S, X[8], i, rsi, 0), A.pas(S, X[9], i, rsi, 0), A.pas(S, X[10], i, cen, 0), A.pas(S, X[11], i, cen, 0),
    A.pas(S, X[12], i, delta, 0), A.pas(S, X[13], i, delta, 0), dv.div && dv.pol === true, dv.div && dv.pol === false,
  ];
  let m = 0;
  for (let k = 0; k < conds.length; k++) if (conds[k]) m |= 1 << k;
  S.m[i] = m;
}

function rendre(p, e, d) {
  const S = e.sorties, n = d.length, o = e.o;
  const pt = (vals, cols, j) => {
    const v = vals[j], pnt = { time: d[j].time, value: nul(v) ? null : v };
    if (cols) { const sv = vals[j + 1]; pnt.color = (!nul(sv) && (typeof cols === 'string' ? cols : cols[j + 1])) || TRANSPARENT; }
    return pnt;
  };
  const ligne = (cle, vals, cols) => pointsStables(S, `_p${cle}`, n, n - 2, (j) => pt(vals, cols, j));
  const halo = (vals) => (p.halo ? vals : []);
  const cZero = transparence(p.couleurZero, 80);
  const cc95 = S.cc95 || (S.cc95 = []);
  for (let j = Math.max(0, cc95.length - 2); j < n; j++) cc95[j] = transparence(S.cc[j], 95);
  return {
    rsi: ligne('rsi', S.sig, p.couleurRsi),
    centre: ligne('cen', S.cen, S.cc),
    haut: ligne('top', S.top, p.couleurHaute),
    bas: ligne('bot', S.bot, p.couleurBasse),
    moyenne: ligne('ma', S.ma, p.couleurMoyenne),
    zero: pointsStables(S, '_z', n, n, (j) => ({ time: d[j].time, value: 0, color: cZero })),
    haloRsi4: ligne('h4', halo(S.sig), transparence(p.couleurRsi, 95)),
    haloRsi3: ligne('h3', halo(S.sig), transparence(p.couleurRsi, 95)),
    haloRsi2: ligne('h2', halo(S.sig), transparence(p.couleurRsi, 95)),
    haloCentre3: ligne('c3', halo(S.cen), cc95),
    haloCentre2: ligne('c2', halo(S.cen), cc95),
    haloMoyenne: ligne('hm', halo(S.ma), transparence(p.couleurMoyenne, 95)),
    signaux: pointsStables(S, '_s', n, n - 1, (j) => ({ time: d[j].time, value: S.m[j] ? S.m[j] : null })),
    objets: o.resultat(),
  };
}

const ALERTES = [
  'RSI au-dessus du centre', 'RSI sous le centre', 'RSI repasse sous la borne haute', 'RSI au-dessus de la borne haute',
  'RSI repasse au-dessus de la borne basse', 'RSI sous la borne basse', 'RSI au-dessus de sa moyenne', 'RSI sous sa moyenne',
  'RSI au-dessus de zéro', 'RSI sous zéro', 'Centre au-dessus de zéro', 'Centre sous zéro', 'Centre qui se met à monter',
  'Centre qui se met à baisser', 'Divergence haussière', 'Divergence baissière',
];

export default class RsiInverseBornesIndicator {
  static metadata = {
    id: 'rsi_inverse_bornes',
    name: 'RSI inversé et bornes lissées',
    shortName: 'RSI-INV',
    description: 'rsi_inverse_bornes',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['rsi', 'rsi inverse', 'bornes', 'divergence', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'rsi', name: 'RSI', type: 'line', color: '#ffffff', lineWidth: 1, reglageCouleur: 'couleurRsi' },
      { id: 'centre', name: 'Centre (RSI 50)', type: 'line', color: '#21a110', lineWidth: 2 },
      { id: 'haut', name: 'Borne haute', type: 'line', color: 'rgba(162, 34, 226, 0.514)', lineWidth: 1 },
      { id: 'bas', name: 'Borne basse', type: 'line', color: 'rgba(229, 182, 12, 0.514)', lineWidth: 1 },
      { id: 'moyenne', name: 'Moyenne binomiale', type: 'line', color: '#FFEE54', lineWidth: 1 },
      { id: 'zero', name: 'Zéro', type: 'line', color: 'rgba(158, 158, 158, 0.2)', lineWidth: 1 },
      { id: 'haloRsi4', name: 'Halo du RSI', type: 'line', color: 'rgba(255, 255, 255, 0.05)', lineWidth: 4 },
      { id: 'haloRsi3', name: 'Halo du RSI', type: 'line', color: 'rgba(255, 255, 255, 0.05)', lineWidth: 3 },
      { id: 'haloRsi2', name: 'Halo du RSI', type: 'line', color: 'rgba(255, 255, 255, 0.05)', lineWidth: 2 },
      { id: 'haloCentre3', name: 'Halo du centre', type: 'line', color: 'rgba(33, 161, 16, 0.05)', lineWidth: 3 },
      { id: 'haloCentre2', name: 'Halo du centre', type: 'line', color: 'rgba(33, 161, 16, 0.05)', lineWidth: 2 },
      { id: 'haloMoyenne', name: 'Halo de la moyenne', type: 'line', color: 'rgba(255, 238, 84, 0.05)', lineWidth: 3 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map((title, k) => ({ id: `rsi_inverse_${k + 1}`, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { rsi: [] };
    const p = this.params;
    return executer(RsiInverseBornesIndicator._memo, JSON.stringify(p), data, {
      creer: () => creer(p),
      etape: (e, d, i, derniere) => etape(p, e, d, i, derniere),
      rendre: (e, d) => rendre(p, e, d),
    });
  }
}
