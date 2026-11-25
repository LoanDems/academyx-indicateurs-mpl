// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Machine Learning Key Levels [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/fm7TWJSE-Machine-Learning-Key-Levels-AlgoAlpha/
// Adaptation : textes en francais ; pas d'erreur d'execution sur une memoire trop courte (les niveaux ne sont simplement pas calcules).
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow } from '../academyscript/ta.js';
import { tostring, formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const R = 'Regroupement', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des sommets et creux', type: 'number', entier: true, default: 14, min: 1, max: 200, step: 1, group: R },
  { id: 'memoire', name: 'Sommets et creux gardés', type: 'number', entier: true, default: 50, min: 2, max: 150, step: 1, group: R,
    description: 'Les plus récents seulement ; le regroupement coûte vite cher au-delà de quelques dizaines.' },
  { id: 'niveaux', name: 'Nombre de niveaux', type: 'number', entier: true, default: 5, min: 1, max: 50, step: 1, group: R,
    description: 'Utilisé quand le nombre automatique est désactivé.' },
  { id: 'auto', name: 'Nombre de niveaux automatique', type: 'boolean', default: true, group: R,
    description: 'Choisit entre 2 et 10 niveaux celui qui sépare le mieux les groupes (score de silhouette).' },
  { id: 'pivots', name: 'Afficher les sommets et creux', type: 'boolean', default: true, group: S },
  { id: 'lueur', name: 'Lueur des niveaux', type: 'boolean', default: true, group: S },
  { id: 'force', name: 'Force des niveaux en', type: 'select', default: 'Percent', group: S,
    options: [{ label: 'Pourcentage', value: 'Percent' }, { label: 'Nombre', value: 'Count' }] },
  { id: 'c1', name: 'Niveau 1', type: 'color', default: '#FDD835', group: S },
  { id: 'c2', name: 'Niveau 2', type: 'color', default: '#2962FF', group: S },
  { id: 'c3', name: 'Niveau 3', type: 'color', default: '#FF9800', group: S },
  { id: 'c4', name: 'Niveau 4', type: 'color', default: '#F23645', group: S },
  { id: 'c5', name: 'Niveau 5', type: 'color', default: '#089981', group: S },
  { id: 'c6', name: 'Niveau 6', type: 'color', default: '#26a69a', group: S },
  { id: 'c7', name: 'Niveau 7', type: 'color', default: '#ef5350', group: S },
  { id: 'c8', name: 'Niveau 8', type: 'color', default: '#787b86', group: S },
  { id: 'tableau', name: 'Tableau des mesures', type: 'boolean', default: true, group: S },
  { id: 'tailleTableau', name: 'Taille du texte du tableau', type: 'select', default: 'Small', group: S,
    options: [{ label: 'Très petite', value: 'Tiny' }, { label: 'Petite', value: 'Small' }, { label: 'Normale', value: 'Normal' }] },
  { id: 'positionTableau', name: 'Position du tableau', type: 'select', default: 'Top Right', group: S,
    options: [
      { label: 'En haut à gauche', value: 'Top Left' }, { label: 'En haut au centre', value: 'Top Center' }, { label: 'En haut à droite', value: 'Top Right' },
      { label: 'Au milieu à droite', value: 'Middle Right' }, { label: 'En bas à gauche', value: 'Bottom Left' }, { label: 'En bas au centre', value: 'Bottom Center' },
      { label: 'En bas à droite', value: 'Bottom Right' },
    ] },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const pourcent = (v) => (Number.isFinite(v) ? formaterMotif(v, '0.00') + '%' : 'NaN');

/** average_linkage_with_labels(src, k) du script : regroupement hierarchique a liaison moyenne, niveaux tries. */
export function liaisonMoyenne(vals, k) {
  const n = vals.length;
  const means = vals.slice(), sizes = new Array(n).fill(1), lbl = vals.map((_, i) => i);
  let D = means.map((a) => means.map((b) => Math.abs(a - b)));
  let active = n;
  while (active > k) {
    let best = null, bi = null, bj = null;
    for (let i = 0; i <= active - 2; i++) {
      for (let j = i + 1; j <= active - 1; j++) { const dd = D[i][j]; if (best === null || dd < best) { best = dd; bi = i; bj = j; } }
    }
    const mi = means[bi], mj = means[bj], si = sizes[bi], sj = sizes[bj];
    means[bi] = (mi * si + mj * sj) / (si + sj);
    sizes[bi] = si + sj;
    for (let q = 0; q < n; q++) { const lp = lbl[q]; if (lp === bj) lbl[q] = bi; else if (lp > bj) lbl[q] = lp - 1; }
    for (let c = 0; c <= active - 1; c++) {
      if (c !== bi && c !== bj) { const di = D[bi][c], dj = D[bj][c], nd = (si * di + sj * dj) / (si + sj); D[bi][c] = nd; D[c][bi] = nd; }
    }
    means.splice(bj, 1); sizes.splice(bj, 1);
    D.splice(bj, 1); D = D.map((r) => { const t = r.slice(); t.splice(bj, 1); return t; });
    active--;
  }
  const tri = means.slice().sort((a, b) => a - b);
  const map = means.map((m) => tri.indexOf(m));
  return { niveaux: tri, etiquettes: lbl.map((l) => map[l]) };
}

/** calc_silhouette_score(data, labels) du script ; na se propage (b_i na avec un seul groupe). */
export function silhouette(vals, labels) {
  const n = vals.length, uniques = [];
  for (const l of labels) if (uniques.indexOf(l) === -1) uniques.push(l);
  let total = 0.0;
  for (let q = 0; q < n; q++) {
    const lq = labels[q];
    let si = 0.0, ci = 0;
    for (let j = 0; j < n; j++) if (j !== q && labels[j] === lq) { si += Math.abs(vals[q] - vals[j]); ci++; }
    const a = ci > 0 ? si / ci : null;
    let b = null;
    for (const cl of uniques) {
      if (cl === lq) continue;
      let so = 0.0, co = 0;
      for (let j = 0; j < n; j++) if (labels[j] === cl) { so += Math.abs(vals[q] - vals[j]); co++; }
      const av = co > 0 ? so / co : null;
      if (av !== null && (b === null || av < b)) b = av;
    }
    let s;
    if (ci === 0) s = 0.0;
    else if (a === 0 && b === 0) s = 0.0;
    else s = a === null || b === null ? null : (b - a) / Math.max(a, b);
    total = total === null || s === null ? null : total + s;
  }
  return n > 0 ? (total === null ? null : total / n) : 0.0;
}

function optimal(vals, minK, maxK) {
  let best = -1.0, k0 = minK;
  for (let k = minK; k <= maxK; k++) {
    if (k >= vals.length) break;
    const sc = silhouette(vals, liaisonMoyenne(vals, k).etiquettes);
    if (sc !== null && sc > best) { best = sc; k0 = k; }
  }
  return k0;
}

const POSITIONS = { 'Top Left': 'top_left', 'Top Center': 'top_center', 'Top Right': 'top_right', 'Middle Right': 'middle_right', 'Bottom Left': 'bottom_left', 'Bottom Center': 'bottom_center', 'Bottom Right': 'bottom_right' };
const TAILLES = { Tiny: 'tiny', Small: 'small', Normal: 'normal' };

function series(p, d) {
  return { ph: pivothigh(d, p.longueur, p.longueur), pl: pivotlow(d, p.longueur, p.longueur) };
}

function etape(p, e, d, i, derniere, s, env) {
  const pv = !nul(s.ph[i]) ? s.ph[i] : s.pl[i];
  if (!nul(pv)) e.P.unshift({ v: pv, b: i - p.longueur });
  while (e.P.length > p.memoire) e.P.pop();
  if (derniere) dessiner(p, e, i, env);
}

function dessiner(p, e, i, env) {
  const o = e.o, P = e.P, vals = P.map((x) => x.v), pal = [p.c1, p.c2, p.c3, p.c4, p.c5, p.c6, p.c7, p.c8];
  const couleur = (k) => pal[k % pal.length];
  let niveaux = [], labs = [], k = p.niveaux;
  if (P.length >= 2) {
    if (p.auto) k = optimal(vals, 2, Math.min(10, P.length));
    if (P.length >= k) { const r = liaisonMoyenne(vals, k); niveaux = r.niveaux; labs = r.etiquettes; }
  }
  e.k = niveaux.length > 0 ? niveaux.length : null;
  const debut = P.length > 0 ? P[P.length - 1].b : i;
  niveaux.forEach((y, j) => {
    if (p.lueur) for (let a = 0; a <= 2; a++) o.ligne({ x1: debut, y1: y, x2: i, y2: y, couleur: transparence(couleur(j), 90 + a * 3), epaisseur: 15 + a * 15 });
    o.ligne({ x1: debut, y1: y, x2: i, y2: y, couleur: couleur(j), epaisseur: 2 });
  });
  if (P.length > 0 && p.pivots) {
    P.forEach((st, j) => { const c = j < labs.length ? labs[j] : 0; o.etiquette({ x: st.b, y: st.v, texte: '', style: 'circle', taille: 'tiny', couleur: transparence(couleur(c), 70) }); });
  }
  if (niveaux.length > 0) {
    const nb = new Array(niveaux.length).fill(0);
    for (const l of labs) nb[l]++;
    niveaux.forEach((y, j) => {
      const force = P.length > 0 ? nb[j] / P.length : 0.0;
      const transp = Math.round((0.9 - force) * 100);
      o.etiquette({ x: i, y, texte: p.force === 'Percent' ? pourcent(force * 100) : String(nb[j]), style: 'label_left', taille: 'normal', couleur: transparence(couleur(j), transp), couleurTexte: env.texte });
    });
  }
  if (p.tableau) {
    const sil = labs.length > 0 ? silhouette(vals, labs) : null;
    const tailles = new Array(k).fill(0);
    for (const l of labs) tailles[l]++;
    const grand = tailles.length > 0 ? Math.max(...tailles) : null, petit = tailles.length > 0 ? Math.min(...tailles) : null;
    const t = o.tableau({ position: POSITIONS[p.positionTableau], colonnes: 2, lignes: 6, fond: '#181924', epaisseurBordure: 1, couleurBordure: '#000000', couleurCadre: '#000000', epaisseurCadre: 1 });
    const taille = TAILLES[p.tailleTableau];
    const lignes = [['Mesure', 'Valeur'], ['Sommets et creux', String(P.length)], ['Niveaux', String(k)],
      ['Score de silhouette', sil === null ? 'NaN' : tostring(sil, '#.###')], ['Plus grand groupe', grand === null ? 'NaN' : String(grand)], ['Plus petit groupe', petit === null ? 'NaN' : String(petit)]];
    lignes.forEach(([a, b], l) => { t.cellule(0, l, { texte: a, couleurTexte: '#FFFFFF', taille }); t.cellule(1, l, { texte: b, couleurTexte: '#FFFFFF', taille }); });
  }
}

export default class NiveauxClesRegroupementIndicator {
  static metadata = {
    id: 'niveaux_cles_regroupement',
    name: 'Niveaux clés par regroupement des sommets et creux',
    shortName: 'NIV-CLES',
    description: 'niveaux_cles_regroupement',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['niveaux', 'regroupement', 'sommets', 'creux', 'support', 'resistance'],
    inputs: INPUTS,
    outputs: [
      { id: 'nombreNiveaux', name: 'Nombre de niveaux', type: 'line', hidden: true },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { nombreNiveaux: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NiveauxClesRegroupementIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }), P: [], k: null }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({ nombreNiveaux: d.map((b, i) => ({ time: b.time, value: i === d.length - 1 ? etat.k : null })), objets: etat.o.resultat() }),
    });
  }
}
