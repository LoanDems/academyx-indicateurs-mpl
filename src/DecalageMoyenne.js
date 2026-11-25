// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Moving Average Shift [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/aApUyBnk-Moving-Average-Shift-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { sma, ema, rma, wma, vwma } from '../academyscript/ta.js';
import { lireReglages, executer, transparence, milieu, remplir, suiteVide, signaux } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const M = 'Moyenne', O = 'Oscillateur', S = 'Style';
const INPUTS = [
  { id: 'typeMoyenne', name: 'Type de moyenne', type: 'select', default: 'SMA', group: M,
    options: [{ label: 'Simple', value: 'SMA' }, { label: 'Exponentielle', value: 'EMA' }, { label: 'Lissée (RMA)', value: 'SMMA (RMA)' }, { label: 'Pondérée', value: 'WMA' }, { label: 'Pondérée par le volume', value: 'VWMA' }] },
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 40, min: 1, max: 500, step: 1, group: M },
  { id: 'source', name: 'Source', type: 'select', default: 'hl2', options: SOURCES, group: M },
  { id: 'longueurOsc', name: 'Longueur de l’oscillateur', type: 'number', entier: true, default: 15, min: 1, max: 200, step: 1, group: O,
    description: 'Variation, sur ce nombre de barres, de l’écart à la moyenne rapporté à son 99e centile des 1 000 dernières barres, lissée par une moyenne de Hull 10.' },
  { id: 'seuil', name: 'Seuil', type: 'number', default: 0.5, min: 0, max: 5, step: 0.1, group: O },
  { id: 'losanges', name: 'Losanges de retournement', type: 'boolean', default: true, group: O,
    description: '◆ quand l’oscillateur repasse au-dessus (au-dessous) de sa valeur d’il y a 2 barres au-delà du seuil.' },
  { id: 'hausse1', name: 'Hausse qui accélère', type: 'color', default: '#1dd1c2', group: S },
  { id: 'hausse2', name: 'Hausse / prix au-dessus de la moyenne', type: 'color', default: '#17a297', group: S },
  { id: 'baisse1', name: 'Baisse qui accélère', type: 'color', default: '#FDD835', group: S },
  { id: 'baisse2', name: 'Baisse / prix sous la moyenne', type: 'color', default: '#FF9800', group: S },
];

const nul = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function series(p, d) {
  const n = d.length;
  const choix = {
    close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
    hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
  };
  const src = d.map(choix[p.source]);
  const L = p.longueur;
  const ma = p.typeMoyenne === 'SMA' ? sma(src, L) : p.typeMoyenne === 'EMA' ? ema(src, L) : p.typeMoyenne === 'SMMA (RMA)' ? rma(src, L)
    : p.typeMoyenne === 'WMA' ? wma(src, L) : vwma(d, src, L);
  const diff = src.map((v, i) => (ma[i] === null ? null : v - ma[i]));
  const bougies = src.map((v, i) => (ma[i] !== null && v >= ma[i] ? p.hausse2 : p.baisse2));
  return { diff, bougies, seuilHaut: new Array(n).fill(p.seuil), zero: new Array(n).fill(0), seuilBas: new Array(n).fill(-p.seuil) };
}

const CENTILE = 1000;
/** Insertion / retrait dans un tableau trie (recherche binaire). */
function rang(t, v) { let a = 0, b = t.length; while (a < b) { const m = (a + b) >> 1; if (t[m] < v) a = m + 1; else b = m; } return a; }
/** ta.wma sur les `n` dernieres valeurs, na si l'une manque. */
function wmaA(s, i, n) {
  if (i - n + 1 < 0) return null;
  let t = 0;
  for (let k = 0; k < n; k++) { const v = s[i - k]; if (v === null) return null; t += v * (n - k); }
  return t / (n * (n + 1) / 2);
}

function creer() {
  return {
    o: creerObjets({ maxPolylignes: 500 }), fondHaut: suiteVide(), fondBas: suiteVide(),
    fenetre: [], nuls: 0, pa: null, pb: null,
    sorties: { rap: [], chg: [], brut: [], w5: [], w10: [], osc: [], col: [], haut: [], bas: [] },
  };
}

function etape(p, e, d, i, derniere, s) {
  const S = e.sorties, x = s.diff[i];
  // ta.percentile_linear_interpolation(diff, 1000, 99) : fenetre triee tenue a jour
  if (x === null) e.nuls++; else e.fenetre.splice(rang(e.fenetre, x), 0, x);
  if (i >= CENTILE) { const y = s.diff[i - CENTILE]; if (y === null) e.nuls--; else e.fenetre.splice(rang(e.fenetre, y), 1); }
  let perc = null;
  if (i >= CENTILE - 1 && e.nuls === 0) {
    const t = e.fenetre, r = Math.min(Math.max((99 / 100) * CENTILE - 0.5, 0), CENTILE - 1), a = Math.floor(r), b = Math.ceil(r);
    perc = t[a] + (r - a) * (t[b] - t[a]);
  }
  S.rap[i] = x === null || perc === null || perc === 0 ? null : x / perc;
  const k = p.longueurOsc;
  S.chg[i] = S.rap[i] === null || i < k || S.rap[i - k] === null ? null : S.rap[i] - S.rap[i - k];
  S.w5[i] = wmaA(S.chg, i, 5); S.w10[i] = wmaA(S.chg, i, 10);
  S.brut[i] = S.w5[i] === null || S.w10[i] === null ? null : 2 * S.w5[i] - S.w10[i];
  const v = wmaA(S.brut, i, 3), v1 = i > 0 ? S.osc[i - 1] : null;
  S.osc[i] = v;
  S.col[i] = v !== null && v > 0 ? (v1 !== null && v > v1 ? p.hausse1 : p.hausse2) : (v !== null && v1 !== null && v < v1 ? p.baisse1 : p.baisse2);
  // croisement de osc et osc[2] (derniere barre ou les deux sont definis)
  const v2 = i >= 2 ? S.osc[i - 2] : null;
  let xo = false, xu = false;
  if (v !== null && v2 !== null) {
    if (e.pa !== null) { xo = e.pa <= e.pb && v > v2; xu = e.pa >= e.pb && v < v2; }
    e.pa = v; e.pb = v2;
  }
  S.haut[i] = p.losanges && xo && v < -p.seuil;
  S.bas[i] = p.losanges && xu && v > p.seuil;
  const c = S.col[i];
  remplir(e.o, e.fondHaut, s.seuilHaut, s.zero, i, milieu(transparence(c, 70), transparence(c, 100)), derniere);
  remplir(e.o, e.fondBas, s.zero, s.seuilBas, i, milieu(transparence(c, 100), transparence(c, 80)), derniere);
  if (S.haut[i]) e.o.plotchar(i, { position: 'absolute', y: v, caractere: '◆', couleur: p.hausse1, taille: 'tiny' });
  if (S.bas[i]) e.o.plotchar(i, { position: 'absolute', y: v, caractere: '◆', couleur: p.baisse1, taille: 'tiny' });
}

function rendre(p, e, d, s) {
  const n = d.length, S = e.sorties;
  const osc = new Array(n), bougies = new Array(n);
  for (let i = 0; i < n; i++) {
    osc[i] = { time: d[i].time, value: nul(S.osc[i]), color: S.col[i] };
    bougies[i] = { time: d[i].time, value: 1, color: s.bougies[i] };
  }
  return { oscillateur: osc, bougies, hausse: signaux(d, S.haut), baisse: signaux(d, S.bas), objets: e.o.resultat() };
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class DecalageMoyenneIndicator {
  static metadata = {
    id: 'decalage_moyenne',
    name: 'Écart à la moyenne et son oscillateur',
    shortName: 'MA-SHIFT',
    description: 'decalage_moyenne',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['moyenne mobile', 'ecart', 'oscillateur', 'centile', 'hull'],
    inputs: INPUTS,
    outputs: [
      { id: 'oscillateur', name: 'Oscillateur', type: 'histogram', color: '#1dd1c2' },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'hausse', name: 'Retournement à la hausse', type: 'line', hidden: true },
      { id: 'baisse', name: 'Retournement à la baisse', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#17a297', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: [
      alerte('retournement_hausse', 'Retournement à la hausse', 'hausse'),
      alerte('retournement_baisse', 'Retournement à la baisse', 'baisse'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { oscillateur: [] };
    const p = this.params;
    void ctx;
    return executer(DecalageMoyenneIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
