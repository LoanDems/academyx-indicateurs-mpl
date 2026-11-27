// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Gradient Trend Filter [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/ou0PETsS-Gradient-Trend-Filter-ChartPrime/
// Adaptation : barstate.isconfirmed = barre close (la derniere barre seulement si le graphique la dit close) ; les trois fill()
// changent de couleur a chaque barre (degrade) : un polygone par barre et par fill, 500 au plus (plafond de la plateforme).
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, remplir, suiteVide, extremesGlissants } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 25, min: 1, max: 500, step: 1, group: P,
    description: 'Trois lissages exponentiels successifs de cette longueur (partant de 0 à la première barre).' },
  { id: 'lineWidth', name: 'Épaisseur de la ligne', type: 'number', entier: true, default: 2, min: 1, max: 5, step: 1, group: S },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#22c878', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#c8224e', group: S },
  { id: 'transparence', name: 'Transparence des bandes', type: 'number', entier: true, default: 80, min: 0, max: 100, step: 1, group: S },
];
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

/** noise_filter du script : trois lissages exponentiels amorces a 0 (nz du passe). */
function filtre(src, L) {
  const a = 2 / (L + 1), out = new Array(src.length);
  let f1 = 0, f2 = 0, f3 = 0;
  for (let i = 0; i < src.length; i++) {
    f1 = (a * src[i]) + ((1 - a) * f1);
    f2 = (a * f1) + ((1 - a) * f2);
    f3 = (a * f2) + ((1 - a) * f3);
    out[i] = f3;
  }
  return out;
}

function series(p, d) {
  const n = d.length;
  const base = filtre(d.map(choix[p.source]), p.longueur);
  const val = filtre(d.map((b) => b.high - b.low), p.longueur);
  const k = [0.618 * 2.5, 0.382 * 2, 0.236 * 1.5];
  const hauts = k.map((m) => base.map((b, i) => b + val[i] * m)), bas = k.map((m) => base.map((b, i) => b - val[i] * m));
  const diff = base.map((b, i) => (i >= 2 ? b - base[i - 2] : null));
  const couleurs = new Array(n);
  for (let i = 0; i < n; i++) couleurs[i] = !nul(diff[i]) && diff[i] >= 0 ? p.couleurHausse : p.couleurBaisse;
  // [PERF 2026-11-27] Couleur des bandes calculee a la demande : seule l'etape de la barre i la lit
  // (une fois par barre close, la derniere a chaque tick) ; ta.lowest / ta.highest de 100 barres (na
  // ignores, na si l'historique est trop court) par file monotone (mpl/commun.js), O(n) au lieu de O(n x 100).
  const lo = extremesGlissants(diff, 100, false), hi = extremesGlissants(diff, 100, true);
  const fond = (i) => transparence(degrade(diff[i], lo[i], hi[i], p.couleurBaisse, p.couleurHausse), p.transparence);
  return { base, hauts, bas, diff, couleurs, fond };
}

function etape(p, e, d, i, derniere, s, env) {
  const fond = s.fond(i);
  for (let j = 0; j < 3; j++) remplir(e.o, e.f[j], s.hauts[j], s.bas[j], i, fond, derniere);
  const confirmee = !derniere || env.derniereConfirmee;
  const b = s.diff[i];
  if (!nul(b)) {
    // ta.crossover / ta.crossunder(diff, 0) : derniere barre ou diff existait
    const x = e.precDiff !== null && ((e.precDiff <= 0 && b > 0) || (e.precDiff >= 0 && b < 0));
    if (x && confirmee && i >= 1) e.o.plotchar(i - 1, { position: 'absolute', y: s.base[i - 1], caractere: '◆', couleur: '#FF9800', taille: 'tiny' });
    e.precDiff = b;
  }
}

export default class FiltreTendanceDegradeIndicator {
  static metadata = {
    id: 'filtre_tendance_degrade',
    name: 'Filtre de tendance lissé et bandes en dégradé',
    shortName: 'FILTRE-DEG',
    description: 'filtre_tendance_degrade',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'filtre', 'lissage', 'bandes', 'degrade'],
    inputs: INPUTS,
    outputs: [{ id: 'filtre', name: 'Filtre', type: 'line', color: '#22c878' }],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { filtre: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(FiltreTendanceDegradeIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer: () => ({ o: creerObjets({ maxPolylignes: 500 }), f: [suiteVide(), suiteVide(), suiteVide()], precDiff: null }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => ({ filtre: tracer(d, s.base, s.couleurs), objets: etat.o.resultat() }),
    });
  }
}
