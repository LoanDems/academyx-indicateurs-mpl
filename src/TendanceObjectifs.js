// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trend Targets [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/OXsSm5NV-Trend-Targets-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { atr, ema, wma } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence } from './commun.js';

const ROUGE = '#F23645', VERT = '#4CAF50', BLANC = '#FFFFFF';
const INPUTS = [
  { id: 'facteur', name: 'Facteur du Supertrend', type: 'number', default: 12, min: 1, max: 100, step: 0.5, group: 'Tendance',
    description: 'Écart des bandes du Supertrend en ATR : plus il est grand, moins la tendance change.' },
  { id: 'longueurAtrTendance', name: 'ATR du Supertrend', type: 'number', entier: true, default: 90, min: 1, max: 500, step: 1, group: 'Tendance' },
  { id: 'longueurWma', name: 'Moyenne pondérée', type: 'number', entier: true, default: 40, min: 1, max: 500, step: 1, group: 'Tendance',
    description: 'Moyenne pondérée du milieu des bandes, lissée ensuite par la moyenne exponentielle.' },
  { id: 'longueurEma', name: 'Moyenne exponentielle', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: 'Tendance' },
  { id: 'confirmation', name: 'Barres de confirmation', type: 'number', entier: true, default: 3, min: 1, max: 100, step: 1, group: 'Rejets',
    description: 'Nombre de barres de suite qui chevauchent la ligne de tendance avant de marquer un rejet.' },
  { id: 'objectifs', name: 'Afficher les objectifs', type: 'boolean', default: true, group: 'Objectifs',
    description: 'À chaque changement de tendance : entrée, stop et trois objectifs, prolongés jusqu’au suivant.' },
  { id: 'longueurAtr', name: 'ATR des objectifs', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: 'Objectifs' },
  { id: 'multipleStop', name: 'Stop (× ATR)', type: 'number', default: 5, min: 0.1, max: 100, step: 0.1, group: 'Objectifs',
    description: 'Le stop est posé à ce multiple de l’ATR sous le plus bas (au-dessus du plus haut) de la barre du signal.' },
  { id: 'multiple1', name: 'Objectif 1 (× distance du stop)', type: 'number', default: 0.5, min: 0.1, max: 100, step: 0.1, group: 'Objectifs' },
  { id: 'multiple2', name: 'Objectif 2 (× distance du stop)', type: 'number', default: 1, min: 0.1, max: 100, step: 0.1, group: 'Objectifs' },
  { id: 'multiple3', name: 'Objectif 3 (× distance du stop)', type: 'number', default: 1.5, min: 0.1, max: 100, step: 0.1, group: 'Objectifs' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: 'Style' },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: 'Style' },
];
const NOMS = ['Entrée ▸ ', '✘ Stop ▸ ', ' ✔ Objectif 1 ▸ ', ' ✔ Objectif 2 ▸ ', ' ✔ Objectif 3 ▸ '];
const ALERTES = [
  ['stop_franchi_hausse', 'Clôture au-dessus du stop'], ['stop_franchi_baisse', 'Clôture sous le stop'],
  ['rejet_stop_baissier', 'Rejet baissier au stop'], ['rejet_stop_haussier', 'Rejet haussier au stop'],
  ['objectif_1', 'Objectif 1 atteint'], ['objectif_2', 'Objectif 2 atteint'], ['objectif_3', 'Objectif 3 atteint'],
];

function creer() {
  return {
    o: creerObjets({ maxLignes: 50, maxEtiquettes: 50 }),
    sorties: { tl: [], tendance: [], alertes: [] },
    tendance: 0, rejets: 0,
    niveaux: [0, 0, 0, 0], lignes: null, etiquettes: null, remplissages: null,
    prec: null,
  };
}

const monte = (a, b, a1, b1) => a !== null && b !== null && a1 !== null && b1 !== null && a > b && a1 <= b1;
const descend = (a, b, a1, b1) => a !== null && b !== null && a1 !== null && b1 !== null && a < b && a1 >= b1;

function etape(p, e, data, i, s, env) {
  const S = e.sorties;
  const b = data[i];
  const tl = s.tl[i], tl1 = i > 0 ? s.tl[i - 1] : null, tl2 = i > 1 ? s.tl[i - 2] : null;
  S.tl[i] = tl;
  const tendancePrec = e.tendance;
  if (monte(tl, tl1, tl1, tl2)) e.tendance = 1;
  if (descend(tl, tl1, tl1, tl2)) e.tendance = -1;
  const t = e.tendance;
  S.tendance[i] = t;
  const chevauche = tl !== null && b.high > tl && b.low < tl;
  const rejet = (t === 1 || t === -1) && chevauche;
  if (rejet) e.rejets += 1;
  const croise = (t > 0 && tendancePrec <= 0) || (t < 0 && tendancePrec >= 0);
  if (croise || (!rejet && e.rejets > 0)) e.rejets = 0;
  if (e.rejets > p.confirmation && t === 1) e.o.plotchar(i, { position: 'belowbar', caractere: '▲', couleur: p.couleurHausse, taille: 'tiny' });
  if (e.rejets > p.confirmation && t === -1) e.o.plotchar(i, { position: 'abovebar', caractere: '▼', couleur: p.couleurBaisse, taille: 'tiny' });
  if (monte(tl, tl1, tl1, tl2)) e.o.plotchar(i, { position: 'absolute', y: tl, caractere: '▲', couleur: p.couleurHausse, taille: 'small' });
  if (descend(tl, tl1, tl1, tl2)) e.o.plotchar(i, { position: 'absolute', y: tl, caractere: '▼', couleur: p.couleurBaisse, taille: 'small' });

  const achat = t > 0 && tendancePrec <= 0, vente = t < 0 && tendancePrec >= 0;
  const poser = (long) => {
    const vol = s.vol[i];
    const stop = vol === null ? null : (long ? b.low - vol * p.multipleStop : b.high + vol * p.multipleStop);
    const ecart = stop === null ? null : Math.abs(b.close - stop);
    const objectif = (m) => (ecart === null ? null : (long ? b.close + ecart * m : b.close - ecart * m));
    e.niveaux = [stop, objectif(p.multiple1), objectif(p.multiple2), objectif(p.multiple3)];
    const prix = [b.close, ...e.niveaux];
    const cote = long ? p.couleurHausse : p.couleurBaisse;
    const couleurs = [cote, transparence(p.couleurBaisse, 80), transparence(p.couleurHausse, 80), transparence(p.couleurHausse, 80), transparence(p.couleurHausse, 80)];
    const anciennes = e.lignes, anciennesEt = e.etiquettes;
    e.lignes = prix.map((y, k) => e.o.ligne({ x1: i, y1: y, x2: i, y2: y, couleur: couleurs[k], epaisseur: 3 }));
    e.etiquettes = prix.map((y, k) => e.o.etiquette({
      x: i, y, texte: NOMS[k] + (y === null ? 'NaN' : tostring(y, 'mintick', env.mintick)), style: 'label_left', couleur: couleurs[k], couleurTexte: BLANC,
    }));
    if (anciennes) for (const h of [...anciennes, ...anciennesEt]) e.o.supprimer(h);
  };
  const etendre = (x) => {
    if (!e.lignes) return;
    for (const l of e.lignes) l.x2 = x;
    for (const et of e.etiquettes) et.x = x;
  };
  if (achat && p.objectifs) poser(true); else etendre(i);
  if (vente && p.objectifs) poser(false); else etendre(i + 40);
  if (e.lignes) {
    if (e.remplissages) for (const r of e.remplissages) e.o.supprimer(r);
    e.remplissages = [
      e.o.remplissage(e.lignes[0], e.lignes[1], { couleur: transparence(ROUGE, 95) }),
      e.o.remplissage(e.lignes[0], e.lignes[4], { couleur: transparence(VERT, 95) }),
    ];
  }

  const [stop, o1, o2, o3] = e.niveaux;
  const q = e.prec;
  let bits = 0;
  if (q) {
    if (monte(b.close, stop, q.close, q.niveaux[0])) bits |= 1;
    if (descend(b.close, stop, q.close, q.niveaux[0])) bits |= 2;
    if (monte(b.high, stop, q.high, q.niveaux[0]) && b.close < stop) bits |= 4;
    if (descend(b.low, stop, q.low, q.niveaux[0]) && b.close > stop) bits |= 8;
    if (monte(b.close, o1, q.close, q.niveaux[1])) bits |= 16;
    if (monte(b.close, o2, q.close, q.niveaux[2])) bits |= 32;
    if (monte(b.close, o3, q.close, q.niveaux[3])) bits |= 64;
  }
  S.alertes[i] = bits;
  e.prec = { close: b.close, high: b.high, low: b.low, niveaux: e.niveaux };
}

function rendre(p, e, data) {
  const S = e.sorties;
  const n = data.length;
  const hausse = transparence(p.couleurHausse, 50), baisse = transparence(p.couleurBaisse, 50);
  const couleurs = S.tendance.map((t) => (t === 1 ? hausse : baisse));
  const bougies = new Array(n), alertes = new Array(n);
  for (let i = 0; i < n; i++) {
    bougies[i] = { time: data[i].time, value: 1, color: couleurs[i] };
    alertes[i] = { time: data[i].time, value: S.alertes[i] || null };
  }
  return { tendance: tracer(data, S.tl, couleurs), bougies, alertes, objets: e.o.resultat() };
}

export default class TendanceObjectifsIndicator {
  static metadata = {
    id: 'tendance_objectifs',
    name: 'Tendance lissée avec objectifs',
    shortName: 'TEND-OBJ',
    description: 'tendance_objectifs',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'supertrend', 'objectifs', 'stop', 'rejet'],
    inputs: INPUTS,
    outputs: [
      { id: 'tendance', name: 'Ligne de tendance', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'alertes', name: 'Alertes', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00ffbb', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title], bit) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && ((pt.value >> bit) & 1) === 1,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { tendance: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(TendanceObjectifsIndicator._memo, JSON.stringify([p, env.mintick]), data, {
      creer,
      series: (d) => {
        const a = atr(d, p.longueurAtrTendance);
        const milieu = new Array(d.length);
        let bas = null, haut = null;
        for (let i = 0; i < d.length; i++) {
          const c = d[i], hl2 = (c.high + c.low) / 2;
          const up = a[i] === null ? null : hl2 + p.facteur * a[i], dn = a[i] === null ? null : hl2 - p.facteur * a[i];
          const pb = bas === null ? 0 : bas, ph = haut === null ? 0 : haut, c1 = i > 0 ? d[i - 1].close : null;
          bas = (dn !== null && dn > pb) || (c1 !== null && c1 < pb) ? dn : pb;
          haut = (up !== null && up < ph) || (c1 !== null && c1 > ph) ? up : ph;
          milieu[i] = bas === null || haut === null ? null : (bas + haut) / 2;
        }
        return { tl: ema(wma(milieu, p.longueurWma), p.longueurEma), vol: atr(d, p.longueurAtr) };
      },
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, s, env),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
