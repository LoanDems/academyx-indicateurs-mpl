// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trend Reversal Probability [Algoalpha] » © AlgoAlpha — https://www.tradingview.com/script/7gnQovYe-Trend-Reversal-Probability-Algoalpha/
// Adaptation : textes du tableau en francais ; le degrade vertical du remplissage prend sa couleur a mi-hauteur.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence, degrade, milieu, remplir, suiteVide, bit, pointsStables, pointTrace } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur de l’oscillateur', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: P,
    description: 'Lissage (RMA) des hausses et des baisses de l’oscillateur de moyennes (5 et 34 barres) qui donne le RSI du signal.' },
  { id: 'niveaux', name: 'Niveaux de probabilité', type: 'boolean', default: true, group: S,
    description: 'Durée moyenne entre deux changements de signe et ses écarts-types (14 %, 50 %, 84 %, 98 %, 99 %).' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: S },
];
const GRIS = '#787B86', BLEU = '#2962FF', JAUNE = '#ffe6002c', ORANGE = '#FF9800';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const fini = (v) => typeof v === 'number' && Number.isFinite(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;

/** Approximation de la fonction de repartition normale par la fonction d'erreur (Abramowitz-Stegun), comme le script. */
function cdf(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, pp = 0.3275911;
  const signe = z < 0 ? -1 : 1, x = Math.abs(z) / Math.sqrt(2), t = 1 / (1 + pp * x);
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + signe * erf);
}

/** Valeurs de la barre i, calculees barre par barre (machines de pasAPas.js, egales bit a bit a ta.js). */
function valeurs(e, d, i) {
  const S = e.sorties, M = e.m, b = d[i], hl2 = (b.high + b.low) / 2;
  const c5 = A.pas(S, M.c, i, hl2), l34 = A.pas(S, M.l, i, hl2);
  const ao = nul(c5) || nul(l34) ? null : c5 - l34;
  S.ao[i] = ao;
  const ch = i === 0 || nul(ao) || nul(S.ao[i - 1]) ? null : ao - S.ao[i - 1];
  const h = A.pas(S, M.h, i, nul(ch) ? null : Math.max(ch, 0)), f = A.pas(S, M.f, i, nul(ch) ? null : -Math.min(ch, 0));
  let rsi;
  if (f === 0) rsi = 100 - 50;
  else if (h === 0) rsi = 0 - 50;
  else rsi = nul(h) || nul(f) ? null : (100 - (100 / (1 + h / f))) - 50;
  S.rsi[i] = rsi;
  if (A.pas(S, M.x, i, rsi, 0)) e.dernierCroisement = i;
  const cut = e.dernierCroisement === null ? null : i - e.dernierCroisement;
  S.cut[i] = cut;
  A.pas(S, M.v, i, cut);
  return { rsi, cut, vol: M.v.et };
}

/** array.avg / array.stdev (biaise) d'un tableau d'entiers, na si vide. */
function stats(a) {
  if (a.length === 0) return { moy: null, et: null };
  let s = 0;
  for (const v of a) s += v;
  const moy = s / a.length;
  let q = 0;
  for (const v of a) { const e = v - moy; q += e * e; }
  return { moy, et: Math.sqrt(q / a.length) };
}

function etape(p, e, d, i, derniere, env) {
  const S = e.sorties, o = e.o, { rsi, cut, vol } = valeurs(e, d, i);
  if (cut === 0 && i > 0 && S.cut[i - 1] !== null && cut !== S.cut[i - 1]) { e.durees.unshift(S.cut[i - 1]); e.stats = stats(e.durees); }
  const { moy, et } = e.stats;
  const niv = (k) => (moy === null ? null : moy + et * k);
  S.moy[i] = moy; S.h1[i] = niv(1); S.h2[i] = niv(2); S.h3[i] = niv(3); S.b1[i] = niv(-1);
  S.col[i] = gt(rsi, 0) ? p.couleurHausse : p.couleurBaisse;
  remplir(o, e.f, S.h3, S.b1, i, e.cFond, derniere);
  if (gt(cut, S.h3[i]) && !nul(vol)) o.plotchar(i, { position: 'absolute', y: cut + vol / 2, caractere: '▼', couleur: ORANGE, taille: 'tiny' });
  let prob = null;
  if (cut !== null && moy !== null) { const z = (cut - moy) / et; prob = fini(z) ? cdf(z) : null; }
  S.prob[i] = prob;
  if (derniere) {
    if (p.niveaux) {
      [['14%', S.b1[i]], ['50%', moy], ['84%', S.h1[i]], ['98%', S.h2[i]], ['99%', S.h3[i]]].forEach(([t, y]) => {
        if (!nul(y)) o.etiquette({ x: i, y, yloc: 'price', texte: t, style: 'label_left', couleur: env.texte, couleurTexte: env.fond });
      });
    }
    const tb = o.tableau({ position: 'middle_right', colonnes: 2, lignes: 8, fond: transparence(env.fond, 10), couleurBordure: env.texte, epaisseurBordure: 1, couleurCadre: env.texte, epaisseurCadre: 1 });
    tb.cellule(0, 0, { texte: 'Probabilité de retournement (P)', couleurTexte: env.texte, taille: 'tiny', alignH: 'center' });
    tb.fusionner(0, 0, 1, 0);
    tb.cellule(0, 1, { texte: (prob === null ? 'NaN' : formaterMotif(prob * 100, '#.#')) + '%', couleurTexte: env.texte, taille: 'large', alignH: 'center',
      fond: degrade(prob, 0, 1, transparence(BLEU, 50), JAUNE) });
    tb.fusionner(0, 1, 1, 7);
  }
}

const PALIERS = [[1, 70], [0.8, 65], [0.6, 55], [0.4, 40], [0.2, 35]];
const ALERTES = [
  ['retournement_eleve', 'Probabilité de retournement au-dessus de 84 %'], ['retournement_extreme', 'Probabilité de retournement au-dessus de 98 %'],
  ['retournement_faible', 'Probabilité de retournement sous 14 %'], ['retournement_remise', 'Remise à zéro (changement de signe)'],
];

function rendre(p, e, d) {
  const S = e.sorties, n = d.length, r = {}, gris = S.gris || (S.gris = []);
  for (let j = gris.length; j < n; j++) gris.push(GRIS);
  const ligne = (cle, v) => (p.niveaux ? pointsStables(S, `_${cle}`, n, n - 2, (j) => pointTrace(d, v, gris, j)) : pointsStables(S, '_vide', n, n - 1, (j) => ({ time: d[j].time, value: null })));
  r.moyenne = ligne('moy', S.moy); r.ecartHaut1 = ligne('h1', S.h1); r.ecartHaut2 = ligne('h2', S.h2); r.ecartHaut3 = ligne('h3', S.h3); r.ecartBas1 = ligne('b1', S.b1);
  PALIERS.forEach(([f, t], k) => {
    r[`duree${k}`] = pointsStables(S, `_duree${k}`, n, n - 1, (i) => ({ time: d[i].time, value: S.cut[i] === null ? null : S.cut[i] * f, color: transparence(S.col[i], t) }));
  });
  const pr = S.prob;
  r.signaux = pointsStables(S, '_signaux', n, n - 1, (i) => {
    const m = (gt(pr[i], 0.84) ? 1 : 0) | (gt(pr[i], 0.98) ? 2 : 0) | (lt(pr[i], 0.14) ? 4 : 0) | (S.cut[i] === 0 ? 8 : 0);
    return { time: d[i].time, value: m === 0 ? null : m };
  });
  r.objets = e.o.resultat();
  return r;
}

export default class ProbabiliteRetournementDureeIndicator {
  static metadata = {
    id: 'probabilite_retournement_duree',
    name: 'Probabilité de retournement par la durée du signal',
    shortName: 'PRD',
    description: 'probabilite_retournement_duree',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['retournement', 'probabilite', 'duree', 'ecart-type', 'oscillateur'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenne', name: 'Durée moyenne', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'ecartHaut1', name: 'Moyenne + 1 écart-type', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'ecartHaut2', name: 'Moyenne + 2 écarts-types', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'ecartHaut3', name: 'Moyenne + 3 écarts-types', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'ecartBas1', name: 'Moyenne - 1 écart-type', type: 'line', color: GRIS, lineWidth: 1 },
      ...PALIERS.map(([f], k) => ({ id: `duree${k}`, name: k === 0 ? 'Durée du signal' : `Durée du signal (${Math.round(f * 100)} %)`, type: 'histogram', color: 'rgba(0, 255, 187, 0.3)' })),
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { moyenne: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ProbabiliteRetournementDureeIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer: () => (() => { const S = { moy: [], h1: [], h2: [], h3: [], b1: [], col: [], prob: [], ao: [], rsi: [], cut: [] }; return {
        o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), f: suiteVide(), durees: [], stats: { moy: null, et: null },
        cFond: milieu(JAUNE, transparence(BLEU, 70)),
        sorties: S, dernierCroisement: null,
        m: { c: A.sma(S, 5), l: A.sma(S, 34), h: A.ema(p.longueur, { rma: true }), f: A.ema(p.longueur, { rma: true }), x: A.croisement(0), v: A.sma(S, 100, { stdev: true }) },
      }; })(),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
