// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Stochastic Z-Score [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/1k7HqCpx-Stochastic-Z-Score-AlgoAlpha/
// Adaptation : les deux etiquettes que le script pose aussi sur le graphique des prix (plotshape force_overlay) ne sont pas
// dessinees ; les memes signaux restent dans le panneau (triangles ▲ ▼).
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, milieu, remplir, suiteVide, masque, bit } from './commun.js';

const SOURCES = [
  { label: 'HLC3', value: 'hlc3' }, { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' },
  { label: 'Plus haut', value: 'high' }, { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'hlc3', options: SOURCES, group: P },
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 21, min: 2, max: 500, step: 1, group: P,
    description: 'Fenêtre de la moyenne, de l’écart-type, du stochastique et des lissages.' },
  { id: 'histogramme', name: 'Afficher le z-score brut', type: 'boolean', default: false, group: S },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;
const nmax = (a, b) => (nul(a) || nul(b) ? null : Math.max(a, b)), nmin = (a, b) => (nul(a) || nul(b) ? null : Math.min(a, b));

/** Machines barre par barre (pasAPas.js, egales bit a bit a ta.js) : sma / stdev, stoch, hma, alma, croisements. */
function creer(p) {
  const S = { z: [], s: [], s1: [], ltm: [], zero: [], deux: [], moinsDeux: [], ext: [], moinsExt: [], croise: [], hausse: [], baisseF: [], zeroH: [], zeroB: [], ltmH: [], ltmB: [] };
  for (const k of COULEURS) S[k] = [];
  const L = p.longueur;
  return {
    o: creerObjets({ maxPolylignes: 500 }), sorties: S, f1: suiteVide(), f2: suiteVide(), f3: suiteVide(), f4: suiteVide(),
    m: { moy: A.sma(S, L, { stdev: true }), st: A.stoch(S, L), h: A.hma(S, L), al: A.alma(S, L, 0, 0.1),
      x: A.croisement(0), xh: A.croisement(1), xb: A.croisement(-1), zh: A.croisement(1), zb: A.croisement(-1), lh: A.croisement(1), lb: A.croisement(-1) },
  };
}

/** Une barre du script (series numeriques et conditions). */
function calculer(p, e, d, i) {
  const S = e.sorties, M = e.m, x = choix[p.source](d[i]);
  const base = A.pas(S, M.moy, i, x), et = M.moy.et;
  const z = nul(base) || nul(et) || et === 0 ? null : (x - base) / et;
  const st = A.pas(S, M.st, i, z);
  const v = A.pas(S, M.h, i, nul(st) ? null : st / 25 - 2), l = A.pas(S, M.al, i, z), v1 = i > 0 ? S.s[i - 1] : null;
  S.z[i] = z; S.s[i] = v; S.s1[i] = v1; S.ltm[i] = l;
  S.zero[i] = 0; S.deux[i] = 2; S.moinsDeux[i] = -2; S.ext[i] = 2.5; S.moinsExt[i] = -2.5;
  S.croise[i] = A.pas(S, M.x, i, v, v1);
  const monte = A.pas(S, M.xh, i, v, v1), baisse = A.pas(S, M.xb, i, v, v1);
  S.hausse[i] = monte && gt(l, 0) && lt(v1, -2);
  S.baisseF[i] = baisse && lt(l, 0) && gt(v1, 2);
  S.zeroH[i] = A.pas(S, M.zh, i, v, 0); S.zeroB[i] = A.pas(S, M.zb, i, v, 0); S.ltmH[i] = A.pas(S, M.lh, i, l, 0); S.ltmB[i] = A.pas(S, M.lb, i, l, 0);
}

const COULEURS = ['cz', 'cs', 'cHaut', 'cBas', 'cHautExt', 'cBasExt', 'fHaut', 'fBas', 'fOsc', 'fLtm'];

/** Couleurs de la barre i, ecrites une fois par barre close (la barre en cours a chaque tick). */
function couleurs(p, C, s, i, env) {
  const z = s.z[i], v = s.s[i], monte = gt(v, s.s1[i]), l = s.ltm[i];
  C.cz[i] = transparence(degrade(z, -2, 2, p.couleurBaisse, p.couleurHausse), 70);
  C.cs[i] = transparence(GRIS, monte ? 0 : 50);
  C.cHaut[i] = transparence(degrade(nmax(0, v), 0, 2, GRIS, p.couleurBaisse), 70);
  C.cBas[i] = transparence(degrade(nmin(0, v), -2, 0, p.couleurHausse, GRIS), 70);
  C.cHautExt[i] = degrade(nmax(0, v), 0, 2.5, GRIS, p.couleurBaisse);
  C.cBasExt[i] = degrade(nmin(0, v), -2.5, 0, p.couleurHausse, GRIS);
  // fill(u1, u, 2.5, 2, c50, c100) et fill(d, d1, -2, -2.5, c100, c50) : couleur a mi-hauteur du degrade.
  const gH = degrade(nmax(0, v), 0, 2, env.fond, p.couleurBaisse), gB = degrade(nmin(0, v), -2, 0, p.couleurHausse, env.fond);
  C.fHaut[i] = milieu(transparence(gH, 50), transparence(gH, 100));
  C.fBas[i] = milieu(transparence(gB, 100), transparence(gB, 50));
  C.fOsc[i] = transparence(GRIS, monte ? 20 : 70);
  const c = gt(l, 0) ? p.couleurHausse : p.couleurBaisse;
  C.fLtm[i] = milieu(transparence(c, 70), transparence(c, 90));
}

function etape(p, e, d, i, derniere, env) {
  calculer(p, e, d, i);
  const o = e.o, C = e.sorties, s = C;
  couleurs(p, C, s, i, env);
  remplir(o, e.f1, s.ext, s.deux, i, C.fHaut[i], derniere);
  remplir(o, e.f2, s.moinsDeux, s.moinsExt, i, C.fBas[i], derniere);
  remplir(o, e.f3, s.s, s.s1, i, C.fOsc[i], derniere);
  remplir(o, e.f4, s.ltm, s.zero, i, C.fLtm[i], derniere);
  if (s.croise[i] && !nul(s.s1[i])) o.plotchar(i, { position: 'absolute', y: s.s1[i], caractere: '●', couleur: env.texte, taille: 'tiny' });
  if (s.hausse[i]) o.plotchar(i, { position: 'absolute', y: -3, caractere: '▲', couleur: p.couleurHausse, taille: 'tiny' });
  if (s.baisseF[i]) o.plotchar(i, { position: 'absolute', y: 3, caractere: '▼', couleur: p.couleurBaisse, taille: 'tiny' });
}

function rendre(p, e, d) {
  const C = e.sorties, s = C, vide = d.map((b) => ({ time: b.time, value: null }));
  return {
    zscore: p.histogramme ? d.map((b, i) => ({ time: b.time, value: nul(s.z[i]) ? null : s.z[i], color: C.cz[i] })) : vide,
    oscillateur: tracer(d, s.s, C.cs),
    haut: tracer(d, s.deux, C.cHaut),
    bas: tracer(d, s.moinsDeux, C.cBas),
    hautExterieur: tracer(d, s.ext, C.cHautExt),
    basExterieur: tracer(d, s.moinsExt, C.cBasExt),
    // alertcondition() : un bit par condition, dans l'ordre de ALERTES.
    signaux: masque(d, [s.croise, s.hausse, s.baisseF, s.zeroH, s.zeroB, s.ltmH, s.ltmB, s.s.map((v) => gt(v, 2.5)), s.s.map((v) => lt(v, -2.5))]),
    objets: e.o.resultat(),
  };
}

const ALERTES = ['bascule', 'retournement_hausse', 'retournement_baisse', 'zero_hausse', 'zero_baisse', 'fond_hausse', 'fond_baisse', 'surachat', 'survente'];

export default class ZscoreStochastiqueIndicator {
  static metadata = {
    id: 'zscore_stochastique',
    name: 'Z-score stochastique',
    shortName: 'Z-STOCH',
    description: 'zscore_stochastique',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['z-score', 'stochastique', 'oscillateur', 'retournement', 'momentum'],
    inputs: INPUTS,
    outputs: [
      { id: 'oscillateur', name: 'Oscillateur lissé', type: 'line', color: '#787B86', lineWidth: 3 },
      { id: 'zscore', name: 'Z-score brut', type: 'histogram', color: 'rgba(0, 255, 187, 0.3)' },
      { id: 'haut', name: 'Seuil 2', type: 'line', color: 'rgba(120, 123, 134, 0.3)', lineWidth: 3 },
      { id: 'bas', name: 'Seuil -2', type: 'line', color: 'rgba(120, 123, 134, 0.3)', lineWidth: 3 },
      { id: 'hautExterieur', name: 'Seuil 2,5', type: 'line', color: '#787B86', lineWidth: 3 },
      { id: 'basExterieur', name: 'Seuil -2,5', type: 'line', color: '#787B86', lineWidth: 3 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: [
      'Changement de sens de l’oscillateur', 'Retournement à la hausse', 'Retournement à la baisse', 'Oscillateur au-dessus de zéro',
      'Oscillateur sous zéro', 'Élan de fond haussier', 'Élan de fond baissier', 'Oscillateur au-dessus de 2,5', 'Oscillateur sous -2,5',
    ].map((title, k) => ({ id: ALERTES[k], title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { oscillateur: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ZscoreStochastiqueIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer: () => creer(p),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
