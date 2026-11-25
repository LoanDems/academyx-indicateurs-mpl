// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Triple Smoothed Signals [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/FoMINXVf-Triple-Smoothed-Signals-AlgoAlpha/
// Adaptation : aucune (les quatre plot() du script sont masques, display.none : seuls les remplissages et les signaux sont dessines ;
// la courbe lissee et son signal restent des sorties cachees, comme dans la fenetre de donnees de TradingView).
import { creerObjets } from '../academyscript/objets.js';
import { sma, ema, rma, wma, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, remplir, suiteVide, masque, bit } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const MOYENNES = [
  { label: 'Exponentielle', value: 'EMA' }, { label: 'Simple', value: 'SMA' }, { label: 'Lissée (RMA)', value: 'RMA' }, { label: 'Pondérée', value: 'WMA' },
];
const M = 'Moyennes', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur du lissage', type: 'number', entier: true, default: 7, min: 1, max: 500, step: 1, group: M,
    description: 'Longueur de chacune des trois moyennes successives.' },
  { id: 'longueurSignal', name: 'Longueur du signal', type: 'number', entier: true, default: 12, min: 1, max: 500, step: 1, group: M,
    description: 'Moyenne de la courbe triplement lissée qui sert de ligne de signal.' },
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: M },
  { id: 'typeMoyenne', name: 'Type des trois lissages', type: 'select', default: 'EMA', options: MOYENNES, group: M },
  { id: 'typeSignal', name: 'Type du signal', type: 'select', default: 'EMA', options: MOYENNES, group: M },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#ffc800', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff0077', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const moyenne = (t, x, L) => (t === 'SMA' ? sma(x, L) : t === 'EMA' ? ema(x, L) : t === 'RMA' ? rma(x, L) : wma(x, L));

/** ta.highest / ta.lowest de `L` barres : les na sont ignores, na si tous le sont ou si l'historique est trop court. */
function extremes(v, L, haut) {
  const out = new Array(v.length).fill(null);
  for (let i = L - 1; i < v.length; i++) {
    let m = null;
    for (let k = 0; k < L; k++) { const x = v[i - k]; if (!nul(x) && (m === null || (haut ? x > m : x < m))) m = x; }
    out[i] = m;
  }
  return out;
}

function series(p, d) {
  const src = d.map(choix[p.source]), L = p.longueur;
  const v1 = moyenne(p.typeMoyenne, moyenne(p.typeMoyenne, moyenne(p.typeMoyenne, src, L), L), L);
  const v2 = moyenne(p.typeSignal, v1, p.longueurSignal);
  const dist = v1.map((x, i) => (nul(x) || nul(v2[i]) ? null : v2[i] - x));
  const dh = extremes(dist, 70, true), dl = extremes(dist, 70, false);
  const ndist = dist.map((x, i) => {
    if (nul(x) || nul(dh[i]) || nul(dl[i])) return null;
    const r = (x - dl[i]) / (dh[i] - dl[i]);
    return Number.isFinite(r) ? r : null;
  });
  const mid = d.map((b) => (b.open + b.close) / 2);
  const proche = v1.map((x, i) => (!nul(v2[i]) && !nul(x) && Math.abs(v2[i] - mid[i]) < Math.abs(x - mid[i]) ? v2[i] : x));
  return {
    v1, v2, ndist, mid, proche, h: extremes(v1, 7, true), l: extremes(v1, 7, false),
    hausse: crossunder(v2, v1), baisse: crossover(v2, v1),
  };
}

function etape(p, e, d, i, derniere, s) {
  const o = e.o;
  remplir(o, e.f1, s.proche, s.mid, i, e.gris, derniere);
  remplir(o, e.f2, s.v1, s.v2, i, degrade(s.ndist[i], 0, 1, p.couleurHausse, p.couleurBaisse), derniere);
  if (s.hausse[i] && !nul(s.l[i])) o.etiquette({ x: i, y: s.l[i], yloc: 'price', texte: '', style: 'label_up', couleur: p.couleurHausse, taille: 'small' });
  if (s.baisse[i] && !nul(s.h[i])) o.etiquette({ x: i, y: s.h[i], yloc: 'price', texte: '', style: 'label_down', couleur: p.couleurBaisse, taille: 'small' });
}

const ALERTES = [['triple_lissee_hausse', 'Signal haussier (signal sous la courbe lissée)'], ['triple_lissee_baisse', 'Signal baissier (signal au-dessus de la courbe lissée)']];

export default class MoyenneTripleLisseeIndicator {
  static metadata = {
    id: 'moyenne_triple_lissee',
    name: 'Moyenne triplement lissée et son signal',
    shortName: 'MTL',
    description: 'moyenne_triple_lissee',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['moyenne', 'lissage', 'signal', 'croisement', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'lissee', name: 'Moyenne triplement lissée', type: 'line', color: '#ffc800', hidden: true },
      { id: 'signal', name: 'Ligne de signal', type: 'line', color: '#ff0077', hidden: true },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { signaux: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(MoyenneTripleLisseeIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), f1: suiteVide(), f2: suiteVide(), gris: transparence(env.texte, 90) }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d, s) => ({ lissee: tracer(d, s.v1), signal: tracer(d, s.v2), signaux: masque(d, [s.hausse, s.baisse]), objets: etat.o.resultat() }),
    });
  }
}
