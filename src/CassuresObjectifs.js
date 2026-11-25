// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Breakout Targets [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/JY7Rjrsi-Breakout-Targets-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow, wma, ema, atr, crossunder } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const P = 'Paramètres', O = 'Objectifs', S = 'Style';
const INPUTS = [
  { id: 'periode', name: 'Période de détection', type: 'number', entier: true, default: 99, min: 4, max: 500, step: 1, group: P,
    description: 'Les sommets et creux sont confirmés sur la moitié de cette période de part et d’autre ; une plage s’ouvre quand le corps moyen des bougies se contracte.' },
  { id: 'sansChevauchement', name: 'Pas de plages qui se chevauchent', type: 'boolean', default: true, group: P },
  { id: 'objectifs', name: 'Afficher les objectifs', type: 'boolean', default: true, group: O },
  { id: 'periodeAtr', name: 'Période de l’ATR', type: 'number', entier: true, default: 14, min: 1, max: 200, step: 1, group: O },
  { id: 'multipleStop', name: 'Stop : multiple de l’ATR', type: 'number', default: 5, min: 0.1, max: 20, step: 0.1, group: O },
  { id: 'multiple1', name: 'Objectif 1 : multiple du risque', type: 'number', default: 0.5, min: 0.1, max: 10, step: 0.1, group: O },
  { id: 'multiple2', name: 'Objectif 2 : multiple du risque', type: 'number', default: 1.0, min: 0.1, max: 10, step: 0.1, group: O },
  { id: 'multiple3', name: 'Objectif 3 : multiple du risque', type: 'number', default: 1.5, min: 0.1, max: 10, step: 0.1, group: O },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const BLANC = '#FFFFFF';

function series(p, d) {
  const L = Math.trunc(p.periode / 2);
  const corps = d.map((b) => Math.abs(b.close - b.open));
  return {
    L, ph: pivothigh(d, L, L), pl: pivotlow(d, L, L),
    croise: crossunder(wma(corps, p.periode), ema(corps, p.periode)),
    vol: atr(d, p.periodeAtr), vola: atr(d, p.periode),
  };
}

function creer() {
  return {
    o: creerObjets({ maxBoites: 500, maxLignes: 50, maxEtiquettes: 50 }),
    sorties: { alertes: [] },
    boites: [], hauts: [], bas: [], centres: [],
    lignes: null, etiquettes: null, remplissages: null, sens: 0, obj3: false, wede: 0,
    pivH: null, idxH: null, pivL: null, idxL: null,
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], L = s.L;
  if (s.ph[i] !== null) { e.pivH = d[i - L].high; e.idxH = i - L; }
  if (s.pl[i] !== null) { e.pivL = d[i - L].low; e.idxL = i - L; }
  const vola = s.vola[i] === null ? NaN : s.vola[i] / 2;
  if (e.boites.length > 0) e.wede = e.boites[0].droite;
  if (s.croise[i]) {
    let h = null, l = null, debut = null;
    if (e.idxH !== null && e.idxL !== null && e.idxH > e.idxL) {
      h = e.pivH; debut = e.idxH;
      const dist = i - debut;
      if (dist > 0) { let m = b.high; for (let k = 0; k < dist; k++) m = Math.min(m, d[i - k].low); l = m; }
    } else {
      l = e.pivL; debut = e.idxL;
      const dist = debut === null ? NaN : i - debut;
      if (dist > 0) { let m = b.low; for (let k = 0; k < dist; k++) m = Math.max(m, d[i - k].high); h = m; }
    }
    if (h !== null && l !== null && b.close <= h && b.close >= l && (!p.sansChevauchement || debut > e.wede)) {
      const nb = (v) => (Number.isFinite(v) ? v : null);
      e.boites.unshift(o.boite({ gauche: debut, haut: h, droite: i, bas: l, fond: transparence(env.texte, 90), couleurBordure: null }));
      e.hauts.unshift(o.boite({ gauche: debut, haut: h, droite: i, bas: nb(h - vola), fond: transparence(p.couleurBaisse, 70), couleurBordure: null }));
      e.bas.unshift(o.boite({ gauche: debut, haut: nb(l + vola), droite: i, bas: l, fond: transparence(p.couleurHausse, 70), couleurBordure: null }));
      const c = (h + l) / 2;
      e.centres.unshift(o.ligne({ x1: debut, y1: c, x2: i, y2: c, couleur: transparence(env.texte, 50), epaisseur: 1, style: 'dashed' }));
    }
  }

  let hausse = 0, baisse = 0, nouvelle = false;
  const fmt = (v) => tostring(v, 'mintick', env.mintick);
  for (let k = e.boites.length - 1; k >= 0; k--) {
    const bx = e.boites[k], haut = bx.haut, bas = bx.bas;
    const casse = b.close > haut ? 1 : b.close < bas ? -1 : 0;
    if (casse === 0) {
      bx.droite = i; e.hauts[k].droite = i; e.bas[k].droite = i; e.centres[k].x2 = i;
      continue;
    }
    if (casse === 1) hausse = bas; else baisse = haut;
    e.boites.splice(k, 1); e.hauts.splice(k, 1); e.bas.splice(k, 1); e.centres.splice(k, 1);
    if (!p.objectifs) continue;
    nouvelle = true; e.sens = casse; e.obj3 = false;
    const v = s.vol[i] === null ? NaN : s.vol[i];
    const sl = casse === 1 ? b.low - v * p.multipleStop : b.high + v * p.multipleStop;
    const risque = Math.abs(b.close - sl);
    const tp = [p.multiple1, p.multiple2, p.multiple3].map((m) => (casse === 1 ? b.close + risque * m : b.close - risque * m));
    if (e.lignes) for (let j = 0; j < 5; j++) { o.supprimer(e.lignes[j]); o.supprimer(e.etiquettes[j]); }
    const coul = casse === 1 ? p.couleurHausse : p.couleurBaisse;
    const r80 = transparence(p.couleurBaisse, 80), v80 = transparence(p.couleurHausse, 80);
    const niveaux = [[b.close, coul, `Entrée ▸ ${fmt(b.close)}`, coul], [sl, r80, `✘ Stop ▸ ${fmt(sl)}`, r80],
      [tp[0], v80, ` ✔ Obj. 1 ▸ ${fmt(tp[0])}`, v80], [tp[1], v80, ` ✔ Obj. 2 ▸ ${fmt(tp[1])}`, v80], [tp[2], v80, ` ✔ Obj. 3 ▸ ${fmt(tp[2])}`, v80]];
    e.lignes = []; e.etiquettes = [];
    for (const [y, c, texte, fond] of niveaux) {
      e.lignes.push(o.ligne({ x1: i, y1: y, x2: i, y2: y, couleur: c, epaisseur: 3 }));
      e.etiquettes.push(o.etiquette({ x: i, y, texte, style: 'label_left', couleur: fond, couleurTexte: BLANC }));
    }
    if (e.remplissages) { o.supprimer(e.remplissages[0]); o.supprimer(e.remplissages[1]); }
    e.remplissages = [o.remplissage(e.lignes[0], e.lignes[1], { couleur: transparence(p.couleurBaisse, 95) }),
      o.remplissage(e.lignes[0], e.lignes[4], { couleur: transparence(p.couleurHausse, 95) })];
  }
  if (!nouvelle && !e.obj3 && e.lignes) {
    for (let j = 0; j < 5; j++) { e.lignes[j].x2 = i; e.etiquettes[j].x = i; }
    const t3 = e.lignes[4].y1;
    if (e.sens === 1 && b.high >= t3) e.obj3 = true;
    else if (e.sens === -1 && b.low <= t3) e.obj3 = true;
  }
  if (hausse !== 0) o.plotchar(i, { position: 'absolute', y: hausse, caractere: '▲', couleur: p.couleurHausse, taille: 'small' });
  if (baisse !== 0) o.plotchar(i, { position: 'absolute', y: baisse, caractere: '▼', couleur: p.couleurBaisse, taille: 'small' });

  // alertes : cassures, objectifs et stop franchis
  let bits = (hausse !== 0 ? 1 : 0) | (baisse !== 0 ? 2 : 0);
  if (e.lignes && i > 0) {
    const [, slv, t1, t2, t3] = e.lignes.map((l) => l.y1);
    const h1 = d[i - 1].high, l1 = d[i - 1].low;
    if (e.sens === 1) {
      if (b.high >= t1 && h1 < t1) bits |= 4;
      if (b.high >= t2 && h1 < t2) bits |= 8;
      if (b.high >= t3 && h1 < t3) bits |= 16;
      if (b.low <= slv && l1 > slv) bits |= 32;
    } else if (e.sens === -1) {
      if (b.low <= t1 && l1 > t1) bits |= 4;
      if (b.low <= t2 && l1 > t2) bits |= 8;
      if (b.low <= t3 && l1 > t3) bits |= 16;
      if (b.high >= slv && h1 < slv) bits |= 32;
    }
  }
  e.sorties.alertes[i] = bits;
}

const ALERTES = [
  ['cassure_haussiere', 'Cassure haussière', 1], ['cassure_baissiere', 'Cassure baissière', 2], ['objectif1', 'Objectif 1 atteint', 4],
  ['objectif2', 'Objectif 2 atteint', 8], ['objectif3', 'Objectif 3 atteint', 16], ['stop', 'Stop touché', 32],
];

export default class CassuresObjectifsIndicator {
  static metadata = {
    id: 'cassures_objectifs',
    name: 'Cassures de plage avec stop et objectifs',
    shortName: 'CASS-OBJ',
    description: 'cassures_objectifs',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['plage', 'cassure', 'objectifs', 'stop', 'atr', 'contraction'],
    inputs: INPUTS,
    outputs: [{ id: 'alertes', name: 'Alertes', type: 'line', hidden: true }],
    alertConditions: ALERTES.map(([id, title, masque]) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && (pt.value & masque) !== 0,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { alertes: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CassuresObjectifsIndicator._memo, JSON.stringify([p, env.texte, env.mintick]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({
        alertes: d.map((b, i) => ({ time: b.time, value: etat.sorties.alertes[i] || null })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
