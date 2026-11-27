// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Dynamic Support/Resistance Zones [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/lrYnTj06-Dynamic-Support-Resistance-Zones-ChartPrime/
// Adaptation : l'option « Calculate on Real Time Only » (accelerateur de TradingView) n'est pas reprise : le calcul se fait
// sur l'historique ; une barre sans plage de prix definie (sommets ou creux pas encore tous connus) ne note aucun pivot.
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, milieu, remplir, suiteVide } from './commun.js';

const G = 'Paramètres', PV = 'Sommets et creux', ST = 'Style';
const INPUTS = [
  { id: 'ponderation', name: 'Pondération', type: 'select', default: 'Linear', group: G,
    options: [{ label: 'Égale', value: 'Linear' }, { label: 'Par l’ancienneté', value: 'Time' }, { label: 'Par le volume', value: 'Volume' }],
    description: 'Égale : chaque sommet ou creux compte pour un. Ancienneté : les plus récents comptent davantage. Volume : selon le volume de leur bougie.' },
  { id: 'nombrePivots', name: 'Nombre de sommets et de creux', type: 'number', entier: true, default: 50, min: 1, max: 500, step: 1, group: G },
  { id: 'filtrage', name: 'Lissage de la distribution', type: 'number', default: 3, min: 0, max: 12, step: 0.5, group: G },
  { id: 'precisionManuelle', name: 'Nombre de divisions fixe', type: 'boolean', default: true, group: G,
    description: 'Sinon le nombre de divisions suit la plage moyenne d’une bougie (10 au moins, 100 au plus).' },
  { id: 'precision', name: 'Nombre de divisions', type: 'number', entier: true, default: 75, min: 3, max: 300, step: 1, group: G },
  { id: 'longueur1', name: 'Longueur 1', type: 'number', entier: true, default: 5, min: 1, max: 200, step: 1, group: PV, legende: false },
  { id: 'avec1', name: 'Utiliser la longueur 1', type: 'boolean', default: true, group: PV },
  { id: 'longueur2', name: 'Longueur 2', type: 'number', entier: true, default: 10, min: 2, max: 200, step: 1, group: PV, legende: false },
  { id: 'avec2', name: 'Utiliser la longueur 2', type: 'boolean', default: true, group: PV },
  { id: 'longueur3', name: 'Longueur 3', type: 'number', entier: true, default: 20, min: 3, max: 200, step: 1, group: PV, legende: false },
  { id: 'avec3', name: 'Utiliser la longueur 3', type: 'boolean', default: true, group: PV },
  { id: 'longueur4', name: 'Longueur 4', type: 'number', entier: true, default: 50, min: 4, max: 200, step: 1, group: PV, legende: false },
  { id: 'avec4', name: 'Utiliser la longueur 4', type: 'boolean', default: true, group: PV },
  { id: 'sommets', name: 'Compter les sommets', type: 'boolean', default: true, group: PV },
  { id: 'creux', name: 'Compter les creux', type: 'boolean', default: true, group: PV },
  { id: 'niveaux', name: 'Afficher les supports et résistances', type: 'boolean', default: true, group: ST },
  { id: 'rebonds', name: 'Afficher les rebonds', type: 'boolean', default: true, group: ST },
  { id: 'reculRebonds', name: 'Barres examinées pour les rebonds', type: 'number', entier: true, default: 100, min: 1, max: 1000, step: 1, group: ST },
  { id: 'zones', name: 'Afficher les zones', type: 'boolean', default: false, group: ST },
  { id: 'opaciteZones', name: 'Transparence des zones', type: 'number', entier: true, default: 88, min: 0, max: 100, step: 1, group: ST },
  { id: 'couleurSupport', name: 'Support', type: 'color', default: '#00FF00', group: ST },
  { id: 'couleurResistance', name: 'Résistance', type: 'color', default: '#FF0000', group: ST },
  { id: 'distribution', name: 'Afficher la distribution', type: 'boolean', default: true, group: ST },
  { id: 'scores', name: 'Afficher les scores', type: 'boolean', default: true, group: ST },
  { id: 'echelle', name: 'Largeur de la distribution (barres)', type: 'number', entier: true, default: 30, min: 5, max: 300, step: 1, group: ST,
    description: 'Elle fixe aussi la finesse de la recherche des pics.' },
  { id: 'fondDistribution', name: 'Prolonger la distribution sur le graphique', type: 'boolean', default: true, group: ST },
  { id: 'opaciteFond', name: 'Transparence du prolongement', type: 'number', entier: true, default: 85, min: 0, max: 100, step: 1, group: ST },
  { id: 'couleurHaute', name: 'Score élevé', type: 'color', default: '#00FFFF', group: ST },
  { id: 'couleurBasse', name: 'Score faible', type: 'color', default: '#FF00FF', group: ST },
  { id: 'couleurTexte', name: 'Texte des scores', type: 'color', default: '#111111', group: ST },
  { id: 'moyenne', name: 'Moyenne des niveaux pondérée', type: 'boolean', default: false, group: ST },
  { id: 'lissageMoyenne', name: 'Lissage de la moyenne', type: 'number', entier: true, default: 12, min: 0, max: 200, step: 1, group: ST },
  { id: 'couleurMoyenne', name: 'Moyenne', type: 'color', default: '#5536e4', group: ST },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const fini = (v) => typeof v === 'number' && Number.isFinite(v);
// Boucles indexees (memes comparaisons, dans le meme ordre, que l'ancien for...of).
const amax = (a) => { let m = null; for (let k = 0; k < a.length; k++) { const v = a[k]; if (m === null || v > m) m = v; } return m; };
const amin = (a) => { let m = null; for (let k = 0; k < a.length; k++) { const v = a[k]; if (m === null || v < m) m = v; } return m; };
const mx = (a, c) => (a === null || c === null ? null : Math.max(a, c));
const mn = (a, c) => (a === null || c === null ? null : Math.min(a, c));

const sinc = (x, bw) => (x === 0 ? 1 : Math.sin(Math.PI * x / bw) / (Math.PI * x / bw));
// Poids sinc(i - j, L + 1) par ecart i - j (memes appels, memes valeurs) : la distribution est filtree a chaque barre.
const TABLES = new Map();
function poidsSinc(n, L) {
  const k = `${n}|${L}`;
  let t = TABLES.get(k);
  if (!t) {
    t = new Float64Array(2 * n - 1);
    for (let d = -(n - 1); d <= n - 1; d++) t[d + n - 1] = sinc(d, L + 1);
    if (TABLES.size > 16) TABLES.clear();
    TABLES.set(k, t);
  }
  return t;
}

/** sinc_filter(source, length) du script. */
function filtrer(src, L) {
  if (!(L > 0 && src.length > 0)) return src;
  const n = src.length, out = new Array(n), T = poidsSinc(n, L);
  for (let i = 0; i < n; i++) {
    let s = 0, sw = 0;
    for (let j = 0; j < n; j++) { const w = T[i - j + n - 1]; s += src[j] * w; sw += w; }
    const c = s / sw;
    out[i] = c >= 0 ? c : 0;
  }
  return out;
}

/** peak_detection(source, scale, real_minimum, true) du script. */
function pics(src, echelle, rmin) {
  const out = [], n = src.length;
  if (n === 0) return out;
  const mx = amax(src) - rmin;
  const niv = (v) => Math.trunc((v - rmin) / mx * (echelle - 1) + 1);
  let i = -1;
  while (i < n - 1) {
    i += 1;
    const centre = niv(src[i]), avant = i > 0 ? niv(src[i - 1]) : 0, apres = i < n - 1 ? niv(src[i + 1]) : 0;
    if (centre > avant) {
      let j = i + 1;
      if (centre === apres) {
        while (j <= n - 1) {
          j += 1;
          const vp = niv(src[j - 1]), vn = j <= n - 1 ? niv(src[j]) : 0;
          if (vn !== vp) {
            if (centre > vn) { const p = Math.trunc((i + j) / 2.0); out.push(j - i > 2 && (j - i) % 2 !== 0 ? p : p - 0.5); i = j; }
            else i = j - 1;
            break;
          }
        }
      }
      if (centre > apres) out.push(i);
    }
  }
  return out;
}

function series(p, d) {
  const L = [p.longueur1, p.longueur2, p.longueur3, p.longueur4];
  return { ph: L.map((l) => pivothigh(d, l, l)), pl: L.map((l) => pivotlow(d, l, l)), L };
}

/** Une barre : pivots, plage, scores bruts (avant filtrage). */
function noter(p, e, d, i, s, avecScores) {
  const b = d[i];
  // [PERF 2026-11-26] Sans fermeture ni tableau par barre ; ta.min des poids seulement en
  // ponderation « Time » (seul mode qui le lit). Memes operations, dans le meme ordre.
  for (let k = 0; k < 4; k++) {
    if (!(k === 0 ? p.avec1 : k === 1 ? p.avec2 : k === 2 ? p.avec3 : p.avec4)) continue;
    const v = s.ph[k][i];
    if (!nul(v)) { e.hauts.push(v); e.poidsHauts.push(poidsPivot(p, d, i, s.L[k])); }
  }
  for (let k = 0; k < 4; k++) {
    if (!(k === 0 ? p.avec1 : k === 1 ? p.avec2 : k === 2 ? p.avec3 : p.avec4)) continue;
    const v = s.pl[k][i];
    if (!nul(v)) { e.bas.push(v); e.poidsBas.push(poidsPivot(p, d, i, s.L[k])); }
  }
  if (e.hauts.length > p.nombrePivots) { e.hauts.shift(); e.poidsHauts.shift(); }
  if (e.bas.length > p.nombrePivots) { e.bas.shift(); e.poidsBas.shift(); }
  e.maxHaut = e.maxHaut === null || b.high > e.maxHaut ? b.high : e.maxHaut; // ta.max(high)
  const haut = mx(p.sommets ? amax(e.hauts) : 0, p.creux ? amax(e.bas) : 0);
  const bas = mn(p.sommets ? amin(e.hauts) : e.maxHaut, p.creux ? amin(e.bas) : e.maxHaut);
  e.cum += b.high - b.low;
  const atr = e.cum > 0 ? e.cum / (i + 1) : 10;
  const nb = p.precisionManuelle ? p.precision : (haut === null || bas === null ? null : Math.min(100, Math.max(10, Math.ceil((haut - bas) / atr))));
  const pas = nb === null || haut === null || bas === null ? null : (haut - bas) / nb;
  const n = { i, scores: null, bas, pas, nb, atr, close: b.close };
  if (avecScores) n.scores = scoresDe(p, e, n);
  return n;
}
/** Scores bruts de la barre `n.i`, lus sur les pivots retenus a cette barre (e.hauts, e.bas). */
function scoresDe(p, e, n) {
  const { i, bas, pas, nb } = n;
  const scores = new Array(nb === null ? 0 : nb).fill(0);
  if (fini(pas) && pas > 0) {
    if (p.sommets) ajouterScores(p, scores, i, e.hauts, e.poidsHauts, bas, pas, nb);
    if (p.creux) ajouterScores(p, scores, i, e.bas, e.poidsBas, bas, pas, nb);
  }
  return scores;
}
const poidsPivot = (p, d, i, L) => (p.ponderation === 'Linear' ? 1 : p.ponderation === 'Time' ? i - L : (i - L >= 0 ? d[i - L].volume : null));
function ajouterScores(p, scores, i, src, w, bas, pas, nb) {
  const temps = p.ponderation === 'Time';
  const wmin = temps ? amin(w) : 0;
  for (let q = 0; q < src.length; q++) {
    const W = temps ? 1 + (i - wmin) - (i - w[q]) : w[q];
    const idx = Math.min(Math.floor((src[q] - bas) / pas), nb - 1);
    if (idx >= 0) scores[idx] = scores[idx] + W;
  }
}

/** Objets de la barre confirmee `n.i` (supprimes et recrees a chaque barre confirmee dans le script). */
function dessiner(p, e, d, n, filtres) {
  const o = e.o, i = n.i, mx = amax(filtres);
  if (!(mx > 0)) return;
  let rmin = 0;
  for (const v of filtres.slice().sort((a, b) => a - b)) if (v !== 0) { rmin = v; break; }
  const pk = pics(filtres, p.echelle, rmin);
  if (pk.length > 0 && p.niveaux) {
    for (const q of pk) {
      const haut = n.bas + n.pas * (q + 1), bas = n.bas + n.pas * q, niveau = (haut + bas) / 2;
      const c = n.close > niveau ? p.couleurSupport : p.couleurResistance;
      if (p.rebonds) rebonds(p, o, d, i, niveau, n.atr);
      o.ligne({ x1: i + 3, y1: niveau, x2: i + p.echelle + 3, y2: niveau, couleur: c, epaisseur: 2, extend: 'left' });
      if (p.zones) { const z = transparence(c, p.opaciteZones); o.boite({ gauche: i - 1, haut, droite: i + p.echelle + 3, bas, couleurBordure: z, fond: z, extend: 'left' }); }
    }
  }
  if (p.distribution || p.fondDistribution) {
    for (let q = 0; q < filtres.length; q++) {
      const ms = mx - rmin, brut = filtres[q];
      const sc = Math.trunc((brut - rmin) / ms * (p.echelle - 1) + 1);
      if (!Number.isFinite(sc)) continue;
      const c = degrade(sc, 0, p.echelle, p.couleurBasse, p.couleurHaute);
      const haut = n.bas + n.pas * (q + 1), bas = n.bas + n.pas * q;
      const txt = p.scores ? (p.ponderation === 'Volume' ? tostring(brut, 'volume') : String(Math.ceil(brut))) : '';
      if (brut > 0) {
        if (p.distribution) o.boite({ gauche: i + p.echelle - sc + 3, haut, droite: i + p.echelle + 3, bas, fond: c, couleurBordure: c, texte: txt, couleurTexte: p.couleurTexte });
        if (p.fondDistribution) { const f = transparence(c, p.opaciteFond); o.boite({ gauche: i + p.echelle - sc + 3, haut, droite: i + p.echelle + 3, bas, fond: f, couleurBordure: f, extend: 'left' }); }
      }
    }
  }
}

/** method hit() du script : rebonds sur le niveau dans les `recul` dernieres bougies. */
function rebonds(p, o, d, i, niveau, atr) {
  for (let k = 0; k < p.reculRebonds; k++) {
    if (i - k < 0) continue;
    const b = d[i - k], h = b.high, l = b.low, plage = h - l, pl = niveau - l, pc = pl / plage;
    if (!(pc <= 1 && pc >= 0)) continue;
    const op = b.open, cl = b.close, cn = d[i - Math.max(k - 1, 0)].close, pol = cl > op;
    const ht = Math.max(op, cl), bt = Math.min(op, cl);
    const mh = h - ht, tw = (niveau - ht) / mh, mb = bt - l, bw = pl / mb, ph = mh / plage, pb = mb / plage;
    const rebondHaut = (tw <= 1 && tw >= 0 && tw >= 0.5) || (ph <= 0.25 && niveau < h && niveau > ht) || (plage <= atr * 2 && niveau <= h && niveau >= ht);
    const rebondBas = (bw <= 1 && bw >= 0 && bw <= 0.5) || (pb <= 0.25 && niveau > l && niveau < bt) || (plage <= atr * 2 && niveau <= bt && niveau >= l);
    const baissier = op < niveau && cn < niveau, haussier = op > niveau && cn > niveau;
    if ((rebondHaut || (pol && pc >= 0.7)) && baissier) { o.etiquette({ x: i - k, y: h, texte: '⬤', couleur: null, style: 'label_down', couleurTexte: p.couleurResistance }); continue; }
    if ((rebondBas || (!pol && pc <= 0.3)) && haussier) o.etiquette({ x: i - k, y: l, texte: '⬤', couleur: null, style: 'label_up', couleurTexte: p.couleurSupport });
  }
}

/** ma() du script : prix moyen des divisions pondere par leur score filtre. */
function moyennePonderee(f, n) {
  if (!(amax(f) > 0)) return null;
  let w = 0, s = 0;
  for (let q = 0; q < f.length; q++) {
    const sc = f[q];
    if (sc === 0) continue;
    const pr = (n.bas + n.pas * (q + 1) + (n.bas + n.pas * q)) / 2;
    w += sc; s += pr * sc;
  }
  return s / w;
}

function etape(p, e, d, i, derniere, s, env) {
  // [PERF 2026-11-26] Sans moyenne, les scores ne servent qu'a la barre DESSINEE : la
  // derniere, ou la derniere close (e.ferme) tant que la derniere n'est pas confirmee. Ceux
  // d'une barre close sont calcules a la derniere barre, avant que noter() ne touche aux
  // pivots : e.hauts / e.bas sont alors exactement ceux de e.ferme.i.
  if (derniere && e.ferme && e.ferme.scores === null) e.ferme.scores = scoresDe(p, e, e.ferme);
  const S = e.sorties, n = noter(p, e, d, i, s, derniere || p.moyenne);
  let f = null;
  if (p.moyenne) {
    f = filtrer(n.scores, p.filtrage);
    S.ma[i] = A.pas(S, e.lissage, i, moyennePonderee(f, n));
  } else S.ma[i] = null;
  S.atr[i] = n.atr;
  S.haut[i] = nul(S.ma[i]) ? null : S.ma[i] + n.atr / 2;
  S.bas[i] = nul(S.ma[i]) ? null : S.ma[i] - n.atr / 2;
  remplir(e.o, e.f1, S.ma, S.haut, i, e.lueur1, derniere);
  remplir(e.o, e.f2, S.ma, S.bas, i, e.lueur2, derniere);
  if (!derniere) { e.ferme = n; return; }
  // Barre en cours non confirmee : ni suppression ni creation, les objets de la derniere barre close restent.
  const cible = env.derniereConfirmee ? n : e.ferme;
  if (cible) dessiner(p, e, d, cible, cible === n && f ? f : filtrer(cible.scores, p.filtrage));
}

export default class ZonesSupportResistanceIndicator {
  static metadata = {
    id: 'zones_support_resistance',
    name: 'Supports et résistances par distribution des sommets et creux',
    shortName: 'SR-DIST',
    description: 'zones_support_resistance',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['support', 'resistance', 'distribution', 'sommets', 'creux', 'rebonds'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenne', name: 'Moyenne des niveaux pondérée', type: 'line', color: '#5536e4', lineWidth: 2 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { moyenne: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ZonesSupportResistanceIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer: () => {
        const S = { ma: [], atr: [], haut: [], bas: [] };
        return {
          o: creerObjets({ maxEtiquettes: 500, maxBoites: 500, maxLignes: 500, maxPolylignes: 500 }), sorties: S,
          hauts: [], poidsHauts: [], bas: [], poidsBas: [], maxHaut: null, cum: 0, ferme: null,
          lissage: A.sma(S, p.lissageMoyenne + 1), f1: suiteVide(), f2: suiteVide(),
          // fill(ma, ma +/- atr / 2, ..., color.new(c, 100), color.new(c, 80)) : couleur a mi-hauteur.
          lueur1: milieu(transparence(p.couleurMoyenne, 100), transparence(p.couleurMoyenne, 80)),
          lueur2: milieu(transparence(p.couleurMoyenne, 80), transparence(p.couleurMoyenne, 100)),
        };
      },
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({ moyenne: tracer(d, etat.sorties.ma, new Array(d.length).fill(p.couleurMoyenne)), objets: etat.o.resultat() }),
    });
  }
}
