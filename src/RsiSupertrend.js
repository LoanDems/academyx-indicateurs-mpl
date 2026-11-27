// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Supertrended RSI [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/tjP35RG5-Supertrended-RSI-AlgoAlpha/
// Adaptation : la ligne du RSI, entierement transparente dans le script, n'est pas une sortie (elle borde les remplissages).
import { creerObjets } from '../academyscript/objets.js';
import { rsi, hma, sma, ema, rma, wma, vwma, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, milieu, remplir, suiteVide, masque, bit, extremesGlissants } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const MOYENNES = [
  { label: 'Simple', value: 'SMA' }, { label: 'Hull', value: 'HMA' }, { label: 'Exponentielle', value: 'EMA' },
  { label: 'Lissée (RMA)', value: 'RMA' }, { label: 'Pondérée', value: 'WMA' }, { label: 'Pondérée par le volume', value: 'VWMA' },
];
const R = 'RSI', M = 'Moyenne du RSI', T = 'Supertrend', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur du RSI', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: R },
  { id: 'lissage', name: 'Longueur du lissage', type: 'number', entier: true, default: 21, min: 2, max: 500, step: 1, group: R,
    description: 'Moyenne de Hull appliquée au RSI quand « Lisser le RSI » est coché.' },
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: R },
  { id: 'lisser', name: 'Lisser le RSI', type: 'boolean', default: false, group: R },
  { id: 'longueurMoyenne', name: 'Longueur de la moyenne', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: M },
  { id: 'typeMoyenne', name: 'Type de moyenne', type: 'select', default: 'HMA', options: MOYENNES, group: M },
  { id: 'facteur', name: 'Facteur', type: 'number', default: 0.8, min: 0.1, max: 20, step: 0.1, group: T,
    description: 'Écart des bandes du Supertrend en multiples de la plage moyenne du RSI.' },
  { id: 'longueurAtr', name: 'Longueur de la plage moyenne', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: T },
  { id: 'afficherMoyenne', name: 'Afficher la moyenne du RSI', type: 'boolean', default: true, group: S },
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
const nz = (v) => (nul(v) ? 0 : v);

/** ta.highest / ta.lowest de `length` barres sur une serie a na : les na sont ignores, na si tous le sont. */
const extremes = extremesGlissants; // [PERF 2026-11-27] file monotone, meme resultat (cf. commun.js)

function series(p, d) {
  const n = d.length, src = d.map(choix[p.source]);
  const brut = rsi(src, p.longueur);
  const r = p.lisser ? hma(brut, p.lissage) : brut;
  const ma = p.typeMoyenne === 'SMA' ? sma(r, p.longueurMoyenne) : p.typeMoyenne === 'HMA' ? hma(r, p.longueurMoyenne)
    : p.typeMoyenne === 'EMA' ? ema(r, p.longueurMoyenne) : p.typeMoyenne === 'RMA' ? rma(r, p.longueurMoyenne)
      : p.typeMoyenne === 'WMA' ? wma(r, p.longueurMoyenne) : vwma(d, r, p.longueurMoyenne);
  // calculateATR(rsi, atrLength)
  const L = p.longueurAtr, hh = extremes(r, L, true), ll = extremes(r, L, false);
  const tr = r.map((_, i) => {
    if (nul(hh[i]) || nul(ll[i])) return null;
    if (i === 0 || nul(hh[i - 1])) return hh[i] - ll[i];
    const s1 = r[i - 1];
    return nul(s1) ? null : Math.max(hh[i] - ll[i], Math.abs(hh[i] - s1), Math.abs(ll[i] - s1));
  });
  const atr = rma(tr, L);
  // calculateSupertrend(factor, atrPeriod, rsi)
  const st = new Array(n), dir = new Array(n);
  let bas1 = null, haut1 = null, st1 = null;
  for (let i = 0; i < n; i++) {
    const a = atr[i], s = r[i], s1 = i > 0 ? r[i - 1] : null;
    let haut = nul(s) || nul(a) ? null : s + p.facteur * a, bas = nul(s) || nul(a) ? null : s - p.facteur * a;
    const pb = nz(bas1), ph = nz(haut1);
    bas = gt(bas, pb) || lt(s1, pb) ? bas : pb;
    haut = lt(haut, ph) || gt(s1, ph) ? haut : ph;
    let t;
    if (i === 0 || nul(atr[i - 1])) t = 1;
    else if (!nul(st1) && st1 === ph) t = gt(s, haut) ? -1 : 1;
    else t = lt(s, bas) ? 1 : -1;
    const v = t === -1 ? bas : haut;
    st[i] = v; dir[i] = t;
    bas1 = bas; haut1 = haut; st1 = v;
  }
  const n70 = new Array(n).fill(70), n30 = new Array(n).fill(30), n50 = new Array(n).fill(50);
  const sb = crossover(st, r), sh = crossunder(st, r);
  return {
    r, ma, st, dir, n70, n30, n50,
    baisse: sb.map((x, i) => x && gt(st[i], 70)), hausse: sh.map((x, i) => x && lt(st[i], 30)),
    alertes: [crossover(r, st), crossunder(r, st)],
  };
}

const COULEURS = ['cSt', 'cHaut', 'cBas', 'fTend', 'fDeg'];

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, C = e.sorties, v = s.r[i], t = s.dir[i];
  C.cSt[i] = t === -1 ? p.couleurHausse : p.couleurBaisse;
  C.cHaut[i] = degrade(v, 50, 70, transparence(GRIS, 70), p.couleurBaisse);
  C.cBas[i] = degrade(v, 30, 50, p.couleurHausse, transparence(GRIS, 70));
  C.fTend[i] = t === 1 ? transparence(p.couleurBaisse, 90) : transparence(p.couleurHausse, 90);
  // fill(st, rsi, rsi, st, color.new(chart.bg_color, 1000), couleur) : degrade, couleur a mi-hauteur.
  C.fDeg[i] = milieu(transparence(env.fond, 1000), t === 1 ? p.couleurBaisse : p.couleurHausse);
  remplir(o, e.f1, s.n70, s.n30, i, e.gris90, derniere);
  remplir(o, e.f2, s.st, s.r, i, C.fTend[i], derniere);
  remplir(o, e.f3, s.st, s.r, i, C.fDeg[i], derniere);
  if (s.baisse[i]) o.etiquette({ x: i, y: 85, yloc: 'price', texte: '', style: 'triangledown', couleur: p.couleurBaisse, taille: 'tiny' });
  if (s.hausse[i]) o.etiquette({ x: i, y: 15, yloc: 'price', texte: '', style: 'triangleup', couleur: p.couleurHausse, taille: 'tiny' });
}

function rendre(p, e, d, s) {
  const C = e.sorties, n = d.length, gris = new Array(n).fill(GRIS);
  return {
    supertrend: tracer(d, s.st, C.cSt),
    surachat: tracer(d, s.n70, C.cHaut),
    survente: tracer(d, s.n30, C.cBas),
    moyenne: p.afficherMoyenne ? tracer(d, s.ma, gris) : d.map((b) => ({ time: b.time, value: null })),
    milieu: tracer(d, s.n50, gris),
    signaux: masque(d, [s.alertes[0], s.alertes[1], s.baisse, s.hausse]),
    objets: e.o.resultat(),
  };
}

const ALERTES = [
  ['rsi_supertrend_haussier', 'RSI au-dessus de son Supertrend'], ['rsi_supertrend_baissier', 'RSI sous son Supertrend'],
  ['retournement_haut', 'Retournement depuis le haut (Supertrend au-dessus de 70)'], ['retournement_bas', 'Retournement depuis le bas (Supertrend sous 30)'],
];

export default class RsiSupertrendIndicator {
  static metadata = {
    id: 'rsi_supertrend',
    name: 'RSI et son Supertrend',
    shortName: 'RSI-ST',
    description: 'rsi_supertrend',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['rsi', 'supertrend', 'tendance', 'surachat', 'survente'],
    inputs: INPUTS,
    outputs: [
      { id: 'supertrend', name: 'Supertrend du RSI', type: 'line', color: '#ff1100', lineWidth: 1 },
      { id: 'surachat', name: 'Niveau 70', type: 'line', color: 'rgba(120, 123, 134, 0.3)', lineWidth: 3 },
      { id: 'survente', name: 'Niveau 30', type: 'line', color: 'rgba(120, 123, 134, 0.3)', lineWidth: 3 },
      { id: 'moyenne', name: 'Moyenne du RSI', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'milieu', name: 'Niveau 50', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { supertrend: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(RsiSupertrendIndicator._memo, JSON.stringify([p, env.fond]), data, {
      creer: () => ({
        o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), sorties: Object.fromEntries(COULEURS.map((k) => [k, []])),
        f1: suiteVide(), f2: suiteVide(), f3: suiteVide(), gris90: transparence(GRIS, 90),
      }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
