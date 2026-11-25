// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Rolling VWAP » © TradingView — https://www.tradingview.com/script/ZU2UUu9T-Rolling-VWAP/
// avec la fonction totalForTimeWhen() de la bibliotheque « ConditionalAverages » version 2 © PineCoders (MPL-2.0).
// Adaptation : le tableau de la periode est pose a la derniere barre (barstate.islastconfirmedhistory) ; pas d'erreur
// d'execution sans volume (les courbes restent vides) ; textes en francais.
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer, tracer, transparence, remplir, suiteVide } from './commun.js';

const SOURCES = [
  { label: 'HLC3', value: 'hlc3' }, { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' },
  { label: 'Plus haut', value: 'high' }, { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'OHLC4', value: 'ohlc4' },
];
const PE = 'Période', EC = 'Écarts-types', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'hlc3', options: SOURCES, group: PE },
  { id: 'periodeFixe', name: 'Période fixe', type: 'boolean', default: false, group: PE,
    description: 'Sinon la période suit l’unité du graphique : 1 h en 1 min, 4 h jusqu’à 5 min, 1 jour jusqu’à 1 h, 3 jours jusqu’à 4 h, 7 jours jusqu’à 12 h, 1 mois jusqu’au jour, 90 jours jusqu’à la semaine, 1 an au-delà.' },
  { id: 'jours', name: 'Jours', type: 'number', entier: true, default: 1, min: 0, max: 3650, step: 1, group: PE, legende: false },
  { id: 'heures', name: 'Heures', type: 'number', entier: true, default: 0, min: 0, max: 23, step: 1, group: PE, legende: false },
  { id: 'minutes', name: 'Minutes', type: 'number', entier: true, default: 0, min: 0, max: 59, step: 1, group: PE, legende: false },
  { id: 'barresMin', name: 'Barres minimales', type: 'number', entier: true, default: 10, min: 0, max: 5000, step: 1, group: PE, legende: false,
    description: 'Nombre de barres toujours gardées dans la moyenne, même hors de la période (évite une fenêtre vide après un trou).' },
  { id: 'ecart1', name: 'Multiplicateur des bandes 1', type: 'number', default: 0, min: 0, max: 20, step: 0.5, group: EC, legende: false,
    description: 'Distance des bandes en écarts-types ; 0 masque les bandes.' },
  { id: 'ecart2', name: 'Multiplicateur des bandes 2', type: 'number', default: 0, min: 0, max: 20, step: 0.5, group: EC, legende: false },
  { id: 'ecart3', name: 'Multiplicateur des bandes 3', type: 'number', default: 0, min: 0, max: 20, step: 0.5, group: EC, legende: false },
  { id: 'couleur1', name: 'Bandes 1', type: 'color', default: '#4caf50', group: S },
  { id: 'couleur2', name: 'Bandes 2', type: 'color', default: '#ffeb3b', group: S },
  { id: 'couleur3', name: 'Bandes 3', type: 'color', default: '#ff5252', group: S },
  { id: 'afficherPeriode', name: 'Afficher la période', type: 'boolean', default: true, group: S },
  { id: 'taillePeriode', name: 'Taille du texte', type: 'select', default: 'small', group: S,
    options: [{ label: 'Très petite', value: 'tiny' }, { label: 'Petite', value: 'small' }, { label: 'Normale', value: 'normal' }, { label: 'Grande', value: 'large' }, { label: 'Très grande', value: 'huge' }, { label: 'Automatique', value: 'auto' }] },
  { id: 'positionVerticale', name: 'Position verticale', type: 'select', default: 'bottom', group: S,
    options: [{ label: 'Haut', value: 'top' }, { label: 'Milieu', value: 'middle' }, { label: 'Bas', value: 'bottom' }] },
  { id: 'positionHorizontale', name: 'Position horizontale', type: 'select', default: 'right', group: S,
    options: [{ label: 'Gauche', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Droite', value: 'right' }] },
  { id: 'fondPeriode', name: 'Fond de la période', type: 'color', default: '#787b86', group: S },
  { id: 'textePeriode', name: 'Texte de la période', type: 'color', default: '#ffffff', group: S },
];
const MIN = 60 * 1000, HEURE = MIN * 60, JOUR = HEURE * 24;
const ORANGE = '#FF9800', VERT = '#4CAF50';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

function pasDuGraphique(data, ctx) {
  const s = ctx && ctx.timeframe && ctx.timeframe.in_seconds;
  if (s > 0) return s;
  const ecarts = [];
  for (let k = Math.max(1, data.length - 200); k < data.length; k++) { const e = data[k].time - data[k - 1].time; if (e > 0) ecarts.push(e); }
  ecarts.sort((a, b) => a - b);
  return ecarts.length ? ecarts[ecarts.length >> 1] : 60;
}

/** timeStep() du script : periode automatique selon l'unite du graphique. */
function periodeAuto(secondes) {
  const ms = secondes * 1000;
  const pas = ms <= MIN ? HEURE : ms <= MIN * 5 ? HEURE * 4 : ms <= HEURE ? JOUR : ms <= HEURE * 4 ? JOUR * 3
    : ms <= HEURE * 12 ? JOUR * 7 : ms <= JOUR ? JOUR * 30.4375 : ms <= JOUR * 7 ? JOUR * 90 : JOUR * 365;
  return Math.trunc(pas);
}

/** tfString() du script. */
function texteDuree(ms) {
  const m = Math.trunc(ms / 1000 / 60), h = m / 60;
  const tm = Math.floor(m % 60), th = Math.floor(h % 24), d = Math.floor(h / 24);
  if (d === 30 && th === 10 && tm === 30) return '1 mois';
  if (d === 7 && th === 0 && tm === 0) return '1 semaine';
  const dS = d > 0 ? `${d} j` : '', hS = th > 0 ? `${th} h` : '', mS = tm > 0 ? `${tm} min` : '';
  return dS + (hS || mS ? ' ' : '') + hS + (mS ? ' ' : '') + mS;
}

/** totalForTimeWhen(source, ms, true, minBars) de PineCoders/ConditionalAverages/2, un accumulateur par appel. */
const accumulateur = () => ({ sources: [], temps: [], total: 0.0 });
function cumuler(a, x, t, ms, minBars) {
  if (!nul(x)) {
    a.sources.push(x); a.temps.push(t); a.total += x;
    while (a.sources.length > Math.max(minBars, 0) && t - a.temps[0] >= ms) { a.total -= a.sources.shift(); a.temps.shift(); }
  }
  return a.sources.length < minBars ? null : a.total;
}

function etape(p, e, d, i, derniere, ms) {
  const b = d[i], x = choix[p.source](b), v = b.volume, t = b.time * 1000, S = e.sorties;
  const sv = cumuler(e.a1, nul(x) || nul(v) ? null : x * v, t, ms, p.barresMin);
  const s = cumuler(e.a2, v, t, ms, p.barresMin);
  const ssv = cumuler(e.a3, nul(x) || nul(v) ? null : v * Math.pow(x, 2), t, ms, p.barresMin);
  let vw = nul(sv) || nul(s) ? null : sv / s;
  if (!Number.isFinite(vw)) vw = null;
  const variance = vw === null || nul(ssv) ? null : Math.max(ssv / s - Math.pow(vw, 2), 0.0);
  const et = variance === null || !Number.isFinite(variance) ? null : Math.sqrt(variance);
  S.vwap[i] = vw;
  for (const k of [1, 2, 3]) {
    const m = p[`ecart${k}`];
    S[`h${k}`][i] = m !== 0 && vw !== null && et !== null ? vw + et * m : null;
    S[`b${k}`][i] = m !== 0 && vw !== null && et !== null ? vw - et * m : null;
    remplir(e.o, e[`f${k}`], S[`h${k}`], S[`b${k}`], i, e.fond, derniere);
  }
  if (derniere && p.afficherPeriode) {
    const tb = e.o.tableau({ position: `${p.positionVerticale}_${p.positionHorizontale}`, colonnes: 1, lignes: 1 });
    tb.cellule(0, 0, { texte: texteDuree(ms), fond: p.fondPeriode, couleurTexte: p.textePeriode, taille: p.taillePeriode });
  }
}

function rendre(p, e, d) {
  const S = e.sorties, n = d.length, plein = (c) => new Array(n).fill(c);
  const r = { vwap: tracer(d, S.vwap, plein(ORANGE)) };
  for (const k of [1, 2, 3]) {
    r[`haut${k}`] = tracer(d, S[`h${k}`], plein(p[`couleur${k}`]));
    r[`bas${k}`] = tracer(d, S[`b${k}`], plein(p[`couleur${k}`]));
  }
  r.objets = e.o.resultat();
  return r;
}

export default class VwapGlissantIndicator {
  static metadata = {
    id: 'vwap_glissant',
    name: 'VWAP glissant',
    shortName: 'RVWAP',
    description: 'vwap_glissant',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['vwap', 'prix moyen', 'volume', 'fenetre glissante', 'bandes'],
    inputs: INPUTS,
    outputs: [
      { id: 'vwap', name: 'VWAP glissant', type: 'line', color: ORANGE, lineWidth: 1 },
      { id: 'haut1', name: 'Bande haute 1', type: 'line', color: '#4caf50', lineWidth: 1 },
      { id: 'bas1', name: 'Bande basse 1', type: 'line', color: '#4caf50', lineWidth: 1 },
      { id: 'haut2', name: 'Bande haute 2', type: 'line', color: '#ffeb3b', lineWidth: 1 },
      { id: 'bas2', name: 'Bande basse 2', type: 'line', color: '#ffeb3b', lineWidth: 1 },
      { id: 'haut3', name: 'Bande haute 3', type: 'line', color: '#ff5252', lineWidth: 1 },
      { id: 'bas3', name: 'Bande basse 3', type: 'line', color: '#ff5252', lineWidth: 1 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { vwap: [] };
    const p = this.params;
    const ms = p.periodeFixe ? p.minutes * MIN + p.heures * HEURE + p.jours * JOUR : periodeAuto(pasDuGraphique(data, ctx));
    return executer(VwapGlissantIndicator._memo, JSON.stringify([p, ms]), data, {
      creer: () => ({
        o: creerObjets({ maxPolylignes: 500 }), a1: accumulateur(), a2: accumulateur(), a3: accumulateur(),
        f1: suiteVide(), f2: suiteVide(), f3: suiteVide(), fond: transparence(VERT, 95),
        sorties: { vwap: [], h1: [], b1: [], h2: [], b2: [], h3: [], b3: [] },
      }),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, ms),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
