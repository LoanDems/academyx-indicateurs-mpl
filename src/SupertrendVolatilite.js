// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Machine Learning Adaptive SuperTrend [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/CLk71Qgy-Machine-Learning-Adaptive-SuperTrend-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { atr } from '../academyscript/ta.js';
import { format } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, signaux, degrade, transparence, milieu, remplir, suiteVide } from './commun.js';

const STYLE = 'Style';
const INPUTS = [
  { id: 'longueurAtr', name: 'Longueur de l’ATR', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: 'Supertrend' },
  { id: 'facteur', name: 'Facteur', type: 'number', default: 3, min: 0.1, max: 50, step: 0.1, group: 'Supertrend',
    description: 'Écart des bandes : facteur × l’ATR du groupe de volatilité où tombe la barre.' },
  { id: 'apprentissage', name: 'Barres d’apprentissage', type: 'number', entier: true, default: 100, min: 2, max: 500, step: 1, group: 'Regroupement',
    description: 'Les ATR de ces dernières barres sont répartis en trois groupes (forte, moyenne, faible volatilité) par k-moyennes.' },
  { id: 'centreFort', name: 'Départ du groupe fort (centile)', type: 'number', default: 0.75, min: 0, max: 1, step: 0.05, group: 'Regroupement',
    description: 'Position de départ du centre du groupe fort dans la plage des ATR (0,75 = aux trois quarts entre le plus bas et le plus haut).' },
  { id: 'centreMoyen', name: 'Départ du groupe moyen (centile)', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, group: 'Regroupement' },
  { id: 'centreFaible', name: 'Départ du groupe faible (centile)', type: 'number', default: 0.25, min: 0, max: 1, step: 0.05, group: 'Regroupement' },
  { id: 'transparence1', name: 'Transparence du stop', type: 'number', entier: true, default: 70, min: 0, max: 100, step: 1, group: STYLE, legende: false },
  { id: 'transparence2', name: 'Transparence du remplissage', type: 'number', entier: true, default: 95, min: 0, max: 100, step: 1, group: STYLE, legende: false },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#00ffbb', group: STYLE },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#ff1100', group: STYLE },
];
const ITERATIONS_MAX = 1000;
const NIVEAUX = ['3 (forte)', '2 (moyenne)', '1 (faible)'];
const NOMS = ['FORTE', 'MOYENNE', 'FAIBLE'];

function creer() {
  return {
    o: creerObjets({ maxEtiquettes: 500 }),
    sorties: { vol: [], st: [], dir: [], groupe: [], hausse: [], baisse: [], corps: [] },
    fondHausse: suiteVide(), fondBaisse: suiteVide(),
    bas: null, haut: null, centre: null,
  };
}

const extreme = (v, i, n, haut) => {
  if (i - n + 1 < 0) return null;
  let m = null;
  for (let k = i - n + 1; k <= i; k++) if (v[k] !== null && (m === null || (haut ? v[k] > m : v[k] < m))) m = v[k];
  return m;
};
const differe = (a, b) => a !== null && b !== null && a !== b;
const plusPetit = (a, b) => a !== null && b !== null && a < b;

/**
 * k-moyennes a trois centres sur les `n` dernieres volatilites (na exclus) ;
 * sommes de la plus recente a la plus ancienne, ordre des tableaux du script.
 */
function regrouper(vol, i, n, depart) {
  let c0 = depart[0], c1 = depart[1], c2 = depart[2], tailles = [0, 0, 0];
  for (let it = 0; it < ITERATIONS_MAX; it++) {
    let s0 = 0, s1 = 0, s2 = 0, n0 = 0, n1 = 0, n2 = 0;
    for (let k = 0; k < n; k++) {
      const v = vol[i - k];
      if (v === null) continue;
      const d0 = c0 === null ? null : Math.abs(v - c0), d1 = c1 === null ? null : Math.abs(v - c1), d2 = c2 === null ? null : Math.abs(v - c2);
      if (plusPetit(d0, d1) && plusPetit(d0, d2)) { s0 += v; n0++; }
      if (plusPetit(d1, d0) && plusPetit(d1, d2)) { s1 += v; n1++; }
      if (plusPetit(d2, d0) && plusPetit(d2, d1)) { s2 += v; n2++; }
    }
    const m0 = n0 ? s0 / n0 : null, m1 = n1 ? s1 / n1 : null, m2 = n2 ? s2 / n2 : null;
    tailles = [n0, n1, n2];
    const stable = !differe(m0, c0) && !differe(m1, c1) && !differe(m2, c2);
    c0 = m0; c1 = m1; c2 = m2;
    if (stable) break;
  }
  return { centres: [c0, c1, c2], tailles };
}

function etape(p, e, data, i, derniere, s, env) {
  const S = e.sorties;
  const b = data[i];
  const vol = s.atr[i];
  S.vol[i] = vol;
  const haut = extreme(S.vol, i, p.apprentissage, true), bas = extreme(S.vol, i, p.apprentissage, false);
  const place = (q) => (haut === null || bas === null ? null : bas + (haut - bas) * q);
  let centres = [place(p.centreFort), place(p.centreMoyen), place(p.centreFaible)];
  let tailles = [0, 0, 0];
  if (vol !== null && vol > 0 && i >= p.apprentissage - 1) ({ centres, tailles } = regrouper(S.vol, i, p.apprentissage, centres));

  const distances = centres.map((c) => (vol === null || c === null ? null : Math.abs(vol - c)));
  let min = null;
  for (const d of distances) if (d !== null && (min === null || d < min)) min = d;
  const groupe = min === null ? -1 : distances.indexOf(min);
  const centre = groupe === -1 ? null : centres[groupe];
  S.groupe[i] = groupe;

  const hl2 = (b.high + b.low) / 2;
  let bandeHaut = centre === null ? null : hl2 + p.facteur * centre;
  let bandeBas = centre === null ? null : hl2 - p.facteur * centre;
  const basPrec = e.bas === null ? 0 : e.bas, hautPrec = e.haut === null ? 0 : e.haut;
  const c1 = i > 0 ? data[i - 1].close : null;
  bandeBas = (bandeBas !== null && bandeBas > basPrec) || (c1 !== null && c1 < basPrec) ? bandeBas : basPrec;
  bandeHaut = (bandeHaut !== null && bandeHaut < hautPrec) || (c1 !== null && c1 > hautPrec) ? bandeHaut : hautPrec;
  const stPrec = i > 0 ? S.st[i - 1] : null;
  let dir;
  if (e.centre === null) dir = 1;
  else if (stPrec !== null && stPrec === hautPrec) dir = bandeHaut !== null && b.close > bandeHaut ? -1 : 1;
  else dir = bandeBas !== null && b.close < bandeBas ? 1 : -1;
  const st = dir === -1 ? bandeBas : bandeHaut;
  S.st[i] = st;
  S.dir[i] = dir;
  e.bas = bandeBas; e.haut = bandeHaut; e.centre = centre;
  S.hausse[i] = st !== null && b.close > st ? st : null;
  S.baisse[i] = st !== null && b.close < st ? st : null;
  S.corps[i] = i === 0 ? null : (b.open + b.close) / 2;
  remplir(e.o, e.fondHausse, S.corps, S.hausse, i, p.fondHausse, derniere);
  remplir(e.o, e.fondBaisse, S.baisse, S.corps, i, p.fondBaisse, derniere);

  const dirPrec = i > 0 ? S.dir[i - 1] : null;
  if (dirPrec !== null && dir < 0 && dirPrec >= 0 && st !== null) e.o.plotchar(i, { position: 'absolute', y: st, caractere: '▲', couleur: p.couleurHausse, taille: 'small' });
  if (dirPrec !== null && dir > 0 && dirPrec <= 0 && st !== null) e.o.plotchar(i, { position: 'absolute', y: st, caractere: '▼', couleur: p.couleurBaisse, taille: 'small' });

  const couleur = dir > 0 ? p.couleurBaisse : p.couleurHausse;
  e.o.etiquette({
    x: i, y: st === null || s.atr7[i] === null ? null : (dir > 0 ? st + s.atr7[i] : st - s.atr7[i]), texte: String(4 - (groupe + 1)), style: 'none', couleur: null,
    couleurTexte: degrade(groupe + 1, 1, 3, transparence(couleur, 30), transparence(couleur, 90)),
  });

  if (derniere) {
    const t = e.o.tableau({ position: 'top_right', colonnes: 4, lignes: 4, fond: env.fond, couleurBordure: env.texte, epaisseurBordure: 1, couleurCadre: env.texte, epaisseurCadre: 1 });
    const cel = (c, l, texte, couleurTexte = env.texte, fond) => t.cellule(c, l, { texte, couleurTexte, alignH: 'center', ...(fond ? { fond } : {}) });
    cel(0, 0, 'Groupe (niveau de volatilité)');
    cel(1, 0, 'Centre du groupe (ATR)');
    cel(2, 0, 'Taille du groupe (nombre de barres)');
    cel(3, 0, 'Volatilité actuelle');
    const f = (v) => format('{0,number,#.##}', v);
    for (let k = 0; k < 3; k++) {
      cel(0, k + 1, NIVEAUX[k]);
      cel(1, k + 1, f(centres[k]));
      cel(2, k + 1, f(tailles[2 - k]));
      cel(3, k + 1, `${NOMS[k]} (ATR : ${f(vol)})`, env.fond, groupe === k ? env.texte : env.fond);
    }
  }
}

function rendre(p, e, data) {
  const S = e.sorties;
  const n = data.length;
  const vrai = (f) => S.dir.map((d, i) => i > 0 && f(d, S.dir[i - 1]));
  const groupe = (k) => S.groupe.map((g, i) => g === k && (i === 0 || S.groupe[i - 1] !== k));
  return {
    hausse: tracer(data, S.hausse, new Array(n).fill(p.stopHausse)),
    baisse: tracer(data, S.baisse, new Array(n).fill(p.stopBaisse)),
    signalHausse: signaux(data, vrai((d, d1) => d < 0 && d1 >= 0)),
    signalBaisse: signaux(data, vrai((d, d1) => d > 0 && d1 <= 0)),
    volatiliteForte: signaux(data, groupe(0)),
    volatiliteMoyenne: signaux(data, groupe(1)),
    volatiliteFaible: signaux(data, groupe(2)),
    objets: e.o.resultat(),
  };
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class SupertrendVolatiliteIndicator {
  static metadata = {
    id: 'supertrend_volatilite',
    name: 'Supertrend à trois régimes de volatilité',
    shortName: 'ST-VOL',
    description: 'supertrend_volatilite',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['supertrend', 'stop suiveur', 'atr', 'volatilite', 'k-moyennes', 'regroupement'],
    inputs: INPUTS,
    outputs: [
      { id: 'hausse', name: 'Stop haussier', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'baisse', name: 'Stop baissier', type: 'line', color: '#ff1100', lineWidth: 1 },
      { id: 'signalHausse', name: 'Passage haussier', type: 'line', hidden: true },
      { id: 'signalBaisse', name: 'Passage baissier', type: 'line', hidden: true },
      { id: 'volatiliteForte', name: 'Volatilité forte', type: 'line', hidden: true },
      { id: 'volatiliteMoyenne', name: 'Volatilité moyenne', type: 'line', hidden: true },
      { id: 'volatiliteFaible', name: 'Volatilité faible', type: 'line', hidden: true },
    ],
    alertConditions: [
      alerte('passage_haussier', 'Passage en tendance haussière', 'signalHausse'),
      alerte('passage_baissier', 'Passage en tendance baissière', 'signalBaisse'),
      alerte('volatilite_forte', 'Volatilité forte', 'volatiliteForte'),
      alerte('volatilite_moyenne', 'Volatilité moyenne', 'volatiliteMoyenne'),
      alerte('volatilite_faible', 'Volatilité faible', 'volatiliteFaible'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { hausse: [], baisse: [] };
    const r = this.params;
    const stopHausse = transparence(r.couleurHausse, r.transparence1), stopBaisse = transparence(r.couleurBaisse, r.transparence1);
    const p = {
      ...r, stopHausse, stopBaisse,
      fondHausse: milieu(transparence(r.couleurHausse, r.transparence2), stopHausse),
      fondBaisse: milieu(stopBaisse, transparence(r.couleurBaisse, r.transparence2)),
    };
    const env = contexte(data, ctx);
    return executer(SupertrendVolatiliteIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer,
      series: (d) => ({ atr: atr(d, p.longueurAtr), atr7: atr(d, 7) }),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
