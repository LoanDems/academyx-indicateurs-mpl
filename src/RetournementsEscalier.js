// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Reversal Signals [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/htGbg6VL-Reversal-Signals-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { sma, ema, wma, vwma, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide } from './commun.js';

const RD = 'Retournements', TD = 'Tendance', S = 'Style';
const INPUTS = [
  { id: 'recul', name: 'Bougies comparées', type: 'number', entier: true, default: 12, min: 2, max: 200, step: 1, group: RD,
    description: 'Une bougie candidate clôture sous les plus bas (au-dessus des plus hauts) de toutes les bougies précédentes de cette fenêtre.' },
  { id: 'confirmation', name: 'Confirmation en moins de (bougies)', type: 'number', entier: true, default: 3, min: 0, max: 100, step: 1, group: RD },
  { id: 'volume', name: 'Exiger un volume élevé', type: 'boolean', default: true, group: RD,
    description: 'Le signal n’est donné que si le volume dépasse sa moyenne des 20 dernières bougies.' },
  { id: 'periode', name: 'Période de la moyenne', type: 'number', entier: true, default: 50, min: 1, max: 1000, step: 1, group: TD },
  { id: 'typeMoyenne', name: 'Type de moyenne', type: 'select', default: 'EMA', group: TD,
    options: [{ label: 'Simple', value: 'SMA' }, { label: 'Exponentielle', value: 'EMA' }, { label: 'Pondérée', value: 'WMA' }, { label: 'Pondérée par le volume', value: 'VWMA' }] },
  { id: 'pas', name: 'Barres entre deux marches', type: 'number', entier: true, default: 33, min: 1, max: 1000, step: 1, group: TD,
    description: 'La moyenne en escalier ne se met à jour que toutes les N barres, et seulement dans le sens de la tendance.' },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
  { id: 'remplissage', name: 'Remplissage de tendance', type: 'boolean', default: true, group: S },
  { id: 'marches', name: 'Moyenne en escalier', type: 'boolean', default: true, group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

function series(p, d) {
  const n = d.length, close = d.map((b) => b.close);
  const vm = sma(d.map((b) => b.volume), 20);
  const ma = p.typeMoyenne === 'SMA' ? sma(close, p.periode) : p.typeMoyenne === 'WMA' ? wma(close, p.periode) : p.typeMoyenne === 'VWMA' ? vwma(d, close, p.periode) : ema(close, p.periode);
  const marche = new Array(n), hausse = new Array(n).fill(false), baisse = new Array(n).fill(false);
  let st = null, maj = 0, dir = 1;
  let candH = false, candB = false, hH = 0, bH = 0, hB = 0, bB = 0, confH = false, confB = false, cptH = 0, cptB = 0;
  const L = p.recul;
  for (let i = 0; i < n; i++) {
    const b = d[i], c = b.close;
    if (nul(st)) { st = ma[i]; maj = i; } else if (dir === 1) {
      if (c < st) { dir = -1; st = ma[i]; maj = i; } else if (i - maj >= p.pas) { st = nul(ma[i]) ? null : Math.max(st, ma[i]); maj = i; }
    } else if (c > st) { dir = 1; st = ma[i]; maj = i; } else if (i - maj >= p.pas) { st = nul(ma[i]) ? null : Math.min(st, ma[i]); maj = i; }
    marche[i] = st;
    let sH = 0, sB = 0;
    for (let k = 0; k < L; k++) {
      if (i - k < 0) continue;
      if (c < d[i - k].low) sH++;
      if (c > d[i - k].high) sB++;
    }
    const volFort = !nul(vm[i]) && b.volume > vm[i];
    // retournement baissier
    if (sB === L - 1) { candB = true; bB = b.low; hB = b.high; confB = false; cptB = 0; }
    if (candB) { cptB++; if (c > hB) candB = false; }
    if (candB && c < bB && !confB && cptB <= p.confirmation + 1) { confB = true; if (!p.volume || volFort) baisse[i] = true; }
    // retournement haussier
    if (sH === L - 1) { candH = true; bH = b.low; hH = b.high; confH = false; cptH = 0; }
    if (candH) { cptH++; if (c < bH) candH = false; }
    if (candH && c > hH && !confH && cptH <= p.confirmation + 1) { confH = true; if (!p.volume || volFort) hausse[i] = true; }
  }
  const centre = d.map((b) => (b.open + b.close) / 2);
  const couleurs = marche.map((m, i) => (!nul(m) && close[i] > m ? p.couleurHausse : p.couleurBaisse));
  const fondH = milieu(transparence(p.couleurHausse, 70), transparence(p.couleurHausse, 100));
  const fondB = milieu(transparence(p.couleurBaisse, 100), transparence(p.couleurBaisse, 70));
  const xo = crossover(close, marche), xu = crossunder(close, marche);
  return {
    marche, centre, couleurs, hausse, baisse, xo, xu,
    fondHausse: marche.map((m, i) => (p.remplissage && !nul(m) && m < close[i] ? fondH : null)),
    fondBaisse: marche.map((m, i) => (p.remplissage && !nul(m) && m > close[i] ? fondB : null)),
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o;
  remplir(o, e.fh, s.marche, s.centre, i, s.fondHausse[i], derniere);
  remplir(o, e.fb, s.centre, s.marche, i, s.fondBaisse[i], derniere);
  if (s.hausse[i]) o.etiquette({ x: i, y: d[i].low, yloc: 'belowbar', texte: '𝓡', style: 'label_up', couleur: p.couleurHausse, couleurTexte: env.fond, taille: 'small' });
  if (s.baisse[i]) o.etiquette({ x: i, y: d[i].high, yloc: 'abovebar', texte: '𝓡', style: 'label_down', couleur: p.couleurBaisse, couleurTexte: env.fond, taille: 'small' });
}

const ALERTES = [['retournement_haussier', 'Retournement haussier', 1], ['retournement_baissier', 'Retournement baissier', 2], ['tendance_haussiere', 'Tendance haussière', 4], ['tendance_baissiere', 'Tendance baissière', 8]];

export default class RetournementsEscalierIndicator {
  static metadata = {
    id: 'retournements_escalier',
    name: 'Retournements confirmés et moyenne en escalier',
    shortName: 'RETOUR',
    description: 'retournements_escalier',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['retournement', 'moyenne en escalier', 'volume', 'tendance', 'signaux'],
    inputs: INPUTS,
    outputs: [
      { id: 'marche', name: 'Moyenne en escalier', type: 'line', color: '#00ffbb', lineWidth: 2 },
      { id: 'alertes', name: 'Alertes', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title, masque]) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && (pt.value & masque) !== 0,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { marche: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(RetournementsEscalierIndicator._memo, JSON.stringify([p, env.fond]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), fh: suiteVide(), fb: suiteVide() }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => ({
        marche: p.marches ? tracer(d, s.marche, s.couleurs) : d.map((b) => ({ time: b.time, value: null })),
        alertes: d.map((b, i) => ({ time: b.time, value: (s.hausse[i] ? 1 : 0) | (s.baisse[i] ? 2 : 0) | (s.xo[i] ? 4 : 0) | (s.xu[i] ? 8 : 0) || null })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
