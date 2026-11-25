// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Dynamic Supply and Demand Zones [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/Sz1PjzR7-Dynamic-Supply-and-Demand-Zones-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow } from '../academyscript/ta.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, contexte, transparence } from './commun.js';

const C = 'Calcul', A = 'Style';
const INPUTS = [
  { id: 'dynamique', name: 'Période depuis le dernier pivot', type: 'boolean', default: true, group: C,
    description: 'La période étudiée part du dernier sommet ou creux majeur confirmé ; sinon, elle compte un nombre fixe de barres.' },
  { id: 'periode', name: 'Période fixe (barres)', type: 'number', entier: true, default: 100, min: 1, max: 4999, step: 1, group: C },
  { id: 'periodePivots', name: 'Longueur des pivots majeurs', type: 'number', entier: true, default: 200, min: 1, max: 1000, step: 1, group: C,
    description: 'Barres de part et d’autre d’un sommet ou d’un creux majeur ; il n’est confirmé qu’après ce nombre de barres.' },
  { id: 'resolution', name: 'Rangées du profil', type: 'number', entier: true, default: 40, min: 2, max: 200, step: 1, group: C },
  { id: 'largeur', name: 'Largeur du profil', type: 'number', entier: true, default: 33, min: 1, max: 100, step: 1, group: C, legende: false },
  { id: 'tolerance', name: 'Tolérance des zones', type: 'number', default: 0.93, min: 0.01, max: 1, step: 0.01, group: C,
    description: 'Une rangée devient une zone si son volume est sous cette fraction du volume des deux rangées voisines : plus bas, moins de zones.' },
  { id: 'profil', name: 'Afficher le profil', type: 'boolean', default: true, group: A },
  { id: 'cadre', name: 'Afficher la période étudiée', type: 'boolean', default: true, group: A },
  { id: 'couleurNiveaux', name: 'Zones', type: 'color', default: '#787B86', group: A },
  { id: 'couleurHausse', name: 'Zone sous le prix', type: 'color', default: '#00ffbb', group: A },
  { id: 'couleurBaisse', name: 'Zone au-dessus du prix', type: 'color', default: '#ff1100', group: A },
];
const BLEU = '#2962FF', GRIS = '#787B86', NOIR = '#363A45';
const maxi = (t) => { let m = null; for (const v of t) if (v !== null && (m === null || v > m)) m = v; return m; };
const mini = (t) => { let m = null; for (const v of t) if (v !== null && (m === null || v < m)) m = v; return m; };
const rond = (v) => (v === null ? null : Math.round(v));

function calculer(p, d, env) {
  const n = d.length, o = creerObjets({ maxBoites: 500, maxEtiquettes: 500 });
  const ph = pivothigh(d, p.periodePivots, p.periodePivots), pl = pivotlow(d, p.periodePivots, p.periodePivots);
  let pivotIndex = 0;
  for (let i = 0; i < n; i++) {
    if (ph[i] !== null || pl[i] !== null) pivotIndex = i - p.periodePivots;
    // plotchar(ph != 0, location.abovebar, offset = -plen) : comparaison avec na fausse
    if (ph[i] !== null && ph[i] !== 0) o.plotchar(i - p.periodePivots, { position: 'abovebar', caractere: '●', couleur: env.texte, taille: 'tiny' });
    if (pl[i] !== null && pl[i] !== 0) o.plotchar(i - p.periodePivots, { position: 'belowbar', caractere: '●', couleur: env.texte, taille: 'tiny' });
  }
  // Toutes les boites et etiquettes sont effacees et refaites a chaque barre : seule la derniere reste.
  const i = n - 1, b = d[i];
  const len1 = p.dynamique ? i - pivotIndex : p.periode;
  const highs = [], lows = [], vols = [];
  for (let k = 0; k <= len1; k++) { const c = d[i - k]; highs.push(c ? c.high : null); lows.push(c ? c.low : null); vols.push(c ? c.volume : null); }
  const maxx = maxi(highs), minn = mini(lows), res = p.resolution;
  const hauts = [], basses = [], bins = [];
  const step = maxx === null || minn === null ? null : (maxx - minn) / res;
  for (let r = 0; r < res; r++) {
    let bin = 0;
    const bottom = step === null ? null : minn + r * step, top = step === null ? null : minn + (r + 1) * step;
    basses.push(bottom); hauts.push(top);
    for (let j = 0; j < highs.length; j++) {
      const dessus = lows[j] !== null && top !== null && lows[j] > top, dessous = highs[j] !== null && bottom !== null && highs[j] < bottom;
      if (!(dessus || dessous)) bin = bin === null || vols[j] === null ? null : bin + vols[j];
    }
    bins.push(bin);
  }
  const binMax = maxi(bins);
  const boites = [];
  for (let r = 0; r < res; r++) {
    const lt = (a, c) => a !== null && c !== null && a < c;
    const cle = (r === res - 1 ? true : lt(bins[r], bins[r + 1] === null ? null : bins[r + 1] * p.tolerance))
      && (r === 0 ? true : lt(bins[r], bins[r - 1] === null ? null : bins[r - 1] * p.tolerance));
    if (cle) {
      const gauche = i - len1;
      boites.push(o.boite({ gauche, haut: hauts[r], droite: i, bas: basses[r], couleurBordure: transparence(p.couleurNiveaux, 70), epaisseurBordure: 1, styleBordure: 'solid', fond: transparence(p.couleurNiveaux, 80) }));
      const pct = bins[r] === null || binMax === null || binMax === 0 ? null : (1 - bins[r] / binMax) * 100;
      o.etiquette({ x: gauche, y: hauts[r] === null ? null : (hauts[r] + basses[r]) / 2, texte: pct === null ? 'NaN' : `${formaterMotif(pct, '0.00')}%`, couleur: env.texte, couleurTexte: env.fond, style: 'label_right' });
    }
  }
  for (let r = 0; r < res; r++) {
    const droite = i + 7 + p.largeur;
    const a = rond(bins[r]), m = rond(binMax);
    const gauche = a === null || m === null || m === 0 ? null : droite - (a / m) * p.largeur;
    boites.push(p.profil ? o.boite({ gauche, haut: hauts[r], droite, bas: basses[r], couleurBordure: NOIR, epaisseurBordure: 1, styleBordure: 'solid', fond: GRIS }) : null);
  }
  if (p.cadre) {
    o.boite({
      gauche: i - len1, haut: maxi(hauts), droite: i, bas: mini(basses), couleurBordure: transparence(BLEU, 70), epaisseurBordure: 1, styleBordure: 'solid', extend: 'none',
      fond: transparence(BLEU, 90), texte: 'Période étudiée', tailleTexte: 'tiny', couleurTexte: GRIS, alignH: 'center', alignV: 'top',
    });
  }
  for (let k = boites.length - 1; k >= 0; k--) {
    const z = boites[k];
    if (!z) continue;
    if (z.haut !== null && b.close > z.haut) { z.couleurBordure = transparence(p.couleurHausse, 50); z.fond = transparence(p.couleurHausse, 50); } else if (z.bas !== null && b.close < z.bas) { z.couleurBordure = transparence(p.couleurBaisse, 50); z.fond = transparence(p.couleurBaisse, 50); }
  }
  return o.resultat();
}

export default class ZonesOffreDemandeIndicator {
  static metadata = {
    id: 'zones_offre_demande',
    name: 'Zones d’offre et de demande par le volume',
    shortName: 'OFFRE-DEM',
    description: 'zones_offre_demande',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['offre', 'demande', 'profil de volume', 'zones', 'pivots'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { objets: creerObjets().resultat() };
    return { objets: calculer(this.params, data, contexte(data, ctx)) };
  }
}
