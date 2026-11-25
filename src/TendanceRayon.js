// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Radius Trend [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/4KIHf36j-Radius-Trend-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { sma } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'pas', name: 'Pas du rayon', type: 'number', default: 0.15, min: 0, max: 10, step: 0.001, group: P,
    description: 'Toutes les 3 barres, la bande avance de ce pas de plus que la fois précédente : sa pente s’accentue tant que la tendance dure.' },
  { id: 'ecart', name: 'Écart de départ', type: 'number', default: 2, min: 0, max: 50, step: 0.1, group: P,
    description: 'Au retournement, la bande repart à ce multiple de l’étendue moyenne des bougies (100 barres) au-delà du plus haut ou du plus bas.' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#54b6d4', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#cf2b2b', group: S },
];
const N = 3, GRIS = '#787B86';
const ajoute = (a, b) => (a === null || b === null ? null : a + b);

function series(p, d, env) {
  const n = d.length;
  const etendue = sma(d.map((b) => Math.abs(b.high - b.low)), 100);
  const distance = etendue.map((v) => (v === null ? null : v * p.ecart));
  const distance1 = etendue.map((v) => (v === null ? null : v * 0.2));
  const bande = new Array(n), tendance = new Array(n), change = new Array(n);
  let band = 0, multi1 = 0, multi2 = 0, prec = null;
  for (let i = 0; i < n; i++) {
    const b = d[i];
    let trend = null;
    if (i === 101) { trend = true; band = b.low * 0.8; }
    if (band !== null && b.close < band) trend = false;
    if (band !== null && b.close > band) trend = true;
    // ta.change(trend) : comparaison avec na fausse
    const ch = trend !== null && prec !== null && trend !== prec;
    if (prec === false && ch) band = distance[i] === null ? null : b.low - distance[i];
    if (prec === true && ch) band = ajoute(b.high, distance[i]);
    if (i % N === 0 && trend === true) {
      multi1 = 0; multi2 += p.pas;
      band = distance1[i] === null || band === null ? null : band + distance1[i] * multi2;
    }
    if (i % N === 0 && trend === false) {
      multi1 += p.pas; multi2 = 0;
      band = distance1[i] === null || band === null ? null : band - distance1[i] * multi1;
    }
    bande[i] = band; tendance[i] = trend; change[i] = ch; prec = trend;
  }
  const moyenne = sma(bande, N);
  const haute = sma(bande.map((v, i) => (v === null || distance[i] === null ? null : v + distance[i] * 0.5)), N);
  const basse = sma(bande.map((v, i) => (v === null || distance[i] === null ? null : v - distance[i] * 0.5)), N);
  const exterieure = new Array(n), couleursExt = new Array(n), centre = new Array(n), fond = new Array(n);
  const prix = sma(d.map((b) => (b.high + b.low) / 2), 20);
  const fg50 = transparence(env.texte, 50);
  for (let i = 0; i < n; i++) {
    const c = tendance[i] === true ? p.couleurHausse : p.couleurBaisse;
    exterieure[i] = tendance[i] === true ? haute[i] : basse[i];
    couleursExt[i] = i % 2 === 0 ? fg50 : null;
    centre[i] = change[i] ? null : moyenne[i];
    fond[i] = milieu(transparence(c, 60), null);
  }
  return { exterieure, couleursExt, centre, prix, fond };
}

export default class TendanceRayonIndicator {
  static metadata = {
    id: 'tendance_rayon',
    name: 'Tendance à rayon progressif',
    shortName: 'RAYON',
    description: 'tendance_rayon',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'bande', 'stop suiveur', 'pente', 'retournement'],
    inputs: INPUTS,
    outputs: [
      { id: 'bandeExterieure', name: 'Bande extérieure', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'bande', name: 'Bande', type: 'line', color: GRIS, lineWidth: 1 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { bandeExterieure: [], bande: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(TendanceRayonIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxPolylignes: 500 }), fond: suiteVide() }),
      series: (d) => series(p, d, env),
      etape: (etat, d, i, derniere, s) => remplir(etat.o, etat.fond, s.centre, s.prix, i, s.fond[i], derniere),
      rendre: (etat, d, s) => ({
        bandeExterieure: tracer(d, s.exterieure, s.couleursExt),
        bande: tracer(d, s.centre, new Array(d.length).fill(GRIS)),
        objets: etat.o.resultat(),
      }),
    });
  }
}
