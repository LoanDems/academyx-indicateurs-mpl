// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Nadaraya-Watson: Rational Quadratic Kernel (Non-Repainting) » © jdehorty — https://www.tradingview.com/script/AWNvbPRM-Nadaraya-Watson-Rational-Quadratic-Kernel-Non-Repainting/
// Adaptation : le parametre `timeframe` d'indicator() (unite superieure) n'est pas repris ; textes des alertes en francais.
import { lireReglages, executer, tracer, masque, bit } from './commun.js';
import { creerObjets } from '../academyscript/objets.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Couleurs';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'fenetre', name: 'Fenêtre', type: 'number', default: 8, min: 3, max: 100, step: 0.5, group: P,
    description: 'Largeur du noyau (en barres) : plus elle est grande, plus l’estimation est lisse.' },
  { id: 'poids', name: 'Pondération relative', type: 'number', default: 8, min: 0.25, max: 100, step: 0.25, group: P,
    description: 'Vers 0, les barres anciennes pèsent davantage ; très grande, le noyau devient gaussien.' },
  { id: 'debut', name: 'Barres prises en compte', type: 'number', entier: true, default: 25, min: 2, max: 500, step: 1, group: P,
    description: 'L’estimation de chaque barre lit cette barre et les (valeur + 1) précédentes.' },
  { id: 'lisserCouleurs', name: 'Couleurs par croisement', type: 'boolean', default: false, group: S,
    description: 'La couleur suit le croisement de l’estimation et d’une estimation plus rapide, au lieu de sa pente.' },
  { id: 'retard', name: 'Écart de la fenêtre rapide', type: 'number', entier: true, default: 2, min: 1, max: 2, step: 1, group: S,
    description: 'L’estimation rapide utilise une fenêtre plus courte d’autant.' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#3AFF17', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#FD1707', group: S },
];
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

/** kernel_regression du script : somme sur i = 0 .. 1 + x_0 (array.size(array.from(src)) = 1) ; na si une barre manque. */
function regression(src, h, r, x0) {
  const n = src.length, out = new Array(n).fill(null), w = [];
  for (let i = 0; i <= 1 + x0; i++) w.push(Math.pow(1 + Math.pow(i, 2) / (Math.pow(h, 2) * 2 * r), -r));
  for (let b = 0; b < n; b++) {
    if (b - (1 + x0) < 0) continue;
    let cur = 0, cum = 0;
    for (let i = 0; i <= 1 + x0; i++) { cur += src[b - i] * w[i]; cum += w[i]; }
    out[b] = cur / cum;
  }
  return out;
}

function series(p, d) {
  const n = d.length, src = d.map(choix[p.source]);
  const y1 = regression(src, p.fenetre, p.poids, p.debut), y2 = regression(src, p.fenetre - p.retard, p.poids, p.debut);
  const gt = (a, b) => !nul(a) && !nul(b) && a > b;
  const couleurs = new Array(n), alerteBaisse = new Array(n), alerteHausse = new Array(n);
  let pa = null, pb = null;
  for (let i = 0; i < n; i++) {
    const y1_1 = i >= 1 ? y1[i - 1] : null, y1_2 = i >= 2 ? y1[i - 2] : null;
    const etaitBaissier = gt(y1_2, y1_1), etaitHaussier = gt(y1_1, y1_2);
    const baissier = gt(y1_1, y1[i]), haussier = gt(y1[i], y1_1);
    // ta.crossover / ta.crossunder(yhat2, yhat1) : derniere barre ou les deux existaient
    let xo = false, xu = false;
    if (!nul(y1[i]) && !nul(y2[i])) {
      if (pa !== null) { xo = pa <= pb && y2[i] > y1[i]; xu = pa >= pb && y2[i] < y1[i]; }
      pa = y2[i]; pb = y1[i];
    }
    const parCroisement = gt(y2[i], y1[i]) ? p.couleurHausse : p.couleurBaisse;
    const parPente = haussier ? p.couleurHausse : p.couleurBaisse;
    couleurs[i] = p.lisserCouleurs ? parCroisement : parPente;
    alerteBaisse[i] = p.lisserCouleurs ? xu : baissier && etaitHaussier;
    alerteHausse[i] = p.lisserCouleurs ? xo : haussier && etaitBaissier;
  }
  return { y1, couleurs, alerteBaisse, alerteHausse };
}

const ALERTES = [['couleur_baissiere', 'Passage à la couleur baissière'], ['couleur_haussiere', 'Passage à la couleur haussière']];

export default class NoyauRationnelQuadratiqueIndicator {
  static metadata = {
    id: 'noyau_rationnel_quadratique',
    name: 'Estimation par noyau rationnel quadratique (sans repeinture)',
    shortName: 'NOYAU-RQ',
    description: 'noyau_rationnel_quadratique',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['regression', 'noyau', 'nadaraya-watson', 'lissage', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'estimation', name: 'Estimation', type: 'line', color: '#3AFF17', lineWidth: 2 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { estimation: [], signaux: [] };
    const p = this.params;
    return executer(NoyauRationnelQuadratiqueIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets() }),
      series: (d) => series(p, d),
      etape: () => {},
      rendre: (etat, d, s) => ({ estimation: tracer(d, s.y1, s.couleurs), signaux: masque(d, [s.alerteBaisse, s.alerteHausse]) }),
    });
  }
}
