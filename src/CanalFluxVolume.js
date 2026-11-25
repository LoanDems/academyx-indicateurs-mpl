// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Volume Channel Flow [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/U8Xy7qJ2-Volume-Channel-Flow-ChartPrime/
// Adaptation : aucune sur le calcul. Le profil d'une barre n'etant lu qu'a la barre suivante (fin de canal ou derniere
// barre), il est calcule a ce moment-la, sur les memes bougies : meme resultat, sans refaire les 30 cases a chaque barre.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence } from './commun.js';

const CA = 'Canal', PR = 'Profil de volume', S = 'Style';
const INPUTS = [
  { id: 'canal', name: 'Canal', type: 'boolean', default: true, group: CA },
  { id: 'largeur', name: 'Largeur du canal (x ATR 200)', type: 'number', default: 3, min: 0.1, max: 50, step: 0.1, group: CA,
    description: 'Demi-largeur du canal autour du milieu de la bougie de cassure, en multiples de l’ATR sur 200 barres.' },
  { id: 'cassures', name: 'Cassures', type: 'boolean', default: true, group: CA },
  { id: 'profil', name: 'Profil de volume', type: 'boolean', default: true, group: PR },
  { id: 'dureeMin', name: 'Durée minimale (barres)', type: 'number', entier: true, default: 10, min: 10, max: 1000, step: 1, group: PR,
    description: 'Un canal n’a son cadre et son profil qu’au-delà de ce nombre de barres sans cassure.' },
  { id: 'poc', name: 'Niveau du plus fort volume', type: 'boolean', default: true, group: PR },
  { id: 'couleurHausse', name: 'Canal haussier', type: 'color', default: '#00E676', group: S },
  { id: 'couleurBaisse', name: 'Canal baissier', type: 'color', default: '#F23645', group: S },
  { id: 'couleurProfilHausse', name: 'Profil acheteur', type: 'color', default: '#4CAF50', group: S },
  { id: 'couleurProfilBaisse', name: 'Profil vendeur', type: 'color', default: '#F23645', group: S },
  { id: 'transparence', name: 'Transparence du profil', type: 'number', entier: true, default: 65, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurPoc', name: 'Plus fort volume', type: 'color', default: '#FF9800', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const CASES = 30;

/** Profil du canal a la barre t (boucle du script) : rend les points, le niveau et le debut du plus fort volume, le sens. */
function profil(d, t, start, top, bot, avecPoc, e) {
  const step = (top - bot) / CASES, vol = new Array(CASES).fill(0), delta = new Array(CASES).fill(0);
  for (let k = 0; k <= t - start; k++) {
    const b = d[t - k], cls = b.close, vo = b.volume;
    for (let i = 0; i < CASES; i++) {
      const mid = bot + step * i + step / 2;
      if (Math.abs(cls - mid) <= step) { vol[i] = vol[i] + vo; delta[i] = delta[i] + (cls > b.open ? vo : -vo); }
    }
  }
  let mx = -Infinity, somme = 0;
  for (let i = 0; i < CASES; i++) if (vol[i] > mx) mx = vol[i];
  for (let i = 0; i < CASES; i++) somme += delta[i];
  const cp = [], longueur = Math.trunc((t - start) / 2);
  for (let i = 0; i < CASES; i++) {
    const r = Math.trunc(vol[i] / mx * longueur), value = Number.isFinite(r) ? r : null;
    if (i === 0) cp.push({ x: start, y: bot });
    const mid = bot + step * i + step / 2;
    if (vol[i] === mx && avecPoc) { e.poc = mid; e.pocDebut = value === null ? null : start + value + 1; }
    e.baissier = !(somme > 0);
    cp.push({ x: value === null ? null : start + value + 1, y: mid });
    if (i === CASES - 1) cp.push({ x: start, y: top });
  }
  e.cp = cp;
}

function series(p, d) {
  const a = taAtr(d, 200);
  return { atr: a.map((v) => (nul(v) ? null : v * p.largeur)) };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], hl2 = (b.high + b.low) / 2, atr = s.atr[i];
  const topAvant = e.top, botAvant = e.bot, avgAvant = e.avg;
  if (i === 201) { e.top = nul(atr) ? null : hl2 + atr; e.bot = nul(atr) ? null : hl2 - atr; }
  if (i > 201) {
    if (!nul(e.top) && b.close > e.top) { e.top = nul(atr) ? null : hl2 + atr; e.bot = nul(atr) ? null : hl2 - atr; e.tendance = true; }
    if (!nul(e.bot) && b.close < e.bot) { e.top = nul(atr) ? null : hl2 + atr; e.bot = nul(atr) ? null : hl2 - atr; e.tendance = false; }
  }
  const avg = nul(e.top) || nul(e.bot) ? null : (e.top + e.bot) / 2;
  e.avg = avg;
  const egal = !nul(avg) && !nul(avgAvant) && avg === avgAvant, change = !nul(avg) && !nul(avgAvant) && avg !== avgAvant;
  // Profil de la barre precedente : lu a la fin d'un canal et a la derniere barre.
  if ((change || derniere) && e.attente) { const a = e.attente; profil(d, a.t, a.start, a.top, a.bot, p.poc, e); }
  if (!(change || derniere)) e.cp = [];
  e.attente = null;
  const pf = e.baissier ? p.couleurProfilBaisse : p.couleurProfilHausse;
  if (egal) e.compte += 1;
  if (change) {
    if (p.cassures) {
      if (avg > avgAvant) o.etiquette({ x: i, y: botAvant, texte: '▲', couleur: null, style: 'label_up', couleurTexte: '#00E676' });
      else o.etiquette({ x: i, y: topAvant, texte: '▼', couleur: null, style: 'label_down', couleurTexte: '#F23645' });
    }
    if (e.compte > p.dureeMin) {
      if (p.canal) {
        o.ligne({ x1: e.debut, y1: topAvant, x2: i, y2: topAvant, couleur: transparence(pf, 20), style: 'solid' });
        o.ligne({ x1: e.debut, y1: botAvant, x2: i, y2: botAvant, couleur: transparence(pf, 20), style: 'solid' });
      }
      o.boite({ gauche: e.debut, haut: topAvant, droite: i, bas: botAvant, couleurBordure: null, epaisseurBordure: 0, fond: transparence(env.texte, 92) });
    }
    if (p.poc) o.ligne({ x1: p.profil ? e.pocDebut : e.debut, y1: e.poc, x2: i, y2: e.poc, couleur: transparence(p.couleurPoc, 20), style: 'dashed' });
    if (p.profil) o.polyligne({ points: e.cp, courbe: true, fermee: false, fond: transparence(pf, p.transparence), couleur: transparence(pf, p.transparence) });
    e.debut = i; e.compte = 0; e.poc = null;
  }
  if (derniere) {
    if (p.profil) o.polyligne({ points: e.cp, courbe: true, fermee: false, fond: transparence(pf, p.transparence), couleur: transparence(pf, p.transparence) });
    if (p.poc) o.ligne({ x1: p.profil ? e.pocDebut : e.debut, y1: e.poc, x2: i, y2: e.poc, couleur: transparence(p.couleurPoc, 20), style: 'solid' });
    if (p.canal) {
      o.ligne({ x1: e.debut, y1: e.top, x2: i, y2: e.top, couleur: transparence(pf, 20), style: 'solid' });
      o.ligne({ x1: e.debut, y1: e.bot, x2: i, y2: e.bot, couleur: transparence(pf, 20), style: 'solid' });
    }
  }
  e.cp = [];
  if (e.compte > p.dureeMin) e.attente = { t: i, start: e.debut, top: e.top, bot: e.bot };
  const S = e.sorties;
  S.avg[i] = avg;
  S.couleur[i] = e.tendance === true ? p.couleurHausse : p.couleurBaisse;
}

export default class CanalFluxVolumeIndicator {
  static metadata = {
    id: 'canal_flux_volume',
    name: 'Canal de flux et profil de volume',
    shortName: 'CFV',
    description: 'canal_flux_volume',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['canal', 'volume', 'profil', 'cassure', 'poc'],
    inputs: INPUTS,
    outputs: [
      { id: 'flux', name: 'Milieu du canal', type: 'line', color: '#00E676', lineWidth: 3, reglageCouleur: 'couleurHausse' },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { flux: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CanalFluxVolumeIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({
        o: creerObjets({ maxLignes: 500, maxEtiquettes: 500, maxBoites: 500, maxPolylignes: 100 }), sorties: { avg: [], couleur: [] },
        top: null, bot: null, avg: null, tendance: null, compte: 0, debut: 0, poc: null, pocDebut: 0, baissier: null, cp: [], attente: null,
      }),
      series: (d) => series(p, d),
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, derniere, s, env),
      rendre: (e, d) => ({ flux: tracer(d, e.sorties.avg, e.sorties.couleur), objets: e.o.resultat() }),
    });
  }
}
