// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Liquidations Zones [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/qvfqG21A-Liquidations-Zones-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, contexte, transparence } from './commun.js';

const P = 'Paramètres', Z = 'Zones', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des pivots', type: 'number', entier: true, default: 10, min: 1, max: 200, step: 1, group: P,
    description: 'Barres de part et d’autre d’un sommet ou d’un creux ; les zones partent du pivot confirmé.' },
  { id: 'prolongement', name: 'Prolongement à droite', type: 'number', entier: true, default: 40, min: 0, max: 500, step: 1, group: P, legende: false },
  { id: 'x10', name: '10X (4 % à 10 %)', type: 'boolean', default: true, group: Z },
  { id: 'x25', name: '25X (2 % à 4 %)', type: 'boolean', default: true, group: Z },
  { id: 'x50', name: '50X (1 % à 2 %)', type: 'boolean', default: true, group: Z },
  { id: 'x100', name: '100X (0 à 1 %)', type: 'boolean', default: true, group: Z },
  { id: 'carteChaleur', name: 'Carte de chaleur', type: 'boolean', default: false, group: Z,
    description: 'Zones sans texte, gardées en grand nombre et plus transparentes, avec le plus haut et le plus bas des 100 dernières barres.' },
  { id: 'couleurHaut', name: 'Zones au-dessus des sommets', type: 'color', default: '#880E4F', group: S },
  { id: 'couleurBas', name: 'Zones sous les creux', type: 'color', default: '#00E676', group: S },
];
const ROUGE = '#F23645', VERT = '#4CAF50', GRIS = '#787B86';
const fv = (v) => (v === null ? 'NaN' : tostring(v, 'volume'));

/** Script entier rejoue a chaque calcul : last_bar_index est la derniere barre, comme au chargement sur TradingView. */
function calculer(p, d, env) {
  const n = d.length, last = n - 1, o = creerObjets({ maxBoites: 500, maxEtiquettes: 500, maxLignes: 50 });
  const ph = pivothigh(d, p.longueur, p.longueur), pl = pivotlow(d, p.longueur, p.longueur);
  const t = p.carteChaleur ? [85, 90, 95, 99] : [80, 85, 90, 95];
  const haut = [], bas = [];
  let n1 = null, n2 = null, l1Haut = null, l1Bas = null, et1 = null, et2 = null, li1 = null, li2 = null;
  const vol = (b) => (b ? b.volume : null);
  const volumeDetect = (i, vente, index) => {
    let v = 0;
    if (last - i < 100 && index !== null) {
      for (let k = 0; k <= index; k++) {
        const b = d[i - k]; // avant la premiere barre : close[k] na, la comparaison est fausse
        if (b) v += vente ? (b.close < b.open ? -b.volume : 0) : (b.close > b.open ? b.volume : 0);
      }
    }
    return v;
  };
  const boite = (zones, x1, top, bottom, couleur, texte) => {
    zones.push(o.boite({
      gauche: x1, haut: top, droite: last, bas: bottom, couleurBordure: transparence(couleur, 100), fond: couleur,
      texte: p.carteChaleur ? '' : texte, alignH: 'left', couleurTexte: env.texte, tailleTexte: 'normal',
    }));
  };
  const supprimerZones = (zones, vente, index, i, l1Prec) => {
    if (zones.length === 0) return null;
    const b = d[i], dernier = zones[0];
    const v0 = vol(b), v1 = vol(d[i - 1]);
    const volu = v1 === null ? null : vente ? -v0 - v1 : v0 + v1;
    let l = null;
    for (let k = 0; k < zones.length; k++) { // parcours par index sur le tableau vivant (for ... in de Pine)
      const z = zones[k];
      z.droite = i + p.prolongement;
      const croise = vente ? b.high > z.haut : b.low < z.bas;
      if (croise) {
        l = o.etiquette({ x: i, y: (dernier.haut + dernier.bas) / 2, texte: fv(volu), couleur: null, style: 'label_right', couleurTexte: vente ? ROUGE : VERT });
        z.droite = i - 1;
        z.fond = transparence(env.texte, p.carteChaleur ? 100 : 95);
        z.styleBordure = 'dotted';
        z.couleurTexte = GRIS;
        zones.splice(zones.indexOf(z), 1);
      }
      if (p.carteChaleur) o.supprimer(l);
    }
    const v = volumeDetect(i, vente, index);
    let l1 = null;
    if (!p.carteChaleur) {
      l1 = o.etiquette({ x: i + p.prolongement, y: (dernier.haut + dernier.bas) / 2, texte: (vente ? 'Volume vendeur : ' : 'Volume acheteur : ') + fv(v), couleur: null, style: 'label_right', couleurTexte: env.texte });
      o.supprimer(l1Prec);
    }
    const max = 4 * (p.carteChaleur ? 200 : 1);
    for (let k = 0; k < zones.length; k++) if (zones.length > max) o.supprimer(zones.shift());
    return l1;
  };
  for (let i = 0; i < n; i++) {
    if (ph[i] !== null) {
      const j = i - p.longueur, h = d[j].high;
      n2 = j;
      const a = h * 1.01, c = h * 1.02, e = h * 1.04, f = h * 1.1;
      if (p.x100) boite(haut, j, a, h, transparence(p.couleurHaut, t[0]), '100X');
      if (p.x50) boite(haut, j, c, a, transparence(p.couleurHaut, t[1]), '50X');
      if (p.x25) boite(haut, j, e, c, transparence(p.couleurHaut, t[2]), '25X');
      if (p.x10) boite(haut, j, f, e, transparence(p.couleurHaut, t[3]), '10X');
    }
    if (pl[i] !== null) {
      const j = i - p.longueur, lo = d[j].low;
      n1 = j;
      const a = lo / 1.01, c = lo / 1.02, e = lo / 1.04, f = lo / 1.1;
      if (p.x100) boite(bas, j, lo, a, transparence(p.couleurBas, t[0]), '100X');
      if (p.x50) boite(bas, j, a, c, transparence(p.couleurBas, t[1]), '50X');
      if (p.x25) boite(bas, j, c, e, transparence(p.couleurBas, t[2]), '25X');
      if (p.x10) boite(bas, j, e, f, transparence(p.couleurBas, t[3]), '10X');
    }
    const vi1 = n1 === null ? null : last - n1, vi2 = n2 === null ? null : last - n2;
    const index = vi2 !== null && vi1 !== null && vi2 > vi1 ? vi2 : vi1;
    if (p.carteChaleur) {
      let hh = null, ll = null;
      if (i >= 99) { hh = -Infinity; ll = Infinity; for (let k = i - 99; k <= i; k++) { hh = Math.max(hh, d[k].high); ll = Math.min(ll, d[k].low); } }
      const e1 = o.etiquette({ x: last + p.prolongement, y: hh, texte: '', style: 'label_left', couleur: transparence(p.couleurHaut, 20), couleurTexte: env.texte });
      const n1l = o.ligne({ x1: last - 100, y1: hh, x2: last + p.prolongement, y2: hh, couleur: transparence(p.couleurHaut, 20) });
      o.supprimer(li1); o.supprimer(et1); li1 = n1l; et1 = e1;
      const e2 = o.etiquette({ x: last + p.prolongement, y: ll, texte: '', style: 'label_left', couleur: transparence(p.couleurBas, 40), couleurTexte: env.texte });
      const n2l = o.ligne({ x1: last - 100, y1: ll, x2: last + p.prolongement, y2: ll, couleur: transparence(p.couleurBas, 20) });
      o.supprimer(li2); o.supprimer(et2); li2 = n2l; et2 = e2;
      et1.texte = fv(volumeDetect(i, true, 100));
      et2.texte = fv(volumeDetect(i, false, 100));
    }
    l1Haut = supprimerZones(haut, true, index, i, l1Haut);
    l1Bas = supprimerZones(bas, false, index, i, l1Bas);
  }
  return o.resultat();
}

export default class ZonesLiquidationIndicator {
  static metadata = {
    id: 'zones_liquidation',
    name: 'Zones de liquidation estimées',
    shortName: 'LIQ-ZONES',
    description: 'zones_liquidation',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['liquidation', 'levier', 'zones', 'pivots', 'volume'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { objets: creerObjets().resultat() };
    const p = this.params;
    const env = contexte(data, ctx);
    return { objets: calculer(p, data, env) };
  }
}
