// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Fibonacci Trend [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/Lrpet5VK-Fibonacci-Trend-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { atr, supertrend } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide } from './commun.js';

const ETIQUETTE = '#15373b';
const INPUTS = [
  { id: 'facteur', name: 'Facteur de la tendance', type: 'number', default: 4, min: 0.01, max: 50, step: 0.01, group: 'Tendance',
    description: 'Facteur du Supertrend (ATR 25) qui fixe le sens de la tendance ; chaque changement de sens ouvre de nouveaux niveaux.' },
  { id: 'prolongement', name: 'Prolongement à droite (barres)', type: 'number', entier: true, default: 15, min: 0, max: 500, step: 1, group: 'Fibonacci' },
  { id: 'niveau1', name: 'Niveau 1', type: 'number', default: 0.236, min: 0, max: 1, step: 0.001, group: 'Fibonacci' },
  { id: 'niveau2', name: 'Niveau 2', type: 'number', default: 0.382, min: 0, max: 1, step: 0.001, group: 'Fibonacci' },
  { id: 'niveau3', name: 'Niveau 3', type: 'number', default: 0.618, min: 0, max: 1, step: 0.001, group: 'Fibonacci' },
  { id: 'niveau4', name: 'Niveau 4', type: 'number', default: 0.786, min: 0, max: 1, step: 0.001, group: 'Fibonacci' },
  { id: 'afficherTendance', name: 'Afficher la tendance', type: 'boolean', default: true, group: 'Style' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#26905d', group: 'Style' },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#74286d', group: 'Style' },
  { id: 'couleurZone', name: 'Zones 0,5-0,786 et 0,618-0,786', type: 'color', default: '#2689901c', group: 'Style' },
];

function creer() {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 50 }),
    sorties: { couleur: [] },
    fond: suiteVide(),
    f: {},
    h: null, l: null, hi: null, li: null,
  };
}

/**
 * Les niveaux, leurs etiquettes et leurs zones sont supprimes et recrees a chaque
 * barre de la tendance : seuls ceux de la derniere barre existent, ils ne sont
 * construits que la.
 */
const PERMANENTS = ['bas', 'haut', 'diag', 'H', 'L'];
const prix = (v, motif) => (v === null ? 'NaN' : tostring(v, motif));

function fibonacci(p, e, data, i, derniere, s, env) {
  const o = e.o, F = e.f, b = data[i];
  const t = s.dir[i], t1 = i > 0 ? s.dir[i - 1] : null;
  const change = t !== null && t1 !== null && t !== t1;
  const a = s.atr[i];
  const ligne = (x1, y1, x2, y2, plus = {}) => o.ligne({ x1, y1, x2, y2, couleur: env.texte, ...plus });
  const supprimer = (k) => { if (F[k]) o.supprimer(F[k]); };
  if (change) for (const k of PERMANENTS) supprimer(k);
  if (change && t === -1) {
    F.bas = ligne(i, b.low, i, b.low, { epaisseur: 2 });
    F.haut = ligne(i, a === null ? null : b.high + a * 3, i, a === null ? null : b.high + a * 3, { epaisseur: 2 });
  }
  if (change && t === 1) {
    F.bas = ligne(i, b.high, i, b.high, { epaisseur: 2 });
    F.haut = ligne(i, a === null ? null : b.low - a * 3, i, a === null ? null : b.low - a * 3, { epaisseur: 2 });
    F.diag = ligne(e.li, e.l, e.hi, e.h, { style: 'dashed' });
  }
  if (t === null || t1 === null || t !== t1 || !F.bas || !F.haut) return;

  const bas = F.bas, haut = F.haut;
  if (bas.y1 !== null && b.low < bas.y1) { bas.y1 = b.low; bas.y2 = b.low; }
  if (haut.y1 !== null && b.high > haut.y1) { haut.y1 = b.high; haut.y2 = b.high; }
  if (b.high === haut.y1) {
    e.h = b.high; e.hi = i;
    supprimer('H');
    F.H = o.etiquette({ x: e.hi, y: e.h, texte: prix(e.h, '#,###.####'), couleur: ETIQUETTE, couleurTexte: '#FFFFFF', style: 'label_down' });
  }
  if (b.low === bas.y1) {
    e.l = b.low; e.li = i;
    supprimer('L');
    F.L = o.etiquette({ x: e.li, y: e.l, texte: prix(e.l, '#,###.####'), couleur: ETIQUETTE, couleurTexte: '#FFFFFF', style: 'label_up' });
  }
  bas.x2 = i + p.prolongement;
  haut.x2 = i + p.prolongement;
  supprimer('diag');
  F.diag = ligne(e.li, e.l, e.hi, e.h, { style: 'dashed' });
  if ((F.diag.x1 !== null && F.diag.x1 < haut.x1) || (F.diag.x2 !== null && F.diag.x2 < haut.x1)) { o.supprimer(F.diag); }

  if (!derniere) return;
  const pas = haut.y1 === null || bas.y1 === null ? null : (haut.y1 - bas.y1) / 100;
  const v0 = t === -1 ? haut.y1 : bas.y1;
  const v1 = t === -1 ? bas.y1 : haut.y1;
  const niveau = (v) => (pas === null || v0 === null ? null : v0 - pas * v * t * -1);
  const tracerNiveau = (v, plus) => ligne(haut.x1, niveau(v), haut.x2, niveau(v), plus);
  const pc = [p.niveau1, p.niveau2, p.niveau3, p.niveau4].map((v) => v * 100);
  F.n1 = tracerNiveau(pc[0]);
  F.n2 = tracerNiveau(pc[1]);
  F.n05 = tracerNiveau(50, { couleur: transparence(env.texte, 50), style: 'dotted' });
  F.n3 = tracerNiveau(pc[2]);
  F.n4 = tracerNiveau(pc[3]);
  const etiquette = (y, texte) => o.etiquette({ x: i + p.prolongement, y, texte, couleurTexte: env.texte, couleur: env.fond, style: 'label_left' });
  F.L0 = etiquette(v0, '0 ' + prix(v0, '(#,###.####)'));
  F.L1 = etiquette(v1, '1 ' + prix(v1, '(#,###.####)'));
  ['n1', 'n2', 'n3', 'n4'].forEach((k, j) => {
    F['L' + k] = etiquette(F[k].y1, tostring(pc[j] / 100, '#.##########') + prix(F[k].y1, ' (#,###.####)'));
  });
  o.remplissage(F.n3, F.n4, { couleur: p.couleurZone });
  o.remplissage(F.n05, F.n4, { couleur: p.couleurZone });
}

function etape(p, e, data, i, derniere, s, env) {
  fibonacci(p, e, data, i, derniere, s, env);
  const d = s.dir[i], d1 = i > 0 ? s.dir[i - 1] : null;
  const couleur = !p.afficherTendance ? null : d === 1 ? p.couleurBaisse : p.couleurHausse;
  const visible = !(d !== null && d1 !== null && d !== d1);
  e.sorties.couleur[i] = visible ? couleur : null;
  remplir(e.o, e.fond, s.st, s.hl2, i, visible ? milieu(null, transparence(couleur, 90)) : null, derniere);
}

export default class FibonacciTendanceIndicator {
  static metadata = {
    id: 'fibonacci_tendance',
    name: 'Retracements de Fibonacci de la tendance',
    shortName: 'FIB-T',
    description: 'fibonacci_tendance',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['fibonacci', 'retracement', 'tendance', 'supertrend', 'niveaux'],
    inputs: INPUTS,
    outputs: [{ id: 'tendance', name: 'Tendance', type: 'line', color: '#26905d', lineWidth: 1 }],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { tendance: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(FibonacciTendanceIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer,
      series: (d) => {
        const st = supertrend(d, p.facteur, 25);
        return { st: st.supertrend, dir: st.direction, atr: atr(d, 200), hl2: d.map((c) => (c.high + c.low) / 2) };
      },
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => ({ tendance: tracer(d, s.st, etat.sorties.couleur), objets: etat.o.resultat() }),
    });
  }
}
