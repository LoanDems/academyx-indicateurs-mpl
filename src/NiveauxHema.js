// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « HEMA Trend Levels [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/WClHCU5Q-HEMA-Trend-Levels-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { ema, atr, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide, signaux } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'rapide', name: 'Moyenne rapide', type: 'number', entier: true, default: 20, min: 2, max: 500, step: 1, group: P },
  { id: 'lente', name: 'Moyenne lente', type: 'number', entier: true, default: 40, min: 2, max: 500, step: 1, group: P },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const GRIS = '#787B86';

/** Moyenne exponentielle de Hull du script : ema(2 ema(n/2) - ema(n), racine de n). */
function hema(src, n) {
  const moitie = Math.max(1, Math.round(n / 2)), racine = Math.max(1, Math.round(Math.sqrt(n)));
  const a = ema(src, moitie), b = ema(src, n);
  return ema(a.map((v, i) => (v === null || b[i] === null ? null : 2 * v - b[i])), racine);
}

function series(p, d, env) {
  const n = d.length, c = d.map((b) => b.close);
  const h1 = hema(c, p.rapide), h2 = hema(c, p.lente);
  const xo = crossover(h1, h2), xu = crossunder(h1, h2);
  const a = atr(d, 14);
  const haut = new Array(n), bas = new Array(n), fond = new Array(n), ligne = new Array(n), bougies = new Array(n);
  const transp = transparence(env.fond, 100);
  const C = {
    fondH: milieu(transp, transparence(p.couleurHausse, 70)), fondB: milieu(transp, transparence(p.couleurBaisse, 70)),
    ligneH: transparence(p.couleurHausse, 70), ligneB: transparence(p.couleurBaisse, 70),
    bH: transparence(p.couleurHausse, 50), bB: transparence(p.couleurBaisse, 50), bG: transparence(GRIS, 50),
  };
  for (let i = 0; i < n; i++) {
    const u = h1[i], v = h2[i];
    const hausse = u !== null && v !== null && u > v;
    haut[i] = u === null || v === null ? null : (hausse ? u : v);
    bas[i] = u === null || v === null ? null : (hausse ? v : u);
    fond[i] = hausse ? C.fondH : C.fondB;
    ligne[i] = hausse ? C.ligneH : C.ligneB;
    const cl = c[i];
    const ok = u !== null && v !== null;
    bougies[i] = ok && cl > u && u > v ? C.bH : ok && cl < u && u < v ? C.bB : ok && ((cl < u && u > v) || (cl > u && u < v)) ? C.bG : null;
  }
  return { h1, h2, xo, xu, vola: a.map((x) => (x === null ? NaN : x / 2)), haut, bas, fond, ligne, bougies };
}

function creer() {
  return { o: creerObjets({ maxBoites: 500, maxEtiquettes: 500 }), fondSuite: suiteVide(), hausses: [], baisses: [], sorties: { testHaut: [], testBas: [] } };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], vola = s.vola[i];
  const nb = (v) => (Number.isFinite(v) ? v : null);
  remplir(o, e.fondSuite, s.haut, s.bas, i, s.fond[i], derniere);
  if (s.xo[i]) e.hausses.unshift(o.boite({ gauche: i, haut: nb(b.low + vola), droite: i + 5, bas: b.low, fond: transparence(p.couleurHausse, 70), couleurBordure: null }));
  else if (s.xu[i]) e.baisses.unshift(o.boite({ gauche: i, haut: nb(b.high - vola), droite: i + 5, bas: b.high, fond: transparence(p.couleurBaisse, 70), couleurBordure: null }));
  let testBas = 0, testHaut = 0;
  if (e.hausses.length > 0) {
    const q = e.hausses[0], t = q.haut;
    if (t !== null && b.low < t && b.high > t && b.open > t && b.close > t) testBas = q.bas;
    q.droite = i;
  }
  if (e.baisses.length > 0) {
    const q = e.baisses[0], t = q.haut;
    if (t !== null && b.high > t && b.low < t && b.open < t && b.close < t) testHaut = q.bas;
    q.droite = i;
  }
  e.sorties.testBas[i] = testBas !== 0; e.sorties.testHaut[i] = testHaut !== 0;
  if (testBas !== 0 && Number.isFinite(testBas - vola)) o.plotchar(i, { position: 'absolute', y: testBas - vola, caractere: '▲', couleur: p.couleurHausse, taille: 'tiny' });
  if (testHaut !== 0 && Number.isFinite(testHaut + vola)) o.plotchar(i, { position: 'absolute', y: testHaut + vola, caractere: '▼', couleur: p.couleurBaisse, taille: 'tiny' });
  if (s.xo[i] && Number.isFinite(vola)) o.etiquette({ x: i, y: b.low - vola * 3, texte: '▲', style: 'label_up', couleur: transparence(p.couleurHausse, 50), couleurTexte: env.texte, taille: 'small' });
  if (s.xu[i] && Number.isFinite(vola)) o.etiquette({ x: i, y: b.high + vola * 3, texte: '▼', style: 'label_down', couleur: transparence(p.couleurBaisse, 50), couleurTexte: env.texte, taille: 'small' });
}

function rendre(p, e, d, s) {
  const n = d.length;
  const bougies = new Array(n);
  for (let i = 0; i < n; i++) bougies[i] = { time: d[i].time, value: s.bougies[i] ? 1 : null, color: s.bougies[i] };
  return {
    rapide: tracer(d, s.h1, s.ligne),
    lente: tracer(d, s.h2, s.ligne),
    bougies,
    hausse: signaux(d, s.xo), baisse: signaux(d, s.xu),
    testHausse: signaux(d, e.sorties.testBas), testBaisse: signaux(d, e.sorties.testHaut),
    objets: e.o.resultat(),
  };
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class NiveauxHemaIndicator {
  static metadata = {
    id: 'niveaux_hema',
    name: 'Niveaux de croisement des moyennes exponentielles de Hull',
    shortName: 'HEMA',
    description: 'niveaux_hema',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['moyenne exponentielle de hull', 'croisement', 'tendance', 'niveaux', 'test'],
    inputs: INPUTS,
    outputs: [
      { id: 'rapide', name: 'Moyenne rapide', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'lente', name: 'Moyenne lente', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'hausse', name: 'Croisement haussier', type: 'line', hidden: true },
      { id: 'baisse', name: 'Croisement baissier', type: 'line', hidden: true },
      { id: 'testHausse', name: 'Test du niveau haussier', type: 'line', hidden: true },
      { id: 'testBaisse', name: 'Test du niveau baissier', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00ffbb', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: [
      alerte('croisement_haussier', 'Croisement haussier', 'hausse'),
      alerte('croisement_baissier', 'Croisement baissier', 'baisse'),
      alerte('test_haussier', 'Test du niveau haussier', 'testHausse'),
      alerte('test_baissier', 'Test du niveau baissier', 'testBaisse'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { rapide: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NiveauxHemaIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer,
      series: (d) => series(p, d, env),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
