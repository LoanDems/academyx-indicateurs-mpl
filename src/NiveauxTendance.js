// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trend Levels [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/bacXsRFN-Trend-Levels-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, degrade, transparence, milieu, remplir, suiteVide } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 30, min: 1, max: 500, step: 1, group: P,
    description: 'Un plus haut des N dernières barres fait passer la tendance à la hausse, un plus bas à la baisse.' },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00E676', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#E040FB', group: S },
];
const GRIS = '#787B86', BLANC = '#FFFFFF';
const QUOTES = ['FDUSD', 'USDT', 'USDC', 'BUSD', 'TUSD', 'USD', 'EUR', 'TRY', 'BRL', 'BTC', 'ETH', 'BNB'];

/** syminfo.basecurrency : le ticker sans sa devise de cotation. */
function deviseBase(ctx) {
  const t = String((ctx && ctx.syminfo && ctx.syminfo.ticker) || '').toUpperCase().replace(/\.P$/, '').replace(/[^A-Z0-9]/g, '');
  for (const q of QUOTES) if (t.length > q.length && t.endsWith(q)) return t.slice(0, -q.length);
  return t;
}

function extremes(d, p) {
  const n = d.length, h = new Array(n).fill(null), l = new Array(n).fill(null);
  for (let i = p.longueur - 1; i < n; i++) {
    let a = -Infinity, b = Infinity;
    for (let k = i - p.longueur + 1; k <= i; k++) { if (d[k].high > a) a = d[k].high; if (d[k].low < b) b = d[k].low; }
    h[i] = a; l[i] = b;
  }
  return { h, l };
}

function creer() {
  return {
    o: creerObjets({ maxEtiquettes: 500, maxLignes: 50, maxPolylignes: 500 }),
    sorties: { h1: [], l1: [], m1: [], delta: [], trend: [] },
    fondHaut: suiteVide(), fondBas: suiteVide(),
    bars: 0, trend: null, up: null, dn: null, h1: null, l1: null, m1: null, runH: null, runL: null,
    eb: null, eh: null, em: null, lh: null, lm: null, lb: null,
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], S = e.sorties;
  if (s.h[i] !== null && s.h[i] === b.high) e.trend = true;
  if (s.l[i] !== null && s.l[i] === b.low) e.trend = false;
  if (e.trend !== null) {
    e.bars += 1;
    const t = (v) => formaterMotif(v, '#.#');
    const eb = o.etiquette({ x: i + 10, y: e.l1, texte: t(e.l1), couleur: p.couleurBaisse, couleurTexte: BLANC, style: 'label_left' });
    const eh = o.etiquette({ x: i + 10, y: e.h1, texte: t(e.h1), couleur: p.couleurHausse, couleurTexte: BLANC, style: 'label_left' });
    const em = o.etiquette({ x: i + 10, y: e.m1, texte: t(e.m1), couleur: GRIS, couleurTexte: BLANC, style: 'label_left' });
    o.supprimer(e.em); o.supprimer(e.eh); o.supprimer(e.eb);
    e.eb = eb; e.eh = eh; e.em = em;
    const lh = o.ligne({ x1: i, y1: e.h1, x2: i + 10, y2: e.h1, couleur: p.couleurHausse });
    const lm = o.ligne({ x1: i, y1: e.m1, x2: i + 10, y2: e.m1, couleur: GRIS, style: 'dashed' });
    const lb = o.ligne({ x1: i, y1: e.l1, x2: i + 10, y2: e.l1, couleur: p.couleurBaisse });
    o.supprimer(e.lh); o.supprimer(e.lb); o.supprimer(e.lm);
    e.lh = lh; e.lm = lm; e.lb = lb;
  }
  const prec = i > 0 ? S.trend[i - 1] : null;
  // ta.change(trend) : comparaison avec na fausse
  if (e.trend !== null && prec !== null && e.trend !== prec) {
    o.supprimer(e.eb); o.supprimer(e.em); o.supprimer(e.eh);
    o.supprimer(e.lh); o.supprimer(e.lb); o.supprimer(e.lm);
    e.bars = 1; e.up = 0; e.dn = 0;
  }
  // ta.highest(bars) / ta.lowest(bars) : bars croit d'une barre par barre depuis sa remise a 1
  if (e.bars === 1) { e.runH = b.high; e.runL = b.low; } else if (e.bars > 1) { e.runH = Math.max(e.runH, b.high); e.runL = Math.min(e.runL, b.low); }
  if (e.bars <= 1) { e.h1 = null; e.l1 = null; e.m1 = null; } else { e.h1 = e.runH; e.l1 = e.runL; e.m1 = (e.h1 + e.l1) / 2; }
  if (e.m1 !== null && b.close > e.m1 && e.up !== null) e.up += 1;
  if (e.m1 !== null && b.close < e.m1 && e.dn !== null) e.dn += 1;
  const total = e.up === null || e.dn === null ? null : e.up + e.dn;
  const delta = total === null || total === 0 ? null : ((e.up - e.dn) / total) * 100;
  S.h1[i] = e.h1; S.l1[i] = e.l1; S.m1[i] = e.m1; S.delta[i] = delta; S.trend[i] = e.trend;
  if (e.trend === true && prec === false) o.etiquette({ x: i, y: b.low, texte: '⇗', couleur: p.couleurHausse, couleurTexte: BLANC, style: 'label_upper_right' });
  if (prec === true && e.trend === false) o.etiquette({ x: i, y: b.high, texte: '⇘', couleur: p.couleurBaisse, couleurTexte: BLANC, style: 'label_lower_right' });
  remplir(o, e.fondHaut, S.m1, S.h1, i, s.fondHaut, derniere);
  remplir(o, e.fondBas, S.m1, S.l1, i, s.fondBas, derniere);
  if (derniere) {
    const c = degrade(delta, -50, 50, p.couleurBaisse, p.couleurHausse);
    const t = o.tableau({ position: 'top_right', colonnes: 10, lignes: 10 });
    t.cellule(0, 0, { texte: 'Symbole : ', couleurTexte: env.texte });
    t.cellule(1, 0, { texte: env.base, couleurTexte: c });
    t.cellule(0, 1, { texte: 'Tendance : ', couleurTexte: env.texte });
    t.cellule(1, 1, { texte: delta === null ? 'NaN' : `${formaterMotif(delta, '0.00')}%`, couleurTexte: c });
  }
}

export default class NiveauxTendanceIndicator {
  static metadata = {
    id: 'niveaux_tendance',
    name: 'Niveaux de la tendance en cours',
    shortName: 'NIV-TEND',
    description: 'niveaux_tendance',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['niveaux', 'tendance', 'plus haut', 'plus bas', 'milieu', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'haut', name: 'Plus haut de la tendance', type: 'line', color: '#00E676', lineWidth: 1 },
      { id: 'milieu', name: 'Milieu', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'bas', name: 'Plus bas de la tendance', type: 'line', color: '#E040FB', lineWidth: 1 },
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
    if (!Array.isArray(data) || data.length === 0) return { haut: [], milieu: [], bas: [] };
    const p = this.params;
    const env = { ...contexte(data, ctx), base: deviseBase(ctx) };
    const fondHaut = milieu(transparence(p.couleurHausse, 90), null), fondBas = milieu(null, transparence(p.couleurBaisse, 90));
    return executer(NiveauxTendanceIndicator._memo, JSON.stringify([p, env.texte, env.base]), data, {
      creer,
      series: (d) => ({ ...extremes(d, p), fondHaut, fondBas }),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => {
        const S = etat.sorties, n = d.length;
        const bougies = new Array(n);
        for (let i = 0; i < n; i++) {
          const c = degrade(S.delta[i], -50, 50, p.couleurBaisse, p.couleurHausse);
          bougies[i] = { time: d[i].time, value: c ? 1 : null, color: c };
        }
        return {
          haut: tracer(d, S.h1, new Array(n).fill(p.couleurHausse)),
          milieu: tracer(d, S.m1, S.m1.map((_, i) => (i % 3 === 0 ? GRIS : null))),
          bas: tracer(d, S.l1, new Array(n).fill(p.couleurBaisse)),
          bougies,
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
