// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Volumatic Trend [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/4lVTa6J4-Volumatic-Trend-ChartPrime/
// Adaptation : les bougies coloriees (plotcandle) deviennent la couleur des bougies du graphique ; les colonnes de volume
// (plotcandle depuis la bande) sont des boites centrees sur leur barre, sur les 500 dernieres barres (plafond des boites).
import { creerObjets } from '../academyscript/objets.js';
import { ema, atr as atrTa } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 40, min: 2, max: 500, step: 1, group: P,
    description: 'Moyenne exponentielle des clôtures lissées sur 4 barres ; la tendance change quand elle passe la moyenne exponentielle simple.' },
  { id: 'histogramme', name: 'Histogramme du volume', type: 'boolean', default: true, group: S,
    description: 'Colonnes de volume (rapporté au plus fort des 1 000 dernières barres) depuis la bande de la tendance.' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#247ac0', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#c88829', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const DEMI = 0.4, NOIR = '#000000';

/** ta.percentile_linear_interpolation(volume, 1000, 100) = plus fort volume des 1 000 dernieres barres (file monotone). */
function plusFort(v, L) {
  const out = new Array(v.length).fill(null), file = [];
  for (let i = 0; i < v.length; i++) {
    while (file.length && v[file[file.length - 1]] <= v[i]) file.pop();
    file.push(i);
    if (file[0] <= i - L) file.shift();
    if (i >= L - 1) out[i] = v[file[0]];
  }
  return out;
}

function series(p, d) {
  const c = d.map((b) => b.close);
  const sw = c.map((_, i) => (i < 3 ? null : c[i - 3] * 1 / 6 + c[i - 2] * 2 / 6 + c[i - 1] * 2 / 6 + c[i] * 1 / 6));
  const vols = d.map((b) => b.volume), mx = plusFort(vols, 1000);
  return {
    e1: ema(sw, p.longueur), e2: ema(c, p.longueur), atr: atrTa(d, 200),
    vol: vols.map((v, i) => { if (nul(mx[i])) return null; const r = Math.trunc(v / mx[i] * 100); return Number.isFinite(r) ? r : null; }),
  };
}

function creer() {
  return {
    o: creerObjets({ maxBoites: 500, maxEtiquettes: 500 }), haut: null, bas: null, basVol: null, hautVol: null, pasH: null, pasB: null, dernier: null,
    sorties: { tend: [], haut: [], bas: [], bougie: [] },
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, S = e.sorties, b = d[i];
  const e1 = s.e1[i], e11 = i > 0 ? s.e1[i - 1] : null, a = s.atr[i];
  const t = !nul(e11) && !nul(s.e2[i]) && e11 < s.e2[i];
  const t1 = i > 0 ? S.tend[i - 1] : false;
  S.tend[i] = t;
  const sur = (x, f) => (nul(x) || nul(a) ? null : f(x));
  if (t !== t1) {
    e.haut = sur(e1, (x) => x + a * 3); e.bas = sur(e1, (x) => x - a * 3);
    e.basVol = nul(e.bas) ? null : e.bas + a * 4; e.hautVol = nul(e.haut) ? null : e.haut - a * 4;
    e.pasH = nul(e.basVol) ? null : (e.basVol - e.bas) / 100; e.pasB = nul(e.haut) ? null : (e.haut - e.hautVol) / 100;
    e.dernier = i;
  }
  const v = s.vol[i];
  const volH = nul(v) || nul(e.pasH) ? null : e.pasH * v, volB = nul(v) || nul(e.pasB) ? null : e.pasB * v;
  const coul = t ? p.couleurHausse : p.couleurBaisse;
  const g = degrade(v, 0, 25, env.fond, coul), g1 = degrade(v, 0, 10, env.fond, coul);
  S.bougie[i] = g1;
  S.haut[i] = e.haut; S.bas[i] = e.bas;
  if (p.histogramme && g) {
    if (t && !nul(volH) && !nul(e.bas)) o.boite({ gauche: i - DEMI, droite: i + DEMI, haut: e.bas + volH, bas: e.bas, couleurBordure: g, epaisseurBordure: 1, fond: g });
    if (!t && !nul(volB) && !nul(e.haut)) o.boite({ gauche: i - DEMI, droite: i + DEMI, haut: e.haut, bas: e.haut - volB, couleurBordure: g, epaisseurBordure: 1, fond: g });
  }
  if (t !== t1 && i > 0 && !nul(e11)) o.etiquette({ x: i - 1, y: e11, yloc: 'price', texte: '', style: 'diamond', couleur: coul, taille: 'tiny' });
  if (derniere && e.dernier !== null) {
    let delta = 0, total = 0;
    for (let k = 0; k <= i - e.dernier; k++) { const x = d[i - k]; total += x.volume; delta += x.close > x.open ? x.volume : -x.volume; }
    const y = p.histogramme ? (t ? (nul(e.bas) || nul(volH) ? null : e.bas + volH) : (nul(e.haut) || nul(volB) ? null : e.haut - volB)) : e1;
    if (!nul(y)) {
      o.etiquette({ x: i, y, yloc: 'price', texte: `Delta > ${tostring(delta, 'volume')}\n--------------------\nTotal > ${tostring(total, 'volume')}`,
        alignTexte: 'left', style: 'label_left', couleur: g1, couleurTexte: NOIR });
    }
  }
}

function rendre(p, e, d, s) {
  const S = e.sorties, vide = d.map((b) => ({ time: b.time, value: null }));
  const coul = S.tend.map((t) => (t ? p.couleurHausse : p.couleurBaisse));
  return {
    tendance: tracer(d, s.e1, coul.map((c) => transparence(c, 20))),
    bandeHaute: p.histogramme ? tracer(d, S.haut.map((v, i) => (S.tend[i] ? null : v)), coul) : vide,
    bandeBasse: p.histogramme ? tracer(d, S.bas.map((v, i) => (S.tend[i] ? v : null)), coul) : vide,
    bougies: d.map((b, i) => ({ time: b.time, value: S.bougie[i] ? 1 : null, color: S.bougie[i] })),
    objets: e.o.resultat(),
  };
}

export default class TendanceVolumetriqueIndicator {
  static metadata = {
    id: 'tendance_volumetrique',
    name: 'Tendance et volume relatif',
    shortName: 'TVR',
    description: 'tendance_volumetrique',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'volume', 'moyenne', 'bougies colorees', 'delta'],
    inputs: INPUTS,
    outputs: [
      { id: 'tendance', name: 'Ligne de tendance', type: 'line', color: 'rgba(36, 122, 192, 0.8)', lineWidth: 2 },
      { id: 'bandeHaute', name: 'Bande haute', type: 'line', color: '#c88829', lineWidth: 1 },
      { id: 'bandeBasse', name: 'Bande basse', type: 'line', color: '#247ac0', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#247ac0', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { bougies: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(TendanceVolumetriqueIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
