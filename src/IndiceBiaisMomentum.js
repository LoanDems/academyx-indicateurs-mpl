// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Momentum Bias Index [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/oMZKratR-Momentum-Bias-Index-AlgoAlpha/
// Adaptation : l'option « Overlay Mode » (bougies coloriees et etiquettes TP, a superposer au graphique des prix) n'est pas
// reprise : l'indicateur reste dans son panneau, ou il affiche les colonnes, la frontiere d'impulsion et les croix.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, transparence, pointsStables, pointTrace } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'longueurMomentum', name: 'Longueur du momentum', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: P,
    description: 'Écart de la source avec sa valeur d’il y a N barres, rapporté à la moyenne exponentielle de la plage des bougies.' },
  { id: 'longueurBiais', name: 'Longueur du biais', type: 'number', entier: true, default: 5, min: 1, max: 500, step: 1, group: P,
    description: 'Somme des momentums positifs (et négatifs) sur ce nombre de barres.' },
  { id: 'longueurLissage', name: 'Longueur du lissage', type: 'number', entier: true, default: 10, min: 2, max: 500, step: 1, group: P,
    description: 'Moyenne de Hull (2 barres au moins : à 1, la moyenne de Hull n’est pas définie).' },
  { id: 'lisser', name: 'Lisser l’indicateur', type: 'boolean', default: true, group: P,
    description: 'Moyenne de Hull des deux biais (bornée à 0).' },
  { id: 'longueurFrontiere', name: 'Longueur de la frontière d’impulsion', type: 'number', entier: true, default: 30, min: 1, max: 500, step: 1, group: P },
  { id: 'multiplicateur', name: 'Multiplicateur d’écart-type', type: 'number', default: 3, min: 1, max: 20, step: 0.1, group: P,
    description: 'Frontière = moyenne exponentielle du biais moyen + ce multiple de son écart-type.' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurHausse2', name: 'Hausse (secondaire)', type: 'color', default: '#008461', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: S },
  { id: 'couleurBaisse2', name: 'Baisse (secondaire)', type: 'color', default: '#840900', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const fini = (v) => typeof v === 'number' && Number.isFinite(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

const max0 = (x) => (nul(x) ? null : Math.max(x, 0));
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;

/**
 * math.sum barre par barre : na tant que la fenetre contient un na ; somme glissante « ajout puis retrait »
 * depuis la derniere reprise (`m` : etat, `H` : valeurs de la serie, ecrites a l'index de la barre).
 */
function pasSomme(m, H, i, x, L) {
  H[i] = fini(x) ? x : null;
  if (!fini(x)) { m.s = 0; m.depuis = 0; return null; }
  m.s += x; m.depuis++;
  if (m.depuis > L) m.s -= H[i - L];
  return m.depuis >= L ? m.s : null;
}

function creer(p) {
  const S = { src: [], pos: [], neg: [], haut: [], bas: [], front: [], hausse: [], baisse: [] };
  return {
    o: creerObjets({}), cH: transparence(p.couleurHausse, 30), cB: transparence(p.couleurBaisse, 30), sorties: S,
    sH: { s: 0, depuis: 0 }, sB: { s: 0, depuis: 0 },
    m: {
      plage: A.ema(p.longueurMomentum), hH: A.hma(S, p.longueurLissage), hB: A.hma(S, p.longueurLissage),
      ef: A.ema(p.longueurFrontiere), sf: A.sma(S, p.longueurFrontiere, { stdev: true }), xb: A.croisement(-1), xh: A.croisement(-1),
    },
  };
}

/** Barre i : machines de pasAPas.js (egales bit a bit a ta.js : ema, hma, sma / stdev, croisements). */
function etape(p, e, d, i) {
  const S = e.sorties, M = e.m, b = d[i], L = p.longueurMomentum;
  const x = choix[p.source](b);
  S.src[i] = x;
  const plage = A.pas(S, M.plage, i, b.high - b.low);
  let sd = null;
  if (i >= L && !nul(plage)) { const r = (x - S.src[i - L]) / plage * 100; sd = fini(r) ? r : null; }
  const sHaut = pasSomme(e.sH, S.pos, i, nul(sd) ? null : Math.max(sd, 0), p.longueurBiais);
  const sBas = pasSomme(e.sB, S.neg, i, nul(sd) ? null : Math.min(sd, 0), p.longueurBiais);
  const haut = p.lisser ? max0(A.pas(S, M.hH, i, sHaut)) : sHaut;
  const bas = p.lisser ? max0(A.pas(S, M.hB, i, nul(sBas) ? null : -sBas)) : (nul(sBas) ? null : -sBas);
  S.haut[i] = haut; S.bas[i] = bas;
  const moy = nul(haut) || nul(bas) ? null : (bas + haut) / 2;
  const em = A.pas(S, M.ef, i, moy);
  A.pas(S, M.sf, i, moy);
  const et = M.sf.et;
  const front = nul(em) || nul(et) ? null : em + et * p.multiplicateur;
  S.front[i] = front;
  const xb = A.pas(S, M.xb, i, bas, i > 0 ? S.bas[i - 1] : null), xh = A.pas(S, M.xh, i, haut, i > 0 ? S.haut[i - 1] : null);
  const hausse = xb && gt(bas, front) && gt(bas, haut), baisse = xh && gt(haut, front) && gt(haut, bas);
  if (hausse) e.o.plotchar(i, { position: 'absolute', y: bas * 1.2, caractere: 'X', couleur: e.cH, taille: 'tiny' });
  if (baisse) e.o.plotchar(i, { position: 'absolute', y: haut * 1.2, caractere: 'X', couleur: e.cB, taille: 'tiny' });
}

const PALIERS = [[1, 60], [0.8, 55], [0.6, 45], [0.4, 30], [0.2, 25]];

function rendre(p, e, d) {
  const S = e.sorties, n = d.length, r = {};
  for (const [cote, v, c1, c2] of [['Haut', S.haut, p.couleurHausse, p.couleurHausse2], ['Bas', S.bas, p.couleurBaisse, p.couleurBaisse2]]) {
    const monte = (i) => i > 0 && gt(v[i], v[i - 1]), recule = (i) => i > 0 && lt(v[i], v[i - 1]);
    r[`monte${cote}`] = pointsStables(S, `_m${cote}`, n, n - 1, (i) => ({ time: d[i].time, value: monte(i) && !nul(v[i]) ? v[i] : null, color: c1 }));
    PALIERS.forEach(([f, t], k) => {
      const c = transparence(c2, 20 + t);
      r[`recul${cote}${k}`] = pointsStables(S, `_r${cote}${k}`, n, n - 1, (i) => ({ time: d[i].time, value: recule(i) && !nul(v[i]) ? v[i] * f : null, color: c }));
    });
    const k = `_lv${cote}`, lv = S[k] || (S[k] = []), cl = transparence(c1, 20), lc = S[`_lc${cote}`] || (S[`_lc${cote}`] = []);
    for (let i = Math.max(0, lv.length - 2); i < n; i++) { lv[i] = recule(i) ? v[i] : null; lc[i] = cl; }
    r[`ligne${cote}`] = pointsStables(S, `_l${cote}`, n, n - 2, (j) => pointTrace(d, lv, lc, j));
  }
  r.frontiere = pointsStables(S, '_f', n, n - 2, (j) => pointTrace(d, S.front, null, j));
  r.objets = e.o.resultat();
  return r;
}

const sortiesCote = (cote, nom, c1, c2) => [
  { id: `monte${cote}`, name: `Biais ${nom} en hausse`, type: 'histogram', color: c1 },
  ...PALIERS.map(([f], k) => ({ id: `recul${cote}${k}`, name: `Biais ${nom} en recul (${Math.round(f * 100)} %)`, type: 'histogram', color: c2 })),
  { id: `ligne${cote}`, name: `Biais ${nom} en recul (ligne)`, type: 'line', color: c1, lineWidth: 1 },
];

export default class IndiceBiaisMomentumIndicator {
  static metadata = {
    id: 'indice_biais_momentum',
    name: 'Indice de biais du momentum',
    shortName: 'IBM',
    description: 'indice_biais_momentum',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['momentum', 'biais', 'impulsion', 'ecart-type', 'hull'],
    inputs: INPUTS,
    outputs: [
      ...sortiesCote('Haut', 'haussier', '#00ffbb', 'rgba(0, 132, 97, 0.4)'),
      ...sortiesCote('Bas', 'baissier', '#ff1100', 'rgba(132, 9, 0, 0.4)'),
      { id: 'frontiere', name: 'Frontière d’impulsion', type: 'line', color: GRIS, lineWidth: 1, trace: 'cercles' },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { frontiere: [] };
    const p = this.params;
    return executer(IndiceBiaisMomentumIndicator._memo, JSON.stringify(p), data, {
      creer: () => creer(p),
      etape: (etat, d, i) => etape(p, etat, d, i),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
