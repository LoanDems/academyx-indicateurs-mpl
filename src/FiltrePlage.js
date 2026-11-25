// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Range Filter [DW] » © DonovanWall — https://www.tradingview.com/script/lut7sBgG-Range-Filter-DW/
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer, contexte, tracer, transparence, remplir, suiteVide } from './commun.js';

const P = 'Paramètres', S = 'Style';
const ECHELLES = [
  { label: 'Points', value: 'Points' }, { label: 'Pips', value: 'Pips' }, { label: 'Pas de cotation', value: 'Ticks' },
  { label: '% du prix', value: '% of Price' }, { label: 'ATR', value: 'ATR' }, { label: 'Variation moyenne', value: 'Average Change' },
  { label: 'Écart-type', value: 'Standard Deviation' }, { label: 'Valeur absolue', value: 'Absolute' },
];
const INPUTS = [
  { id: 'type', name: 'Type de filtre', type: 'select', default: 'Type 1', group: P,
    options: [{ label: 'Type 1 : suit le prix au-delà de la plage', value: 'Type 1' }, { label: 'Type 2 : avance par paliers d’une plage', value: 'Type 2' }] },
  { id: 'source', name: 'Mouvement mesuré sur', type: 'select', default: 'Close', group: P,
    options: [{ label: 'Les clôtures', value: 'Close' }, { label: 'Les mèches', value: 'Wicks' }] },
  { id: 'taille', name: 'Taille de la plage', type: 'number', default: 2.618, min: 0.0000001, max: 1000000, step: 0.1, group: P },
  { id: 'echelle', name: 'Unité de la plage', type: 'select', default: 'Average Change', group: P, options: ECHELLES },
  { id: 'periode', name: 'Période (ATR, variation moyenne, écart-type)', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P },
  { id: 'lisser', name: 'Lisser la plage', type: 'boolean', default: true, group: P },
  { id: 'periodeLissage', name: 'Période de lissage', type: 'number', entier: true, default: 27, min: 1, max: 500, step: 1, group: P },
  { id: 'moyenner', name: 'Moyenner les changements du filtre', type: 'boolean', default: false, group: P },
  { id: 'changements', name: 'Nombre de changements moyennés', type: 'number', entier: true, default: 2, min: 1, max: 100, step: 1, group: P },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#05ff9b', group: S },
  { id: 'couleurHausseFaible', name: 'Hausse, clôture en repli', type: 'color', default: '#00b36b', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff0583', group: S },
  { id: 'couleurBaisseFaible', name: 'Baisse, clôture en rebond', type: 'color', default: '#b8005d', group: S },
  { id: 'couleurNeutre', name: 'Neutre', type: 'color', default: '#cccccc', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

/** Cond_EMA(x, cond, n) du script : etat amorce sur la premiere valeur, mis a jour seulement si cond. */
function emaCond(n) {
  const a = 2 / (n + 1);
  let val = null, e = null, vide = true;
  return (x, cond) => {
    if (cond) {
      val = x; vide = false;
      if (nul(e)) e = val;
      e = nul(val) || nul(e) ? null : (val - e) * a + e;
    }
    return vide ? null : e;
  };
}

/** Cond_SMA(x, 1, n) : moyenne (array.avg) des n dernieres valeurs vues. */
function smaCond(n) {
  const vals = [];
  return (x) => {
    vals.push(x);
    if (vals.length > n) vals.shift();
    let s = 0;
    for (const v of vals) s += v;
    return s / vals.length;
  };
}

function series(p, d, env, pointvalue) {
  const n = d.length;
  const hv = d.map((b) => (p.source === 'Wicks' ? b.high : b.close)), lv = d.map((b) => (p.source === 'Wicks' ? b.low : b.close));
  const emaAtr = emaCond(p.periode), emaAc = emaCond(p.periode), sma2 = smaCond(p.periode), sma1 = smaCond(p.periode);
  const emaLisse = emaCond(p.periodeLissage), emaF = emaCond(p.changements), emaH = emaCond(p.changements), emaL = emaCond(p.changements);
  const filtre = new Array(n), haut = new Array(n), bas = new Array(n), couleurs = new Array(n), bougies = new Array(n);
  let r0 = null, r1 = null, f1Prec = null, fdir = 0;
  for (let i = 0; i < n; i++) {
    const b = d[i], c1 = i > 0 ? d[i - 1].close : null;
    const x = (hv[i] + lv[i]) / 2, x1 = i > 0 ? (hv[i - 1] + lv[i - 1]) / 2 : null;
    const tr = nul(c1) ? b.high - b.low : Math.max(Math.max(b.high - b.low, Math.abs(b.high - c1)), Math.abs(b.low - c1));
    const atr = emaAtr(tr, true);
    const ac = emaAc(nul(x1) ? null : Math.abs(x - x1), true);
    const m2 = sma2(x * x), m1 = sma1(x);
    const v = m2 - m1 * m1;
    const sd = v < 0 ? null : Math.sqrt(v);
    const q = p.taille, e = p.echelle;
    const rng = e === 'Pips' ? q * 0.0001 : e === 'Points' ? q * pointvalue : e === '% of Price' ? (b.close * q) / 100 : e === 'ATR' ? (nul(atr) ? null : q * atr)
      : e === 'Average Change' ? (nul(ac) ? null : q * ac) : e === 'Standard Deviation' ? (nul(sd) ? null : q * sd) : e === 'Ticks' ? q * env.mintick : q;
    const lisse = emaLisse(rng, true);
    const r = p.lisser ? lisse : rng;
    if (i === 0) { r0 = (hv[0] + lv[0]) / 2; r1 = r0; }
    r1 = r0;
    const h = hv[i], l = lv[i];
    if (!nul(r)) {
      if (p.type === 'Type 1') {
        if (h - r > r1) r0 = h - r;
        if (l + r < r1) r0 = l + r;
      } else {
        if (h >= r1 + r) r0 = r1 + Math.floor(Math.abs(h - r1) / r) * r;
        if (l <= r1 - r) r0 = r1 - Math.floor(Math.abs(l - r1) / r) * r;
      }
    }
    const f1 = r0, hb1 = nul(r) ? null : f1 + r, lb1 = nul(r) ? null : f1 - r;
    const change = !nul(f1Prec) && f1 !== f1Prec;
    const f2 = emaF(f1, change), hb2 = emaH(hb1, change), lb2 = emaL(lb1, change);
    f1Prec = f1;
    const f = p.moyenner ? f2 : f1;
    filtre[i] = f; haut[i] = p.moyenner ? hb2 : hb1; bas[i] = p.moyenner ? lb2 : lb1;
    const fp = i > 0 ? filtre[i - 1] : null;
    if (!nul(f) && !nul(fp)) fdir = f > fp ? 1 : f < fp ? -1 : fdir;
    const up = fdir === 1, dn = fdir === -1;
    couleurs[i] = up ? p.couleurHausse : dn ? p.couleurBaisse : p.couleurNeutre;
    bougies[i] = up && !nul(f) && b.close > f ? (!nul(c1) && b.close > c1 ? p.couleurHausse : p.couleurHausseFaible)
      : dn && !nul(f) && b.close < f ? (!nul(c1) && b.close < c1 ? p.couleurBaisse : p.couleurBaisseFaible) : p.couleurNeutre;
  }
  return { filtre, haut, bas, couleurs, bougies, fondHaut: transparence(p.couleurHausseFaible, 85), fondBas: transparence(p.couleurBaisseFaible, 85) };
}

export default class FiltrePlageIndicator {
  static metadata = {
    id: 'filtre_plage',
    name: 'Filtre de plage',
    shortName: 'FILTRE',
    description: 'filtre_plage',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['filtre', 'plage', 'tendance', 'bandes', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'filtre', name: 'Filtre', type: 'line', color: '#05ff9b', lineWidth: 3 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#05ff9b', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { filtre: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    const pv = Number(ctx && ctx.syminfo && ctx.syminfo.pointvalue);
    const pointvalue = pv > 0 ? pv : 1;
    return executer(FiltrePlageIndicator._memo, JSON.stringify([p, env.mintick, pointvalue]), data, {
      creer: () => ({ o: creerObjets({ maxPolylignes: 500 }), fondHaut: suiteVide(), fondBas: suiteVide() }),
      series: (d) => series(p, d, env, pointvalue),
      etape: (etat, d, i, derniere, s) => {
        remplir(etat.o, etat.fondHaut, s.haut, s.filtre, i, s.fondHaut, derniere);
        remplir(etat.o, etat.fondBas, s.filtre, s.bas, i, s.fondBas, derniere);
      },
      rendre: (etat, d, s) => ({
        filtre: tracer(d, s.filtre, s.couleurs),
        bougies: d.map((b, i) => ({ time: b.time, value: 1, color: s.bougies[i] })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
