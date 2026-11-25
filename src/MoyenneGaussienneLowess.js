// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « LOWESS (Locally Weighted Scatterplot Smoothing) [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/hyeoDyZn-LOWESS-Locally-Weighted-Scatterplot-Smoothing-ChartPrime/
// Adaptation : les croix de la moyenne gaussienne brute (couleur grise tiree au hasard a chaque barre dans le script) prennent une couleur fixe reglable.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr, stdev as taStdev, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, TRANSPARENT } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 30, min: 2, max: 300, step: 1, group: P,
    description: 'Fenêtre de la moyenne gaussienne adaptative, lissée ensuite par une régression locale (LOWESS) sur 10 barres.' },
  { id: 'pivots', name: 'Barres des sommets et creux', type: 'number', entier: true, default: 5, min: 2, max: 100, step: 1, group: P,
    description: 'Barres à gauche ; un sommet ou un creux est confirmé deux barres plus tôt que ce nombre.' },
  { id: 'compter', name: 'Compter les cassures', type: 'boolean', default: false, group: P },
  { id: 'gaussienne', name: 'Afficher la moyenne gaussienne brute', type: 'boolean', default: false, group: P },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#60befd', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ab61ff', group: S },
  { id: 'couleurGaussienne', name: 'Moyenne gaussienne brute', type: 'color', default: '#9e9e9e', group: S },
];
const BLEU = '#2962FF';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

/** lowess(src, length) du script, a la barre i. */
function lowess(src, i, length) {
  let sw = 0, swx = 0, swy = 0;
  for (let k = 0; k < length; k++) {
    const w = Math.pow(1 - Math.pow(k / length, 3), 3);
    sw += w; swx += w * k;
    const v = i - k >= 0 ? src[i - k] : null;
    swy = nul(v) || nul(swy) ? null : swy + w * v;
  }
  if (nul(swy)) return null;
  return swy / sw + swx / sw / (length - 1) / 2000;
}

// Series de ta.* sur toutes les bougies (lineaires) ; la moyenne gaussienne et sa regression,
// qui coutent `longueur` operations par barre, sont calculees barre par barre dans etape() :
// une seule fois par barre close, la barre en cours seule a chaque tick.
function series(p, d) {
  const L = p.longueur, droite = p.pivots - 2;
  return {
    a: taAtr(d, L), sd: taStdev(d.map((b) => b.close), L),
    ph: pivothigh(d.map((b) => b.high), p.pivots, droite), pl: pivotlow(d.map((b) => b.low), p.pivots, droite),
  };
}

/** GaussianMA(close, length) puis lowess(gma, 10) a la barre i ; S porte les valeurs des barres precedentes. */
function moyenne(p, d, i, s, S) {
  const L = p.longueur;
  const sigma = nul(s.a[i]) || nul(s.sd[i]) ? null : (s.a[i] + s.sd[i]) / 2;
  let g = 0, sw = 0, hi = -Infinity, lo = Infinity;
  for (let k = 0; k < L; k++) {
    const c = i - k >= 0 ? d[i - k].close : null;
    if (!nul(c)) { if (c > hi) hi = c; if (c < lo) lo = c; }
    const w = nul(sigma) ? null : Math.exp(-Math.pow((k - (L - 1)) / (2 * sigma), 2) / 2);
    const hk = k === 0 ? hi : i - k >= 0 ? S.haut[i - k] : null, lk = k === 0 ? lo : i - k >= 0 ? S.bas[i - k] : null;
    const v = nul(hk) || nul(lk) ? null : Math.max(hk, hi) + Math.min(lk, lo);
    g = nul(g) || nul(v) || nul(w) ? null : g + v * w;
    sw = nul(sw) || nul(w) ? null : sw + w;
  }
  S.haut[i] = hi; S.bas[i] = lo;
  S.gma[i] = nul(g) || nul(sw) ? null : g / sw / 2;
  const v = lowess(S.gma, i, 10), v2 = i >= 2 ? S.lisse[i - 2] : null;
  S.lisse[i] = v;
  S.couleurs[i] = nul(v) || nul(v2) ? null : v > v2 ? p.couleurHausse : p.couleurBaisse;
  S.halo[i] = S.couleurs[i] ? transparence(S.couleurs[i], 80) : null;
  return [v, v2];
}

const creer = () => ({
  o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }), lh: null, eh: null, ll: null, el: null, up: 0, dn: 0,
  xh: [null, null], xl: [null, null], xo: [null, null], xu: [null, null],
  sorties: { haut: [], bas: [], gma: [], lisse: [], couleurs: [], halo: [] },
});

/** ta.crossover / ta.crossunder sur des valeurs calculees barre par barre (derniere barre ou les deux sont definies). */
function croise(etat, a, b, sens) {
  if (nul(a) || nul(b)) return false;
  const [pa, pb] = etat;
  const r = pa === null ? false : sens > 0 ? a > b && pa <= pb : a < b && pa >= pb;
  etat[0] = a; etat[1] = b;
  return r;
}

function etape(p, e, d, i, s) {
  const o = e.o, b = d[i], droite = p.pivots - 2;
  const [v, v2] = moyenne(p, d, i, s, e.sorties);
  const col = e.sorties.couleurs[i];
  if (col === p.couleurHausse && col !== null && s.ph[i]) {
    e.lh = o.ligne({ x1: i - droite, y1: d[i - droite].high, x2: i - droite, y2: d[i - droite].high, couleur: BLEU });
    e.eh = o.etiquette({ x: null, y: d[i - droite].high, texte: '⬥', couleur: TRANSPARENT, couleurTexte: p.couleurHausse, style: 'label_down', taille: 'large' });
  }
  if (croise(e.xh, b.close, e.lh ? e.lh.y1 : null, 1)) {
    e.dn = 0; e.up += 1;
    e.lh.x2 = i; e.lh.couleur = transparence(p.couleurHausse, 30);
    e.eh.x = i;
    if (!p.compter) e.eh.style = 'label_center';
    else { e.eh.y = b.high; e.eh.taille = 'normal'; e.eh.style = 'label_down'; e.eh.texte = String(e.up); }
    e.lh = null;
  }
  if (col === p.couleurBaisse && col !== null && s.pl[i]) {
    e.ll = o.ligne({ x1: i - droite, y1: d[i - droite].low, x2: i - droite, y2: d[i - droite].low, couleur: BLEU });
    e.el = o.etiquette({ x: null, y: d[i - droite].low, texte: '⬥', couleur: TRANSPARENT, couleurTexte: p.couleurBaisse, style: 'label_down', taille: 'large' });
  }
  if (croise(e.xl, b.close, e.ll ? e.ll.y1 : null, -1)) {
    e.up = 0; e.dn += 1;
    e.ll.x2 = i; e.ll.couleur = transparence(p.couleurBaisse, 30);
    e.el.x = i;
    if (!p.compter) e.el.style = 'label_center';
    else { e.el.y = b.low; e.el.taille = 'normal'; e.el.style = 'label_up'; e.el.texte = String(e.dn); }
    e.ll = null;
  }
  const xo = croise(e.xo, v, v2, 1), xu = croise(e.xu, v, v2, -1);
  const c = xo ? p.couleurHausse : xu ? p.couleurBaisse : null;
  if (c) o.plotchar(i, { position: 'absolute', y: v, caractere: '◆', couleur: c, taille: 'tiny' });
}

export default class MoyenneGaussienneLowessIndicator {
  static metadata = {
    id: 'moyenne_gaussienne_lowess',
    name: 'Moyenne gaussienne lissée (LOWESS) et cassures',
    shortName: 'LOWESS',
    description: 'moyenne_gaussienne_lowess',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['lowess', 'moyenne gaussienne', 'regression locale', 'sommets', 'creux', 'cassure'],
    inputs: INPUTS,
    outputs: [
      { id: 'lisse', name: 'Moyenne lissée', type: 'line', color: '#60befd', lineWidth: 1 },
      { id: 'halo', name: 'Halo', type: 'line', color: 'rgba(96, 190, 253, 0.2)', lineWidth: 5 },
      { id: 'gaussienne', name: 'Moyenne gaussienne brute', type: 'line', color: '#9e9e9e', lineWidth: 1, trace: 'cercles' },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { lisse: [] };
    const p = this.params;
    contexte(data, ctx);
    return executer(MoyenneGaussienneLowessIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, s),
      rendre: (etat, d) => ({
        lisse: tracer(d, etat.sorties.lisse, etat.sorties.couleurs),
        halo: tracer(d, etat.sorties.lisse, etat.sorties.halo),
        gaussienne: d.map((b, i) => ({ time: b.time, value: p.gaussienne && i % 4 === 0 && !nul(etat.sorties.gma[i]) ? etat.sorties.gma[i] : null, color: p.couleurGaussienne })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
