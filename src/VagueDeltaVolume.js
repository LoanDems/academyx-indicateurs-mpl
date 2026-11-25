// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « DeltaPulse Wave [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/lfaZVLub-DeltaPulse-Wave-ChartPrime/
// Adaptation : les lignes et triangles que le script pose aussi sur le graphique des prix (force_overlay) ne sont pas
// dessines (les lignes comptent quand meme dans le plafond de 50 lignes du script) ; les memes divergences restent dans le
// panneau (lignes et points). Le remplissage en degrade vertical prend la couleur a mi-hauteur. Textes en francais.
import { creerObjets } from '../academyscript/objets.js';
import { ema } from '../academyscript/ta.js';
import { format } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide, masque, bit } from './commun.js';

const P = 'Paramètres', NI = 'Niveaux', AN = 'Divergences', TB = 'Tableau de bord', S = 'Style';
const POSITIONS = [
  { label: 'En haut à droite', value: 'top_right' }, { label: 'En bas à droite', value: 'bottom_right' },
  { label: 'En haut à gauche', value: 'top_left' }, { label: 'En bas à gauche', value: 'bottom_left' },
];
const TAILLES = [{ label: 'Très petite', value: 'tiny' }, { label: 'Petite', value: 'small' }, { label: 'Normale', value: 'normal' }, { label: 'Grande', value: 'large' }];
const INPUTS = [
  { id: 'longueur', name: 'Longueur de la vague', type: 'number', entier: true, default: 20, min: 5, max: 500, step: 1, group: P,
    description: 'Moyennes exponentielles du volume des bougies haussières, baissières et du volume total.' },
  { id: 'lissage', name: 'Lissage', type: 'number', entier: true, default: 5, min: 1, max: 200, step: 1, group: P },
  { id: 'seuilHaut', name: 'Seuil haut', type: 'number', default: 25, min: 1, max: 100, step: 1, group: NI },
  { id: 'seuilBas', name: 'Seuil bas', type: 'number', default: -25, min: -100, max: -1, step: 1, group: NI },
  { id: 'ecartMin', name: 'Écart minimal entre deux sommets', type: 'number', entier: true, default: 5, min: 2, max: 200, step: 1, group: AN,
    description: 'Nombre de barres au moins entre deux sommets (ou creux) de la vague pour retenir une divergence.' },
  { id: 'lignes', name: 'Lignes de divergence', type: 'boolean', default: true, group: AN },
  { id: 'tableau', name: 'Tableau de bord', type: 'boolean', default: true, group: TB },
  { id: 'position', name: 'Position', type: 'select', default: 'top_right', options: POSITIONS, group: TB },
  { id: 'taille', name: 'Taille du texte', type: 'select', default: 'small', options: TAILLES, group: TB },
  { id: 'couleurHausse', name: 'Achats dominants', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Ventes dominantes', type: 'color', default: '#ff0055', group: S },
  { id: 'couleurNeutre', name: 'Niveaux', type: 'color', default: '#6b7b8f', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b;
const lt = (a, b) => !nul(a) && !nul(b) && a < b;

function series(p, d) {
  const L = p.longueur;
  const sb = ema(d.map((b) => (b.close > b.open ? b.volume : 0)), L), ss = ema(d.map((b) => (b.close < b.open ? b.volume : 0)), L);
  const st = ema(d.map((b) => (b.volume > 0 ? b.volume : 1)), L);
  const rds = d.map((_, i) => (nul(sb[i]) || nul(ss[i]) ? null : (sb[i] - ss[i]) / (gt(st[i], 0) ? st[i] : 1) * 100));
  return { vague: ema(rds, p.lissage) };
}

function creer(p, env) {
  return {
    o: creerObjets({ maxLignes: 50 }), f: suiteVide(), sorties: { haussier: [], baissier: [], couleurs: [] },
    lastPH: 0, lastPHi: 0, lastWH: 0, lastWHi: 0, lastPL: 0, lastPLi: 0, lastWL: 0, lastWLi: 0,
    typeDiv: 'Aucune', couleurDiv: env.texte,
    // color.new(c, 100) : entierement transparente, elle ne compte que par son opacite (comme na).
    fH: milieu(transparence(p.couleurHausse, 40), null),
    fB: milieu(null, transparence(p.couleurBaisse, 40)),
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, w = s.vague, w0 = w[i], w1 = i >= 1 ? w[i - 1] : null, w2 = i >= 2 ? w[i - 2] : null;
  const haut = lt(w0, w1) && gt(w1, w2) && gt(w1, p.seuilHaut * 0.2);
  const creux = gt(w0, w1) && lt(w1, w2) && lt(w1, p.seuilBas * 0.2);
  let baisse = false, hausse = false;
  if (haut) {
    const b = d[i - 1];
    if (b.high > e.lastPH && w1 < e.lastWH && (i - 1 - e.lastPHi) >= p.ecartMin) {
      baisse = true;
      if (p.lignes) {
        o.ligne({ x1: e.lastPHi, y1: e.lastPH, x2: i - 1, y2: b.high, couleur: p.couleurBaisse, style: 'solid', epaisseur: 2, surPrix: true });
        o.ligne({ x1: e.lastWHi, y1: e.lastWH, x2: i - 1, y2: w1, couleur: p.couleurBaisse, style: 'solid', epaisseur: 2 });
      }
    }
    e.lastPH = b.high; e.lastPHi = i - 1; e.lastWH = w1; e.lastWHi = i - 1;
  }
  if (creux) {
    const b = d[i - 1];
    if (b.low < e.lastPL && w1 > e.lastWL && (i - 1 - e.lastPLi) >= p.ecartMin) {
      hausse = true;
      if (p.lignes) {
        o.ligne({ x1: e.lastPLi, y1: e.lastPL, x2: i - 1, y2: b.low, couleur: p.couleurHausse, style: 'solid', epaisseur: 2, surPrix: true });
        o.ligne({ x1: e.lastWLi, y1: e.lastWL, x2: i - 1, y2: w1, couleur: p.couleurHausse, style: 'solid', epaisseur: 2 });
      }
    }
    e.lastPL = b.low; e.lastPLi = i - 1; e.lastWL = w1; e.lastWLi = i - 1;
  }
  const S = e.sorties;
  S.haussier[i] = hausse; S.baissier[i] = baisse;
  S.couleurs[i] = gt(w0, 0) ? p.couleurHausse : p.couleurBaisse;
  if (hausse && i >= 1) o.plotchar(i - 1, { position: 'bottom', caractere: '●', couleur: p.couleurHausse, taille: 'tiny' });
  if (baisse && i >= 1) o.plotchar(i - 1, { position: 'top', caractere: '●', couleur: p.couleurBaisse, taille: 'tiny' });
  remplir(o, e.f, w, s.zero, i, gt(w0, 0) ? e.fH : lt(w0, 0) ? e.fB : null, derniere);
  if (hausse) { e.typeDiv = 'Haussière'; e.couleurDiv = p.couleurHausse; }
  if (baisse) { e.typeDiv = 'Baissière'; e.couleurDiv = p.couleurBaisse; }
  if (p.tableau && derniere) {
    const g = transparence(p.couleurNeutre, 80), c = S.couleurs[i], tx = env.texte, tt = p.taille;
    const t = o.tableau({ position: p.position, colonnes: 2, lignes: 4, fond: transparence(env.fond, 10), couleurCadre: tx, epaisseurCadre: 1, couleurBordure: tx, epaisseurBordure: 1 });
    t.cellule(0, 0, { texte: 'Delta', couleurTexte: tx, taille: tt, fond: g });
    t.cellule(1, 0, { texte: 'Valeur', couleurTexte: tx, taille: tt, fond: g });
    t.cellule(0, 1, { texte: 'Vague', couleurTexte: tx, alignH: 'left', taille: tt });
    t.cellule(1, 1, { texte: format('{0,number,#.##}', w0), couleurTexte: c, taille: tt });
    t.cellule(0, 2, { texte: 'Tendance', couleurTexte: tx, alignH: 'left', taille: tt });
    t.cellule(1, 2, { texte: gt(w0, 0) ? 'Haussière' : 'Baissière', couleurTexte: c, taille: tt });
    t.cellule(0, 3, { texte: 'Dernière div.', couleurTexte: tx, alignH: 'left', taille: tt });
    t.cellule(1, 3, { texte: e.typeDiv, couleurTexte: e.couleurDiv, taille: tt });
  }
}

function rendre(p, e, d, s) {
  const S = e.sorties, n = d.length;
  const cst = (v) => new Array(n).fill(v);
  const objets = e.o.resultat();
  objets.lignes = objets.lignes.filter((l) => !l.surPrix);
  return {
    base: tracer(d, cst(0), cst(transparence(p.couleurNeutre, 50))),
    seuilHaut: tracer(d, cst(p.seuilHaut), cst(transparence(p.couleurNeutre, 80))),
    seuilBas: tracer(d, cst(p.seuilBas), cst(transparence(p.couleurNeutre, 80))),
    vague: tracer(d, s.vague, S.couleurs),
    bougies: d.map((b, i) => ({ time: b.time, value: 1, color: S.couleurs[i] })),
    signaux: masque(d, [S.haussier, S.baissier]),
    objets,
  };
}

const ALERTES = [['vague_delta_divergence_haussiere', 'Divergence haussière'], ['vague_delta_divergence_baissiere', 'Divergence baissière']];

export default class VagueDeltaVolumeIndicator {
  static metadata = {
    id: 'vague_delta_volume',
    name: 'Vague du delta de volume',
    shortName: 'VDV',
    description: 'vague_delta_volume',
    version: '1.0.0',
    overlay: false,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['volume', 'delta', 'oscillateur', 'divergence', 'pression'],
    inputs: INPUTS,
    outputs: [
      { id: 'vague', name: 'Vague du delta', type: 'line', color: '#00ffbb', lineWidth: 2 },
      { id: 'base', name: 'Zéro', type: 'line', color: 'rgba(107, 123, 143, 0.5)', lineWidth: 1 },
      { id: 'seuilHaut', name: 'Seuil haut', type: 'line', color: 'rgba(107, 123, 143, 0.2)', lineWidth: 1 },
      { id: 'seuilBas', name: 'Seuil bas', type: 'line', color: 'rgba(107, 123, 143, 0.2)', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00ffbb', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { vague: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(VagueDeltaVolumeIndicator._memo, JSON.stringify([p, env.fond, env.texte]), data, {
      creer: () => creer(p, env),
      series: (d) => { const s = series(p, d); s.zero = new Array(d.length).fill(0); return s; },
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, derniere, s, env),
      rendre: (e, d, s) => rendre(p, e, d, s),
    });
  }
}
