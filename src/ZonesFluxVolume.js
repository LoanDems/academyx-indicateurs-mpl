// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Supply & Demand: Cumulative Volume Delta Flow [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/paLrV2ud-Supply-Demand-Cumulative-Volume-Delta-Flow-ChartPrime/
// Adaptation : calcul sur toutes les bougies (calc_bars_count = 3000 non repris) ; textes en francais. Le script redessine a
// chaque barre la courbe du delta cumule et le texte de chaque zone active ; seule la derniere version est visible : elle
// est calculee a la derniere barre, sur les memes bougies.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, transparence } from './commun.js';

const DE = 'Détection', S = 'Style';
const INPUTS = [
  { id: 'longueurAtr', name: 'Longueur de l’ATR', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: DE },
  { id: 'multiple', name: 'Corps minimal (x ATR)', type: 'number', default: 1, min: 0.1, max: 20, step: 0.1, group: DE,
    description: 'Le corps de la bougie qui suit la bougie d’origine doit valoir au moins ce multiple de l’ATR.' },
  { id: 'maxZones', name: 'Zones actives de chaque côté', type: 'number', entier: true, default: 10, min: 1, max: 50, step: 1, group: DE, legende: false },
  { id: 'signaux', name: 'Signaux', type: 'boolean', default: true, group: DE },
  { id: 'couleurDemande', name: 'Zone de demande', type: 'color', default: 'rgba(34, 197, 143, 0.15)', group: S },
  { id: 'couleurOffre', name: 'Zone d’offre', type: 'color', default: 'rgba(239, 68, 68, 0.15)', group: S },
  { id: 'bordDemande', name: 'Bord de la demande', type: 'color', default: 'rgba(34, 197, 94, 0.7)', group: S },
  { id: 'bordOffre', name: 'Bord de l’offre', type: 'color', default: 'rgba(239, 68, 68, 0.7)', group: S },
  { id: 'vagueDemande', name: 'Delta cumulé (demande)', type: 'color', default: 'rgba(34, 197, 175, 0.6)', group: S },
  { id: 'vagueOffre', name: 'Delta cumulé (offre)', type: 'color', default: 'rgba(239, 136, 68, 0.6)', group: S },
];

const deltaDe = (b) => (b.close > b.open ? b.volume : b.close < b.open ? -b.volume : 0);

/** updatePolylines du script a la barre i : points du delta cumule rapporte a son plus grand ecart, et delta final. */
function courbe(d, i, gauche, zTop, zBot, demande) {
  let longueur = Math.min(Math.trunc(i - gauche), 2900);
  longueur = Math.max(0, Math.min(longueur, i - 1));
  let tmp = 0, maxAbs = 0;
  for (let k = longueur; k >= 0; k--) { tmp += deltaDe(d[i - k]); maxAbs = Math.max(maxAbs, Math.abs(tmp)); }
  const h = zTop - zBot, mid = (zTop + zBot) / 2, pts = [{ x: i - longueur, y: mid }];
  let cum = 0;
  for (let k = longueur; k >= 0; k--) {
    cum += deltaDe(d[i - k]);
    const r = demande ? zBot + (maxAbs > 0 ? (cum / maxAbs) * h : 0) : zTop + (maxAbs > 0 ? (cum / maxAbs) * h : 0);
    pts.push({ x: i - k, y: Math.max(zBot, Math.min(zTop, r)) });
  }
  pts.push({ x: i, y: mid });
  return { pts, cum };
}

function creer() {
  return { o: creerObjets({ maxBoites: 500, maxPolylignes: 100, maxEtiquettes: 50 }), dem: [], off: [] };
}

function etape(p, e, d, i, derniere, s) {
  const o = e.o, a = s.atr;
  let cDem = false, cOff = false;
  if (i >= 2 && !(a[i - 1] === null)) {
    const b2 = d[i - 2], b1 = d[i - 1], corps = Math.abs(b1.close - b1.open), seuil = p.multiple * a[i - 1];
    cDem = b2.close < b2.open && b1.close > b1.open && corps >= seuil;
    cOff = b2.close > b2.open && b1.close < b1.open && corps >= seuil;
  }
  const creerZone = (liste, demande) => {
    const b2 = d[i - 2], zTop = b2.high, zBot = b2.low;
    if (liste.some((z) => zBot <= z.top && zTop >= z.bot)) return;
    const boite = o.boite({
      gauche: i - 2, haut: zTop, droite: i, bas: zBot, fond: demande ? p.couleurDemande : p.couleurOffre,
      couleurBordure: demande ? p.bordDemande : p.bordOffre, epaisseurBordure: 1, extend: 'none',
      texte: `${demande ? 'Demande' : 'Offre'}  |  CVD : calcul...`, couleurTexte: '#FFFFFF', tailleTexte: 'small', alignH: 'right', alignV: 'center',
    });
    liste.push({ boite, top: zTop, bot: zBot, gauche: i - 2 });
  };
  if (cDem) creerZone(e.dem, true);
  if (e.dem.length > p.maxZones) o.supprimer(e.dem.shift().boite);
  if (cOff) creerZone(e.off, false);
  if (e.off.length > p.maxZones) o.supprimer(e.off.shift().boite);
  const c = d[i].close;
  for (const [liste, demande] of [[e.dem, true], [e.off, false]]) {
    for (let k = liste.length - 1; k >= 0; k--) {
      const z = liste[k];
      if (demande ? c <= z.bot : c >= z.top) { o.supprimer(z.boite); liste.splice(k, 1); continue; }
      if (!derniere) continue;
      const { pts, cum } = courbe(d, i, z.gauche, z.top, z.bot, demande);
      const v = demande ? p.vagueDemande : p.vagueOffre;
      o.polyligne({ points: pts, fermee: true, courbe: false, couleur: transparence(v, 0), fond: v, epaisseur: 1 });
      z.boite.droite = i;
      z.boite.texte = `${demande ? 'Demande' : 'Offre'}  |  CVD : ${tostring(cum, 'volume')}`;
      z.boite.alignV = demande ? 'bottom' : 'top';
    }
  }
  if (p.signaux && cDem) o.etiquette({ x: i, y: d[i].low, texte: '△', yloc: 'belowbar', style: 'none', couleurTexte: p.bordDemande, taille: 'normal' });
  if (p.signaux && cOff) o.etiquette({ x: i, y: d[i].high, texte: '▽', yloc: 'abovebar', style: 'none', couleurTexte: p.bordOffre, taille: 'normal' });
}

export default class ZonesFluxVolumeIndicator {
  static metadata = {
    id: 'zones_flux_volume',
    name: 'Zones d’offre et de demande et delta cumulé',
    shortName: 'ZODC',
    description: 'zones_flux_volume',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['offre', 'demande', 'zones', 'delta cumule', 'volume'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    return executer(ZonesFluxVolumeIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: (d) => ({ atr: taAtr(d, p.longueurAtr) }),
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, derniere, s),
      rendre: (e) => ({ objets: e.o.resultat() }),
    });
  }
}
