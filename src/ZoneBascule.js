// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Zone Shift [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/8lfE3qMN-Zone-Shift-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { ema as taEma, hma as taHma, sma as taSma } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, TRANSPARENT } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 100, min: 60, max: 200, step: 1, group: P,
    description: 'Moyenne exponentielle de cette longueur et moyenne de Hull de 40 barres de moins ; la zone a la largeur de l’étendue moyenne des bougies sur 200 barres.' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#00E676', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#2962FF', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const sup = (a, b) => !nul(a) && !nul(b) && a > b, inf = (a, b) => !nul(a) && !nul(b) && a < b;

function series(p, d) {
  const close = d.map((b) => b.close);
  const e = taEma(close, p.longueur), h = taHma(close, p.longueur - 40), dist = taSma(d.map((b) => b.high - b.low), 200);
  const mid = e.map((v, i) => (nul(v) || nul(h[i]) ? null : (v + h[i]) / 2));
  return { mid, top: mid.map((m, i) => (nul(m) || nul(dist[i]) ? null : m + dist[i])), bot: mid.map((m, i) => (nul(m) || nul(dist[i]) ? null : m - dist[i])) };
}

const creer = () => ({ o: creerObjets({ maxEtiquettes: 500 }), trend: false, depart: null, retest: 0, sorties: { trend: [], depart: [] } });

function etape(p, e, d, i, derniere, s, env) {
  const b = d[i], b1 = i > 0 ? d[i - 1] : null, S = e.sorties;
  const confirmee = !derniere || env.derniereConfirmee;
  const t1 = i > 0 ? s.top[i - 1] : null, o1 = i > 0 ? s.bot[i - 1] : null;
  if (confirmee) {
    if (sup(b.low, s.top[i]) && b1 && inf(b1.low, t1) && !e.trend) { e.trend = true; e.depart = b.low; }
    if (inf(b.high, s.bot[i]) && b1 && sup(b1.high, o1) && e.trend) { e.trend = false; e.depart = b.high; }
  }
  const col = e.trend ? p.couleurHausse : p.couleurBaisse;
  const ts = e.depart, ts1 = i > 0 ? S.depart[i - 1] : null;
  if (confirmee && b1) {
    if (((sup(b.close, ts) && inf(b1.close, ts1)) || (sup(b.low, ts) && inf(b1.low, ts1))) && e.trend && i - e.retest > 5) {
      e.retest = i;
      e.o.etiquette({ x: i, y: b.low, texte: '⯁', couleur: TRANSPARENT, style: 'label_up', couleurTexte: col });
    }
    if (((sup(b1.close, ts) && inf(b.close, ts1)) || (sup(b1.high, ts) && inf(b.high, ts1))) && !e.trend && i - e.retest > 5) {
      e.retest = i;
      e.o.etiquette({ x: i, y: b.high, texte: '⯁', couleur: TRANSPARENT, style: 'label_down', couleurTexte: col });
    }
  }
  S.trend[i] = e.trend; S.depart[i] = ts;
}

export default class ZoneBasculeIndicator {
  static metadata = {
    id: 'zone_bascule',
    name: 'Zone de bascule de tendance',
    shortName: 'ZONE',
    description: 'zone_bascule',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['zone', 'tendance', 'moyenne exponentielle', 'moyenne de hull', 'retest', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'milieu', name: 'Milieu', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'haut', name: 'Haut de la zone', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'bas', name: 'Bas de la zone', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'depart', name: 'Niveau de départ de la tendance', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00E676', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { milieu: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ZoneBasculeIndicator._memo, JSON.stringify([p, env.texte, env.derniereConfirmee]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => {
        const n = d.length, S = etat.sorties, fg = env.texte;
        const alterne = d.map((_, i) => (i % 2 === 0 ? fg : null)), plein = new Array(n).fill(fg);
        const depart = S.depart.map((v, i) => (i > 0 && !nul(v) && !nul(S.depart[i - 1]) && v !== S.depart[i - 1] ? null : v));
        return {
          milieu: tracer(d, s.mid, alterne),
          haut: tracer(d, s.top, plein),
          bas: tracer(d, s.bot, plein),
          depart: tracer(d, depart, alterne),
          bougies: d.map((b, i) => ({ time: b.time, value: 1, color: S.trend[i] ? p.couleurHausse : p.couleurBaisse })),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
