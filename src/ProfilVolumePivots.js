// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Volume Profile + Pivot Levels [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/KjzRRZIc-Volume-Profile-Pivot-Levels-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer } from './commun.js';

const P = 'Profil de volume', V = 'Sommets et creux', S = 'Style';
const INPUTS = [
  { id: 'periode', name: 'Barres du profil', type: 'number', entier: true, default: 200, min: 2, max: 500, step: 1, group: P },
  { id: 'rangees', name: 'Rangées', type: 'number', entier: true, default: 50, min: 2, max: 200, step: 1, group: P },
  { id: 'poc', name: 'Rangée la plus échangée', type: 'boolean', default: true, group: P },
  { id: 'pivots', name: 'Afficher les sommets et creux', type: 'boolean', default: true, group: V },
  { id: 'longueurPivot', name: 'Barres de part et d’autre', type: 'number', entier: true, default: 10, min: 1, max: 50, step: 1, group: V },
  { id: 'filtre', name: 'Volume minimal de la rangée (%)', type: 'number', entier: true, default: 20, min: 0, max: 100, step: 1, group: V,
    description: 'Un sommet ou un creux n’est retenu que si la rangée du profil à son prix atteint ce pourcentage de la plus échangée.' },
  { id: 'couleurHausse', name: 'Volume net acheteur / creux', type: 'color', default: '#089981', group: S },
  { id: 'couleurBaisse', name: 'Volume net vendeur / sommets', type: 'color', default: '#880E4F', group: S },
];

const BLEU = '#2962FF', BLANC = '#FFFFFF';
const pourcent = (v) => (Number.isFinite(v) ? `${tostring(v, '0.00')}%` : 'NaN');
const volume = (v) => (Number.isFinite(v) ? tostring(v, 'volume') : 'NaN');

function creer() {
  return { o: creerObjets({ maxEtiquettes: 500, maxLignes: 500, maxPolylignes: 100 }), pivots: [] };
}

function etape(p, e, d, i, derniere, s) {
  const L = p.longueurPivot;
  if (s.ph[i] !== null) e.pivots.push({ value: d[i - L].high, index: i - L, haut: true });
  if (s.pl[i] !== null) e.pivots.push({ value: d[i - L].low, index: i - L, haut: false });
  for (const q of e.pivots) if (q.index <= i - p.periode) e.pivots.splice(e.pivots.indexOf(q), 1);
  if (!derniere) return;

  const o = e.o, N = p.periode, R = p.rangees;
  let H = null, B = null;
  for (let k = 0; k < N; k++) {
    const b = d[i - k];
    if (!b) continue;
    H = H === null ? Math.max(b.high, b.low) : Math.max(H, b.high, b.low);
    B = B === null ? Math.min(b.high, b.low) : Math.min(B, b.high, b.low);
  }
  const pas = (H - B) / R;
  const bins = new Array(R).fill(0), deltas = new Array(R).fill(0);
  for (let r = 0; r < R; r++) {
    const bas = B + pas * r, haut = bas + pas;
    for (let k = 0; k < N; k++) {
      const b = d[i - k];
      if (b && b.close >= bas - pas && b.close < haut + pas) bins[r] += b.volume;
      // [FIX 2026-11-26] volume de la barre j (le script lisait `volume`, celui de la
      // barre courante, pour toutes : le Delta ne comptait que le nombre de barres
      // haussieres et baissieres). Ecart volontaire ; barre absente = 0.
      deltas[r] += b ? (b.close > b.open ? b.volume : -b.volume) : 0;
    }
  }
  let delta = 0;
  for (const v of deltas) delta += v;
  let max = -Infinity;
  for (const v of bins) if (v > max) max = v;
  const points = [];
  const niveaux = [];
  let poc = null, etiquettePoc = null;
  const gauche = i - N;
  for (let r = 0; r < R; r++) {
    const bas = B + pas * r, haut = bas + pas, mid = (bas + haut) / 2;
    const v = bins[r];
    const droite = gauche + Math.round(v / max * 50);
    const pct = v / max * 100;
    if (r === 0) points.push({ x: gauche, y: bas });
    points.push({ x: droite + 4, y: mid });
    if (r === R - 1) points.push({ x: gauche, y: haut });
    if (pct === 100 && p.poc) {
      poc = o.ligne({ x1: droite + 4, y1: mid, x2: i, y2: mid, couleur: BLEU, epaisseur: 2 });
      etiquettePoc = o.etiquette({ x: i, y: mid, style: 'label_left', texte: volume(v), couleur: BLEU, couleurTexte: BLANC });
    }
    if (e.pivots.length > 0 && p.pivots) {
      for (const q of e.pivots) {
        if (Math.abs(mid - q.value) <= pas && pct >= p.filtre && i - N + 54 <= q.index) {
          const c = q.haut ? p.couleurBaisse : p.couleurHausse;
          const texte = q.haut ? `${volume(v)}\n${pourcent(pct)}` : `${pourcent(pct)}\n${volume(v)}`;
          o.etiquette({ x: q.index, y: q.value, style: q.haut ? 'label_down' : 'label_up', couleur: c, texte, couleurTexte: BLANC });
          o.ligne({ x1: q.index - L, y1: q.value, x2: q.index + L, y2: q.value, couleur: c, epaisseur: 2 });
          niveaux.push(o.ligne({ x1: q.index, y1: q.value, x2: q.index, y2: q.value, style: 'dotted', couleur: c }));
        }
      }
    }
  }
  for (let j = N - 1; j >= 0; j--) {
    const b = d[i - j];
    for (const l of niveaux) {
      if (b && b.high > l.y1 && b.low < l.y1 && i - j > l.x1) { l.x2 = i - j; niveaux.splice(niveaux.indexOf(l), 1); } else l.x2 = i;
    }
  }
  const couleur = delta > 0 ? p.couleurHausse : p.couleurBaisse;
  if (poc) poc.couleur = couleur;
  if (etiquettePoc) etiquettePoc.couleur = couleur;
  o.polyligne({ points, courbe: true, fermee: false, couleur, epaisseur: 4 });
}

export default class ProfilVolumePivotsIndicator {
  static metadata = {
    id: 'profil_volume_pivots',
    name: 'Profil de volume et sommets et creux échangés',
    shortName: 'VP-PIV',
    description: 'profil_volume_pivots',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['profil de volume', 'sommets', 'creux', 'poc', 'niveaux'],
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
    void ctx;
    return executer(ProfilVolumePivotsIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: (d) => ({ ph: pivothigh(d, p.longueurPivot, p.longueurPivot), pl: pivotlow(d, p.longueurPivot, p.longueurPivot) }),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat) => ({ objets: etat.o.resultat() }),
    });
  }
}
