// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Ghost Tangent Crossings [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/F2vJnCdI-Ghost-Tangent-Crossings-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { lireReglages, executer } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'pivots', name: 'Sommets et creux', type: 'select', default: 'Wick', group: P,
    options: [{ label: 'Mèches', value: 'Wick' }, { label: 'Corps', value: 'Body' }] },
  { id: 'confirmation', name: 'Barres de confirmation', type: 'number', entier: true, default: 25, min: 1, max: 200, step: 1, group: P,
    description: 'Un sommet (creux) est confirmé quand autant de barres ont suivi sans le dépasser.' },
  { id: 'maxArcs', name: 'Arcs gardés', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: P, legende: false },
  { id: 'tangente', name: 'Tangente', type: 'select', default: 'Directional', group: P,
    options: [{ label: 'Inclinée', value: 'Directional' }, { label: 'Horizontale', value: 'Horizontal' }, { label: 'Aucune', value: 'None' }] },
  { id: 'cassures', name: 'Marquer les cassures', type: 'boolean', default: true, group: P,
    description: '« C » sur la première barre qui franchit la tangente prolongée après l’arc.' },
  { id: 'arcs', name: 'Afficher les arcs', type: 'boolean', default: true, group: S },
  { id: 'fantome', name: 'Arc en cours (fantôme)', type: 'boolean', default: true, group: S },
  { id: 'prolonger', name: 'Prolonger les tangentes', type: 'boolean', default: false, group: S },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#1bcf66', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ee2d2d', group: S },
  { id: 'fantomeHausse', name: 'Fantôme en hausse', type: 'color', default: '#1bcf663a', group: S },
  { id: 'fantomeBaisse', name: 'Fantôme en baisse', type: 'color', default: '#ee2d2d3a', group: S },
  { id: 'couleurTexte', name: 'Texte', type: 'color', default: '#EEEEEE', group: S },
];

const defini = (v) => v !== null && v !== undefined && !Number.isNaN(v);

/** Pivot a gauche variable (regles d'egalite de TradingView), candidat src[i - droite]. */
function pivot(src, i, gauche, droite, haut) {
  if (i < gauche + droite) return false;
  const c = i - droite, v = src[c];
  for (let j = 1; j <= gauche; j++) { const w = src[c - j]; if (haut ? w > v : w < v) return false; }
  for (let j = 1; j <= droite; j++) { const w = src[c + j]; if (haut ? w >= v : w <= v) return false; }
  return true;
}

/** Quart d'ellipse du sommet (fin_x, debut_y) au creux (debut_x, fin_y), points aux changements d'abscisse entiere. */
function ellipse(dx, fx, dy, fy) {
  const pts = [];
  const a = fx - dx, b = fy - dy;
  let x = null;
  if (a > 1) {
    for (let i = 0; i <= 90; i++) {
      const nx = Math.trunc(a * Math.cos(i * Math.PI / 180));
      const y = b * Math.sin(i * Math.PI / 180);
      if (x !== null && x !== nx) pts.push({ x: dx + x, y: dy + y });
      x = nx;
    }
    pts.push({ x: dx, y: fy });
  } else {
    pts.unshift({ x: fx, y: dy });
    pts.push({ x: dx, y: fy });
  }
  return pts;
}

/** Point de l'arc qui partage la variation de prix en deux moities egales, et pente de la tangente. */
function tangente(dx, fx, dy, fy, pts) {
  if (pts.length > 2) {
    const ec = [];
    for (let i = 0; i < pts.length - 1; i++) ec.push(Math.abs(pts[i + 1].y - pts[i].y));
    let meilleur = Infinity, mid = -1;
    for (let i = 1; i < ec.length; i++) {
      let g = 0, d = 0;
      for (let k = 0; k <= i; k++) g += ec[k];
      for (let k = i - 1; k < ec.length; k++) d += ec[k];
      const c = Math.abs(g - d);
      if (c < meilleur) { meilleur = c; mid = i; }
    }
    const t = pts[mid];
    const a = fx - dx, b = fy - dy, x = t.x - dx, y = t.y - dy;
    const den = Math.pow(a, 2) * y;
    return { t, pente: den === 0 ? NaN : -(Math.pow(b, 2) * x) / den };
  }
  return { t: pts[0], pente: -(pts[pts.length - 1].y - pts[0].y) };
}

function creer(p) {
  return {
    o: creerObjets({ maxLignes: 100, maxPolylignes: 100, maxEtiquettes: 500 }),
    ph: { cur: null, idx: null }, pl: { cur: null, idx: null },
    upStart: null, upEnd: null, dnStart: null, dnEnd: null, dernierHaut: null, dernierBas: null, polarite: null,
    arcs: [], points: [], tangentes: [], cassures: [], fArcs: [], fPoints: [], fTangentes: [],
    phBack: p.confirmation, plBack: p.confirmation, depuisPh: null, depuisPl: null,
  };
}

function arc(p, e, d, i, dx, fx, dy, fy, cHausse, cBaisse, L, polarite, fantome) {
  const o = e.o;
  const coul = polarite ? cHausse : cBaisse, opp = polarite ? cBaisse : cHausse;
  const pts = ellipse(dx, fx, dy, fy);
  const { t, pente } = tangente(dx, fx, dy, fy, pts);
  const long = fx - dx, arriere = t.x - dx, avant = long - arriere;
  if (p.arcs) {
    const fin = pts[pts.length - 1];
    L.points.push(o.etiquette({ x: fin.x, y: fin.y, texte: '', couleur: coul, style: 'circle', taille: 'auto' }));
    L.arcs.push(o.polyligne({ points: pts, courbe: false, fermee: false, couleur: coul, epaisseur: 2 }));
  }
  const yb = (v) => (Number.isNaN(v) ? null : v);
  if (p.tangente === 'Directional') {
    L.tangentes.push(p.prolonger
      ? o.ligne({ x1: t.x, y1: t.y, x2: t.x + 1, y2: yb(t.y + pente), extend: 'both', couleur: coul, style: 'dashed' })
      : o.ligne({ x1: t.x - arriere, y1: yb(t.y - pente * arriere), x2: t.x + arriere, y2: yb(t.y + pente * arriere), extend: 'none', couleur: coul, style: 'dashed' }));
  }
  if (p.tangente === 'Horizontal') {
    L.tangentes.push(p.prolonger
      ? o.ligne({ x1: t.x, y1: t.y, x2: t.x + 1, y2: t.y, extend: 'right', couleur: coul, style: 'dashed' })
      : o.ligne({ x1: t.x, y1: t.y, x2: t.x + long * 2, y2: t.y, extend: 'none', couleur: coul, style: 'dashed' }));
  }
  if (p.cassures && !fantome) {
    let k = avant - 1, trouve = false, prix = null;
    const depart = i - t.x;
    let cur = depart;
    while (!trouve && cur >= 0) {
      k += 1;
      const seuil = t.y + pente * k;
      cur = depart - k;
      if (cur < 0) break;
      if (polarite) { prix = d[i - cur].high; if (prix < seuil) trouve = true; } else { prix = d[i - cur].low; if (prix > seuil) trouve = true; }
    }
    e.cassures.push(trouve ? o.etiquette({ x: i - cur, y: prix, texte: 'C', yloc: polarite ? 'abovebar' : 'belowbar', couleur: opp, style: polarite ? 'label_down' : 'label_up', couleurTexte: p.couleurTexte }) : null);
  }
}

function vider(o, liste) { while (liste.length) o.supprimer(liste.pop()); }

function etape(p, e, d, i, derniere, env) {
  const o = e.o, F = p.confirmation;
  const hs = (k) => (p.pivots === 'Wick' ? d[k].high : Math.max(d[k].open, d[k].close));
  const ls = (k) => (p.pivots === 'Wick' ? d[k].low : Math.min(d[k].open, d[k].close));
  if (!e.srcH) { e.srcH = []; e.srcL = []; }
  e.srcH[i] = hs(i); e.srcL[i] = ls(i);
  const nouveauPh = pivot(e.srcH, i, e.phBack, F, true);
  if (nouveauPh) e.ph = { cur: e.srcH[i - F], idx: i - F };
  const nouveauPl = pivot(e.srcL, i, e.plBack, F, false);
  if (nouveauPl) e.pl = { cur: e.srcL[i - F], idx: i - F };
  e.depuisPh = nouveauPh ? 0 : (e.depuisPh === null ? null : e.depuisPh + 1);
  e.depuisPl = nouveauPl ? 0 : (e.depuisPl === null ? null : e.depuisPl + 1);
  const ph = e.ph, pl = e.pl;
  const polHaut = ph.idx !== null && pl.idx !== null && ph.idx > pl.idx;
  const polBas = ph.idx !== null && pl.idx !== null && ph.idx < pl.idx;
  const attenteHaut = e.polarite !== true, attenteBas = e.polarite === true;
  const confirmee = !derniere || env.derniereConfirmee;
  const principal = { points: e.points, arcs: e.arcs, tangentes: e.tangentes };
  const fant = { points: e.fPoints, arcs: e.fArcs, tangentes: e.fTangentes };
  const viderFantome = () => { vider(o, e.fArcs); vider(o, e.fPoints); vider(o, e.fTangentes); };

  if (nouveauPh && polHaut && (e.upStart === null || e.upStart < pl.idx) && attenteHaut && confirmee) {
    viderFantome();
    const relie = e.dnEnd !== null ? pl.idx === e.dnEnd : true;
    const dx = relie ? pl.idx : e.dnEnd, fx = ph.idx, dy = ph.cur, fy = relie ? pl.cur : e.dernierBas;
    e.upStart = dx; e.upEnd = fx; e.dernierHaut = dy; e.polarite = true;
    arc(p, e, d, i, dx, fx, dy, fy, p.couleurHausse, p.couleurBaisse, principal, true, false);
  }
  if (nouveauPl && polBas && (e.dnStart === null || e.dnStart < ph.idx) && attenteBas && confirmee) {
    viderFantome();
    const relie = e.upEnd !== null ? ph.idx === e.upEnd : true;
    const dx = relie ? ph.idx : e.upEnd, fx = pl.idx, dy = pl.cur, fy = relie ? ph.cur : e.dernierHaut;
    e.dnStart = dx; e.dnEnd = fx; e.dernierBas = dy; e.polarite = false;
    arc(p, e, d, i, dx, fx, dy, fy, p.couleurHausse, p.couleurBaisse, principal, false, false);
  }

  // arcs fantomes : du dernier pivot oppose a l'extreme atteint depuis
  const fantome = (haut) => {
    const relie = haut ? (e.dnEnd !== null ? pl.idx === e.dnEnd : true) : (e.upEnd !== null ? ph.idx === e.upEnd : true);
    const dx = haut ? (relie ? pl.idx : e.dnEnd) : (relie ? ph.idx : e.upEnd);
    const depuis = haut ? e.depuisPl : e.depuisPh;
    const vals = [];
    if (dx !== null && i - dx >= 0 && depuis !== null) for (let k = 0; k <= i - dx - depuis; k++) vals.push(haut ? e.srcH[i - k] : e.srcL[i - k]);
    let ext = null, ou = 0;
    for (let k = 0; k < vals.length; k++) if (ext === null || (haut ? vals[k] > ext : vals[k] < ext)) { ext = vals[k]; ou = k; }
    const fy = haut ? (relie ? pl.cur : e.dernierBas) : (relie ? ph.cur : e.dernierHaut);
    return { dx, fx: i - ou, dy: ext, fy };
  };
  if (attenteHaut && !nouveauPh && p.fantome) {
    viderFantome();
    const g = fantome(true);
    if (defini(g.dx) && defini(g.dy) && defini(g.fy)) arc(p, e, d, i, g.dx, g.fx, g.dy, g.fy, p.fantomeHausse, p.fantomeBaisse, fant, true, true);
  }
  if (attenteBas && !nouveauPl && p.fantome) {
    viderFantome();
    const g = fantome(false);
    if (defini(g.dx) && defini(g.dy) && defini(g.fy)) arc(p, e, d, i, g.dx, g.fx, g.dy, g.fy, p.fantomeHausse, p.fantomeBaisse, fant, false, true);
  }

  if (e.arcs.length > p.maxArcs) { o.supprimer(e.arcs.shift()); o.supprimer(e.points.shift()); }
  if (e.tangentes.length > p.maxArcs) o.supprimer(e.tangentes.shift());
  if (e.cassures.length > p.maxArcs) { const c = e.cassures.shift(); if (c) o.supprimer(c); }

  const borne = (v) => Math.min(Math.max(v, 0), 500);
  e.phBack = borne(e.dnEnd === null ? 5 : i - e.dnEnd - e.plBack + 1);
  e.plBack = borne(e.upEnd === null ? 5 : i - e.upEnd - e.phBack + 1);
}

export default class TangentesEllipsesIndicator {
  static metadata = {
    id: 'tangentes_ellipses',
    name: 'Arcs elliptiques et tangentes des sommets et creux',
    shortName: 'ARCS-T',
    description: 'tangentes_ellipses',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['sommets', 'creux', 'ellipse', 'tangente', 'cassure', 'zigzag'],
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
    const bs = ctx && ctx.barstate;
    const env = { derniereConfirmee: bs && typeof bs.isconfirmed === 'function' ? bs.isconfirmed(data.length - 1) : false };
    return executer(TangentesEllipsesIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer: () => creer(p),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat) => ({ objets: etat.o.resultat() }),
    });
  }
}
