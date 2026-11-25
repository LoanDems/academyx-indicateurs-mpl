// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Market sessions and Volume profile - By Leviathan » © LeviathanCapital — https://www.tradingview.com/script/tV3rCaJ9-Market-sessions-and-Volume-profile-By-Leviathan/
import { creerObjets } from '../academyscript/objets.js';
import { ema } from '../academyscript/ta.js';
import { lireReglages, executer, contexte } from './commun.js';

const SESSIONS = [
  { value: 'Tokyo', label: 'Tokyo' }, { value: 'London', label: 'Londres' }, { value: 'New York', label: 'New York' },
  { value: 'Daily', label: 'Jour' }, { value: 'Weekly', label: 'Semaine' }, { value: 'Monthly', label: 'Mois' },
  { value: 'Quarterly', label: 'Trimestre' }, { value: 'Yearly', label: 'Année' },
];
const NOMS = Object.fromEntries(SESSIONS.map((s) => [s.value, s.label]));
const AFFICHAGE = 'Style : affichage';
const INPUTS = [
  { id: 'session', name: 'Période', type: 'select', default: 'Daily', options: SESSIONS, group: 'Paramètres',
    description: 'Chaque période (séance horaire UTC, jour, semaine, mois, trimestre, année) reçoit son profil de volume, dessiné à sa fin.' },
  { id: 'rangees', name: 'Rangées du profil', type: 'number', entier: true, default: 30, min: 5, max: 200, step: 1, group: 'Profil de volume' },
  { id: 'zoneValeur', name: 'Zone de valeur (% du volume)', type: 'number', entier: true, default: 70, min: 1, max: 100, step: 1, group: 'Profil de volume' },
  { id: 'mode', name: 'Disposition des barres', type: 'select', default: 'Mode 2', group: 'Profil de volume',
    options: [{ value: 'Mode 1', label: 'Hausse seule' }, { value: 'Mode 2', label: 'Hausse puis baisse' }, { value: 'Mode 3', label: 'Hausse à droite, baisse à gauche' }] },
  { id: 'lisser', name: 'Lisser le volume', type: 'boolean', default: false, group: 'Profil de volume',
    description: 'Moyenne exponentielle du volume sur 5 barres, utile quand de très grosses barres écrasent le profil.' },
  { id: 'profil', name: 'Profil de volume', type: 'boolean', default: true, group: AFFICHAGE },
  { id: 'poc', name: 'Rangée la plus échangée', type: 'boolean', default: true, group: AFFICHAGE },
  { id: 'bornes', name: 'Haut et bas de la zone de valeur', type: 'boolean', default: true, group: AFFICHAGE },
  { id: 'cadreValeur', name: 'Cadre de la zone de valeur', type: 'boolean', default: false, group: AFFICHAGE },
  { id: 'enCours', name: 'Période en cours', type: 'boolean', default: true, group: AFFICHAGE },
  { id: 'etiquettes', name: 'Noms des périodes', type: 'boolean', default: true, group: AFFICHAGE },
  { id: 'seancesForex', name: 'Séances Tokyo, Londres, New York (sans profil)', type: 'boolean', default: false, group: AFFICHAGE },
  { id: 'couleurHausse', name: 'Volume haussier', type: 'color', default: 'rgba(76, 175, 79, 0.5)', group: 'Style' },
  { id: 'couleurBaisse', name: 'Volume baissier', type: 'color', default: 'rgba(255, 82, 82, 0.5)', group: 'Style' },
  { id: 'couleurCadreValeur', name: 'Cadre de la zone de valeur', type: 'color', default: 'rgba(107, 159, 255, 0.1)', group: 'Style' },
  { id: 'couleurPoc', name: 'Rangée la plus échangée', type: 'color', default: '#F23645', group: 'Style' },
  { id: 'epaisseurPoc', name: 'Épaisseur (rangée la plus échangée)', type: 'number', entier: true, default: 1, min: 1, max: 4, step: 1, group: 'Style', legende: false },
  { id: 'couleurHautValeur', name: 'Haut de la zone de valeur', type: 'color', default: '#00BCD4', group: 'Style' },
  { id: 'epaisseurHautValeur', name: 'Épaisseur (haut de la zone de valeur)', type: 'number', entier: true, default: 1, min: 1, max: 4, step: 1, group: 'Style', legende: false },
  { id: 'couleurBasValeur', name: 'Bas de la zone de valeur', type: 'color', default: '#00BCD4', group: 'Style' },
  { id: 'epaisseurBasValeur', name: 'Épaisseur (bas de la zone de valeur)', type: 'number', entier: true, default: 1, min: 1, max: 4, step: 1, group: 'Style', legende: false },
  { id: 'fondCadre', name: 'Fond du cadre de période', type: 'color', default: 'rgba(255, 153, 0, 0)', group: 'Style' },
  { id: 'epaisseurCadre', name: 'Épaisseur du cadre de période', type: 'number', entier: true, default: 1, min: 1, max: 4, step: 1, group: 'Style', legende: false },
];

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

function creer() {
  return {
    o: creerObjets({ maxBoites: 500, maxLignes: 50, maxEtiquettes: 50 }),
    sorties: { haut: [], bas: [], heure: [] },
    debut: 0, actif: false, tokyo: 0, londres: 0, newYork: 0,
    barres: [],
    extremes: { haut: -Infinity, bas: Infinity }, extremesAvant: { haut: -Infinity, bas: Infinity },
    prec: null,
  };
}

const semaineIso = (d) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const j = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - j);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
const calendrier = (temps) => {
  const d = new Date(temps * 1000);
  return { jourSemaine: d.getUTCDay(), semaine: semaineIso(d), jour: d.getUTCDate(), mois: d.getUTCMonth() + 1, annee: d.getUTCFullYear(), heure: d.getUTCHours() };
};

const partage = (a1, a2, b1, b2, hauteur, vol) => {
  const r = Math.max(Math.min(Math.max(a1, a2), Math.max(b1, b2)) - Math.max(Math.min(a1, a2), Math.min(b1, b2)), 0) * vol / hauteur;
  return Number.isFinite(r) ? r : 0;
};

/** profileAdd du script : corps et meches repartis sur les rangees, meches pour moitie de chaque cote. */
function ajouter(b, bornes, pas, vert, rouge) {
  const v = b.v === null ? NaN : b.v;
  const corpsHaut = Math.max(b.c, b.o), corpsBas = Math.min(b.c, b.o), hausse = b.c >= b.o;
  const mecheHaute = b.h - corpsHaut, mecheBasse = corpsBas - b.l, corps = corpsHaut - corpsBas;
  const total = 2 * mecheHaute + 2 * mecheBasse + corps;
  const vCorps = corps * v / total, vHaute = 2 * mecheHaute * v / total, vBasse = 2 * mecheBasse * v / total;
  for (let k = 0; k < bornes.length; k++) {
    const haut = bornes[k], bas = haut - pas;
    const enCorps = partage(bas, haut, corpsBas, corpsHaut, corps, vCorps);
    const meches = partage(bas, haut, corpsHaut, b.h, mecheHaute, vHaute) / 2;
    const mechesBas = partage(bas, haut, corpsBas, b.l, mecheBasse, vBasse) / 2;
    vert[k] = vert[k] + (hausse ? enCorps : 0) + meches + mechesBas;
    rouge[k] = rouge[k] + (hausse ? 0 : enCorps) + meches + mechesBas;
  }
}

function profil(p, e, haut, bas) {
  const pas = (haut - bas) / p.rangees;
  const bornes = new Array(p.rangees);
  for (let k = 0; k < p.rangees; k++) bornes[k] = haut - pas * k;
  const vert = new Array(p.rangees).fill(0), rouge = new Array(p.rangees).fill(0);
  for (const b of e.barres) ajouter(b, bornes, pas, vert, rouge);
  return { pas, bornes, vert, rouge };
}

function niveaux(p, P, haut, bas) {
  const { bornes, vert, rouge, pas } = P;
  const N = bornes.length;
  let max = 0, rang = 0;
  for (let k = 0; k < N; k++) if (rouge[k] + vert[k] > max) { max = rouge[k] + vert[k]; rang = k; }
  const poc = rang !== N - 1 ? bornes[rang] - (bornes[rang] - bornes[rang + 1]) / 2 : null;
  let somme = 0;
  for (let k = 0; k < N; k++) somme += rouge[k];
  let sommeV = 0;
  for (let k = 0; k < N; k++) sommeV += vert[k];
  const total = somme + sommeV;
  let cumul = 0, hautVa = haut, basVa = bas, iPoc = 0;
  for (let k = 0; k < N - 1; k++) if (poc !== null && bornes[k] >= poc && bornes[k + 1] < poc) iPoc = k;
  cumul += rouge[iPoc] + vert[iPoc];
  for (let k = 1; k <= N; k++) {
    if (iPoc + k >= 0 && iPoc + k < N) {
      cumul += rouge[iPoc + k] + vert[iPoc + k];
      if (cumul >= total * (p.zoneValeur / 100)) break;
      basVa = bornes[iPoc + k] - pas;
    }
    if (iPoc - k >= 0 && iPoc - k < N) {
      cumul += rouge[iPoc - k] + vert[iPoc - k];
      if (cumul >= total * (p.zoneValeur / 100)) break;
      hautVa = bornes[iPoc - k];
    }
  }
  return { poc, hautVa, basVa, total };
}

function dessiner(p, e, i, haut, bas, env) {
  const o = e.o;
  const P = profil(p, e, haut, bas);
  const N = P.bornes.length;
  let sv = 0, sr = 0;
  for (let k = 0; k < N; k++) { sv += P.vert[k]; sr += P.rouge[k]; }
  if (!(sv + sr > 0)) return;
  const recul = i - e.debut;
  const gauche = e.debut, droiteMax = i - Math.trunc(recul / 1.4);
  const maxVol = Math.max(...P.vert) + Math.max(...P.rouge);
  const marge = P.pas / 10;
  if (p.etiquettes) o.etiquette({ x: Math.trunc((i - 1 + gauche) / 2), y: haut, texte: NOMS[p.session], couleur: TRANSPARENT, couleurTexte: env.texte });
  if (p.profil) {
    for (let k = 0; k < N; k++) {
      const finVert = Math.trunc(gauche + (droiteMax - gauche) * (P.vert[k] / maxVol));
      const finRouge = Math.trunc(finVert + (droiteMax - gauche) * (P.rouge[k] / maxVol));
      const rangee = (g, d, fond) => o.boite({ gauche: g, haut: P.bornes[k] - marge, droite: d, bas: P.bornes[k] - P.pas + marge, fond, epaisseurBordure: 0, couleurBordure: null });
      rangee(gauche, finVert, p.couleurHausse);
      if (p.mode === 'Mode 2') rangee(finVert, finRouge, p.couleurBaisse);
      else if (p.mode === 'Mode 3') rangee(gauche - finRouge + finVert, gauche, p.couleurBaisse);
    }
  }
  o.boite({ gauche, haut, droite: i - 1, bas, couleurBordure: env.texte, epaisseurBordure: p.epaisseurCadre, styleBordure: 'dashed', fond: p.fondCadre });
  const N2 = niveaux(p, P, haut, bas);
  if (p.poc) o.ligne({ x1: gauche, y1: N2.poc, x2: i - 1, y2: N2.poc, couleur: p.couleurPoc, epaisseur: p.epaisseurPoc });
  if (p.bornes) {
    o.ligne({ x1: gauche, y1: N2.hautVa, x2: i - 1, y2: N2.hautVa, couleur: p.couleurHautValeur, epaisseur: p.epaisseurHautValeur });
    o.ligne({ x1: gauche, y1: N2.basVa, x2: i - 1, y2: N2.basVa, couleur: p.couleurBasValeur, epaisseur: p.epaisseurBasValeur });
  }
  if (p.cadreValeur) o.boite({ gauche, haut: N2.hautVa, droite: i - 1, bas: N2.basVa, couleurBordure: TRANSPARENT, fond: p.couleurCadreValeur });
}

function etape(p, e, data, i, derniere, s, env) {
  const b = data[i], S = e.sorties;
  const c = calendrier(b.time), q = e.prec;
  const recul = i - e.debut;
  S.haut[i] = b.high; S.bas[i] = b.low;
  const haut = i > 0 ? Math.max(e.extremesAvant.haut, S.haut[i - 1]) : null;
  const bas = i > 0 ? Math.min(e.extremesAvant.bas, S.bas[i - 1]) : null;

  const nouveau = { Tokyo: false, London: false, 'New York': false, Daily: false, Weekly: false, Monthly: false, Yearly: false, Quarterly: false };
  const fin = { Tokyo: false, London: false, 'New York': false };
  if (q) {
    const h = c.heure, h1 = q.heure;
    nouveau.Daily = c.jourSemaine !== q.jourSemaine;
    nouveau.Weekly = c.semaine !== q.semaine;
    nouveau.Monthly = c.jour !== q.jour + 1 && c.jour !== q.jour;
    nouveau.Yearly = c.annee !== q.annee;
    nouveau.Quarterly = c.mois !== q.mois && (c.mois - 1) % 3 === 0;
    nouveau.Tokyo = h !== h1 + 1 && h !== h1;
    fin.Tokyo = h >= 9 && h1 < 9;
    nouveau.London = h >= 7 && h1 < 7;
    fin.London = h >= 16 && h1 < 16;
    nouveau['New York'] = h >= 13 && h1 < 13;
    fin['New York'] = h >= 22 && h1 < 22;
  }
  const nouvelle = nouveau[p.session];
  const finZone = p.session in fin ? fin[p.session] : nouveau[p.session];

  if (i > recul && haut !== null) {
    if (finZone) dessiner(p, e, i, haut, bas, env);
    else if (derniere && p.enCours && e.actif) dessiner(p, e, i, haut, bas, env);
  }
  if (nouvelle) e.barres = [];
  e.barres.push({ o: b.open, h: b.high, l: b.low, c: b.close, v: s.volume[i] });
  if (finZone) e.actif = false;
  if (nouvelle) { e.debut = i; e.actif = true; }
  e.extremesAvant = e.extremes;
  e.extremes = nouvelle ? { haut: b.high, bas: b.low } : { haut: Math.max(e.extremes.haut, b.high), bas: Math.min(e.extremes.bas, b.low) };
  if (nouveau.London) e.londres = i;
  if (nouveau.Tokyo) e.tokyo = i;
  if (nouveau['New York']) e.newYork = i;

  if (p.seancesForex) {
    const seance = (debut, nom) => {
      let h = -Infinity, l = Infinity;
      for (let k = debut; k <= i; k++) { if (S.haut[k] > h) h = S.haut[k]; if (S.bas[k] < l) l = S.bas[k]; }
      e.o.boite({ gauche: debut, haut: h, droite: i - 1, bas: l, couleurBordure: env.texte, epaisseurBordure: p.epaisseurCadre, styleBordure: 'dashed', fond: p.fondCadre });
      if (p.etiquettes) e.o.etiquette({ x: Math.trunc((i - 1 + debut) / 2), y: h, texte: nom, couleur: TRANSPARENT, couleurTexte: env.texte });
    };
    if (fin.London) seance(e.londres, 'Londres');
    if (fin['New York']) seance(e.newYork, 'New York');
    if (fin.Tokyo) seance(e.tokyo, 'Tokyo');
  }
  e.prec = c;
}

export default class ProfilsSessionsIndicator {
  static metadata = {
    id: 'profils_sessions',
    name: 'Profils de volume par période',
    shortName: 'VP-PER',
    description: 'profils_sessions',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['profil de volume', 'sessions', 'zone de valeur', 'poc', 'jour', 'semaine'],
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
    const env = contexte(data, ctx);
    return executer(ProfilsSessionsIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => ({ volume: p.lisser ? ema(d.map((c) => c.volume), 5) : d.map((c) => c.volume) }),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat) => ({ objets: etat.o.resultat() }),
    });
  }
}
