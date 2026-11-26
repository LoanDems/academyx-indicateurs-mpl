// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trend Magic Enhanced [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/64xgEdlW-Trend-Magic-Enhanced-AlgoAlpha/
// Adaptation : le degrade vertical du fill() prend la couleur a mi-hauteur (pas de degrade sur le graphique) ; textes en francais.
import { creerObjets } from '../academyscript/objets.js';
import { sma as smaTa, tr, cci } from '../academyscript/ta.js';
import { sma, ema, wma, vwma, croisement, pas } from './pasAPas.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide, masque, bit } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const MOYENNES = [
  { label: 'Simple (SMA)', value: 'SMA' }, { label: 'Exponentielle (EMA)', value: 'EMA' }, { label: 'Lissée (RMA)', value: 'SMMA (RMA)' },
  { label: 'Pondérée (WMA)', value: 'WMA' }, { label: 'Pondérée par le volume (VWMA)', value: 'VWMA' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'periodeCci', name: 'Période du CCI', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: P,
    description: 'CCI positif : la ligne suit le plus bas moins l’écart ATR ; négatif : le plus haut plus l’écart ATR.' },
  { id: 'multipleAtr', name: 'Multiple de l’ATR', type: 'number', default: 2, min: 0, max: 20, step: 0.1, group: P },
  { id: 'periodeAtr', name: 'Période de l’ATR', type: 'number', entier: true, default: 5, min: 1, max: 500, step: 1, group: P,
    description: 'Moyenne simple du vrai range.' },
  { id: 'longueurLissage', name: 'Longueur du lissage', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P },
  { id: 'typeLissage', name: 'Type du lissage', type: 'select', default: 'SMA', options: MOYENNES, group: P },
  { id: 'source', name: 'Source du CCI', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'lisser', name: 'Lisser la ligne', type: 'boolean', default: false, group: P,
    description: 'Remplace la ligne par sa moyenne (le calcul suivant repart de la ligne lissée).' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#ff1100', group: S },
];
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const nz = (v) => (nul(v) ? 0 : v);

function machine(S, type, L) {
  if (type === 'EMA') return ema(L);
  if (type === 'SMMA (RMA)') return ema(L, { rma: true });
  if (type === 'WMA') return wma(S, L);
  if (type === 'VWMA') return vwma(S, L);
  return sma(S, L);
}

function series(p, d) {
  const n = d.length;
  const atrV = smaTa(tr(d, true), p.periodeAtr);
  const cciV = cci(d.map(choix[p.source]), p.periodeCci);
  const H = {}, m = machine(H, p.typeLissage, p.longueurLissage);
  const xo = croisement(1), xu = croisement(-1), x0o = croisement(1), x0u = croisement(-1);
  const ligne = new Array(n), sens = new Array(n), hausse = new Array(n), baisse = new Array(n), chg = new Array(n);
  const milieuPrix = new Array(n), bas21 = new Array(n), haut21 = new Array(n);
  let dir = 0;
  for (let i = 0; i < n; i++) {
    const b = d[i];
    const up = nul(atrV[i]) ? null : b.low - atrV[i] * p.multipleAtr;
    const dn = nul(atrV[i]) ? null : b.high + atrV[i] * p.multipleAtr;
    const prec = nz(i > 0 ? ligne[i - 1] : null);
    let mt;
    if (!nul(cciV[i]) && cciV[i] >= 0) mt = up !== null && up < prec ? prec : up;
    else mt = dn !== null && dn > prec ? prec : dn;
    const lisse = pas(H, m, i, mt, b.volume);
    mt = p.lisser ? lisse : mt;
    ligne[i] = nul(mt) ? null : mt;
    const ancien = dir;
    // ta.crossover / ta.crossunder lisent l'historique des series : evalues a chaque barre.
    const monte = pas(H, xo, i, b.low, ligne[i]), descend = pas(H, xu, i, b.high, ligne[i]);
    if (monte) dir = 1;
    else if (descend) dir = -1;
    sens[i] = dir;
    hausse[i] = pas(H, x0o, i, dir, 0);
    baisse[i] = pas(H, x0u, i, dir, 0);
    chg[i] = i > 0 && dir !== ancien;
    milieuPrix[i] = (b.open + b.close) / 2;
    let l = null, h = null;
    if (i >= 20) for (let k = 0; k < 21; k++) { const x = d[i - k]; if (l === null || x.low < l) l = x.low; if (h === null || x.high > h) h = x.high; }
    bas21[i] = l; haut21[i] = h;
  }
  const couleurs = sens.map((s) => transparence(s > 0 ? p.couleurHausse : p.couleurBaisse, 70));
  const fonds = sens.map((s) => { const c = s > 0 ? p.couleurHausse : p.couleurBaisse; return milieu(transparence(c, 90), transparence(c, 70)); });
  const alertes = [sens.map((s, i) => i > 0 && s === 1 && sens[i - 1] !== 1), sens.map((s, i) => i > 0 && s === -1 && sens[i - 1] !== -1), chg];
  return { ligne, couleurs, fonds, milieuPrix, hausse, baisse, bas21, haut21, alertes };
}

function etape(p, e, d, i, derniere, s, env) {
  remplir(e.o, e.fond, s.milieuPrix, s.ligne, i, s.fonds[i], derniere);
  if (s.hausse[i] && !nul(s.bas21[i])) e.o.etiquette({ x: i, y: s.bas21[i], texte: '▲', style: 'label_up', couleur: p.couleurHausse, couleurTexte: env.texte, taille: 'small' });
  if (s.baisse[i] && !nul(s.haut21[i])) e.o.etiquette({ x: i, y: s.haut21[i], texte: '▼', style: 'label_down', couleur: p.couleurBaisse, couleurTexte: env.texte, taille: 'small' });
}

const ALERTES = [['tendance_haussiere', 'Tendance haussière'], ['tendance_baissiere', 'Tendance baissière'], ['changement_tendance', 'Changement de tendance']];

export default class TendanceCciAtrIndicator {
  static metadata = {
    id: 'tendance_cci_atr',
    name: 'Ligne de tendance CCI et ATR',
    shortName: 'CCI-ATR',
    description: 'tendance_cci_atr',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'cci', 'atr', 'stop suiveur', 'trend magic'],
    inputs: INPUTS,
    outputs: [
      { id: 'ligne', name: 'Ligne de tendance', type: 'line', color: '#00ffbb', lineWidth: 3 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { ligne: [], signaux: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(TendanceCciAtrIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), fond: suiteVide() }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => ({ ligne: tracer(d, s.ligne, s.couleurs), signaux: masque(d, s.alertes), objets: etat.o.resultat() }),
    });
  }
}
