// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Specter Trend Cloud [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/x6Ll0NOu-Specter-Trend-Cloud-ChartPrime/
// Adaptation : les losanges (plotshape) deviennent des caracteres ◆ (petit plein + grand estompe) ; le remplissage en degrade
// vertical prend la couleur a mi-hauteur. barstate.isconfirmed : vrai sur les barres closes, sur la derniere selon le
// contexte du graphique. Calcul barre par barre.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, contexte, transparence, milieu, remplir, suiteVide, pointsStables, pointTrace } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const TYPES = [
  { label: 'Simple', value: 'SMA' }, { label: 'Exponentielle', value: 'EMA' }, { label: 'Lissée (RMA)', value: 'SMMA (RMA)' },
  { label: 'Pondérée', value: 'WMA' }, { label: 'Pondérée par le volume', value: 'VWMA' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 25, min: 1, max: 500, step: 1, group: P,
    description: 'Moyenne rapide sur cette longueur, moyenne lente sur le double ; le nuage est décalé d’un ATR 200 du côté opposé à la tendance.' },
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'typeMoyenne', name: 'Type de moyenne', type: 'select', default: 'EMA', options: TYPES, group: P },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#00BCD4', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#FF9800', group: S },
];
const AQUA = '#00BCD4', ORANGE = '#FF9800';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

function machine(S, type, L) {
  if (type === 'SMA') return A.sma(S, L);
  if (type === 'EMA') return A.ema(L);
  if (type === 'SMMA (RMA)') return A.ema(L, { rma: true });
  if (type === 'WMA') return A.wma(S, L);
  return A.vwma(S, L);
}

function creer(p) {
  const S = { p1: [], p2: [], c: [], f: [] };
  return {
    o: creerObjets({ maxLignes: 500, maxPolylignes: 500 }), sorties: S, f: suiteVide(),
    m1: machine(S, p.typeMoyenne, p.longueur), m2: machine(S, p.typeMoyenne, p.longueur + p.longueur), atr: A.ema(200, { rma: true }),
    xH: A.croisement(1), xB: A.croisement(-1), c1: null, trend1: false, indexRetest: 0, lower: null, upper: null,
  };
}

const vivante = (l) => l && !l.__supprime;

function etape(p, e, d, i, derniere, env) {
  const S = e.sorties, o = e.o, b = d[i], src = choix[p.source](b);
  let ma1 = A.pas(S, e.m1, i, src, b.volume), ma2 = A.pas(S, e.m2, i, src, b.volume);
  const tr = e.c1 === null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - e.c1), Math.abs(b.low - e.c1));
  e.c1 = b.close;
  const atr = A.pas(S, e.atr, i, tr);
  const trend = !nul(ma1) && !nul(ma2) && ma1 > ma2;
  const tChange = trend !== e.trend1;
  e.trend1 = trend;
  const T = trend ? p.couleurHausse : p.couleurBaisse;
  const plus = (x) => (nul(x) || nul(atr) ? null : x + atr), moins = (x) => (nul(x) || nul(atr) ? null : x - atr);
  if (trend) { ma1 = moins(ma1); ma2 = moins(ma2); } else { ma1 = plus(ma1); ma2 = plus(ma2); }
  const freq = i - e.indexRetest > 5;
  const confirmee = derniere ? env.derniereConfirmee : true;
  const xH = A.pas(S, e.xH, i, b.low, ma1), xB = A.pas(S, e.xB, i, b.high, ma1);
  const up = xH && !tChange && trend && freq && confirmee;
  const dn = xB && !tChange && !trend && freq && confirmee;
  const b1 = i > 0 ? d[i - 1] : null;
  if (up) { e.lower = null; e.indexRetest = i; e.lower = o.ligne({ x1: i - 1, y1: b1 ? b1.low : null, x2: i, y2: b1 ? b1.low : null }); }
  if (dn) { e.upper = null; e.indexRetest = i; e.upper = o.ligne({ x1: i - 1, y1: b1 ? b1.high : null, x2: i, y2: b1 ? b1.high : null }); }
  if (vivante(e.lower)) { e.lower.x2 = i; e.lower.couleur = AQUA; e.lower.style = 'dotted'; }
  if (vivante(e.upper)) { e.upper.x2 = i; e.upper.couleur = ORANGE; e.upper.style = 'dotted'; }
  if (e.upper && !nul(e.upper.y1) && b.high > e.upper.y1) e.upper = null;
  if (e.lower && !nul(e.lower.y1) && b.low < e.lower.y1) e.lower = null;
  S.p1[i] = tChange ? null : ma1;
  S.p2[i] = tChange ? null : (trend ? moins(ma1) : plus(ma1));
  S.c[i] = T;
  remplir(o, e.f, S.p1, S.p2, i, milieu(transparence(T, 60), transparence(T, 80)), derniere);
  if ((up || dn) && i >= 1) {
    const y = up ? moins(b1.low) : plus(b1.high);
    if (!nul(y)) {
      o.plotchar(i - 1, { position: 'absolute', y, caractere: '◆', couleur: T, taille: 'tiny' });
      o.plotchar(i - 1, { position: 'absolute', y, caractere: '◆', couleur: transparence(T, 70), taille: 'small' });
    }
  }
}

function rendre(e, d) {
  const S = e.sorties, n = d.length;
  return { moyenne: pointsStables(S, '_m', n, n - 2, (j) => pointTrace(d, S.p1, S.c, j)), objets: e.o.resultat() };
}

export default class NuageTendanceRetestsIndicator {
  static metadata = {
    id: 'nuage_tendance_retests',
    name: 'Nuage de tendance et retests',
    shortName: 'NTR',
    description: 'nuage_tendance_retests',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'moyenne', 'atr', 'nuage', 'retest'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenne', name: 'Bord du nuage', type: 'line', color: AQUA, lineWidth: 1 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { moyenne: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NuageTendanceRetestsIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer: () => creer(p),
      etape: (e, d, i, derniere) => etape(p, e, d, i, derniere, env),
      rendre: (e, d) => rendre(e, d),
    });
  }
}
