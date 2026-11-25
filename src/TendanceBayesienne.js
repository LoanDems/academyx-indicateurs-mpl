// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Bayesian Trend Indicator [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/rVEhAQDO-Bayesian-Trend-Indicator-ChartPrime/
// Adaptation : textes du tableau en francais ; couleurs reglables ; bougies colorees (plotcandle) et barcolor reunis en une couleur de bougie.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { tostring, formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence, degrade } from './commun.js';

const SOURCES = [
  { label: 'HLC3', value: 'hlc3' }, { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' },
  { label: 'Plus haut', value: 'high' }, { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'OHLC4', value: 'ohlc4' },
];
const G = 'Paramètres', ST = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'hlc3', options: SOURCES, group: G },
  { id: 'longueur', name: 'Longueur des moyennes', type: 'number', entier: true, default: 60, min: 2, max: 1000, step: 1, group: G },
  { id: 'ecartLongueurs', name: 'Écart entre moyennes lentes et rapides', type: 'number', entier: true, default: 20, min: 0, max: 999, step: 1, group: G,
    description: 'Les moyennes rapides ont pour longueur « Longueur des moyennes » moins cet écart.' },
  { id: 'recul', name: 'Recul du signal (barres)', type: 'number', entier: true, default: 10, min: 10, max: 500, step: 1, group: G,
    description: 'Le prix est comparé à chaque moyenne de ce nombre de barres en arrière (et des neuf barres suivantes) pour noter sa pente.' },
  { id: 'etiquettes', name: 'Probabilité sur chaque bougie', type: 'boolean', default: true, group: ST },
  { id: 'tableau', name: 'Tableau des probabilités', type: 'boolean', default: true, group: ST },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#0fac16', group: ST },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#c51212', group: ST },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const NOTES = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
const rond2 = (v) => Math.round(v * 100) / 100;

const MOY = ['sma', 'ema', 'dema', 'vwma'];

/**
 * Etat du script barre par barre (pasAPas.js, egal bit a bit a ta.js) : 2 x 4 moyennes, l'historique de
 * chacune (sig() lit src[gap] ... src[gap - 9]), leurs notes lissees par ta.ema(_, 4), l'a posteriori.
 */
function vitesse(S, L) {
  const h = {};
  for (const k of MOY) { h[k] = `moy_${k}_${L}_${Object.keys(S).length}`; S[h[k]] = []; }
  const notes = {};
  for (const k of MOY) { notes[k] = `note_${k}_${L}_${Object.keys(S).length}`; S[notes[k]] = []; }
  return { L, sma: A.sma(S, L), e: A.ema(L), ee: A.ema(L), dem: A.ema(L), vwma: A.vwma(S, L), lisse: Object.fromEntries(MOY.map((k) => [k, A.ema(4)])), h, notes };
}

function creer(p) {
  const S = { post: [], couleur: [], haut: [], bas: [] };
  return { o: creerObjets({ maxEtiquettes: 100 }), sorties: S, lent: vitesse(S, p.longueur), rapide: vitesse(S, p.longueur - p.ecartLongueurs), xh: A.croisement(1), xb: A.croisement(-1) };
}

/** Les 4 moyennes d'une vitesse a la barre i, puis sig() de chacune : moyenne des 4 notes. */
function noter(S, V, i, x, vol, gap) {
  const e = A.pas(S, V.e, i, x), ee = A.pas(S, V.ee, i, e);
  const m = { sma: A.pas(S, V.sma, i, x), ema: e, dema: A.pas(S, V.dem, i, nul(e) || nul(ee) ? null : 2 * e - ee), vwma: A.pas(S, V.vwma, i, x, vol) };
  for (const k of MOY) {
    const H = S[V.h[k]];
    H[i] = m[k];
    let n = 0;
    for (let q = 0; q < 10; q++) { const j = i - (gap - q); if (j >= 0 && !nul(H[j]) && x >= H[j]) { n = NOTES[q]; break; } }
    S[V.notes[k]][i] = A.pas(S, V.lisse[k], i, n);
  }
  const N = (k) => S[V.notes[k]][i];
  return (N('ema') + N('sma') + N('dema') + N('vwma')) / 4;
}

function etape(p, e, d, i, derniere, env) {
  const o = e.o, b = d[i], S = e.sorties, x = choix[p.source](b);
  const pu = noter(S, e.lent, i, x, b.volume, p.recul), lu = noter(S, e.rapide, i, x, b.volume, p.recul);
  let v = (pu * lu) / (pu * lu + (1 - pu) * (1 - lu));
  if (!Number.isFinite(v)) v = 0; // if na(posterior_up) posterior_up := 0
  S.post[i] = v;
  const fondTransp = transparence(env.fond, 20);
  S.couleur[i] = v < 0.48 ? degrade(v, 0, 0.48, p.couleurBaisse, fondTransp) : v > 0.52 ? degrade(v, 0.52, 1, fondTransp, p.couleurHausse) : env.fond;
  S.haut[i] = A.pas(S, e.xh, i, v, 0.5);
  S.bas[i] = A.pas(S, e.xb, i, v, 0.5);
  if (p.etiquettes) {
    o.etiquette({ x: i, y: v > 0.5 ? b.high : b.low, texte: tostring(rond2(v), '#.##########'), style: v > 0.5 ? 'label_down' : 'label_up',
      couleurTexte: degrade(v, 0, 1, p.couleurBaisse, p.couleurHausse), couleur: null });
  }
  if (S.haut[i]) o.plotchar(i, { position: 'belowbar', caractere: '◆', couleur: transparence(p.couleurHausse, 5), taille: 'tiny' });
  if (S.bas[i]) o.plotchar(i, { position: 'abovebar', caractere: '◆', couleur: transparence(p.couleurBaisse, 5), taille: 'tiny' });
  if (derniere && p.tableau) {
    const t = o.tableau({ position: 'top_right', colonnes: 10, lignes: 10 });
    const g = (y) => degrade(y, 0, 1, p.couleurBaisse, p.couleurHausse);
    t.cellule(0, 0, { texte: 'Tendance bayésienne', couleurTexte: env.texte, taille: 'large' });
    t.fusionner(0, 0, 3, 0);
    t.cellule(0, 1, { texte: 'Probabilité de hausse :', couleurTexte: env.texte, taille: 'normal' });
    t.cellule(1, 1, { texte: formaterMotif(v * 100, '0.00') + '%', couleurTexte: g(v), taille: v > 0.5 ? 'large' : 'normal' });
    t.fusionner(1, 1, 3, 1);
    t.cellule(0, 2, {});
    t.cellule(0, 3, { texte: 'Moyenne', couleurTexte: '#4a4f5e' });
    t.cellule(1, 3, { texte: 'Lente', couleurTexte: '#4a4f5e' });
    t.cellule(2, 3, { texte: 'Rapide', couleurTexte: '#4a4f5e' });
    [['SMA', 'sma', 4], ['EMA', 'ema', 5], ['DEMA', 'dema', 6], ['VWMA', 'vwma', 7]].forEach(([nom, k, l]) => {
      const a = S[e.lent.notes[k]][i], r = S[e.rapide.notes[k]][i];
      t.cellule(0, l, { texte: nom, couleurTexte: env.texte });
      t.cellule(1, l, { texte: tostring(rond2(a), '#.##########'), couleurTexte: g(a) });
      t.cellule(2, l, { texte: tostring(rond2(r), '#.##########'), couleurTexte: g(r) });
    });
  }
}

function rendre(e, d) {
  const S = e.sorties, n = d.length, prob = new Array(n), bougies = new Array(n);
  for (let i = 0; i < n; i++) {
    prob[i] = { time: d[i].time, value: S.post[i] };
    bougies[i] = { time: d[i].time, value: S.couleur[i] ? 1 : null, color: S.couleur[i] };
  }
  return { probabilite: prob, bougies, objets: e.o.resultat() };
}

export default class TendanceBayesienneIndicator {
  static metadata = {
    id: 'tendance_bayesienne',
    name: 'Probabilité de tendance (règle de Bayes)',
    shortName: 'BAYES',
    description: 'tendance_bayesienne',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['bayes', 'probabilite', 'tendance', 'moyennes mobiles', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'probabilite', name: 'Probabilité de hausse', type: 'line', color: '#0fac16', hidden: true },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#0fac16', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: [
      { id: 'hausse', title: 'Probabilité de hausse au-dessus de 50 %', message: 'Probabilité de hausse au-dessus de 50 %', when: 'cross_above', source: 'probabilite', reference: 0.5 },
      { id: 'baisse', title: 'Probabilité de hausse sous 50 %', message: 'Probabilité de hausse sous 50 %', when: 'cross_below', source: 'probabilite', reference: 0.5 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { bougies: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(TendanceBayesienneIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer: () => creer(p),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat, d) => rendre(etat, d),
    });
  }
}
