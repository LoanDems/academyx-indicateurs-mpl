// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Amazing Oscillator (AO) [Algoalpha] » (titre du script : « Amazing Oscillator [Algoalpha] ») © Algoalpha X © SUSHIBOI77 — https://www.tradingview.com/script/g9j9piQE-Amazing-Oscillator-AO-Algoalpha/
// Adaptation : aucune sur le calcul. Calcul barre par barre (34 ms par tick a 20 000 bougies avec les series refaites).
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, transparence, degrade, pointsStables, pointTrace, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur de l’oscillateur', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: P,
    description: 'Lissage (moyenne de Wilder) des hausses et des baisses de l’Awesome Oscillator (SMA 5 - SMA 34 des points médians), comme un RSI.' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;

/** Machines barre par barre (pasAPas.js, egales bit a bit a ta.js) : sma, rma, croisements. */
function creer(p) {
  const S = { osc: [], col: [], lig: [], cH: [], cB: [], m: [] };
  const L = p.longueur;
  return {
    o: creerObjets({}), sorties: S, ao1: null,
    m: { s5: A.sma(S, 5), s34: A.sma(S, 34), r: A.ema(L, { rma: true }), f: A.ema(L, { rma: true }),
      xa: A.croisement(1), xv: A.croisement(-1), x0h: A.croisement(1), x0b: A.croisement(-1), xph: A.croisement(-1), xpb: A.croisement(1) },
  };
}

function etape(p, e, d, i) {
  const S = e.sorties, M = e.m, b = d[i], mid = (b.high + b.low) / 2;
  const s5 = A.pas(S, M.s5, i, mid), s34 = A.pas(S, M.s34, i, mid);
  const ao = nul(s5) || nul(s34) ? null : s5 - s34;
  // ta.change(ao) : ao - ao[1] ; math.max / math.min avec na = na.
  const ch = i === 0 || nul(ao) || nul(e.ao1) ? null : ao - e.ao1;
  e.ao1 = ao;
  const r = A.pas(S, M.r, i, nul(ch) ? null : Math.max(ch, 0)), f = A.pas(S, M.f, i, nul(ch) ? null : -Math.min(ch, 0));
  const w = (f === 0 ? 100 : r === 0 ? 0 : 100 - (100 / (1 + r / f))) - 50;
  const v = Number.isFinite(w) ? w : null, v1 = i > 0 ? S.osc[i - 1] : null;
  S.osc[i] = v;
  const H = p.couleurHausse, B = p.couleurBaisse;
  const op = (gt(v, 0) && gt(v, v1)) || (lt(v, 0) && lt(v, v1)) ? 30 : 80;
  S.col[i] = gt(v, 0) ? transparence(H, op) : transparence(B, op);
  S.lig[i] = gt(v, 0) ? transparence(H, 0) : transparence(B, 0);
  S.cH[i] = degrade(v, 0, 50, transparence(GRIS, 70), transparence(B, 0));
  S.cB[i] = degrade(v, -50, 0, transparence(H, 0), transparence(GRIS, 70));
  const xa = A.pas(S, M.xa, i, v, -30), xv = A.pas(S, M.xv, i, v, 30);
  const x0h = A.pas(S, M.x0h, i, v, 0), x0b = A.pas(S, M.x0b, i, v, 0);
  const xph = A.pas(S, M.xph, i, v, v1), xpb = A.pas(S, M.xpb, i, v, v1);
  const conds = [xa, xv, x0h, x0b, xph && gt(v, 0), xpb && lt(v, 0)];
  let m = 0;
  for (let k = 0; k < conds.length; k++) if (conds[k]) m |= 1 << k;
  S.m[i] = m;
  if (xa) e.o.plotchar(i, { position: 'absolute', y: -52, caractere: 'x', couleur: H, taille: 'tiny' });
  if (xv) e.o.plotchar(i, { position: 'absolute', y: 52, caractere: 'x', couleur: B, taille: 'tiny' });
}

function rendre(e, d) {
  const S = e.sorties, n = d.length;
  const ligne = (cle, vals, cols) => pointsStables(S, `_p${cle}`, n, n - 2, (j) => pointTrace(d, vals, cols, j));
  const cst = (k) => { const c = S[`_c${k}`] || (S[`_c${k}`] = []); for (let j = c.length; j < n; j++) c[j] = k; return c; };
  return {
    colonnes: pointsStables(S, '_col', n, n - 1, (j) => ({ time: d[j].time, value: S.osc[j], color: S.col[j] })),
    ligne: ligne('l', S.osc, S.lig),
    seuilHaut: ligne('h', cst(30), S.cH),
    seuilBas: ligne('b', cst(-30), S.cB),
    milieu: pointsStables(S, '_z', n, n, (j) => ({ time: d[j].time, value: 0 })),
    signaux: pointsStables(S, '_s', n, n - 1, (j) => ({ time: d[j].time, value: S.m[j] ? S.m[j] : null })),
    objets: e.o.resultat(),
  };
}

const ALERTES = [
  ['rsi_awesome_retournement_hausse', 'Retournement haussier (passe au-dessus de -30)'],
  ['rsi_awesome_retournement_baisse', 'Retournement baissier (passe sous 30)'],
  ['rsi_awesome_tendance_hausse', 'Passage au-dessus de zéro'],
  ['rsi_awesome_tendance_baisse', 'Passage sous zéro'],
  ['rsi_awesome_essoufflement_hausse', 'Élan haussier qui faiblit'],
  ['rsi_awesome_essoufflement_baisse', 'Élan baissier qui faiblit'],
];

export default class RsiAwesomeOscillatorIndicator {
  static metadata = {
    id: 'rsi_awesome_oscillator',
    name: 'RSI de l’Awesome Oscillator',
    shortName: 'RSI-AWE',
    description: 'rsi_awesome_oscillator',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['awesome oscillator', 'rsi', 'momentum', 'oscillateur', 'retournement'],
    inputs: INPUTS,
    outputs: [
      { id: 'ligne', name: 'Oscillateur', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'colonnes', name: 'Colonnes', type: 'histogram', color: 'rgba(0, 255, 187, 0.7)' },
      { id: 'seuilHaut', name: 'Seuil 30', type: 'line', color: 'rgba(120, 123, 134, 0.3)', lineWidth: 3 },
      { id: 'seuilBas', name: 'Seuil -30', type: 'line', color: 'rgba(120, 123, 134, 0.3)', lineWidth: 3 },
      { id: 'milieu', name: 'Zéro', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { ligne: [] };
    const p = this.params;
    return executer(RsiAwesomeOscillatorIndicator._memo, JSON.stringify(p), data, {
      creer: () => creer(p),
      etape: (e, d, i) => etape(p, e, d, i),
      rendre: (e, d) => rendre(e, d),
    });
  }
}
