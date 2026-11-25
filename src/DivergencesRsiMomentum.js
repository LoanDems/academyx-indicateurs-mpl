// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « RSI Momentum Divergence Zones [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/x3KNfmR3-RSI-Momentum-Divergence-Zones-ChartPrime/
// Adaptation : les zones, niveaux et etiquettes que le script pose sur le graphique des prix (force_overlay) ne sont pas
// dessines ; le panneau garde le RSI du momentum, ses divergences et leurs etiquettes.
import { creerObjets } from '../academyscript/objets.js';
import { rsi as taRsi, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, tracer, degrade, remplir, suiteVide, TRANSPARENT } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur du RSI', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P,
    description: 'RSI du momentum des clôtures (variation sur 10 barres), pas des clôtures elles-mêmes.' },
  { id: 'divergences', name: 'Repérer les divergences', type: 'boolean', default: true, group: P },
  { id: 'couleurBaisse', name: 'Divergence baissière', type: 'color', default: '#ae4ce6', group: S },
  { id: 'couleurHausse', name: 'Divergence haussière', type: 'color', default: '#33c570', group: S },
];
const G = 5, D = 5, MIN = 5, MAX = 50, GRIS = '#787B86', BLANC = '#FFFFFF';

/** Points d'un plot plot.style_line decale de -D : les na sont enjambes, le segment prend la couleur de son point droit. */
function enjambe(d, valeurs, couleurs) {
  const n = d.length, out = new Array(n);
  let suivant = null;
  for (let j = n - 1; j >= 0; j--) {
    const s = j + D;
    const v = s < n ? valeurs[s] : null;
    out[j] = { time: d[j].time, value: v, color: v === null ? TRANSPARENT : (suivant === null ? TRANSPARENT : suivant) };
    if (v !== null) suivant = couleurs[s] || TRANSPARENT;
  }
  return out;
}

function series(p, d) {
  const n = d.length;
  const close = d.map((b) => b.close);
  const mom = close.map((c, i) => (i >= 10 ? c - close[i - 10] : null));
  const r = taRsi(mom, p.longueur);
  const ph = pivothigh(r, G, D), pl = pivotlow(r, G, D);
  const basTrouve = new Array(n).fill(false), hautTrouve = new Array(n).fill(false);
  const divHausse = new Array(n).fill(false), divBaisse = new Array(n).fill(false);
  const rd = (i) => (i - D >= 0 ? r[i - D] : null);
  let bas = [], haut = [], dernierBas = null, dernierHaut = null; // pivots precedents : [bar, rsi, prix]
  for (let i = 0; i < n; i++) {
    if (!p.divergences) continue;
    const fpl = pl[i] !== null && pl[i] !== undefined, fph = ph[i] !== null && ph[i] !== undefined;
    basTrouve[i] = fpl; hautTrouve[i] = fph;
    // _inRange(found[1]) : barres depuis la barre qui suit le pivot precedent
    const dansBas = dernierBas !== null && i - dernierBas - 1 >= MIN && i - dernierBas - 1 <= MAX;
    const dansHaut = dernierHaut !== null && i - dernierHaut - 1 >= MIN && i - dernierHaut - 1 <= MAX;
    if (fpl) {
      const prec = bas;
      const rv = rd(i), lw = i - D >= 0 ? d[i - D].low : null;
      divHausse[i] = prec.length > 0 && rv !== null && prec[1] !== null && rv > prec[1] && dansBas && lw < prec[2];
      bas = [i, rv, lw];
    }
    if (fph) {
      const prec = haut;
      const rv = rd(i), hg = i - D >= 0 ? d[i - D].high : null;
      divBaisse[i] = prec.length > 0 && rv !== null && prec[1] !== null && rv < prec[1] && dansHaut && hg > prec[2];
      haut = [i, rv, hg];
    }
    if (fpl) dernierBas = i;
    if (fph) dernierHaut = i;
  }
  const couleurRsi = r.map((v) => degrade(v, 30, 70, p.couleurHausse, p.couleurBaisse));
  // fill(rsi, 50, 70, 30, baissier, na) et fill(rsi, 50, 70, 30, na, haussier) : couleur du degrade au milieu
  // de la part tracee (60 au-dessus de 50, 40 en dessous).
  const milieuDe = (v) => (v === null ? null : v >= 50 ? 60 : 40);
  const fond1 = r.map((v) => (v === null ? null : degrade(milieuDe(v), 30, 70, null, p.couleurBaisse)));
  const fond2 = r.map((v) => (v === null ? null : degrade(milieuDe(v), 30, 70, p.couleurHausse, null)));
  return {
    r, couleurRsi, cinquante: new Array(n).fill(50), fond1, fond2,
    bas: r.map((_, i) => (basTrouve[i] ? rd(i) : null)), haut: r.map((_, i) => (hautTrouve[i] ? rd(i) : null)),
    couleurBas: divHausse.map((x) => (x ? p.couleurHausse : null)), couleurHaut: divBaisse.map((x) => (x ? p.couleurBaisse : null)),
    divHausse, divBaisse,
  };
}

function etape(p, e, d, i, derniere, s) {
  remplir(e.o, e.fond1, s.r, s.cinquante, i, s.fond1[i], derniere);
  remplir(e.o, e.fond2, s.r, s.cinquante, i, s.fond2[i], derniere);
  const v = i - D >= 0 ? s.r[i - D] : null;
  if (s.divHausse[i]) e.o.etiquette({ x: i - D, y: v, texte: ' Bull ', couleur: p.couleurHausse, couleurTexte: BLANC, style: 'label_up' });
  if (s.divBaisse[i]) e.o.etiquette({ x: i - D, y: v, texte: ' Bear ', couleur: p.couleurBaisse, couleurTexte: BLANC, style: 'label_down' });
}

export default class DivergencesRsiMomentumIndicator {
  static metadata = {
    id: 'divergences_rsi_momentum',
    name: 'Divergences du RSI du momentum',
    shortName: 'DIV-RSIM',
    description: 'divergences_rsi_momentum',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['rsi', 'momentum', 'divergence', 'pivots', 'retournement'],
    inputs: INPUTS,
    outputs: [
      { id: 'rsi', name: 'RSI du momentum', type: 'line', color: '#33c570', lineWidth: 1 },
      { id: 'cinquante', name: '50', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'creux', name: 'Divergence haussière (creux du RSI)', type: 'line', color: '#33c570', lineWidth: 2 },
      { id: 'sommets', name: 'Divergence baissière (sommets du RSI)', type: 'line', color: '#ae4ce6', lineWidth: 2 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { rsi: [], cinquante: [] };
    const p = this.params;
    void ctx;
    return executer(DivergencesRsiMomentumIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), fond1: suiteVide(), fond2: suiteVide() }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d, s) => ({
        rsi: tracer(d, s.r, s.couleurRsi),
        cinquante: tracer(d, s.cinquante, new Array(d.length).fill(GRIS)),
        creux: enjambe(d, s.bas, s.couleurBas),
        sommets: enjambe(d, s.haut, s.couleurHaut),
        objets: etat.o.resultat(),
      }),
    });
  }
}
