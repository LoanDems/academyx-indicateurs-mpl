// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Zero Lag Trend Signals (MTF) [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/tHK4O1Fi-Zero-Lag-Trend-Signals-MTF-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { atr, ema } from '../academyscript/ta.js';
import { securite } from '../academyscript/request.js';
import { infosTimeframe } from '../academyscript/contexte.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide } from './commun.js';

const UNITES = ['t1', 't2', 't3', 't4', 't5'];
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 70, min: 2, max: 500, step: 1, group: 'Calcul',
    description: 'Fenêtre de la moyenne exponentielle sans retard (clôture corrigée de son écart à la clôture d’il y a (longueur - 1) / 2 barres).' },
  { id: 'multiple', name: 'Largeur des bandes', type: 'number', default: 1.2, min: 0.1, max: 20, step: 0.1, group: 'Calcul',
    description: 'Multiple du plus haut ATR des 3 × longueur dernières barres : la tendance change quand la clôture sort des bandes.' },
  { id: 't1', name: 'Unité 1', type: 'timeframe', default: '5m', group: 'Autres unités' },
  { id: 't2', name: 'Unité 2', type: 'timeframe', default: '15m', group: 'Autres unités' },
  { id: 't3', name: 'Unité 3', type: 'timeframe', default: '1h', group: 'Autres unités' },
  { id: 't4', name: 'Unité 4', type: 'timeframe', default: '4h', group: 'Autres unités' },
  { id: 't5', name: 'Unité 5', type: 'timeframe', default: '1D', group: 'Autres unités' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00ffbb', group: 'Style' },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ff1100', group: 'Style' },
];

/**
 * ta.highest(x, n) en temps lineaire (file monotone) : lecture arretee au premier
 * na en remontant, na sur une barre na ou avant la barre n - 1.
 */
function plusHaut(v, n) {
  const out = new Array(v.length).fill(null);
  const file = [];
  let debut = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] === null) { file.length = 0; debut = 0; continue; }
    while (file.length > debut && v[file[file.length - 1]] <= v[i]) file.pop();
    file.push(i);
    while (file[debut] <= i - n) debut++;
    if (i >= n - 1) out[i] = v[file[debut]];
  }
  return out;
}

/** Moyenne sans retard, bandes et tendance du script sur des bougies quelconques. */
function tendance(bougies, p) {
  const n = bougies.length;
  const c = bougies.map((b) => b.close);
  const decal = Math.floor((p.longueur - 1) / 2);
  const zlema = ema(c.map((v, i) => (i >= decal ? v + (v - c[i - decal]) : null)), p.longueur);
  const vol = plusHaut(atr(bougies, p.longueur), p.longueur * 3).map((v) => (v === null ? null : v * p.multiple));
  const sens = new Array(n);
  let t = 0;
  for (let i = 0; i < n; i++) {
    const z = zlema[i], v = vol[i], z1 = i > 0 ? zlema[i - 1] : null, v1 = i > 0 ? vol[i - 1] : null;
    const ok = z !== null && v !== null && z1 !== null && v1 !== null;
    if (ok && c[i] > z + v && c[i - 1] <= z1 + v1) t = 1;
    if (ok && c[i] < z - v && c[i - 1] >= z1 - v1) t = -1;
    sens[i] = t;
  }
  return { zlema, vol, sens };
}

function pasDuGraphique(data, ctx) {
  const s = ctx && ctx.timeframe && ctx.timeframe.in_seconds;
  if (s > 0) return s;
  const ecarts = [];
  for (let k = Math.max(1, data.length - 200); k < data.length; k++) { const d = data[k].time - data[k - 1].time; if (d > 0) ecarts.push(d); }
  ecarts.sort((a, b) => a - b);
  return ecarts.length ? ecarts[ecarts.length >> 1] : 60;
}

function creer() {
  return { o: creerObjets({ maxEtiquettes: 500 }), sorties: { alertes: [] }, fondHaut: suiteVide(), fondBas: suiteVide() };
}

const croiseHausse = (a, b, a1, b1) => a !== null && b !== null && a1 !== null && b1 !== null && a > b && a1 <= b1;
const croiseBaisse = (a, b, a1, b1) => a !== null && b !== null && a1 !== null && b1 !== null && a < b && a1 >= b1;

function etape(p, e, data, i, derniere, s, env) {
  const o = e.o, b = data[i];
  const z = s.zlema[i], v = s.vol[i], t = s.sens[i], t1 = i > 0 ? s.sens[i - 1] : null;
  remplir(o, e.fondHaut, s.zlema, s.haut, i, p.fondBaisse, derniere);
  remplir(o, e.fondBas, s.zlema, s.bas, i, p.fondHausse, derniere);
  const zv = z === null || v === null ? null : z + v, zm = z === null || v === null ? null : z - v;
  if (t1 !== null && t < 0 && t1 >= 0 && zv !== null) o.plotchar(i, { position: 'absolute', y: zv, caractere: '▼', couleur: p.couleurBaisse, taille: 'small' });
  if (t1 !== null && t > 0 && t1 <= 0 && zm !== null) o.plotchar(i, { position: 'absolute', y: zm, caractere: '▲', couleur: p.couleurHausse, taille: 'small' });
  const c1 = i > 0 ? data[i - 1].close : null, z1 = i > 0 ? s.zlema[i - 1] : null;
  const entreeHausse = croiseHausse(b.close, z, c1, z1) && t === 1 && t1 === 1;
  const entreeBaisse = croiseBaisse(b.close, z, c1, z1) && t === -1 && t1 === -1;
  if (entreeHausse) o.plotchar(i, { position: 'absolute', y: z - v * 1.5, caractere: '▲', couleur: p.couleurHausse, taille: 'tiny' });
  if (entreeBaisse) o.plotchar(i, { position: 'absolute', y: z + v * 1.5, caractere: '▼', couleur: p.couleurBaisse, taille: 'tiny' });

  const bits = [entreeHausse, entreeBaisse, t1 !== null && t > 0 && t1 <= 0, t1 !== null && t < 0 && t1 >= 0];
  for (const u of s.unites) {
    const x = u.sens ? u.sens[i] : null, x1 = u.sens && i > 0 ? u.sens[i - 1] : null;
    bits.push(x !== null && x1 !== null && x > 0 && x1 <= 0, x !== null && x1 !== null && x < 0 && x1 >= 0);
  }
  e.sorties.alertes[i] = bits.reduce((m, vrai, k) => (vrai ? m | (1 << k) : m), 0);

  if (!derniere) return;
  const tb = o.tableau({ position: 'top_right', colonnes: 2, lignes: 6, fond: env.fond, couleurBordure: env.texte, epaisseurBordure: 1, couleurCadre: env.texte, epaisseurCadre: 1 });
  const cel = (c, l, texte, fond) => tb.cellule(c, l, { texte, couleurTexte: env.texte, alignH: 'center', ...(fond ? { fond } : {}) });
  cel(0, 0, 'Unité');
  cel(1, 0, 'Signal');
  s.unites.forEach((u, k) => {
    cel(0, k + 1, u.nom);
    if (!u.sens) { cel(1, k + 1, 'n/d'); return; }
    const hausse = u.sens[i] === 1;
    cel(1, k + 1, hausse ? 'Haussier' : 'Baissier', hausse ? p.fondHausse70 : p.fondBaisse70);
  });
}

function rendre(p, e, data, s) {
  const n = data.length;
  const couleurs = s.sens.map((t) => (t === 1 ? p.fondHausse70 : p.fondBaisse70));
  const alertes = new Array(n);
  for (let i = 0; i < n; i++) alertes[i] = { time: data[i].time, value: e.sorties.alertes[i] || null };
  return {
    moyenne: tracer(data, s.zlema, couleurs),
    bandeHaute: tracer(data, s.haut, new Array(n).fill(p.fondBaisse90)),
    bandeBasse: tracer(data, s.bas, new Array(n).fill(p.fondHausse90)),
    alertes,
    objets: e.o.resultat(),
  };
}

const ALERTES = [
  ['entree_haussiere', 'Entrée haussière'], ['entree_baissiere', 'Entrée baissière'],
  ['tendance_haussiere', 'Tendance haussière'], ['tendance_baissiere', 'Tendance baissière'],
  ...UNITES.flatMap((u, k) => [[`unite${k + 1}_haussiere`, `Tendance haussière (unité ${k + 1})`], [`unite${k + 1}_baissiere`, `Tendance baissière (unité ${k + 1})`]]),
];

export default class TendanceSansRetardIndicator {
  static metadata = {
    id: 'tendance_sans_retard',
    name: 'Tendance sans retard multi-unités',
    shortName: 'ZL-TEND',
    description: 'tendance_sans_retard',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'zero lag', 'sans retard', 'bandes', 'multi-unites', 'atr'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenne', name: 'Moyenne sans retard', type: 'line', color: '#00ffbb', lineWidth: 2 },
      { id: 'bandeHaute', name: 'Bande haute', type: 'line', color: '#ff1100', lineWidth: 1 },
      { id: 'bandeBasse', name: 'Bande basse', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'alertes', name: 'Alertes', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], bit) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && ((pt.value >> bit) & 1) === 1,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { moyenne: [] };
    const r = this.params;
    const env = contexte(data, ctx);
    const p = {
      ...r,
      fondHausse70: transparence(r.couleurHausse, 70), fondBaisse70: transparence(r.couleurBaisse, 70),
      fondHausse90: transparence(r.couleurHausse, 90), fondBaisse90: transparence(r.couleurBaisse, 90),
    };
    p.fondHausse = milieu(p.fondHausse90, p.fondHausse70);
    p.fondBaisse = milieu(p.fondBaisse90, p.fondBaisse70);
    const pas = pasDuGraphique(data, ctx);
    const enCours = ctx && ctx.barstate && ctx.barstate.isrealtime ? undefined : true;
    return executer(TendanceSansRetardIndicator._memo, JSON.stringify([r, env.texte, env.fond, pas]), data, {
      creer,
      series: (d) => {
        const base = tendance(d, p);
        const haut = d.map((_, i) => (base.sens[i] === -1 && base.zlema[i] !== null && base.vol[i] !== null ? base.zlema[i] + base.vol[i] : null));
        const bas = d.map((_, i) => (base.sens[i] === 1 && base.zlema[i] !== null && base.vol[i] !== null ? base.zlema[i] - base.vol[i] : null));
        const unites = UNITES.map((k) => {
          const tf = r[k];
          const s = infosTimeframe(tf).in_seconds;
          if (!(s >= pas)) return { nom: tf, sens: null };
          return { nom: tf, sens: securite(d, tf, (h) => tendance(h, p).sens, { ctx, pasGraphique: `${pas}s`, derniereEnCours: enCours }) };
        });
        return { ...base, haut, bas, unites };
      },
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
