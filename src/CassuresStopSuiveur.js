// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Market Structure Trend Targets [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/F3b5dGLx-Market-Structure-Trend-Targets-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { tostring, formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide, TRANSPARENT } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des sommets et creux', type: 'number', entier: true, default: 10, min: 2, max: 30, step: 1, group: P,
    description: 'Barres de part et d’autre d’un sommet ou d’un creux pour le confirmer.' },
  { id: 'pourcentage', name: 'Afficher la progression en %', type: 'boolean', default: false, group: P,
    description: 'Après la première cassure, les étiquettes donnent l’écart au premier niveau cassé plutôt que le nombre de cassures.' },
  { id: 'stop', name: 'Afficher le stop suiveur', type: 'boolean', default: true, group: P },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#54b6d4', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#cf3737', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const vrai = (b) => b === true; // booleen Pine v5 : na compte pour faux
const non = (b) => (b === null ? false : !b); // `not na` est faux
// str.tostring(x, format.percent) : deux decimales suivies de % (meme regle que les lots precedents).
const pourcent = (v) => (Number.isFinite(v) ? formaterMotif(v, '0.00') + '%' : 'NaN');

// hl2 sur toutes les bougies ; pivots et ligne de tendance (sma, mediane sur 40, plus haut et
// plus bas sur 200 barres) est calculee barre par barre dans etape() : une fois par barre close,
// la barre en cours seule au tick (63 ms par tick a 20 000 bougies avec les series refaites).
function series(d) {
  return {
    hl2: d.map((b) => (b.high + b.low) / 2),
  };
}

/** ta.pivothigh / ta.pivotlow(L, L) de la plateforme, evalue a la barre i (candidat i - L). */
function pivotBarre(d, i, L, haut) {
  if (i < 2 * L) return null;
  const k = haut ? 'high' : 'low', p = d[i - L][k];
  for (let j = 1; j <= L; j++) { const v = d[i - L - j][k]; if (haut ? v > p : v < p) return null; }
  for (let j = 1; j <= L; j++) { const v = d[i - L + j][k]; if (haut ? v >= p : v <= p) return null; }
  return p;
}

/** ta.sma de la plateforme : somme glissante (ajout puis retrait) des n dernieres valeurs non na. */
function sma(st, v, n) {
  if (nul(v)) return st.j >= n ? st.v : null;
  const k = st.j % n, ancien = st.r[k];
  st.s += v;
  if (st.j >= n) st.s -= ancien;
  st.r[k] = v; st.j++;
  if (st.j >= n) st.v = Number.isFinite(st.s / n) ? st.s / n : null;
  return st.j >= n ? st.v : null;
}

/** ta.median(close, 40) de la plateforme : tri de la fenetre, moyenne des deux valeurs centrales. */
// [PERF 2026-11-26] Fenetre triee par insertion dans un tampon reutilise (ni tableau ni
// comparateur par barre). Toute disposition croissante du meme multiensemble donne les
// memes valeurs centrales : resultat identique au tri d'origine (clotures finies).
let TAMPON = new Float64Array(64);
function mediane(d, i, n) {
  if (i < n - 1) return null;
  if (TAMPON.length < n) TAMPON = new Float64Array(n);
  const f = TAMPON;
  let t = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const v = d[k].close;
    let j = t++;
    while (j > 0 && f[j - 1] > v) { f[j] = f[j - 1]; j--; }
    f[j] = v;
  }
  const m = Math.floor(n / 2);
  return n % 2 === 0 ? (f[m - 1] + f[m]) / 2 : f[m];
}

/** ta.highest / ta.lowest(source, 200) : file monotone, lecture arretee au premier na. */
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

function ligneTendance(e, d, i) {
  const t = e.ta, S = e.sorties, b = d[i];
  const h = sma(t.hl, b.high - b.low, 50);
  S.source[i] = nul(h) ? null : h * 2;
  const src1 = sma(t.md, mediane(d, i, 40), 10);
  const hi = extreme(t.qh, S.source, i, 200, true), lo = extreme(t.ql, S.source, i, 200, false);
  return [src1, nul(hi) || nul(lo) ? null : (hi + lo) / 2];
}

const creer = () => ({
  o: creerObjets({ maxLignes: 500, maxEtiquettes: 500, maxPolylignes: 500 }), fond: suiteVide(),
  haut: null, bas: null, nH: 0, nB: 0, iH: 0, iB: 0, trend: null, lh: null, ll: null, entreeH: 0, entreeB: 0,
  xh: null, xl: null, xs: null, xd: null,
  ta: { hl: { r: [], s: 0, j: 0, v: null }, md: { r: [], s: 0, j: 0, v: null }, qh: { q: [], t: 0, na: -1 }, ql: { q: [], t: 0, na: -1 } },
  sorties: { trend: [], ligne: [], stop: [], couleur: [], fond: [], source: [] },
});

/** ta.crossover / ta.crossunder sur des valeurs calculees barre par barre (derniere barre ou les deux sont definies). */
function croise(e, cle, a, b, sens) {
  if (nul(a) || nul(b)) return false;
  const prec = e[cle];
  e[cle] = [a, b];
  if (!prec) return false;
  return sens > 0 ? a > b && prec[0] <= prec[1] : a < b && prec[0] >= prec[1];
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], L = p.longueur, S = e.sorties;
  if (!nul(pivotBarre(d, i, L, true))) { e.iH = i - L; e.haut = d[i - L].high; e.lh = o.ligne({ x1: e.iH, y1: e.haut, x2: e.iH, y2: e.haut, couleur: p.couleurHausse }); }
  if (!nul(pivotBarre(d, i, L, false))) { e.iB = i - L; e.bas = d[i - L].low; e.ll = o.ligne({ x1: e.iB, y1: e.bas, x2: e.iB, y2: e.bas, couleur: p.couleurBaisse }); }
  if (croise(e, 'xh', b.high, e.haut, 1)) {
    e.nH += 1;
    const x = Math.trunc(i - (i - e.iH) / 2);
    if (e.nH === 1) e.entreeH = e.lh.y1;
    const pct = ((e.lh.y1 - e.entreeH) / e.entreeH) * 100;
    const txt = e.nH === 1 ? tostring(e.entreeH, '#.# △') : p.pourcentage ? pourcent(pct) : String(e.nH - 1);
    o.etiquette({ x, y: e.lh.y1, texte: txt, couleurTexte: env.texte, couleur: TRANSPARENT, style: 'label_down' });
    e.lh.x2 = i; e.lh = null; e.haut = null; e.nB = 0; e.trend = true;
  }
  if (croise(e, 'xl', b.low, e.bas, -1)) {
    e.nB += 1;
    const x = Math.trunc(i - (i - e.iB) / 2);
    if (e.nB === 1) e.entreeB = e.ll.y1;
    const pct = ((e.ll.y1 - e.entreeB) / e.entreeB) * 100;
    const txt = e.nB === 1 ? tostring(e.entreeB, '#.# ▽') : p.pourcentage ? pourcent(pct) : String(e.nB - 1);
    o.etiquette({ x, y: e.ll.y1, texte: txt, couleurTexte: env.texte, couleur: TRANSPARENT, style: 'label_up' });
    e.ll.x2 = i; e.ll = null; e.bas = null; e.nH = 0; e.trend = false;
  }
  const t = e.trend, t1 = i > 0 ? S.trend[i - 1] : null;
  const [src1, vol] = ligneTendance(e, d, i);
  const ligne = nul(src1) || nul(vol) ? null : vrai(t) ? src1 - vol : src1 + vol;
  const couleur = vrai(t) ? p.couleurHausse : p.couleurBaisse;
  const xs = croise(e, 'xs', b.low, ligne, 1), xd = croise(e, 'xd', b.high, ligne, -1);
  const b1 = i > 0 ? d[i - 1] : null;
  if (vrai(t) && xs && p.stop && !(vrai(t) && non(t1)) && b1) o.etiquette({ x: i - 1, y: b1.low, texte: '◈', style: 'label_up', couleurTexte: couleur, couleur: TRANSPARENT });
  if (non(t) && xd && p.stop && !(vrai(t1) && non(t)) && b1) o.etiquette({ x: i - 1, y: b1.high, texte: '◈', style: 'label_down', couleurTexte: couleur, couleur: TRANSPARENT });
  if (vrai(t) && non(t1) && !nul(ligne)) o.etiquette({ x: i, y: ligne, texte: '△', couleurTexte: couleur, style: 'label_center', couleur: TRANSPARENT, taille: 'large' });
  if (non(t) && vrai(t1) && !nul(ligne)) o.etiquette({ x: i, y: ligne, texte: '▽', couleurTexte: couleur, style: 'label_center', couleur: TRANSPARENT, taille: 'large' });
  // stop_loss := ta.change(trend) ? na : high > stop and not trend ? na : low < stop and trend ? na : stop
  const change = t !== null && t1 !== null && t !== t1;
  const stop = change || nul(ligne) ? null : (b.high > ligne && non(t)) || (b.low < ligne && vrai(t)) ? null : ligne;
  S.trend[i] = t; S.ligne[i] = ligne; S.stop[i] = stop; S.couleur[i] = couleur;
  S.fond[i] = p.stop ? milieu(transparence(couleur, 90), null) : null;
  remplir(o, e.fond, S.stop, s.hl2, i, S.fond[i], derniere);
}

export default class CassuresStopSuiveurIndicator {
  static metadata = {
    id: 'cassures_stop_suiveur',
    name: 'Cassures successives des sommets et creux avec stop suiveur',
    shortName: 'CASS-STOP',
    description: 'cassures_stop_suiveur',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['cassure', 'sommets', 'creux', 'stop suiveur', 'tendance', 'objectifs'],
    inputs: INPUTS,
    outputs: [
      { id: 'stop', name: 'Stop suiveur', type: 'line', color: '#54b6d4', lineWidth: 1 },
      { id: 'halo', name: 'Halo du stop', type: 'line', color: 'rgba(84, 182, 212, 0.2)', lineWidth: 5 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#54b6d4', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { stop: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CassuresStopSuiveurIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => series(d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => {
        const S = etat.sorties, vide = d.map((b) => ({ time: b.time, value: null }));
        return {
          stop: p.stop ? tracer(d, S.stop, S.couleur) : vide,
          halo: p.stop ? tracer(d, S.stop, S.couleur.map((c) => transparence(c, 80))) : vide,
          bougies: d.map((b, i) => ({ time: b.time, value: 1, color: transparence(S.couleur[i], 50) })),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
