// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Swing Ranges [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/x1uxHl67-Swing-Ranges-ChartPrime/
// Adaptation : textes en francais ; VWAP de seance ancre sur le jour UTC. Le script s'arrete sur TradingView quand une
// oscillation depasse son max_bars_back (300 barres) ; le portage la dessine.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr, pivothigh, pivotlow, vwap as taVwap } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des oscillations', type: 'number', entier: true, default: 20, min: 1, max: 100, step: 1, group: P,
    description: 'Un sommet ou un creux est confirmé ce nombre de barres plus tard, de part et d’autre.' },
  { id: 'longueurAtr', name: 'Longueur de l’ATR', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P },
  { id: 'historique', name: 'Plages passées', type: 'boolean', default: true, group: P },
  { id: 'poc', name: 'Niveau médian du VWAP', type: 'boolean', default: true, group: P },
  { id: 'couleurPoc', name: 'Niveau médian du VWAP', type: 'color', default: '#46ecf8', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const rgb = (r, g, b, t) => `rgba(${r}, ${g}, ${b}, ${(100 - t) / 100})`;
const OFFWHITE = rgb(255, 255, 255, 71), OFFWHITE2 = rgb(255, 255, 255, 50), ROUGE1 = rgb(255, 82, 82, 85), ROUGE2 = rgb(243, 6, 6, 50);
const VERT1 = rgb(73, 241, 241, 85), VERT2 = rgb(73, 241, 241, 50), NOIR = rgb(7, 7, 7, 0), JAUNE = rgb(254, 229, 4, 0);
const r2 = (v) => (nul(v) ? null : Math.round(v * 100) / 100);
const mediane = (a) => {
  if (!a.length || a.some(nul)) return null;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const moyenne = (a) => { if (!a.length || a.some(nul)) return null; let t = 0; for (const v of a) t += v; return t / a.length; };
const somme = (a) => { let t = 0; for (const v of a) { if (nul(v)) return null; t += v; } return t; };
const eq = (a, b) => !nul(a) && !nul(b) && a === b;

function series(p, d) {
  const n = d.length, atr = taAtr(d, p.longueurAtr), atr30 = taAtr(d, 30);
  const band = new Array(n);
  for (let i = 0; i < n; i++) { const a = atr30[i], pc = d[i].close * (5 / 100); band[i] = nul(a) ? null : Math.min(a * 0.3, pc); }
  return {
    ph: pivothigh(d, p.longueur, p.longueur), pl: pivotlow(d, p.longueur, p.longueur), band,
    atrPc: atr.map((a, i) => (nul(a) ? null : (a / d[i].close) * 100)), vwap: taVwap(d),
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, sw = p.longueur, low1 = e.prevLow, high1 = e.prevHigh;
  const ph = s.ph[i], pl = s.pl[i];
  if (!nul(ph)) { e.prevHigh = ph; e.prevHighIndex = i - sw; }
  if (!nul(pl)) { e.prevLow = pl; e.prevLowIndex = i - sw; }
  const dump = nul(pl) || nul(e.prevHigh) ? null : (pl - e.prevHigh) / e.prevHigh * 100;
  const pump = nul(ph) || nul(e.prevLow) ? null : (ph - e.prevLow) / e.prevLow * 100;
  const Vol = [], ATR = [], VW = [];
  const remplirTableaux = (bi) => {
    if (nul(bi)) return;
    for (let k = 0; k <= bi; k++) {
      const j = i - (sw + k);
      Vol.push(j >= 0 ? r2(d[j].volume) : null); ATR.push(j >= 0 ? s.atrPc[j] : null); VW.push(j >= 0 ? s.vwap[j] : null);
    }
    if (Vol.length > bi + 1) { Vol.shift(); ATR.shift(); }
  };
  const message = (dir) => {
    let m = '';
    m += eq(dir, pump) ? `Hausse du prix : ${tostring(r2(pump), 'percent')} %\n` : `Baisse du prix :${tostring(r2(dump), 'percent')}\n`;
    m += `ATR moyen : ${tostring(nul(moyenne(ATR)) ? null : Math.round(moyenne(ATR) * 10000) / 10000, 'percent')}\n`;
    m += `Moyenne du VWAP : ${tostring(mediane(VW), 'mintick', env.mintick)}\n`;
    m += `Volume moyen : ${tostring(somme(Vol), 'volume')}\n`;
    m += `Nombre de barres : ${Vol.length}\n`;
    return m;
  };
  if (!nul(low1) && !nul(e.prevLow) && low1 !== e.prevLow && p.historique) {
    const bi = nul(e.prevHighIndex) ? null : Math.trunc((i - sw) - e.prevHighIndex);
    remplirTableaux(bi);
    o.boite({ gauche: e.prevHighIndex, haut: e.prevHigh, droite: i - sw, bas: pl, fond: ROUGE1, couleurBordure: ROUGE2, epaisseurBordure: 1 });
    o.etiquette({ x: nul(e.prevHighIndex) ? null : e.prevHighIndex + Math.trunc(((i - sw) - e.prevHighIndex) / 2), y: e.prevHigh, texte: '', infobulle: message(dump), taille: 'tiny', couleur: ROUGE2, style: 'label_down' });
    const m = mediane(VW);
    o.ligne({ x1: e.prevHighIndex, y1: m, x2: i - sw, y2: m, couleur: JAUNE, epaisseur: 2 });
  }
  if (!nul(high1) && !nul(e.prevHigh) && high1 !== e.prevHigh && p.historique) {
    const bi = nul(e.prevLowIndex) ? null : Math.trunc((i - sw) - e.prevLowIndex);
    remplirTableaux(bi);
    o.boite({ gauche: e.prevLowIndex, haut: ph, droite: i - sw, bas: e.prevLow, fond: VERT1, couleurBordure: VERT2, epaisseurBordure: 1 });
    o.etiquette({ x: nul(e.prevLowIndex) ? null : e.prevLowIndex + Math.trunc(((i - sw) - e.prevLowIndex) / 2), y: e.prevLow, texte: '', infobulle: message(pump), taille: 'tiny', couleur: VERT2, style: 'label_up' });
    const m = mediane(VW);
    if (!nul(m) && !nul(e.prevHigh) && e.prevHigh > m) o.ligne({ x1: e.prevLowIndex, y1: m, x2: i - sw, y2: m, couleur: JAUNE, epaisseur: 2 });
  }
  if (!derniere) return;
  const ph0 = e.prevHighIndex;
  remplirTableaux(nul(ph0) ? null : Math.trunc((i - sw) - ph0));
  const band = i - sw >= 0 && !nul(s.band[i - sw]) ? s.band[i - sw] / 2 : null;
  const plus = (x) => (nul(x) ? null : x + (x * 0.0015)), moins = (x) => (nul(x) ? null : x - (x * 0.0015));
  const add = (a, b) => (nul(a) || nul(b) ? null : a + b), sub = (a, b) => (nul(a) || nul(b) ? null : a - b);
  const HH = add(plus(e.prevHigh), band), HL = sub(plus(e.prevHigh), band), LH = add(moins(e.prevLow), band), LL = sub(moins(e.prevLow), band);
  let vg = 0, vr = 0, vt = 0;
  if (!nul(ph0)) {
    for (let k = 1; k <= i - ph0; k++) {
      const b = d[i - k];
      if (b.close > b.open) vg += b.volume;
      if (b.close < b.open) vr += b.volume;
      vt += b.volume;
    }
  }
  const IB = nul(ph0) ? null : (i + 50) - ph0, GR = vg / vt, RR = vr / vt;
  const GI = nul(IB) || !Number.isFinite(GR) ? null : Math.trunc(GR * IB), RI = nul(IB) || !Number.isFinite(RR) ? null : Math.trunc(RR * IB);
  const c = d[i].close;
  const cS = gt(c, LH) ? VERT1 : ROUGE1, cB = gt(c, LH) ? VERT2 : ROUGE2, cS2 = gt(c, HH) ? VERT1 : ROUGE1, cB2 = gt(c, HH) ? VERT2 : ROUGE2;
  const reste = 100 - ((RR + GR) * 100);
  const x0 = ph0, xg = (k) => (nul(x0) || nul(k) ? null : x0 + k);
  o.boite({ gauche: x0, haut: LH, droite: i + 50, bas: LL, fond: cS, couleurBordure: cB, epaisseurBordure: 1 });
  o.boite({ gauche: x0, haut: HH, droite: i + 50, bas: HL, fond: cS2, couleurBordure: cB2, epaisseurBordure: 1 });
  o.boite({ gauche: x0, haut: LH, droite: xg(GI), bas: LL, fond: OFFWHITE, couleurBordure: OFFWHITE2, epaisseurBordure: 1, texte: 'Volume acheteur', tailleTexte: 'normal', couleurTexte: NOIR });
  o.boite({ gauche: x0, haut: HH, droite: xg(RI), bas: HL, fond: OFFWHITE, couleurBordure: OFFWHITE2, epaisseurBordure: 1, texte: 'Volume vendeur', tailleTexte: 'normal', couleurTexte: NOIR });
  o.etiquette({ x: xg(nul(GI) ? null : GI + 9), y: nul(LL) || nul(LH) ? null : (LL + LH) / 2, texte: `${tostring(r2(GR * 100))} %`, style: 'label_left', couleurTexte: '#FFFFFF', couleur: null });
  o.etiquette({ x: xg(nul(RI) ? null : RI + 9), y: nul(HL) || nul(HH) ? null : (HL + HH) / 2, texte: `${tostring(r2(RR * 100))} %`, style: 'label_left', couleurTexte: '#FFFFFF', couleur: null });
  const m = mediane(VW);
  if (p.poc) o.ligne({ x1: x0, y1: m, x2: i + 50, y2: m, couleur: p.couleurPoc, epaisseur: 2, style: 'dotted' });
  if (reste > 0) {
    o.boite({ gauche: xg(nul(RI) ? null : RI + 20), haut: HH, droite: xg(nul(RI) ? null : RI + 30), bas: HL, fond: rgb(255, 137, 68, 15), couleurBordure: rgb(255, 137, 68, 8),
      epaisseurBordure: 1, texte: `NV ${tostring(r2(reste))} %`, tailleTexte: 'small', couleurTexte: NOIR });
  }
}
const gt = (a, b) => !nul(a) && !nul(b) && a > b;

export default class PlagesOscillationsIndicator {
  static metadata = {
    id: 'plages_oscillations',
    name: 'Plages des oscillations et volume',
    shortName: 'PLO',
    description: 'plages_oscillations',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['oscillations', 'sommets', 'creux', 'vwap', 'volume'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(PlagesOscillationsIndicator._memo, JSON.stringify([p, env.mintick]), data, {
      creer: () => ({ o: creerObjets({ maxBoites: 500, maxEtiquettes: 50, maxLignes: 50 }), prevHigh: null, prevLow: null, prevHighIndex: null, prevLowIndex: null }),
      series: (d) => series(p, d),
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, derniere, s, env),
      rendre: (e) => ({ objets: e.o.resultat() }),
    });
  }
}
