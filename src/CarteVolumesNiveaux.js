// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Liquidity Pro Map [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/o5rNAgUw-Liquidity-Pro-Map-ChartPrime/
// Adaptation : nom et textes neutres ; tout se calcule a la derniere barre comme au chargement sur TradingView. Le bord gauche
// des niveaux (bar_index - lookback - largeur / 5) est entier (division entiere, l'abscisse d'une boite est un entier). Il faut
// au moins lookback + 24 barres (ecart-type 25 de la reference) : sinon rien n'est dessine.
import { creerObjets } from '../academyscript/objets.js';
import { stdev } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, degrade } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'periode', name: 'Période', type: 'number', entier: true, default: 200, min: 10, max: 2000, step: 1, group: P,
    description: 'Barres dont le volume est réparti sur les rangées, autour d’un prix de référence placé à deux écarts-types sous le plus bas (bougie haussière) ou au-dessus du plus haut (baissière).' },
  { id: 'rangees', name: 'Rangées', type: 'number', entier: true, default: 90, min: 5, max: 300, step: 1, group: P },
  { id: 'separer', name: 'Séparer les rangées', type: 'boolean', default: true, group: S },
  { id: 'couleurAchat', name: 'Volume sous le prix', type: 'color', default: '#0EECA5', group: S },
  { id: 'couleurVente', name: 'Volume au-dessus du prix', type: 'color', default: '#EC0EA5', group: S },
];
const LARGEUR = 50;
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const ROUGE_PALE = 'rgba(255, 82, 82, 0.1)', VERT_PALE = 'rgba(105, 255, 82, 0.1)';

function calculer(p, d, env) {
  const o = creerObjets({ maxLignes: 500, maxBoites: 500, maxPolylignes: 100 }), n = d.length, last = n - 1, N = p.periode, R = p.rangees;
  const dev = stdev(d.map((b) => b.close), 25);
  const ref = (i) => { const b = d[i], s = dev[i]; return nul(s) ? null : (b.close > b.open ? b.low - s * 2 : b.high + s * 2); };
  if (n < N) return { objets: o.resultat() };
  const refs = [];
  for (let i = 0; i < N; i++) refs.push(ref(last - i));
  if (refs.some(nul)) return { objets: o.resultat() };
  let mn = refs[0], mx = refs[0];
  for (const v of refs) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const pas = (mx - mn) / R, close = d[last].close, debut = last + 2;
  const bins = new Array(R).fill(0.0);
  for (let k = 0; k < N; k++) {
    for (let bin = 0; bin < R; bin++) {
      const bas = mn + pas * bin, mil = bas + pas / 2;
      if (Math.abs(refs[k] - mil) <= pas && !(Math.abs(close - mil) < pas * 2)) bins[bin] = bins[bin] + d[last - k].volume;
    }
  }
  let vmax = bins[0];
  for (const v of bins) if (v > vmax) vmax = v;
  if (!(vmax > 0)) return { objets: o.resultat() };
  let totH = 0, maxH = 0, totVente = 0.0, totB = 0, maxB = 0, totAchat = 0.0;
  for (let bin = 0; bin < R; bin++) {
    const mil = mn + pas * bin + pas / 2, v = bins[bin], rw = Math.trunc(v / vmax * LARGEUR);
    if (close < mil) { totVente += v; totH += rw; maxH = Math.max(maxH, rw); } else { totAchat += v; totB += rw; maxB = Math.max(maxB, rw); }
  }
  const vente = [], achat = [], niveaux = [];
  let courH = 0, courB = 0, pocV = false, pocA = false;
  const bord = p.separer ? 1 : 0;
  for (let bin = 0; bin < R; bin++) {
    const bas = mn + pas * bin, haut = bas + pas, mil = bas + pas / 2, v = bins[bin], rw = Math.trunc(v / vmax * LARGEUR);
    if (Math.abs(close - mil) < pas * 2) continue;
    const dessus = close < mil;
    if (dessus) {
      courH += Math.trunc(v / vmax * maxH);
      const x = debut + Math.round(courH / totH * 50);
      if (Number.isFinite(x)) vente.push({ x, y: haut });
      if (rw === maxH && !pocV) { o.etiquette({ x: debut + rw, y: mil, style: 'label_left', couleur: null, texte: '◀ ' + tostring(v, 'volume'), couleurTexte: p.couleurVente }); pocV = true; }
      if (bin === R - 1 && Number.isFinite(x)) o.etiquette({ x, y: haut, style: 'label_down', couleur: null, texte: tostring(totVente, 'volume') + '\n▼', couleurTexte: p.couleurVente });
    } else {
      courB += Math.trunc(v / vmax * maxB);
      const x = debut + Math.round(maxB - (courB / totB * 50));
      if (Number.isFinite(x)) achat.push({ x, y: bas });
      if (rw === maxB && !pocA) { o.etiquette({ x: debut + rw, y: mil, style: 'label_left', couleur: null, texte: '◀ ' + tostring(v, 'volume'), couleurTexte: p.couleurAchat }); pocA = true; }
      if (bin === 0 && Number.isFinite(x)) o.etiquette({ x, y: bas, style: 'label_up', couleur: null, texte: '▲\n' + tostring(totAchat, 'volume'), couleurTexte: p.couleurAchat });
    }
    const cProfil = dessus ? degrade(rw, 0, maxH, ROUGE_PALE, p.couleurVente) : degrade(rw, 0, maxB, VERT_PALE, p.couleurAchat);
    const cNiveau = dessus ? degrade(rw, 0, maxH, null, p.couleurVente) : degrade(rw, 0, maxB, null, p.couleurAchat);
    niveaux.push(o.boite({ gauche: last - N - Math.trunc(rw / 5), haut, droite: last, bas, couleurBordure: env.fond, epaisseurBordure: bord, fond: cNiveau }));
    o.boite({ gauche: debut, haut, droite: debut + rw, bas, couleurBordure: env.fond, epaisseurBordure: bord, fond: cProfil });
  }
  // Chaque niveau part de la derniere bougie qui le traverse (+1 barre).
  for (const bx of niveaux) {
    const m = (bx.haut + bx.bas) / 2;
    for (let i = N - 1; i >= 0; i--) { const b = d[last - i]; if (b.high > m && b.low < m) bx.gauche = last - i + 1; }
  }
  o.polyligne({ points: vente, couleur: p.couleurVente, epaisseur: 2 });
  o.polyligne({ points: achat, couleur: p.couleurAchat, epaisseur: 2 });
  return { objets: o.resultat() };
}

export default class CarteVolumesNiveauxIndicator {
  static metadata = {
    id: 'carte_volumes_niveaux',
    name: 'Carte des volumes au-dessus et sous le prix',
    shortName: 'CVN',
    description: 'carte_volumes_niveaux',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['volume', 'profil', 'niveaux', 'zones', 'prix de reference'],
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
    return executer(CarteVolumesNiveauxIndicator._memo, JSON.stringify([p, env.fond]), data, {
      creer: () => ({ o: creerObjets({}) }),
      etape: () => {},
      rendre: (e, dd) => calculer(p, dd, env),
    });
  }
}
