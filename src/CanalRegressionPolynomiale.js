// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Polynomial Regression Channel [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/F7duegmG-Polynomial-Regression-Channel-ChartPrime/
// Adaptation : textes du tableau en francais ; calc_bars_count = 500 non repris (la largeur du canal, plus haut sur 100 barres
// de la moyenne 100 du range, ne lit que les 199 dernieres barres : meme valeur). matrix.inv : elimination de Gauss-Jordan a
// pivot partiel (l'algorithme de TradingView n'est pas publie). Le script est rejoue a la derniere barre comme au
// chargement sur TradingView (les etiquettes [1] des barres precedentes n'existent pas).
import { creerObjets } from '../academyscript/objets.js';
import { sma } from '../academyscript/ta.js';
import { highest } from '../academyscript/series.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'longueur', name: 'Période', type: 'number', entier: true, default: 100, min: 2, max: 1000, step: 1, group: P,
    description: 'Nombre de barres ajustées par le polynôme (moindres carrés).' },
  { id: 'prolonger', name: 'Afficher la projection', type: 'boolean', default: true, group: P },
  { id: 'projection', name: 'Barres projetées', type: 'number', entier: true, default: 10, min: 0, max: 500, step: 1, group: P },
  { id: 'degre', name: 'Degré du polynôme', type: 'number', entier: true, default: 4, min: 1, max: 10, step: 1, group: P },
  { id: 'couleurHausse', name: 'Pente montante', type: 'color', default: '#24DF17', group: S },
  { id: 'couleurBaisse', name: 'Pente descendante', type: 'color', default: '#E040FB', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const MOTIF = '##,###,###.###';

/** matrix.mult : somme des produits dans l'ordre des indices. */
function produit(a, b) {
  const n = a.length, m = b[0].length, q = b.length, r = [];
  for (let i = 0; i < n; i++) {
    const ligne = new Array(m);
    for (let j = 0; j < m; j++) { let s = 0; for (let k = 0; k < q; k++) s += a[i][k] * b[k][j]; ligne[j] = s; }
    r.push(ligne);
  }
  return r;
}
/** matrix.inv : Gauss-Jordan, pivot partiel (plus grande valeur absolue de la colonne). */
function inverse(a) {
  const n = a.length, m = a.map((l, i) => [...l, ...a.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    if (piv !== c) { const t = m[c]; m[c] = m[piv]; m[piv] = t; }
    const d = m[c][c];
    for (let k = 0; k < 2 * n; k++) m[c][k] = m[c][k] / d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c];
      if (f === 0) continue;
      for (let k = 0; k < 2 * n; k++) m[r][k] = m[r][k] - f * m[c][k];
    }
  }
  return m.map((l) => l.slice(n));
}

/** polyreg(source, length, degree, extrapolate) a la derniere barre : predictions des length + extrapolate abscisses. */
function regression(src, last, L, deg, ext) {
  const total = L + ext, X = [];
  for (let i = 0; i < total; i++) { const l = []; for (let j = 0; j <= deg; j++) l.push(Math.pow(i, j)); X.push(l); }
  const y = [];
  for (let i = 0; i < L; i++) { const k = last - (L - 1 - i); y.push([k >= 0 ? src[k] : null]); }
  if (y.some((v) => nul(v[0]))) return null;
  const Xtr = X.slice(0, L);
  const Xt = Xtr[0].map((_, j) => Xtr.map((l) => l[j]));
  const b = produit(inverse(produit(Xt, Xtr)), produit(Xt, y));
  return produit(X, b).map((l) => l[0]);
}

function dessiner(p, o, preds, offset, last, env, tb) {
  const L = p.longueur, ext = p.projection, H = p.couleurHausse, B = p.couleurBaisse;
  const pts = [], pts1 = [];
  let prev = null;
  for (let index = 0; index < preds.length; index++) {
    const pr = preds[index];
    const dir = !nul(prev) && pr > prev ? H : B;
    prev = pr;
    const zone = index >= L, x = last + index - L + 1;
    if (offset === 0) {
      const marque = p.prolonger ? (zone ? '•' : '⬥') : (zone ? '' : '⬥');
      o.etiquette({ x, y: pr + offset, texte: marque, couleur: null, couleurTexte: zone ? env.texte : dir, style: 'label_center' });
    } else if (zone && p.prolonger) pts.push({ x, y: pr + offset });
    else if (!zone) pts1.push({ x, y: pr + offset });
    if (index === L + ext - 1 && p.prolonger && offset < 0) {
      const style = dir === H ? 'label_lower_left' : 'label_upper_left';
      for (const v of [pr - offset, pr, pr + offset]) {
        o.etiquette({ x: last + ext, y: v, texte: formaterMotif(v, MOTIF), style, couleurTexte: env.texte, couleur: null });
      }
      tb.cellule(0, 0, { texte: 'Prévision haute : ', couleurTexte: env.texte });
      tb.cellule(1, 0, { texte: formaterMotif(pr - offset, MOTIF), couleurTexte: B });
      tb.cellule(0, 1, { texte: 'Prévision médiane : ', couleurTexte: env.texte });
      tb.cellule(1, 1, { texte: formaterMotif(pr, MOTIF), couleurTexte: env.texte });
      tb.cellule(0, 2, { texte: 'Prévision basse : ', couleurTexte: env.texte });
      tb.cellule(1, 2, { texte: formaterMotif(pr + offset, MOTIF), couleurTexte: H });
    }
  }
  o.polyligne({ points: pts, epaisseur: 1, style: 'dashed', couleur: env.texte });
  o.polyligne({ points: pts1, epaisseur: 1, style: 'solid', couleur: env.texte });
}

function calculer(p, d, env) {
  const o = creerObjets({ maxEtiquettes: 500 }), n = d.length, last = n - 1;
  const tb = o.tableau({ position: 'top_right', colonnes: 100, lignes: 100 });
  const src = d.map(choix[p.source]);
  const hl = sma(d.map((b) => b.high - b.low), p.longueur);
  const h = highest(hl, p.longueur);
  const dist = nul(h[last]) ? null : h[last] * 2;
  const preds = regression(src, last, p.longueur, p.degre, p.projection);
  if (preds && preds.every(Number.isFinite) && !nul(dist)) {
    dessiner(p, o, preds, dist, last, env, tb);
    dessiner(p, o, preds, 0, last, env, tb);
    dessiner(p, o, preds, -dist, last, env, tb);
  }
  return { objets: o.resultat() };
}

export default class CanalRegressionPolynomialeIndicator {
  static metadata = {
    id: 'canal_regression_polynomiale',
    name: 'Canal de régression polynomiale',
    shortName: 'CRP',
    description: 'canal_regression_polynomiale',
    version: '1.0.0',
    overlay: true,
    type: 'volatility',
    category: 'Volatility',
    source: 'builtin',
    tags: ['regression', 'polynome', 'canal', 'projection', 'moindres carres'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    const env = contexte(data, ctx);
    // Tout se calcule a la derniere barre : rien a garder d'une barre close a l'autre.
    return executer(CanalRegressionPolynomialeIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({}) }),
      etape: () => {},
      rendre: (e, dd) => calculer(p, dd, env),
    });
  }
}
