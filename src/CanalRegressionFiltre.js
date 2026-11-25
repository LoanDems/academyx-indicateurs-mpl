// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Regression Channel [DW] » © DonovanWall — https://www.tradingview.com/script/xnMdv0lA-Regression-Channel-DW/
// Adaptation : les couleurs se choisissent au selecteur (le script les compose par trois listes R / V / B de six niveaux) ;
// periodes de la fenetre « Intervalle » agregees depuis les bougies du graphique (request.securite, grille UTC). Calcul
// barre par barre (les moyennes du script sont des boucles sur la fenetre).
import { creerObjets } from '../academyscript/objets.js';
import { securite } from '../academyscript/request.js';
import { lireReglages, executer, pointsStables, pointTrace } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const MOYENNES = [
  { label: 'ALMA', value: 'ALMA' }, { label: 'Exponentielle', value: 'EMA' }, { label: 'Simple', value: 'SMA' },
  { label: 'Lissée (RMA)', value: 'RMA' }, { label: 'Pondérée linéaire', value: 'LWMA' }, { label: 'Pondérée par le volume', value: 'VWMA' },
];
const STYLES = [{ label: 'Plein', value: 'Solid' }, { label: 'Pointillé', value: 'Dotted' }, { label: 'Tirets', value: 'Dashed' }];
const P = 'Paramètres';
const ligne = (cle, nom, ep, st, c, c2) => {
  const g = `Ligne ${nom}`;
  return [
    { id: `afficher${cle}`, name: 'Afficher', type: 'boolean', default: true, group: g },
    { id: `epaisseur${cle}`, name: 'Épaisseur', type: 'number', entier: true, default: ep, min: 1, max: 10, step: 1, group: g },
    { id: `style${cle}`, name: 'Style', type: 'select', default: st, options: STYLES, group: g },
    { id: `couleur${cle}`, name: c2 ? 'Pente positive' : 'Couleur', type: 'color', default: c, group: g },
    ...(c2 ? [{ id: `couleur${cle}Baisse`, name: 'Pente négative', type: 'color', default: c2, group: g }] : []),
  ];
};
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'moyenne', name: 'Moyenne de base', type: 'select', default: 'SMA', options: MOYENNES, group: P,
    description: 'Moyenne utilisée pour le centre, l’écart-type et la corrélation de la droite.' },
  { id: 'fenetre', name: 'Fenêtre', type: 'select', default: 'Continuous', options: [{ label: 'Glissante', value: 'Continuous' }, { label: 'Intervalle', value: 'Interval' }], group: P,
    description: 'Glissante : les N dernières barres. Intervalle : les barres depuis le début de la période de l’unité choisie.' },
  { id: 'longueur', name: 'Longueur (fenêtre glissante)', type: 'number', entier: true, default: 200, min: 2, max: 2000, step: 1, group: P },
  { id: 'intervalle', name: 'Unité (fenêtre intervalle)', type: 'timeframe', default: '1D', group: P },
  { id: 'multiple', name: 'Largeur du canal (écarts-types)', type: 'number', default: 1, min: 0, max: 20, step: 0.1, group: P,
    description: 'Multiple de l’écart-type filtré pour les bords (il intervient aussi dans la pente, comme dans le script).' },
  { id: 'prolonger', name: 'Prolonger les lignes à droite', type: 'boolean', default: false, group: 'Lignes' },
  ...ligne('Regression', 'de régression', 4, 'Solid', '#00ff00', '#ff0000'),
  ...ligne('Haute', 'haute', 2, 'Solid', '#00ff00'),
  ...ligne('Q3', 'du 3e quart', 2, 'Dashed', '#00cc00'),
  ...ligne('Q1', 'du 1er quart', 2, 'Dashed', '#cc0000'),
  ...ligne('Basse', 'basse', 2, 'Solid', '#ff0000'),
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const STYLE = { Solid: 'solid', Dotted: 'dotted', Dashed: 'dashed' };

/** filt(y, t, type) du script, barre i : Y = historique de l'argument, O = historique de la sortie, V = volumes. */
function filtre(type, Y, O, V, i, t) {
  const y = Y[i];
  const nzY = (k) => { const v = k >= 0 ? Y[k] : null; return nul(v) ? y : v; };
  if (type === 'EMA') { const pr = i > 0 ? O[i - 1] : null; return nul(pr) ? y : (y - pr) * (2 / (t + 1)) + pr; }
  const sma = () => { let s = 0.0; for (let k = 0; k < t; k++) s = s + nzY(i - k); return s / t; };
  if (type === 'SMA') return sma();
  if (type === 'RMA') { const pr = i > 0 ? O[i - 1] : null; return nul(pr) ? sma() : (pr * (t - 1) + y) / t; }
  if (type === 'LWMA') {
    let num = 0.0, den = 0.0;
    for (let k = 0; k < t; k++) { num = num + (t - k) * nzY(i - k); den = den + (t - k); }
    return num / den;
  }
  if (type === 'ALMA') {
    const m = 0.85 * (t - 1), s = t / 6;
    let ws = 0.0, cw = 0.0;
    for (let k = 0; k < t; k++) { const wt = Math.exp(-Math.pow(k - m, 2) / (2 * Math.pow(s, 2))); ws = ws + wt * nzY(i - (t - 1 - k)); cw = cw + wt; }
    return ws / cw;
  }
  // VWMA : vp = y * volume, sommes des t dernieres valeurs (na -> valeur courante).
  const vp = (k) => (k >= 0 ? Y[k] * V[k] : null), vpI = vp(i), vol = V[i];
  let a = 0.0, b = 0.0;
  for (let k = 0; k < t; k++) { const x = vp(i - k); a = a + (nul(x) ? vpI : x); const w = i - k >= 0 ? V[i - k] : null; b = b + (nul(w) ? vol : w); }
  return a / b;
}

function etape(p, e, d, i, derniere, s) {
  const S = e.sorties, b = d[i], src = choix[p.source](b);
  if (!S.src) Object.assign(S, { src: [], f: [], sq: [], g: [], dev: [], y2: [], couleur: [], vol: [] });
  const per = p.fenetre === 'Interval' ? (e.inter = s.nouvelle[i] ? 1 : e.inter + 1) : p.longueur;
  S.src[i] = src; S.vol[i] = b.volume;
  const f = filtre(p.moyenne, S.src, S.f, S.vol, i, per);
  S.f[i] = f;
  S.sq[i] = Math.pow(src - f, 2);
  const g = filtre(p.moyenne, S.sq, S.g, S.vol, i, per);
  S.g[i] = g;
  const sdev = Math.sqrt(g) * p.multiple;
  // corr(bar_index, y, t) : x_dev constant = round(t / 2), y_dev = y - filt(y).
  const ydev = src - f;
  S.dev[i] = ydev;
  const xd = Math.round(per / 2);
  let xy = 0.0, x2 = 0.0, y2s = 0.0;
  for (let k = 0; k < per; k++) {
    const v0 = i - k >= 0 ? S.dev[i - k] : null, v = nul(v0) ? ydev : v0;
    xy = xy + xd * v; x2 = x2 + Math.pow(xd, 2); y2s = y2s + Math.pow(v, 2);
  }
  const den = Math.sqrt(x2 * y2s), r = den === 0 ? 0 : xy / den;
  const sx = Math.round(per / 2), xMoy = i - sx >= 0 ? i - sx : 0;
  const pente = per === 1 ? 0 : r * (sdev / sx), a = f - pente * xMoy;
  const Y1 = a + pente * (i - (per - 1) >= 0 ? i - (per - 1) : i), Y2 = a + pente * i;
  S.y2[i] = Number.isFinite(Y2) ? Y2 : null;
  S.couleur[i] = src > Y2 && Y2 <= Y1 ? '#008b00' : src > Y2 && Y2 > Y1 ? '#00ff00' : src < Y2 && Y2 >= Y1 ? '#8b0000' : src < Y2 && Y2 < Y1 ? '#ff0000' : '#cccccc';
  if (!derniere || i === 0) return;
  // draw_line : la ligne est refaite a chaque barre (sauf la premiere) ; seule celle de la derniere barre reste.
  const X1 = i - (per - 1) >= 0 ? i - (per - 1) : 0, ext = p.prolonger ? 'right' : 'none';
  const coul = Y2 > Y1 ? p.couleurRegression : Y2 < Y1 ? p.couleurRegressionBaisse : '#cccccc';
  for (const [cle, dy, c] of [['Regression', 0, coul], ['Haute', sdev, p.couleurHaute], ['Q3', sdev / 2, p.couleurQ3], ['Q1', -sdev / 2, p.couleurQ1], ['Basse', -sdev, p.couleurBasse]]) {
    if (!p[`afficher${cle}`]) continue;
    e.o.ligne({ x1: X1, y1: Y1 + dy, x2: i, y2: Y2 + dy, extend: ext, couleur: c, style: STYLE[p[`style${cle}`]], epaisseur: p[`epaisseur${cle}`] });
  }
}

function rendre(e, d) {
  const S = e.sorties, n = d.length, blanc = S._blanc || (S._blanc = []);
  for (let j = Math.max(0, blanc.length - 2); j < n; j++) blanc[j] = '#ffffff';
  return {
    regression: pointsStables(S, '_r', n, n - 2, (j) => pointTrace(d, S.y2, blanc, j)),
    bougies: pointsStables(S, '_b', n, n - 1, (j) => ({ time: d[j].time, value: 1, color: S.couleur[j] })),
    objets: e.o.resultat(),
  };
}

export default class CanalRegressionFiltreIndicator {
  static metadata = {
    id: 'canal_regression_filtre',
    name: 'Canal de régression filtré',
    shortName: 'CRF',
    description: 'canal_regression_filtre',
    version: '1.0.0',
    overlay: true,
    type: 'volatility',
    category: 'Volatility',
    source: 'builtin',
    tags: ['regression', 'canal', 'ecart-type', 'tendance', 'quartiles'],
    inputs: INPUTS,
    outputs: [
      { id: 'regression', name: 'Valeur courante de la régression', type: 'line', color: '#ffffff', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#cccccc', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { regression: [] };
    const p = this.params;
    const pas = ctx && ctx.timeframe && ctx.timeframe.platform;
    return executer(CanalRegressionFiltreIndicator._memo, JSON.stringify([p, pas || '']), data, {
      creer: () => ({ o: creerObjets({ maxLignes: 50 }), sorties: {}, inter: 1 }),
      series: p.fenetre === 'Interval' ? (d) => {
        const deb = securite(d, p.intervalle, (h) => h.map((x) => x.time), { ctx, lookahead: true });
        // newbar(res) : na(t[1]) and not na(t) (premiere barre) ou t[1] < t.
        return { nouvelle: deb.map((t, i) => (i === 0 ? !nul(t) : !nul(t) && (nul(deb[i - 1]) ? t : deb[i - 1]) < t)) };
      } : null,
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, derniere, s),
      rendre: (e, d) => rendre(e, d),
    });
  }
}
