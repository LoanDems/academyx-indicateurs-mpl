// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Swing Profile Analyzer [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/8S40eYNi-Swing-Profile-Analyzer-ChartPrime/
// Adaptation : aucune (plafonds de TradingView repris : 50 lignes, 50 etiquettes, 500 boites).
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const AFFICHAGES = [
  { label: 'Tous', value: 'All' }, { label: 'Hausses', value: 'Bull' }, { label: 'Baisses', value: 'Bear' }, { label: 'Aucun', value: 'None' },
];
const P = 'Paramètres', PR = 'Profil', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des oscillations', type: 'number', entier: true, default: 100, min: 2, max: 1000, step: 1, group: P,
    description: 'Plus haut et plus bas sur ce nombre de barres : un nouvel extrême suivi d’un recul marque un sommet ou un creux.' },
  { id: 'rangees', name: 'Rangées du profil', type: 'number', entier: true, default: 30, min: 1, max: 200, step: 1, group: PR },
  { id: 'profils', name: 'Profils affichés', type: 'select', default: 'All', options: AFFICHAGES, group: PR,
    description: 'Hausses : profil de la jambe qui monte (dessiné quand le sommet suivant se forme) ; baisses : l’inverse.' },
  { id: 'epaisseurPoc', name: 'Épaisseur de la ligne du point de contrôle', type: 'number', entier: true, default: 2, min: 1, max: 10, step: 1, group: S },
  { id: 'couleurHaut', name: 'Jambe baissière (▽)', type: 'color', default: '#9d14d8', group: S },
  { id: 'couleurBas', name: 'Jambe haussière (△)', type: 'color', default: '#13c25f', group: S },
];

function series(p, d) {
  const n = d.length, L = p.longueur, haut = new Array(n).fill(null), bas = new Array(n).fill(null);
  for (let i = L - 1; i < n; i++) {
    let h = -Infinity, b = Infinity;
    for (let k = 0; k < L; k++) { const x = d[i - k]; if (x.high > h) h = x.high; if (x.low < b) b = x.low; }
    haut[i] = h; bas[i] = b;
  }
  return { haut, bas };
}

function creer() {
  return {
    o: creerObjets({ maxLignes: 50, maxEtiquettes: 50, maxBoites: 500 }),
    H: null, L: null, ih: 0, il: 0, tendance: false, ligneZ: null, poc: null, Harr: [], Larr: [],
    sorties: { tendance: [] },
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], up = s.haut[i], lo = s.bas[i];
  const up1 = i > 0 ? s.haut[i - 1] : null, lo1 = i > 0 ? s.bas[i - 1] : null;
  if (i > 0 && up1 !== null && up !== null && d[i - 1].high === up1 && b.high < up) { e.ih = i - 1; e.H = up; e.Harr.push(e.ih); }
  if (i > 0 && lo1 !== null && lo !== null && d[i - 1].low === lo1 && b.low > lo) { e.il = i - 1; e.L = lo; e.Larr.push(e.il); }
  const avant = i > 0 ? e.sorties.tendance[i - 1] : false;
  if (up !== null && b.high === up) e.tendance = true;
  if (lo !== null && b.low === lo) e.tendance = false;
  const t = e.tendance;
  e.sorties.tendance[i] = t;
  if (!t && avant) e.ligneZ = o.ligne({ x1: e.il, y1: e.L, x2: e.ih, y2: e.H, couleur: p.couleurBas });
  if (t && !avant) e.ligneZ = o.ligne({ x1: e.ih, y1: e.H, x2: e.il, y2: e.L, couleur: p.couleurHaut });
  if (e.ligneZ) e.ligneZ.style = 'dashed';
  if (derniere && t === avant) {
    if (t) o.ligne({ x1: e.il, y1: e.L, x2: e.ih, y2: up, couleur: p.couleurBas });
    else o.ligne({ x1: e.ih, y1: e.H, x2: e.il, y2: lo, couleur: p.couleurHaut });
  }
  const montrer = p.profils === 'All' ? true : p.profils === 'Bull' ? !t : p.profils === 'Bear' ? t : false;
  if (t !== avant && e.Harr.length > 0 && e.Larr.length > 0) {
    const col = t ? p.couleurHaut : p.couleurBas, gauche = (t ? e.Harr : e.Larr)[(t ? e.Harr : e.Larr).length - 1];
    o.etiquette({ x: gauche, y: t ? e.H : e.L, yloc: 'price', texte: t ? '▼' : '▲', style: t ? 'label_down' : 'label_up', couleur: null, couleurTexte: col });
    if (montrer) {
      const R = p.rangees, bins = new Array(R).fill(0), pas = (e.H - e.L) / R, fin = i - gauche;
      for (let k = 0; k < R; k++) {
        const bl = e.L + pas * k, bh = bl + pas;
        for (let j = 0; j <= fin; j++) { const c = d[i - j].close; if (c >= bl && c < bh) bins[k]++; }
      }
      let max = 0;
      for (const v of bins) if (v > max) max = v;
      for (let k = 0; k < R; k++) {
        const bl = e.L + pas * k, bh = bl + pas, v = bins[k], droite = gauche + v;
        const part = Math.trunc(v / max * 100);
        const bord = Number.isFinite(part) ? transparence(col, 70 - part) : null, fond = Number.isFinite(part) ? transparence(col, 100 - part) : null;
        o.boite({ gauche, haut: bh, droite, bas: bl, couleurBordure: bord, epaisseurBordure: 1, fond, texte: v === max ? String(max) : '', couleurTexte: env.texte });
        if (v === max) e.poc = o.ligne({ x1: droite, y1: (bh + bl) / 2, x2: t ? e.il : e.ih, y2: (bh + bl) / 2, couleur: col, epaisseur: p.epaisseurPoc });
      }
      o.boite({ gauche, haut: e.H, droite: t ? e.il : e.ih, bas: e.L, couleurBordure: transparence(col, 70), epaisseurBordure: 1, fond: null });
    }
  }
  if (derniere && e.poc) e.poc.x2 = d.length - 1;
}

export default class ProfilsOscillationsIndicator {
  static metadata = {
    id: 'profils_oscillations',
    name: 'Profils des oscillations (sommets et creux)',
    shortName: 'POSC',
    description: 'profils_oscillations',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['oscillations', 'sommets', 'creux', 'profil', 'point de controle'],
    inputs: INPUTS,
    outputs: [{ id: 'tendance', name: 'Sens de l’oscillation', type: 'line', hidden: true }],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { tendance: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ProfilsOscillationsIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({
        tendance: d.map((b, i) => ({ time: b.time, value: etat.sorties.tendance[i] ? 1 : -1 })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
