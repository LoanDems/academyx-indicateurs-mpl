// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Double Top/Bottom [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/53EEupiO-Double-Top-Bottom-AlgoAlpha/
// Adaptation : aucune (la seconde boucle du script, qui parcourt la liste des lignes basses avec la taille de la liste des
// lignes hautes, est reprise telle quelle, indices negatifs compris).
import { creerObjets } from '../academyscript/objets.js';
import { sma, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, transparence, masque, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'horizon', name: 'Horizon', type: 'number', entier: true, default: 21, min: 1, max: 200, step: 1, group: P,
    description: 'Barres de part et d’autre d’un sommet ou d’un creux de clôture : plus grand, figures de plus long terme.' },
  { id: 'signauxSeuls', name: 'Étiquettes seules', type: 'boolean', default: false, group: S,
    description: 'Ne montre que l’étiquette posée sur le second sommet (ou creux), sans les lignes ni les losanges.' },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const ORANGE = '#FF9800';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

function series(p, d) {
  const close = d.map((b) => b.close);
  return {
    limite: sma(d.map((b) => Math.abs(b.open - b.close)), 100),
    ph: pivothigh(close, p.horizon, p.horizon), pl: pivotlow(close, p.horizon, p.horizon),
  };
}

function creer() {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }),
    pph: null, ppl: null, cpph: null, cppl: null, ln: null, hn: null, lpt: 0, aDBC: 0, aDTC: 0,
    seq: [], t: [], t1: [], tthresh: 0, bthresh: 0,
    sorties: { pdb: [], pdt: [], dbc: [], dtc: [] },
  };
}
/** array.get de Pine v6 : un indice negatif compte depuis la fin. */
const lire = (a, i) => (i < 0 ? a[a.length + i] : a[i]);

function etape(p, e, d, i, derniere, s) {
  const o = e.o, x = p.horizon, close = (k) => d[i - k].close, ph = s.ph[i], pl = s.pl[i], sig = p.signauxSeuls;
  const lpt1 = e.lpt, rouge = p.couleurBaisse, vert = p.couleurHausse;
  const losanges = () => {
    if (e.aDBC === 1) { e.aDBC = 0; if (!sig) o.etiquette({ x: i, y: e.bthresh, yloc: 'price', texte: '', style: 'diamond', taille: 'tiny', couleur: ORANGE }); }
    if (e.aDTC === 1) { e.aDTC = 0; if (!sig) o.etiquette({ x: i, y: e.tthresh, yloc: 'price', texte: '', style: 'diamond', taille: 'tiny', couleur: ORANGE }); }
  };
  if (!nul(ph)) {
    e.lpt = 1;
    losanges();
    if (nul(e.ppl)) { e.hn = i - x; e.cpph = ph; e.seq.unshift({ dir: 1, n: e.hn, y: close(i - e.hn) }); e.pph = ph; }
    else if (ph > e.ppl && (e.lpt === lpt1 ? ph > e.pph : true)) { e.hn = i - x; e.cppl = e.ppl; e.seq.unshift({ dir: -1, n: e.ln, y: close(i - e.ln) }); e.pph = ph; }
  }
  if (!nul(pl)) {
    e.lpt = -1;
    losanges();
    if (nul(e.pph)) { e.ln = i - x; e.cppl = pl; e.seq.unshift({ dir: -1, n: e.ln, y: close(i - e.ln) }); e.ppl = pl; }
    else if (pl < e.pph && (e.lpt === lpt1 ? pl < e.ppl : true)) { e.ln = i - x; e.cpph = e.pph; e.seq.unshift({ dir: 1, n: e.hn, y: close(i - e.hn) }); e.ppl = pl; }
  }
  while (e.seq.length > 3) e.seq.pop();

  const lim = s.limite[i];
  // alertcondition() : memes conditions des deux pivots (evaluation paresseuse de Pine v6), sans exiger le troisieme.
  const proche = e.seq.length > 1 && !nul(lim) && i >= x && Math.abs(close(x) - e.seq[1].y) < lim;
  const pdt = !nul(ph) && e.seq.length > 1 && e.seq[0].dir === -1 && e.seq[1].dir === 1 && proche && lpt1 !== 1;
  const pdb = !nul(pl) && e.seq.length > 1 && e.seq[0].dir === 1 && e.seq[1].dir === -1 && proche && lpt1 !== -1;
  if (e.seq.length > 2) {
    const [s0, s1, s2] = e.seq;
    if (pdt) {
      o.etiquette({ x: i - x, y: close(x), yloc: 'price', texte: '', style: 'label_down', taille: 'large', couleur: rouge });
      if (!sig) e.t1.unshift(o.ligne({ x1: s0.n, y1: s0.y, x2: s0.n + 1, y2: s0.y, couleur: rouge, epaisseur: 2, style: 'dashed' }));
      e.aDTC = 1; e.tthresh = s0.y;
      if (!sig) {
        const l0 = o.ligne({ x1: s1.n, y1: s1.y, x2: s2.n, y2: s2.y, couleur: rouge, epaisseur: 2 });
        const l1 = o.ligne({ x1: s1.n, y1: s1.y, x2: s0.n, y2: s0.y, couleur: rouge, epaisseur: 2 });
        const l2 = o.ligne({ x1: s0.n, y1: s0.y, x2: i - x, y2: ph, couleur: rouge, epaisseur: 2 });
        o.remplissage(l0, l1, { couleur: transparence(rouge, 70) });
        o.remplissage(e.t1[0], l2, { couleur: transparence(rouge, 70) });
      }
    }
    if (pdb) {
      o.etiquette({ x: i - x, y: close(x), yloc: 'price', texte: '', style: 'label_up', taille: 'large', couleur: vert });
      if (!sig) e.t.unshift(o.ligne({ x1: s0.n, y1: s0.y, x2: s0.n + 1, y2: s0.y, couleur: vert, epaisseur: 2, style: 'dashed' }));
      e.aDBC = 1; e.bthresh = s0.y;
      if (!sig) {
        const l0 = o.ligne({ x1: s1.n, y1: s1.y, x2: s2.n, y2: s2.y, couleur: vert, epaisseur: 2 });
        const l1 = o.ligne({ x1: s1.n, y1: s1.y, x2: s0.n, y2: s0.y, couleur: vert, epaisseur: 2 });
        const l2 = o.ligne({ x1: s0.n, y1: s0.y, x2: i - x, y2: pl, couleur: vert, epaisseur: 2 });
        o.remplissage(l0, l1, { couleur: transparence(vert, 70) });
        o.remplissage(e.t[0], l2, { couleur: transparence(vert, 70) });
      }
    }
  }
  let dtc = false, dbc = false;
  const c = d[i].close;
  if (e.aDTC === 1 && c < e.tthresh) { e.aDTC = 0; e.tthresh = 0; if (!sig) e.t1[0].x2 = i; dtc = true; }
  if (e.aDBC === 1 && c > e.bthresh) { e.aDBC = 0; if (!sig) e.t[0].x2 = i; dbc = true; }
  if (e.t.length > 0) {
    const qt = e.t.length;
    for (let k = qt - 1; k >= 0; k--) if (k < e.t.length) { if (e.aDBC === 1) lire(e.t, k).x2 = i + 1; else e.t.pop(); }
  }
  if (e.t1.length > 0) {
    const qt = e.t.length;
    // for i = qt - 1 to 0 : vers le bas si qt >= 1, sinon de -1 a 0 en montant.
    const indices = qt - 1 >= 0 ? Array.from({ length: qt }, (_, k) => qt - 1 - k) : [-1, 0];
    for (const k of indices) if (k < e.t1.length) { if (e.aDTC === 1) lire(e.t1, k).x2 = i + 1; else e.t1.pop(); }
  }
  const S = e.sorties;
  S.pdb[i] = pdb; S.pdt[i] = pdt; S.dbc[i] = dbc; S.dtc[i] = dtc;
}

const ALERTES = [
  ['double_creux_possible', 'Double creux possible'], ['double_sommet_possible', 'Double sommet possible'],
  ['double_creux_confirme', 'Double creux confirmé'], ['double_sommet_confirme', 'Double sommet confirmé'],
];

export default class DoublesSommetsCreuxIndicator {
  static metadata = {
    id: 'doubles_sommets_creux',
    name: 'Doubles sommets et doubles creux',
    shortName: 'DSC',
    description: 'doubles_sommets_creux',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['figures', 'double sommet', 'double creux', 'retournement', 'pivots'],
    inputs: INPUTS,
    outputs: [{ id: 'signaux', name: 'Signaux', type: 'line', hidden: true }],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { signaux: [] };
    const p = this.params;
    return executer(DoublesSommetsCreuxIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d) => {
        const S = etat.sorties;
        return { signaux: masque(d, [S.pdb, S.pdt, S.dbc, S.dtc]), objets: etat.o.resultat() };
      },
    });
  }
}
