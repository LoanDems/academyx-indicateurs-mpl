// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Liquidity Weighted Moving Averages [AlgoAlpha] » © AlgoAlpha X © SUSHIBOI77 — https://www.tradingview.com/script/YVBua1JY-Liquidity-Weighted-Moving-Averages-AlgoAlpha/
// Adaptation : couleurs reglables (le script les fixe) ; le remplissage en degrade vertical (moyenne rapide -> fond du
// graphique) prend la couleur a mi-hauteur, le graphique ne dessinant pas de degrade vertical.
import { creerObjets } from '../academyscript/objets.js';
import { ema, stdev, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide, masque, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueurSeuil', name: 'Longueur du seuil', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: P,
    description: 'Le volume par unité de corps (volume / |clôture - ouverture|) est retenu quand il passe au-dessus de sa moyenne exponentielle + un écart-type sur ce nombre de barres.' },
  { id: 'longueurRapide', name: 'Moyenne rapide', type: 'number', entier: true, default: 50, min: 1, max: 1000, step: 1, group: P,
    description: 'Moyenne exponentielle des clôtures retenues.' },
  { id: 'longueurLente', name: 'Moyenne lente', type: 'number', entier: true, default: 100, min: 1, max: 1000, step: 1, group: P },
  { id: 'couleurHausse', name: 'Rapide au-dessus', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Rapide en dessous', type: 'color', default: '#ff1100', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b;

function series(p, d, env) {
  const n = d.length;
  // volume / |close - open| : division par zero = na (corps nul).
  const liq = d.map((b) => { const r = b.volume / Math.abs(b.close - b.open); return Number.isFinite(r) ? r : null; });
  const m = ema(liq, p.longueurSeuil), e = stdev(liq, p.longueurSeuil);
  const seuil = liq.map((_, i) => (nul(m[i]) || nul(e[i]) ? null : m[i] + e[i]));
  const passe = crossover(liq, seuil);
  // var array.new_float(5) : array.get(_, 0) reste na jusqu'au premier passage, puis vaut la cloture de ce passage.
  const retenue = new Array(n);
  let dernier = null;
  for (let i = 0; i < n; i++) { if (passe[i]) dernier = d[i].close; retenue[i] = dernier; }
  const rapide = ema(retenue, p.longueurRapide), lente = ema(retenue, p.longueurLente);
  const cH = transparence(p.couleurHausse, 50), cB = transparence(p.couleurBaisse, 50), fondBas = transparence(env.fond, 80);
  const couleur = rapide.map((v, i) => (gt(v, lente[i]) ? cH : cB));
  const fH = milieu(cH, fondBas), fB = milieu(cB, fondBas);
  return { rapide, lente, couleur, remp: rapide.map((v, i) => (gt(v, lente[i]) ? fH : fB)), hausse: crossover(rapide, lente), baisse: crossunder(rapide, lente) };
}

const ALERTES = [['moyennes_liquidite_hausse', 'Moyenne rapide au-dessus de la lente'], ['moyennes_liquidite_baisse', 'Moyenne rapide sous la lente']];

export default class MoyennesLiquiditeIndicator {
  static metadata = {
    id: 'moyennes_liquidite',
    name: 'Moyennes des clôtures à forte liquidité',
    shortName: 'MCL',
    description: 'moyennes_liquidite',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['moyenne', 'volume', 'liquidite', 'croisement', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'rapide', name: 'Moyenne rapide', type: 'line', color: 'rgba(0, 255, 187, 0.5)', lineWidth: 1 },
      { id: 'lente', name: 'Moyenne lente', type: 'line', color: 'rgba(0, 255, 187, 0.5)', lineWidth: 1 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { rapide: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(MoyennesLiquiditeIndicator._memo, JSON.stringify([p, env.fond]), data, {
      creer: () => ({ o: creerObjets({ maxPolylignes: 500 }), f: suiteVide() }),
      series: (d) => series(p, d, env),
      etape: (e, d, i, derniere, s) => remplir(e.o, e.f, s.rapide, s.lente, i, s.remp[i], derniere),
      rendre: (e, d, s) => ({ rapide: tracer(d, s.rapide, s.couleur), lente: tracer(d, s.lente, s.couleur), signaux: masque(d, [s.hausse, s.baisse]), objets: e.o.resultat() }),
    });
  }
}
