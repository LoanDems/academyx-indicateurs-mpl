// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Swing High/Low (ZigZag) [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/91qV64vV-Swing-High-Low-ZigZag-ChartPrime/
// Adaptation : textes des etiquettes et du tableau en francais.
import { creerObjets } from '../academyscript/objets.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des swings', type: 'number', entier: true, default: 100, min: 2, max: 1000, step: 1, group: P,
    description: 'Un sommet (creux) de swing est le plus haut (plus bas) de ce nombre de barres.' },
  { id: 'niveaux', name: 'Niveaux', type: 'boolean', default: true, group: P },
  { id: 'niveauxCasses', name: 'Niveaux cassés en pointillés', type: 'boolean', default: false, group: P },
  { id: 'historique', name: 'Garder les anciens niveaux', type: 'boolean', default: false, group: P },
  { id: 'ombre', name: 'Ombre des niveaux', type: 'boolean', default: true, group: P },
  { id: 'epaisseurOmbre', name: 'Épaisseur de l’ombre', type: 'number', entier: true, default: 8, min: 1, max: 30, step: 1, group: S },
  { id: 'couleurHaut', name: 'Sommets', type: 'color', default: '#c424e0', group: S },
  { id: 'couleurBas', name: 'Creux', type: 'color', default: '#24e075', group: S },
];
const ms = (b) => b.time * 1000;

const creer = () => ({
  o: creerObjets({ maxLignes: 50, maxEtiquettes: 500 }),
  lh: null, lh1: null, ll: null, ll1: null, lz: null, ih: 0, il: 0, trend: false, up: null, dn: null, eh: null, el: null,
  xo: [null, null], xu: [null, null], sorties: { sens: [] },
});

/** ta.crossover / crossunder sur des valeurs calculees barre par barre (derniere barre ou les deux sont definies). */
function croise(etat, a, b, sens) {
  if (a === null || b === null || a === undefined || b === undefined || Number.isNaN(b)) return false;
  const [pa, pb] = etat;
  const r = pa === null ? false : sens > 0 ? a > b && pa <= pb : a < b && pa >= pb;
  etat[0] = a; etat[1] = b;
  return r;
}

function plusHaut(d, i, n) {
  if (i < n - 1) return null;
  let h = -Infinity;
  for (let k = i - n + 1; k <= i; k++) if (d[k].high > h) h = d[k].high;
  return h;
}
function plusBas(d, i, n) {
  if (i < n - 1) return null;
  let l = Infinity;
  for (let k = i - n + 1; k <= i; k++) if (d[k].low < l) l = d[k].low;
  return l;
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], b1 = i > 0 ? d[i - 1] : null;
  const prec = { lh: e.lh, lh1: e.lh1, ll: e.ll, ll1: e.ll1, trend: e.trend };
  const upper = s.haut[i], lower = s.bas[i], upper1 = i > 0 ? s.haut[i - 1] : null, lower1 = i > 0 ? s.bas[i - 1] : null;
  if (b1 && upper1 !== null && upper !== null && b1.high === upper1 && b.high < upper) e.ih = ms(b1);
  if (b1 && lower1 !== null && lower !== null && b1.low === lower1 && b.low > lower) e.il = ms(b1);
  if (upper !== null && b.high === upper) e.trend = true;
  if (lower !== null && b.low === lower) e.trend = false;
  const t = e.trend, t1 = prec.trend;
  if (!t && t1) {
    e.lh = o.ligne({ x1: e.ih, y1: upper, x2: ms(b), y2: upper, couleur: p.niveaux ? p.couleurHaut : null, epaisseur: 2, xloc: 'bar_time' });
    if (p.ombre) e.lh1 = o.ligne({ x1: e.ih, y1: upper, x2: e.lh.x2, y2: upper, couleur: p.niveaux ? transparence(p.couleurHaut, 70) : null, epaisseur: p.epaisseurOmbre, xloc: 'bar_time' });
    e.lz = o.ligne({ x1: e.il, y1: e.ll ? e.ll.y1 : null, x2: e.lh.x1, y2: upper, couleur: p.couleurBas, xloc: 'bar_time' });
    if (!p.historique) { o.supprimer(prec.lh); o.supprimer(prec.lh1); }
  }
  if (t && !t1) {
    e.ll = o.ligne({ x1: e.il, y1: lower, x2: ms(b), y2: lower, couleur: p.niveaux ? p.couleurBas : null, epaisseur: 2, xloc: 'bar_time' });
    if (p.ombre) e.ll1 = o.ligne({ x1: e.il, y1: lower, x2: ms(b), y2: lower, couleur: p.niveaux ? transparence(p.couleurBas, 70) : null, epaisseur: p.epaisseurOmbre, xloc: 'bar_time' });
    e.lz = o.ligne({ x1: e.ih, y1: e.lh ? e.lh.y1 : null, x2: e.ll.x1, y2: lower, couleur: p.couleurHaut, xloc: 'bar_time' });
    if (!p.historique) { o.supprimer(prec.ll); o.supprimer(prec.ll1); }
  }
  if (e.lz) e.lz.style = 'dashed';
  for (const l of [e.ll, e.ll1, e.lh, e.lh1]) if (l) l.x2 = ms(b);
  const xo = croise(e.xo, b.low, e.lh ? e.lh.y1 : null, 1), xu = croise(e.xu, b.high, e.ll ? e.ll.y1 : null, -1);
  if (t === t1 && p.niveauxCasses) {
    if (xo && e.lh) { e.lh.style = 'dashed'; e.lh.epaisseur = 1; }
    if (xu && e.ll && (!derniere || env.derniereConfirmee)) { e.ll.style = 'dashed'; e.ll.epaisseur = 1; }
  }
  if (derniere) {
    if (t === t1) {
      if (t) e.up = o.ligne({ x1: e.il, y1: e.ll ? e.ll.y1 : null, x2: e.ih, y2: upper, style: 'dashed', couleur: p.couleurBas, xloc: 'bar_time' });
      else e.dn = o.ligne({ x1: e.ih, y1: e.lh ? e.lh.y1 : null, x2: e.il, y2: lower, style: 'dashed', couleur: p.couleurHaut, xloc: 'bar_time' });
    }
    if (p.niveaux) {
      const yh = e.lh ? e.lh.y1 : null, yl = e.ll ? e.ll.y1 : null;
      const txt = (v, nom) => (v === null ? 'NaN' : tostring(v, `${nom}  (#,###.####)`));
      e.eh = o.etiquette({ x: i, y: yh, texte: txt(yh, 'Sommet'), style: 'label_left', couleur: transparence(p.couleurHaut, 50), couleurTexte: env.texte });
      e.el = o.etiquette({ x: i, y: yl, texte: txt(yl, 'Creux'), style: 'label_left', couleur: transparence(p.couleurBas, 50), couleurTexte: env.texte });
    }
    const tb = o.tableau({ position: 'top_right', colonnes: 10, lignes: 10 });
    tb.cellule(0, 0, { texte: 'Sens du swing : ', couleurTexte: env.texte });
    tb.cellule(1, 0, { texte: t ? '⬈' : '⬊', couleurTexte: t ? p.couleurBas : p.couleurHaut, taille: 'huge' });
  }
  if (!p.niveaux) {
    o.etiquette({ x: e.lh ? e.lh.x1 : null, y: e.lh ? e.lh.y2 : null, texte: '', xloc: 'bar_time', style: 'label_down', couleur: p.couleurHaut });
    o.etiquette({ x: e.ll ? e.ll.x1 : null, y: e.ll ? e.ll.y2 : null, texte: '', xloc: 'bar_time', style: 'label_up', couleur: p.couleurBas });
  }
  e.sorties.sens[i] = t ? 1 : -1;
}

export default class SommetsCreuxSwingIndicator {
  static metadata = {
    id: 'sommets_creux_swing',
    name: 'Sommets et creux de swing avec ZigZag',
    shortName: 'SWING',
    description: 'sommets_creux_swing',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['swing', 'zigzag', 'sommets', 'creux', 'niveaux'],
    inputs: INPUTS,
    outputs: [{ id: 'sens', name: 'Sens du swing', type: 'line', hidden: true }],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { sens: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(SommetsCreuxSwingIndicator._memo, JSON.stringify([p, env.texte, env.derniereConfirmee]), data, {
      creer,
      series: (d) => ({ haut: d.map((_, i) => plusHaut(d, i, p.longueur)), bas: d.map((_, i) => plusBas(d, i, p.longueur)) }),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({
        sens: d.map((b, i) => ({ time: b.time, value: etat.sorties.sens[i] ?? null })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
