// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « HTF Candle Profile [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/5d1au2Dh-HTF-Candle-Profile-ChartPrime/
// Adaptation : periodes jour / semaine (lundi) / mois en UTC ; lettres J / S / M et textes en francais ; fond des changements
// de periode a la couleur du texte du theme sombre ; couleurs reglables.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence, degrade } from './commun.js';

const P = 'Paramètres', NV = 'Niveaux', S = 'Style';
const INPUTS = [
  { id: 'unite', name: 'Unité', type: 'select', default: 'W', group: P,
    options: [{ label: 'Jour', value: 'D' }, { label: 'Semaine', value: 'W' }, { label: 'Mois', value: 'M' }] },
  { id: 'barresMin', name: 'Barres minimales du profil', type: 'number', entier: true, default: 50, min: 10, max: 5000, step: 1, group: P,
    description: 'Tant que la période en cours compte moins de barres, le profil reprend aussi la période précédente.' },
  { id: 'haut', name: 'Plus haut', type: 'boolean', default: true, group: NV },
  { id: 'bas', name: 'Plus bas', type: 'boolean', default: true, group: NV },
  { id: 'cloture', name: 'Clôture', type: 'boolean', default: true, group: NV },
  { id: 'ouverture', name: 'Ouverture', type: 'boolean', default: true, group: NV },
  { id: 'poc', name: 'Prix au plus fort volume', type: 'boolean', default: true, group: NV },
  { id: 'decalage', name: 'Décalage du profil (barres)', type: 'number', entier: true, default: 5, min: 0, max: 500, step: 1, group: S },
  { id: 'couleurHausse', name: 'Bougie haussière', type: 'color', default: '#4CAF50', group: S },
  { id: 'couleurBaisse', name: 'Bougie baissière', type: 'color', default: '#F23645', group: S },
];
const SEPARATION = 'rgba(241, 241, 241, 0.1)';
const LETTRE = { D: 'J', W: 'S', M: 'M' };
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const prix = (v) => (Number.isFinite(v) ? tostring(v, '#.##########') : 'NaN');

/** Cle de periode UTC : jour, semaine du lundi, mois. */
function periode(t, u) {
  const jour = Math.floor(t / 86400);
  if (u === 'W') return Math.floor((jour + 3) / 7);
  if (u === 'M') { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
  return jour;
}

function series(p, d) {
  const n = d.length, change = new Array(n).fill(false);
  for (let i = 1; i < n; i++) change[i] = periode(d[i].time, p.unite) !== periode(d[i - 1].time, p.unite);
  // timeframe.change(tf)[1]
  const apres = change.map((_, i) => (i > 0 ? change[i - 1] : false));
  return { apres, atr: taAtr(d, 200) };
}

function etape(p, e, d, i, derniere, s, env) {
  const b = d[i];
  if (s.apres[i]) { e.O.push(b.open); e.C.push(b.close); e.debuts.push(i); }
  if (e.debuts.length > 1) {
    const dernier = e.debuts[e.debuts.length - 1];
    if (i - dernier < p.barresMin) { e.periode = i - e.debuts[e.debuts.length - 2]; e.op = e.O[e.O.length - 2]; e.cl = e.C[e.C.length - 1]; }
    else { e.periode = i - dernier; e.op = e.O[e.O.length - 1]; e.cl = b.close; }
  }
  if (derniere) profil(p, e, d, i, s, env);
}

function profil(p, e, d, n1, s, env) {
  const o = e.o, per = e.periode, a = s.atr[n1];
  let max = null, min = null;
  for (let k = 0; k <= per; k++) {
    const b = d[n1 - k];
    if (!b) continue;
    for (const v of [b.high, b.low]) { if (max === null || v > max) max = v; if (min === null || v < min) min = v; }
  }
  if (nul(a) || max === null) return;
  const pas0 = a * 0.3, H = max - min, taille = Math.ceil(H / pas0), pas = H / taille;
  if (!(taille > 0) || !Number.isFinite(pas)) return;
  const vols = new Array(taille).fill(0.0);
  for (let k = 0; k <= per; k++) {
    const b = d[n1 - k];
    // Seules les cases dont le milieu est a au plus un pas de la cloture comptent : on ne teste que celles-la (meme comparaison).
    const c = b.close, i0 = Math.max(0, Math.floor((c - min) / pas - 1.5) - 1), i1 = Math.min(taille - 1, Math.ceil((c - min) / pas + 0.5) + 1);
    for (let j = i0; j <= i1; j++) {
      const bas = min + pas * j, mil = bas + pas / 2;
      if (Math.abs(c - mil) <= pas) vols[j] += b.volume;
    }
  }
  let vmax = null;
  for (const v of vols) if (vmax === null || v > vmax) vmax = v;
  const coul = !nul(e.cl) && !nul(e.op) && e.cl > e.op ? p.couleurHausse : p.couleurBaisse;
  const pale = transparence(coul, 90);
  const indx = n1 + 50 + p.decalage, x0 = n1 - per;
  for (let j = 0; j < taille; j++) {
    const bas = min + pas * j, haut = bas + pas;
    const vv = Math.trunc((vols[j] / vmax) * 50);
    if (!Number.isFinite(vv)) continue;
    o.boite({ gauche: indx, haut, droite: indx - vv, bas, couleurBordure: env.fond, epaisseurBordure: 1, fond: degrade(vv, 0, 50, pale, coul) });
    if (vv === 50 && p.poc) {
      const y = (bas + haut) / 2;
      o.ligne({ x1: indx - vv, y1: y, x2: x0, y2: y, couleur: coul });
      o.etiquette({ x: x0, y, texte: tostring(vols[j], 'volume'), couleur: null, couleurTexte: env.texte, style: 'label_right' });
    }
  }
  const xb = n1 + 55 + p.decalage;
  o.ligne({ x1: xb, y1: max, x2: xb, y2: min, couleur: coul });
  o.ligne({ x1: xb, y1: nul(e.cl) ? null : e.cl, x2: xb, y2: nul(e.op) ? null : e.op, couleur: coul, epaisseur: 10 });
  const niveau = (y, texte, style, trait) => {
    const v = nul(y) ? null : y;
    o.etiquette({ x: xb, y: v, texte: texte + prix(v), style, couleur: null, couleurTexte: env.texte });
    o.ligne({ x1: x0, y1: v, x2: xb, y2: v, couleur: coul, style: trait });
  };
  if (p.haut) niveau(max, 'Haut : ', 'label_down', 'dashed');
  if (p.bas) niveau(min, 'Bas : ', 'label_up', 'dashed');
  if (p.cloture) niveau(e.cl, 'Clôture : ', 'label_left', 'dotted');
  if (p.ouverture) niveau(e.op, 'Ouverture : ', 'label_left', 'dotted');
}

export default class ProfilBougieSuperieureIndicator {
  static metadata = {
    id: 'profil_bougie_superieure',
    name: 'Bougie et profil de volume de l’unité supérieure',
    shortName: 'PROFIL-HTF',
    description: 'profil_bougie_superieure',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['profil de volume', 'unite superieure', 'bougie', 'poc', 'niveaux'],
    inputs: INPUTS,
    outputs: [
      { id: 'separation', name: 'Début de période', type: 'line', hidden: true },
    ],
    bgColors: [
      { when: 'custom', source: 'separation', condition: (pt) => pt.value === 1, color: SEPARATION },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { separation: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ProfilBougieSuperieureIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer: () => ({ o: creerObjets({ maxBoites: 500, maxLignes: 500, maxEtiquettes: 50 }), O: [], C: [], debuts: [], periode: 0, op: null, cl: null }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => {
        const n = d.length, o = etat.o;
        // plotchar(timeframe.change(tf)[1], ..., location.bottom, show_last = 1000) : pose au rendu, sur les 1 000 dernieres barres.
        const res = o.resultat();
        const car = [];
        for (let i = Math.max(0, n - 1000); i < n; i++) if (s.apres[i]) car.push({ x: i, position: 'bottom', caractere: LETTRE[p.unite], couleur: env.texte, taille: 'small' });
        return {
          separation: d.map((b, i) => ({ time: b.time, value: s.apres[i] && i >= n - 1000 ? 1 : null })),
          objets: { ...res, plotchar: car },
        };
      },
    });
  }
}
