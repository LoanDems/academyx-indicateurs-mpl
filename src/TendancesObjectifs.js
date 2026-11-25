// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trendline Breakouts With Targets [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/hb6J9iHI-Trendline-Breakouts-With-Targets-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { atr, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer } from './commun.js';

const CUIVRE = '#9a6714', BLANC = '#FFFFFF';
const INPUTS = [
  { id: 'periode', name: 'Période', type: 'number', entier: true, default: 10, min: 2, max: 200, step: 1, group: 'Paramètres',
    description: 'Un sommet (creux) doit dominer autant de barres à gauche et la moitié à droite ; chaque nouveau sommet (creux) relie le précédent en ligne de tendance.' },
  { id: 'type', name: 'Points des lignes', type: 'select', default: 'Wicks', group: 'Paramètres',
    options: [{ value: 'Wicks', label: 'Mèches' }, { value: 'Body', label: 'Corps' }] },
  { id: 'prolongement', name: 'Prolongement', type: 'select', default: '  25', group: 'Paramètres',
    options: [{ value: '  25', label: '25 barres' }, { value: '  50', label: '50 barres' }, { value: '  75', label: '75 barres' }],
    description: 'Durée sur laquelle chaque ligne est prolongée au-delà de son dernier point.' },
  { id: 'objectifs', name: 'Afficher les objectifs', type: 'boolean', default: true, group: 'Paramètres',
    description: 'À chaque cassure, trait vers l’objectif et étiquette, verte si l’objectif est atteint, rouge si le stop l’est d’abord.' },
  { id: 'couleurBande', name: 'Bande des lignes', type: 'color', default: 'rgba(109, 111, 111, 0.81)', group: 'Style' },
  { id: 'couleurDescendante', name: 'Ligne descendante (sommets)', type: 'color', default: 'rgba(11, 139, 7, 0.47)', group: 'Style' },
  { id: 'couleurMontante', name: 'Ligne montante (creux)', type: 'color', default: 'rgba(212, 46, 0, 0.46)', group: 'Style' },
  { id: 'couleurAchat', name: 'Cassure haussière', type: 'color', default: 'rgba(46, 192, 6, 0.89)', group: 'Style' },
  { id: 'couleurVente', name: 'Cassure baissière', type: 'color', default: 'rgba(241, 2, 2, 0.89)', group: 'Style' },
];
const MULTIPLES = { '  25': 1, '  50': 2, '  75': 3 };

const site = () => ({ dernier: null, depart: 1, temps: 1, yDepart: 0, pente: 0 });

function creer() {
  const o = creerObjets({ maxLignes: 500, maxEtiquettes: 50 });
  for (let k = 0; k < 6; k++) o.ligne({ x1: null, y1: null, x2: null, y2: null, xloc: 'bar_time' });
  return {
    o, haut: site(), bas: site(),
    sorties: { majY: [], majYBas: [], signal: [] },
    enCours: false, enCoursPrec: false, long: false, court: false, tp: 0, sl: 0, ligneTp: null, etiquette: null,
    maj: { x: 0, y: 0, pente: 0 }, majBas: { x: 0, y: 0, pente: 0 },
    pivotHaut: null, pivotBas: null,
  };
}

const defini = (v) => v !== null && v !== undefined && !Number.isNaN(v);

/** Methode Trendlines du script (etat propre a chaque appel : sommets, puis creux). */
function lignes(p, e, s, pivot, i, data, z, montante) {
  const t = (k) => (i - k >= 0 ? data[i - k].time * 1000 : null);
  const scr = defini(pivot) ? pivot : s.dernier;
  const precedent = s.dernier;
  const change = defini(scr) && defini(precedent) && scr - precedent !== 0;
  if (change) {
    const tempsPrec = s.temps;
    s.temps = t(p.decalage);
    s.yDepart = precedent;
    s.depart = tempsPrec;
    s.pente = defini(s.temps) ? (scr - s.yDepart) / (s.temps - s.depart) : null;
  }
  s.dernier = scr;
  const pas = i > 0 ? t(0) - t(1) : null;
  const ext = pas === null ? null : MULTIPLES[p.prolongement] * pas * 25;
  const fin = ext === null || !defini(s.temps) ? null : s.temps + ext;
  const yFin = ext === null || !defini(scr) || !defini(s.pente) ? null : scr + ext * s.pente;
  if (change && !e.enCoursPrec) {
    const pente = s.pente;
    const couleur = defini(pente) && pente * t(0) < 0 ? (montante ? null : p.couleurDescendante) : (montante ? p.couleurMontante : null);
    if (couleur) {
      const decale = (y, k) => (!defini(y) || (k > 0 && !defini(z)) ? null : k > 0 ? y - z * k : y);
      const trace = (k) => e.o.ligne({ x1: s.depart, y1: decale(s.yDepart, k), x2: fin, y2: decale(yFin, k), xloc: 'bar_time', couleur: 'rgba(0, 0, 0, 0)' });
      const l1 = trace(0), l2 = trace(2), l3 = trace(1);
      e.o.remplissage(l3, l2, { couleur: p.couleurBande });
      e.o.remplissage(l3, l1, { couleur });
    }
  }
  return { x: s.depart, y: s.yDepart, pente: s.pente };
}

/** CheckCross du script : na (null) si le point de depart n'a pas change depuis `periode` barres. */
function croisement(p, data, i, histoY, maj, z) {
  const y = histoY[i], yAvant = i - p.periode >= 0 ? histoY[i - p.periode] : null;
  if (!defini(yAvant) || !defini(y) || yAvant === y) return null;
  const t = data[i].time * 1000, pas = i > 0 ? t - data[i - 1].time * 1000 : null;
  const prix = (k) => (pas === null || !defini(maj.pente) ? null : y + (t - maj.x - k * pas) * maj.pente);
  const actuel = prix(0), precedent = prix(1);
  const c = data[i].close, c1 = i > 0 ? data[i - 1].close : null;
  const ok = defini(c1) && defini(actuel) && defini(precedent);
  if (ok && c1 < precedent && c > actuel) return 1;
  if (ok && defini(z) && c1 > precedent - z * 0.1 && c < actuel - z * 0.1) return -1;
  return 0;
}

function etape(p, e, data, i, s) {
  const b = data[i], z = s.zone[i], S = e.sorties;
  const h = lignes(p, e, e.haut, s.ph[i], i, data, z, false);
  const l = lignes(p, e, e.bas, s.pl[i], i, data, z, true);
  const changeHaut = defini(s.ph[i]) ? s.ph[i] : e.pivotHaut, changeBas = defini(s.pl[i]) ? s.pl[i] : e.pivotBas;
  if (defini(changeHaut) && defini(e.pivotHaut) && changeHaut !== e.pivotHaut) e.maj = h;
  if (defini(changeBas) && defini(e.pivotBas) && changeBas !== e.pivotBas) e.majBas = l;
  e.pivotHaut = changeHaut; e.pivotBas = changeBas;
  S.majY[i] = e.maj.y; S.majYBas[i] = e.majBas.y;

  const tps = b.time * 1000;
  const long = !(defini(e.maj.pente) && e.maj.pente * tps > 0) && croisement(p, data, i, S.majY, e.maj, z) === 1 && !e.enCours;
  const court = !(defini(e.majBas.pente) && e.majBas.pente * tps < 0) && croisement(p, data, i, S.majYBas, e.majBas, z) === -1 && !e.enCours;
  const etaitEnCours = e.enCoursPrec;
  if (long && !e.enCours) { e.long = true; e.court = false; }
  if (court && !e.enCours) { e.long = false; e.court = true; }
  if ((long || court) && !e.enCours) {
    e.tp = !defini(z) ? null : long ? b.high + z * 20 : b.low - z * 20;
    e.sl = !defini(z) ? null : long ? b.low - z * 20 : b.high + z * 20;
    e.enCours = true;
    if (p.objectifs) {
      e.o.ligne({ x1: i, y1: long ? b.high : b.low, x2: i, y2: e.tp, epaisseur: 2, couleur: CUIVRE, style: 'dashed' });
      e.ligneTp = e.o.ligne({ x1: i, y1: e.tp, x2: i + 2, y2: e.tp, style: 'dashed', couleur: CUIVRE });
      e.etiquette = e.o.etiquette({ x: i, y: e.tp, texte: 'Objectif', couleur: CUIVRE, style: 'label_left', taille: 'small', couleurTexte: BLANC });
    }
  }
  if (e.enCours) {
    if (e.ligneTp) e.ligneTp.x2 = i;
    if (e.etiquette) e.etiquette.x = i + 1;
  }
  const atteint = (vrai, couleur) => { if (vrai) { if (e.etiquette) e.etiquette.couleur = couleur; e.enCours = false; } };
  if (e.long && e.enCours) {
    atteint(defini(e.tp) && b.high >= e.tp, 'rgba(6, 128, 10, 0.63)');
    atteint(defini(e.sl) && b.close <= e.sl, 'rgba(246, 7, 7, 0.3)');
  } else if (e.court && e.enCours) {
    atteint(defini(e.tp) && b.low <= e.tp, 'rgba(6, 128, 10, 0.63)');
    atteint(defini(e.sl) && b.close >= e.sl, 'rgba(246, 7, 7, 0.3)');
  }
  if (long && !etaitEnCours) e.o.plotchar(i, { position: 'belowbar', caractere: '▲', couleur: p.couleurAchat, taille: 'small' });
  if (court && !etaitEnCours) e.o.plotchar(i, { position: 'abovebar', caractere: '▼', couleur: p.couleurVente, taille: 'small' });
  S.signal[i] = long && !etaitEnCours ? 1 : court && !etaitEnCours ? -1 : 0;
  e.enCoursPrec = e.enCours;
}

export default class TendancesObjectifsIndicator {
  static metadata = {
    id: 'tendances_objectifs',
    name: 'Lignes de tendance : cassures et objectifs',
    shortName: 'LT-OBJ',
    description: 'tendances_objectifs',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['lignes de tendance', 'cassure', 'objectif', 'stop', 'sommets', 'creux'],
    inputs: INPUTS,
    outputs: [
      { id: 'cassureHausse', name: 'Cassure haussière', type: 'line', hidden: true },
      { id: 'cassureBaisse', name: 'Cassure baissière', type: 'line', hidden: true },
    ],
    alertConditions: [
      { id: 'cassure_haussiere', title: 'Cassure haussière', message: 'Cassure haussière', when: 'custom', source: 'cassureHausse', condition: (pt) => pt.value === 1 },
      { id: 'cassure_baissiere', title: 'Cassure baissière', message: 'Cassure baissière', when: 'custom', source: 'cassureBaisse', condition: (pt) => pt.value === 1 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = { ...this.params, decalage: Math.trunc(this.params.periode / 2) };
    return executer(TendancesObjectifsIndicator._memo, JSON.stringify(p), data, {
      creer,
      series: (d) => {
        const meches = p.type === 'Wicks';
        const hauts = d.map((c) => (meches ? c.high : c.close > c.open ? c.close : c.open));
        const bas = d.map((c) => (meches ? c.low : c.close > c.open ? c.open : c.close));
        const a = atr(d, 30);
        const mini = d.map((c, i) => (a[i] === null ? null : Math.min(a[i] * 0.3, c.close * (0.3 / 100))));
        const zone = d.map((_, i) => (i >= 20 && mini[i - 20] !== null ? mini[i - 20] / 2 : null));
        return { ph: pivothigh(hauts, p.periode, p.decalage), pl: pivotlow(bas, p.periode, p.decalage), zone };
      },
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, s),
      rendre: (etat, d) => {
        const sig = etat.sorties.signal;
        const serie = (v) => d.map((c, i) => ({ time: c.time, value: sig[i] === v ? 1 : null }));
        return { cassureHausse: serie(1), cassureBaisse: serie(-1), objets: etat.o.resultat() };
      },
    });
  }
}
