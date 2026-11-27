// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Reversal and Breakout Signals [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/fpWwOup4-Reversal-and-Breakout-Signals-AlgoAlpha/
// Adaptation : niveaux en marches sans les losanges de plot.style_stepline_diamond ; lettres R (retournement) et C (cassure)
// au lieu des lettres calligraphiees ; bougies colorees (plotcandle) et barcolor reunis en une couleur de bougie.
import { creerObjets } from '../academyscript/objets.js';
import { hma, sma, wma, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, tracer, transparence, masque, bit, extremesGlissants } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'periode', name: 'Période', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: P,
    description: 'Moyennes pondérées des plus hauts et des plus bas, puis leur extrême sur la même période.' },
  { id: 'periodeVolume', name: 'Période du volume', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: P },
  { id: 'seuilVolume', name: 'Seuil de volume fort', type: 'number', default: 2, min: 0, max: 50, step: 0.1, group: P,
    description: 'Une cassure n’est retenue que si le volume dépasse ce multiple de sa moyenne.' },
  { id: 'bougiesTendance', name: 'Colorer les bougies en tendance', type: 'boolean', default: true, group: S },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: S },
  { id: 'couleurCassure', name: 'Cassure', type: 'color', default: '#eeff00', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;

/** ta.highest / ta.lowest de `length` barres : les na sont ignores, na si tous le sont ou avant la barre length - 1. */
const extremes = extremesGlissants; // [PERF 2026-11-27] file monotone, meme resultat (cf. commun.js)

function series(p, d) {
  const n = d.length, close = d.map((b) => b.close), vol = d.map((b) => b.volume);
  const moyenne = hma(close, 30), mv = sma(vol, p.periodeVolume);
  const h = extremes(wma(d.map((b) => b.high), p.periode), p.periode, true), l = extremes(wma(d.map((b) => b.low), p.periode), p.periode, false);
  const HS = new Array(n), LS = new Array(n), etat = new Array(n);
  const bo = [], bd = [], bb = [], be = [], rh = [], rb = [];
  let hs = 0.0, ls = 0.0, st = 0.0;
  const v = (a, k) => (k >= 0 ? !!a[k] : false);
  for (let i = 0; i < n; i++) {
    const b = d[i];
    const h1 = i > 0 ? h[i - 1] : null, l1 = i > 0 ? l[i - 1] : null;
    if (!(lt(h[i], h1) || gt(h[i], h1))) hs = h1;
    if (!(lt(l[i], l1) || gt(l[i], l1))) ls = l1;
    HS[i] = hs; LS[i] = ls;
    const dir = b.close > b.open ? 1 : -1;
    const fort = !nul(mv[i]) && mv[i] !== 0 && b.volume / mv[i] > p.seuilVolume;
    bo[i] = dir === 1 && gt(b.close, hs) && lt(b.open, hs);
    bd[i] = dir === -1 && lt(b.close, ls) && gt(b.open, ls);
    bb[i] = (bo[i] || ((v(bo, i - 1) || v(bo, i - 2) || v(bo, i - 3) || v(bo, i - 4)) && dir === 1)) && fort && !(v(bb, i - 1) || v(bb, i - 2) || v(bb, i - 3));
    be[i] = (bd[i] || ((v(bd, i - 1) || v(bd, i - 2) || v(bd, i - 3) || v(bd, i - 4)) && dir === -1)) && fort && !(v(be, i - 1) || v(be, i - 2) || v(be, i - 3));
    rh[i] = lt(b.low, ls) && gt(b.close, ls) && !(v(rh, i - 1) || v(rh, i - 2) || v(rh, i - 3) || v(rh, i - 4));
    rb[i] = gt(b.high, hs) && lt(b.close, hs) && !(v(rb, i - 1) || v(rb, i - 2) || v(rb, i - 3) || v(rb, i - 4));
  }
  // ta.crossover(low, lstore) / ta.crossunder(high, hstore), evalues a chaque barre.
  const xL = crossover(d.map((b) => b.low), LS), xH = crossunder(d.map((b) => b.high), HS);
  for (let i = 0; i < n; i++) {
    if (bb[i]) st = 1;
    if (be[i]) st = -1;
    if ((xL[i] && st === -1) || (xH[i] && st === 1)) st = 0;
    etat[i] = st;
  }
  const milieu = HS.map((x, i) => (nul(x) || nul(LS[i]) ? null : (x + LS[i]) / 2));
  const suivi = moyenne.map((x, i) => (etat[i] !== 0 ? x : null));
  const retH = rh.map((x, i) => x && etat[i] !== -1), retB = rb.map((x, i) => x && etat[i] !== 1);
  return { HS, LS, milieu, suivi, etat, bb, be, retH, retB };
}

function etape(p, e, d, i, derniere, s) {
  const o = e.o, b = d[i];
  if (s.retH[i]) o.etiquette({ x: i, y: b.low * 0.9995, yloc: 'belowbar', texte: 'R', style: 'triangleup', couleur: p.couleurHausse, couleurTexte: GRIS, taille: 'tiny' });
  if (s.retB[i]) o.etiquette({ x: i, y: b.high * 1.0005, yloc: 'abovebar', texte: 'R', style: 'triangledown', couleur: p.couleurBaisse, couleurTexte: GRIS, taille: 'tiny' });
  if (s.bb[i]) o.etiquette({ x: i, y: b.low * 0.999, yloc: 'belowbar', texte: 'C', style: 'diamond', couleur: p.couleurCassure, couleurTexte: GRIS, taille: 'tiny' });
  if (s.be[i]) o.etiquette({ x: i, y: b.high * 1.001, yloc: 'abovebar', texte: 'C', style: 'diamond', couleur: p.couleurCassure, couleurTexte: GRIS, taille: 'tiny' });
}

function rendre(p, e, d, s) {
  const n = d.length, plein = (c) => new Array(n).fill(c);
  const cSuivi = s.etat.map((t) => (t === 1 ? p.couleurHausse : p.couleurBaisse));
  const bougies = new Array(n);
  for (let i = 0; i < n; i++) {
    // plotcandle (couleur de tendance) par-dessus barcolor (cassure) : la premiere couleur definie l'emporte.
    const t = s.etat[i];
    const c = (p.bougiesTendance && t === 1 ? p.couleurHausse : p.bougiesTendance && t === -1 ? p.couleurBaisse : null)
      || (s.bb[i] || s.be[i] ? p.couleurCassure : null);
    bougies[i] = { time: d[i].time, value: c ? 1 : null, color: c };
  }
  return {
    haut: tracer(d, s.HS, plein(transparence(p.couleurBaisse, 50))),
    bas: tracer(d, s.LS, plein(transparence(p.couleurHausse, 50))),
    milieu: tracer(d, s.milieu, plein(GRIS)),
    suivi: tracer(d, s.suivi, cSuivi),
    bougies,
    signaux: masque(d, [s.retH, s.retB, s.bb, s.be]),
    objets: e.o.resultat(),
  };
}

const ALERTES = [
  ['retournement_hausse', 'Retournement à la hausse'], ['retournement_baisse', 'Retournement à la baisse'],
  ['cassure_hausse', 'Cassure haussière'], ['cassure_baisse', 'Cassure baissière'],
];

export default class RetournementsCassuresVolumeIndicator {
  static metadata = {
    id: 'retournements_cassures_volume',
    name: 'Retournements et cassures sur volume fort',
    shortName: 'R/C-VOL',
    description: 'retournements_cassures_volume',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['retournement', 'cassure', 'volume', 'niveaux', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'haut', name: 'Niveau haut', type: 'line', color: 'rgba(255, 17, 0, 0.5)', lineWidth: 1, trace: 'escalier' },
      { id: 'bas', name: 'Niveau bas', type: 'line', color: 'rgba(0, 255, 187, 0.5)', lineWidth: 1, trace: 'escalier' },
      { id: 'milieu', name: 'Milieu', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'suivi', name: 'Suivi de tendance', type: 'line', color: '#00ffbb', lineWidth: 3 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#eeff00', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { haut: [] };
    const p = this.params;
    return executer(RetournementsCassuresVolumeIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500 }) }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
