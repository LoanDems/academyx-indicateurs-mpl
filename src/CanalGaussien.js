// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Gaussian Channel [DW] » © DonovanWall — https://www.tradingview.com/script/WpVY7GKW-Gaussian-Channel-DW/
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer, tracer, transparence, remplir, suiteVide } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'hlc3', options: SOURCES, group: P },
  { id: 'poles', name: 'Pôles', type: 'number', entier: true, default: 4, min: 1, max: 9, step: 1, group: P,
    description: 'Nombre de passages du filtre : plus il y en a, plus la courbe est lisse et en retard.' },
  { id: 'periode', name: 'Période d’échantillonnage', type: 'number', entier: true, default: 144, min: 2, max: 1000, step: 1, group: P },
  { id: 'multiple', name: 'Multiple du vrai range filtré', type: 'number', default: 1.414, min: 0, max: 10, step: 0.001, group: P },
  { id: 'retardReduit', name: 'Retard réduit', type: 'boolean', default: false, group: P,
    description: 'Ajoute à la source son écart à la valeur d’il y a (période - 1) / (2 × pôles) barres avant de filtrer.' },
  { id: 'reponseRapide', name: 'Réponse rapide', type: 'boolean', default: false, group: P,
    description: 'Moyenne du filtre à N pôles et du filtre à un pôle.' },
  { id: 'couleurHausse', name: 'Filtre qui monte', type: 'color', default: '#0aff68', group: S },
  { id: 'couleurBaisse', name: 'Filtre qui descend', type: 'color', default: '#ff0a5a', group: S },
];

const M = {
  2: [0, 0, 1, 3, 6, 10, 15, 21, 28, 36], 3: [0, 0, 0, 1, 4, 10, 20, 35, 56, 84], 4: [0, 0, 0, 0, 1, 5, 15, 35, 70, 126],
  5: [0, 0, 0, 0, 0, 1, 6, 21, 56, 126], 6: [0, 0, 0, 0, 0, 0, 1, 7, 28, 84], 7: [0, 0, 0, 0, 0, 0, 0, 1, 8, 36],
  8: [0, 0, 0, 0, 0, 0, 0, 0, 1, 9], 9: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
};
const nz = (v) => (Number.isNaN(v) ? 0 : v);

/** f_filt9x du script : filtre recursif a `i` poles (poids binomiaux), etat propre. */
function filtre(a, s, i) {
  const n = s.length, f = new Float64Array(n), x = 1 - a;
  const h = (b, k) => (b - k >= 0 ? f[b - k] : NaN);
  for (let b = 0; b < n; b++) {
    let v = Math.pow(a, i) * nz(s[b]) + i * x * nz(h(b, 1));
    for (let k = 2; k <= 9; k++) {
      const t = i >= k ? M[k][i] * Math.pow(x, k) * nz(h(b, k)) : 0;
      v = k % 2 === 0 ? v - t : v + t;
    }
    f[b] = v;
  }
  return f;
}

function series(p, d) {
  const n = d.length;
  const choix = {
    close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
    hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
  };
  const src = d.map(choix[p.source]);
  const N = p.poles, per = p.periode;
  const beta = (1 - Math.cos(4 * Math.asin(1) / per)) / (Math.pow(1.414, 2 / N) - 1);
  const alpha = -beta + Math.sqrt(Math.pow(beta, 2) + 2 * beta);
  const lag = Math.trunc((per - 1) / (2 * N));
  const tr = d.map((b, i) => (i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - d[i - 1].close), Math.abs(b.low - d[i - 1].close))));
  const avecRetard = (v) => v.map((x, i) => (p.retardReduit ? (i >= lag ? x + (x - v[i - lag]) : NaN) : x));
  const sd = avecRetard(src), td = avecRetard(tr);
  const fN = filtre(alpha, sd, N), f1 = filtre(alpha, sd, 1);
  const tN = filtre(alpha, td, N), t1 = filtre(alpha, td, 1);
  const filt = new Array(n), haut = new Array(n), bas = new Array(n), coul = new Array(n), bougies = new Array(n);
  for (let i = 0; i < n; i++) {
    filt[i] = p.reponseRapide ? (fN[i] + f1[i]) / 2 : fN[i];
    const ftr = p.reponseRapide ? (tN[i] + t1[i]) / 2 : tN[i];
    haut[i] = filt[i] + ftr * p.multiple;
    bas[i] = filt[i] - ftr * p.multiple;
  }
  for (let i = 0; i < n; i++) {
    const f = filt[i], f_1 = i > 0 ? filt[i - 1] : NaN;
    coul[i] = f > f_1 ? p.couleurHausse : f < f_1 ? p.couleurBaisse : '#cccccc';
    const s = src[i], s1 = i > 0 ? src[i - 1] : NaN;
    bougies[i] = s > s1 && s > f && s < haut[i] ? '#0aff68' : s > s1 && s >= haut[i] ? '#0aff1b' : s <= s1 && s > f ? '#00752d'
      : s < s1 && s < f && s > bas[i] ? '#ff0a5a' : s < s1 && s <= bas[i] ? '#ff0a11' : s >= s1 && s < f ? '#990032' : '#cccccc';
  }
  return { filt, haut, bas, coul, bougies, fond: coul.map((c) => transparence(c, 80)) };
}

function rendre(p, e, d, s) {
  const n = d.length;
  const bougies = new Array(n);
  for (let i = 0; i < n; i++) bougies[i] = { time: d[i].time, value: 1, color: s.bougies[i] };
  return {
    filtre: tracer(d, s.filt, s.coul),
    bandeHaute: tracer(d, s.haut, s.coul),
    bandeBasse: tracer(d, s.bas, s.coul),
    bougies,
    objets: e.o.resultat(),
  };
}

export default class CanalGaussienIndicator {
  static metadata = {
    id: 'canal_gaussien',
    name: 'Canal du filtre gaussien',
    shortName: 'GAUSS',
    description: 'canal_gaussien',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['filtre gaussien', 'ehlers', 'canal', 'vrai range', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'filtre', name: 'Filtre', type: 'line', color: '#0aff68', lineWidth: 3 },
      { id: 'bandeHaute', name: 'Bande haute', type: 'line', color: '#0aff68', lineWidth: 1 },
      { id: 'bandeBasse', name: 'Bande basse', type: 'line', color: '#0aff68', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#0aff68', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { filtre: [] };
    const p = this.params;
    void ctx;
    return executer(CanalGaussienIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets({ maxPolylignes: 500 }), fond: suiteVide() }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => remplir(etat.o, etat.fond, s.haut, s.bas, i, s.fond[i], derniere),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
