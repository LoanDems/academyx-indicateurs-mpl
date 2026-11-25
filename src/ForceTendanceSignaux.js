// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trend Strength Signals [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/7NIERkQE-Trend-Strength-Signals-AlgoAlpha/
// Adaptation : la jauge (tableau) est posee a la derniere barre ; une graduation hors de la jauge (ecart negatif, ou na)
// n'est pas marquee au lieu de provoquer une erreur d'execution.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, contexte, transparence, degrade, remplir, suiteVide, bit, pointsStables, pointTrace } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'periode', name: 'Période', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: P,
    description: 'Moyenne et écart-type des clôtures ; la tendance change quand la clôture sort de la bande à un écart-type.' },
  { id: 'multiplicateur', name: 'Multiplicateur des objectifs', type: 'number', default: 2.5, min: 0.1, max: 20, step: 0.1, group: P,
    description: 'Bande extérieure, en écarts-types : la clôture qui y rentre marque un objectif (X).' },
  { id: 'nuage', name: 'Afficher le nuage', type: 'boolean', default: true, group: S },
  { id: 'jauge', name: 'Taille de la jauge', type: 'number', entier: true, default: 25, min: 3, max: 100, step: 1, group: S },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;

/** Barre i : machines de pasAPas.js (sma / stdev, croisements), egales bit a bit a ta.js. */
function valeurs(p, e, d, i) {
  const S = e.sorties, M = e.m, x = d[i].close;
  const base = A.pas(S, M.moy, i, x), et = M.moy.et;
  const defini = !nul(base) && !nul(et);
  const haut = defini ? base + et * 1 : null, bas = defini ? base + et * -1 : null;
  const haut1 = defini ? base + et * p.multiplicateur : null, bas1 = defini ? base - et * p.multiplicateur : null;
  if (gt(x, base) && gt(x, haut)) e.tendance = 1;
  if (lt(x, base) && lt(x, bas)) e.tendance = -1;
  const ecart = nul(base) ? null : base - x;
  S.ecart[i] = ecart;
  // ta.highest(basis - src, 200) : na ignores, na tant que l'historique est trop court.
  let hh = null;
  if (i >= 199) for (let k = 0; k < 200; k++) { const v = S.ecart[i - k]; if (!nul(v) && (hh === null || v > hh)) hh = v; }
  let grad = null;
  if (!nul(ecart) && !nul(hh)) { const r = Math.abs(ecart) / hh * 100; grad = Number.isFinite(r) ? r : null; }
  const transp = A.pas(S, M.tr, i, nul(grad) ? null : 100 - Math.min(grad, 40));
  const hausse = A.pas(S, M.xh, i, e.tendance, 0), baisse = A.pas(S, M.xb, i, e.tendance, 0);
  const objH = A.pas(S, M.oh, i, x, bas1), objB = A.pas(S, M.ob, i, x, haut1);
  S.haut[i] = haut; S.bas[i] = bas;
  S.al[i] = ((hausse || baisse) ? 1 : 0) | (hausse ? 2 : 0) | (baisse ? 4 : 0) | ((objH || objB) ? 8 : 0) | (objH ? 16 : 0) | (objB ? 32 : 0);
  return { src: x, base, haut, bas, grad, transp, hausse, baisse, objH, objB };
}

function etape(p, e, d, i, derniere, env) {
  const o = e.o, b = d[i], S = e.sorties, v = valeurs(p, e, d, i);
  S.bougie[i] = gt(v.src, v.haut) ? p.couleurHausse : lt(v.src, v.bas) ? p.couleurBaisse : env.texte;
  if (p.nuage) remplir(o, e.f, S.haut, S.bas, i, nul(v.transp) ? null : transparence(env.texte, v.transp), derniere);
  if (v.hausse) o.etiquette({ x: i, y: b.low, yloc: 'belowbar', texte: '▲', style: 'label_up', couleur: p.couleurHausse, couleurTexte: env.texte });
  if (v.baisse) o.etiquette({ x: i, y: b.high, yloc: 'abovebar', texte: '▼', style: 'label_down', couleur: p.couleurBaisse, couleurTexte: env.texte });
  if (v.objH) o.plotchar(i, { position: 'belowbar', caractere: 'X', couleur: p.couleurHausse, taille: 'tiny' });
  if (v.objB) o.plotchar(i, { position: 'abovebar', caractere: 'X', couleur: p.couleurBaisse, taille: 'tiny' });
  if (derniere) {
    const tc = p.jauge, t = o.tableau({ position: 'middle_right', colonnes: 3, lignes: tc + 1 });
    let y = nul(v.grad) ? null : 1 - v.grad / 100;
    if (y !== null) y = y > 100 ? 100 : y < 0 ? 0 : y;
    const rang = y === null ? null : Math.round(y * tc);
    const c1 = gt(v.src, v.base) ? p.couleurHausse : p.couleurBaisse;
    for (let k = 1; k <= tc; k++) {
      t.cellule(1, k, { texte: '', fond: degrade(k, 1, tc, c1, env.texte) });
      if (rang !== null && rang >= 0 && rang <= tc) t.cellule(1, rang, { texte: '>', fond: null, couleurTexte: '#FFFFFF' });
    }
  }
}

const ALERTES = [
  ['force_bascule', 'Changement de tendance (dans un sens ou dans l’autre)'], ['force_hausse', 'Tendance haussière'], ['force_baisse', 'Tendance baissière'],
  ['force_objectif', 'Objectif (dans un sens ou dans l’autre)'], ['force_objectif_bas', 'Objectif bas (retour dans la bande basse)'], ['force_objectif_haut', 'Objectif haut (retour dans la bande haute)'],
];

export default class ForceTendanceSignauxIndicator {
  static metadata = {
    id: 'force_tendance_signaux',
    name: 'Force de tendance et ses signaux',
    shortName: 'FTS',
    description: 'force_tendance_signaux',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'ecart-type', 'bandes', 'jauge', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'haut', name: 'Bande haute', type: 'line', color: 'rgba(241, 241, 241, 0.2)', lineWidth: 1 },
      { id: 'bas', name: 'Bande basse', type: 'line', color: 'rgba(241, 241, 241, 0.2)', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00ffbb', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { bougies: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ForceTendanceSignauxIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => {
        const S = { bougie: [], ecart: [], haut: [], bas: [], al: [] };
        return {
          o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), f: suiteVide(), sorties: S, tendance: 0,
          m: { moy: A.sma(S, p.periode, { stdev: true }), tr: A.sma(S, 7), xh: A.croisement(1), xb: A.croisement(-1), oh: A.croisement(1), ob: A.croisement(-1) },
        };
      },
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat, d) => {
        const S = etat.sorties, n = d.length, coul = S._coul || (S._coul = []), c80 = transparence(env.texte, 80);
        for (let j = coul.length; j < n; j++) coul[j] = c80;
        const ligne = (cle, v) => (p.nuage ? pointsStables(S, cle, n, n - 2, (j) => pointTrace(d, v, coul, j)) : pointsStables(S, '_vide', n, n - 1, (j) => ({ time: d[j].time, value: null })));
        return {
          haut: ligne('_haut', S.haut),
          bas: ligne('_bas', S.bas),
          bougies: pointsStables(S, '_bougies', n, n - 1, (i) => ({ time: d[i].time, value: S.bougie[i] ? 1 : null, color: S.bougie[i] })),
          signaux: pointsStables(S, '_sig', n, n - 1, (i) => ({ time: d[i].time, value: S.al[i] === 0 ? null : S.al[i] })),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
