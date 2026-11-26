// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Monte Carlo Range Forecast [DW] » © DonovanWall — https://www.tradingview.com/script/ujVS2XfG-Monte-Carlo-Range-Forecast-DW/
// Adaptation : heure de depart vide par defaut = la prevision commence `Barres` bougies avant la derniere (le script demande
// une date a l'ajout, 01/01/2021 par defaut) ; graine parente fixe seulement (la graine « dynamique » du script lit timenow et
// change a chaque chargement) ; textes du panneau en francais, dates en UTC ; fond noir du panneau (bgcolor) non repris, le
// fond du graphique restant sombre ; fill() a transparence 60 comme le script. Comme le script, les simulations sont tirees
// sur les `Barres` premieres bougies du graphique, avec les memes nombres a chaque barre (les tableaux de graines sont recopies
// a chaque appel de Sim_Vals) : la dispersion croit donc lineairement d'un pas a l'autre.
import { creerObjets } from '../academyscript/objets.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, transparence, remplir, suiteVide, pointsStables, TRANSPARENT } from './commun.js';

const PR = 'Prévision', GR = 'Graine', AM = 'Amplitudes', PO = 'Poids', AF = 'Affichage', PA = 'Panneau d’information', S = 'Style';
const INPUTS = [
  { id: 'debut', name: 'Heure de départ', type: 'time', default: null, group: PR,
    description: 'Vide : la prévision commence à « Barres » bougies de la dernière. Sinon, première bougie à cette heure ou après.' },
  { id: 'barres', name: 'Barres', type: 'number', entier: true, default: 100, min: 2, max: 1000, step: 1, group: PR },
  { id: 'simulations', name: 'Simulations', type: 'number', entier: true, default: 1000, min: 2, max: 3000, step: 1, group: PR },
  { id: 'derive', name: 'Inclure la dérive', type: 'boolean', default: false, group: PR },
  { id: 'type', name: 'Type', type: 'select', default: 'End Result', group: PR, options: [{ label: 'Issue finale', value: 'End Result' }, { label: 'En cours', value: 'Developing' }] },
  { id: 'graine', name: 'Graine parente', type: 'number', default: 123456, min: 0, max: 1e9, step: 1, group: GR, legende: false },
  { id: 'ajusterAmplitudes', name: 'Ajuster les amplitudes', type: 'boolean', default: true, group: AM },
  { id: 'amplitude1', name: 'Variable 1', type: 'number', default: 1.0, min: 0, max: 100, step: 0.1, group: AM, legende: false },
  { id: 'amplitude2', name: 'Variable 2', type: 'number', default: 2.0, min: 0, max: 100, step: 0.1, group: AM, legende: false },
  { id: 'amplitude3', name: 'Variable 3', type: 'number', default: 3.0, min: 0, max: 100, step: 0.1, group: AM, legende: false },
  { id: 'limiterPoids', name: 'Limiter les poids', type: 'boolean', default: true, group: PO },
  { id: 'min1', name: 'Variable 1 : minimum', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, group: PO, legende: false },
  { id: 'max1', name: 'Variable 1 : maximum', type: 'number', default: 1.0, min: 0, max: 1, step: 0.05, group: PO, legende: false },
  { id: 'min2', name: 'Variable 2 : minimum', type: 'number', default: 0.25, min: 0, max: 1, step: 0.05, group: PO, legende: false },
  { id: 'max2', name: 'Variable 2 : maximum', type: 'number', default: 1.0, min: 0, max: 1, step: 0.05, group: PO, legende: false },
  { id: 'min3', name: 'Variable 3 : minimum', type: 'number', default: 0.0, min: 0, max: 1, step: 0.05, group: PO, legende: false },
  { id: 'max3', name: 'Variable 3 : maximum', type: 'number', default: 1.0, min: 0, max: 1, step: 0.05, group: PO, legende: false },
  { id: 'affichage', name: 'Affichage', type: 'select', default: 'Forecast', group: AF, options: [{ label: 'Prévision', value: 'Forecast' }, { label: 'Comparaison des variations', value: 'Difference Comparison' }] },
  { id: 'extremes', name: 'Extrêmes en cours', type: 'boolean', default: true, group: AF },
  { id: 'montrerSimulation', name: 'Montrer une simulation', type: 'boolean', default: false, group: AF },
  { id: 'simulationPrix', name: 'Simulation montrée (prévision)', type: 'number', entier: true, default: 1, min: 1, max: 3000, step: 1, group: AF },
  { id: 'simulationVariations', name: 'Simulation montrée (comparaison)', type: 'number', entier: true, default: 1, min: 1, max: 3000, step: 1, group: AF },
  { id: 'panneau', name: 'Panneau d’information', type: 'boolean', default: true, group: PA },
  { id: 'tailleTexte', name: 'Taille', type: 'select', default: 'Large', group: PA,
    options: ['Auto', 'Tiny', 'Small', 'Normal', 'Large', 'Huge'].map((v, k) => ({ label: ['Automatique', 'Très petite', 'Petite', 'Normale', 'Grande', 'Très grande'][k], value: v })) },
  { id: 'formatDate', name: 'Format de date', type: 'select', default: 'MM/DD/YYYY', group: PA, options: ['MM/DD/YYYY', 'YYYY/MM/DD', 'DD/MM/YYYY'] },
  { id: 'fondPanneau', name: 'Fond du panneau', type: 'color', default: 'rgba(53, 2, 25, 0.7)', group: S },
  { id: 'textePanneau', name: 'Texte du panneau', type: 'color', default: 'rgba(255, 255, 255, 0.7)', group: S },
];
const FILLS = ['#ffa900', '#ff9002', '#ff731a', '#ff4e2f', '#ff0044', '#ff005a', '#ff0073', '#ff008e', '#f100ab', '#ce00c9', '#9800e6', '#1e00ff'];
const B_COL = '#ff8b00', ACT = '#ffffff', ACT2 = '#00ffff', ACT3 = '#14e110', INACT = '#8b8b8b';
const SEP = '\n═══════════════════\n';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const ts = (v) => (Number.isFinite(v) ? formaterMotif(v, '#.##########') : 'NaN');
const deux = (k) => (k < 10 ? '0' : '') + String(k);

/** Rand_Seeds(s, n) : graines uniformes (Wichmann-Hill), coupees en trois tranches. */
function graines(s, n) {
  const seeds = new Array(n);
  let a1 = s, a2 = s, a3 = s;
  for (let i = 0; i <= n - 1; i++) {
    a1 = (171 * a1 % 30269); a2 = (172 * a2 % 30307); a3 = (170 * a3 % 30323);
    const t = ((a1 / 30269) + (a2 / 30307) + (a3 / 30323)) % 1;
    seeds[i] = Math.max(Math.round(t * 10000), 1);
  }
  const k = Math.trunc(n / 3);
  return [seeds.slice(0, k), seeds.slice(k, 2 * k), seeds.slice(2 * k, 3 * k)];
}

/** Sim_Vals, partie tiree a chaque appel : les copies des graines sont neuves a chaque barre, donc ces variations aussi. */
function variations(p, c) {
  const [s1, s2, s3, s4, s5, s6] = c, n = s1.length;
  const sr2 = Math.sqrt(2), pi = Math.acos(-1), A = 8 * (pi - 3) / (3 * pi * (4 - pi)), B = 2 / (A * pi);
  const amp = p.ajusterAmplitudes ? [p.amplitude1, p.amplitude2, p.amplitude3] : [1, 1, 1];
  const mn = p.limiterPoids ? [p.min1, p.min2, p.min3] : [0, 0, 0], mx = p.limiterPoids ? [p.max1, p.max2, p.max3] : [1, 1, 1];
  const u = (x, y, z, i) => 2 * ((((171 * x[i] % 30269) / 30269) + ((172 * y[i] % 30307) / 30307) + ((170 * z[i] % 30323) / 30323)) % 1 - 0.5);
  const erfInv = (r) => { const a = 0.5 * Math.log(1 - r * r), b = B + a; return Math.sqrt(Math.sqrt(b * b - a * 2 / A) - b); };
  const poids = (w, k) => Math.min(Math.max(Math.abs(w), mn[k]), mx[k]) * (w) / Math.abs(w);
  const difs = new Array(n);
  for (let i = 0; i <= n - 1; i++) {
    const e1 = erfInv(u(s1, s2, s3, i)), r2 = u(s4, s5, s6, i);
    const e2 = erfInv(u(s3, s1, s2, i)), r4 = u(s6, s4, s5, i), r5 = u(s2, s3, s1, i);
    const e3 = erfInv(u(s2, s1, s3, i)), r7 = u(s5, s4, s6, i), r8 = u(s1, s3, s5, i), r9 = u(s2, s4, s6, i);
    const f1 = sr2 * e1 * poids(r2, 0) * amp[0], f2 = sr2 * e2 * poids(r4 * r5, 1) * amp[1], f3 = sr2 * e3 * poids(r7 * r8 * r9, 2) * amp[2];
    difs[i] = f1 + f2 + f3;
  }
  return difs;
}

/** SMA sans boucle du script (une instance par appel). */
const smaVide = (n) => ({ n, x: new Array(n + 1).fill(null), sum: 0.0, v: null });
function smaPas(m, x) {
  m.x.unshift(x); m.x.pop();
  m.sum = nul(m.x[0]) ? null : (nul(m.sum) ? 0 : m.sum) + m.x[0];
  if (!nul(m.x[m.n])) { m.sum = (nul(m.sum) ? 0 : m.sum) - m.x[m.n]; m.v = m.sum / m.n; }
  return m.v;
}

function creer(p, debut) {
  const sims = p.simulations * 3;
  const parent = p.graine;
  const [c1, c2, c3] = graines(parent, sims), [c4, c5, c6] = graines(parent + 1, sims);
  const nsims = c1.length;
  const S = {};
  for (const k of ['src', 'reel', 'alea', 'rMax', 'aMax', 'hors', 'dans', 'base', 'dh', 'dl', 'sim']) S[k] = [];
  for (let k = 0; k < 12; k++) { S[`h${k}`] = []; S[`l${k}`] = []; }
  return {
    o: creerObjets({ maxPolylignes: 500 }), sorties: S, debut, f: Array.from({ length: 24 }, () => suiteVide()),
    difs: variations(p, [c1, c2, c3, c4, c5, c6]), nsims, sims: new Array(nsims).fill(0.0), indx: 0,
    hv: [], lv: [], mv: [], sv: [], dv: [], pv: [],
    simP: Math.trunc(Math.min(p.simulationPrix - 1, (sims / 3) - 1)), simD: Math.trunc(Math.min(p.simulationVariations - 1, (sims / 3) - 1)),
    smaXX: smaVide(p.barres), smaX: smaVide(p.barres), smaD: smaVide(p.barres), stdPrec: null, driftPrec: null,
    stDev: 0.0, drift: 0.0, startPrice: 0.0, fBasis: null, hb: new Array(12).fill(null), lb: new Array(12).fill(null),
    devH: null, devL: null, devM: null, randSeries: 0.0, randPrice: 0.0, bars: 0, fcond: 0, fcond1: 0, rMax: 0.0, aMax: 0.0,
    info1: '', info: '', dt: '', etiquette: null, parent,
  };
}

function bandes(e, base, sd) {
  e.fBasis = base;
  for (let k = 0; k < 12; k++) { e.hb[k] = base + sd * 0.25 * (k + 1); e.lb[k] = base - sd * 0.25 * (k + 1); }
}

function texteIssue(p, e, drift, moy, sd, mx, mn) {
  return e.dt + `Graine parente = ${ts(e.parent)}${SEP}` + `Simulations = ${ts(p.simulations)}` + `\nBarres prévues = ${ts(p.barres)}`
    + `\nDérive totale = ${ts(drift)}${SEP}` + `Issue moyenne = ${ts(moy)}` + `\nÉcart-type = ${ts(sd)}` + `\nIssue maximale = ${ts(mx)}` + `\nIssue minimale = ${ts(mn)}`;
}

function etape(p, e, d, i, derniere) {
  const S = e.sorties, b = d[i], src = b.close, nb = p.barres, fin = nb - 1;
  S.src[i] = src;
  // Sim_Vals : un pas par barre sur les `nbars` premieres barres.
  if (e.indx < nb) {
    let s = 0.0, s2 = 0.0;
    for (let k = 0; k <= e.nsims - 1; k++) { e.sims[k] = e.sims[k] + e.difs[k]; const t = e.sims[k]; s = s + t; s2 = s2 + t * t; }
    let mx = e.sims[0], mn = e.sims[0];
    for (const v of e.sims) { if (v > mx) mx = v; if (v < mn) mn = v; }
    e.mv[e.indx] = s / e.nsims; e.sv[e.indx] = Math.sqrt((s2 / e.nsims) - (s * s) / (e.nsims * e.nsims));
    e.hv[e.indx] = mx; e.lv[e.indx] = mn; e.dv[e.indx] = e.difs[e.simD]; e.pv[e.indx] = e.sims[e.simP];
    e.indx += 1;
  }
  // na -> NaN pour que l'arithmetique le propage comme Pine (null * x vaudrait 0 en JavaScript).
  const g = (t, k) => (nul(t[k]) ? NaN : t[k]);
  const N = (v) => (nul(v) ? NaN : v);
  const reel = i > 0 ? src - S.src[i - 1] : null;
  const xx = smaPas(e.smaXX, nul(reel) ? null : reel * reel), x1 = smaPas(e.smaX, reel);
  const sd1 = nul(xx) || nul(x1) ? null : Math.sqrt(xx - Math.pow(x1, 2));
  const dr = smaPas(e.smaD, reel), drift1 = nul(dr) ? null : dr * nb;
  const t = b.time * 1000, t1 = i > 0 ? d[i - 1].time * 1000 : null;
  if (!nul(e.debut) && t >= e.debut) {
    if (t1 !== null && t1 < e.debut) {
      e.stDev = N(e.stdPrec);
      if (p.derive) e.drift = N(e.driftPrec);
      e.startPrice = i > 0 ? S.src[i - 1] : NaN;
      const D = new Date(t);
      const an = D.getUTCFullYear(), mo = D.getUTCMonth() + 1, jo = D.getUTCDate();
      const date = p.formatDate === 'YYYY/MM/DD' ? `${an}/${deux(mo)}/${deux(jo)}` : p.formatDate === 'MM/DD/YYYY' ? `${deux(mo)}/${deux(jo)}/${an}` : `${deux(jo)}/${deux(mo)}/${an}`;
      const heure = `${deux(D.getUTCHours())}:${deux(D.getUTCMinutes())}:${deux(D.getUTCSeconds())}`;
      e.dt = `Simulation depuis le ${date}, ${heure} (UTC)\nPrix de départ = ${ts(e.startPrice)}\nType de prévision = ${p.type === 'End Result' ? 'issue finale' : 'en cours'}${SEP}`;
      if (p.type === 'End Result') {
        const sd = e.stDev, dft = e.drift;
        const mx = e.startPrice + g(e.hv, fin) * sd + dft, mn = e.startPrice + g(e.lv, fin) * sd + dft, moy = e.startPrice + g(e.mv, fin) * sd + dft;
        const msd = g(e.sv, fin) * sd;
        bandes(e, moy, msd);
        e.info1 = texteIssue(p, e, dft, moy, msd, mx, mn);
      }
    }
    if (e.bars === nb) e.fcond = 0;
    if (e.bars < nb) {
      const k = e.bars, sd = e.stDev;
      e.randSeries = g(e.dv, k) * sd + e.drift / nb;
      const dd = e.drift * k / nb;
      e.randPrice = e.startPrice + g(e.pv, k) * sd + dd;
      e.devH = e.startPrice + g(e.hv, k) * sd + dd; e.devL = e.startPrice + g(e.lv, k) * sd + dd; e.devM = e.startPrice + g(e.mv, k) * sd + dd;
      const dsd = g(e.sv, k) * sd;
      if (p.type === 'Developing') { bandes(e, e.devM, dsd); e.info1 = texteIssue(p, e, dd, e.devM, dsd, e.devH, e.devL); }
      e.fcond = 1;
      e.bars += 1;
      e.info = e.info1 + `${SEP}Barres de prévision restantes = ${ts(nb + 1 - e.bars)}${SEP}Prix actuel = ${ts(src)}`;
    }
    if (e.fcond === 0) e.info = e.info1 + `${SEP}Barres de prévision restantes = 0${SEP}Prix final = ${ts(i > 0 ? S.src[i - 1] : null)}`;
  }
  e.stdPrec = sd1; e.driftPrec = drift1;
  // cmax : maximum courant (part de 0) de la valeur absolue des variations, 0 avant le depart.
  const avant = nul(e.debut) || t < e.debut;
  const vr = avant ? 0 : Math.abs(reel), va = avant ? 0 : Math.abs(e.randSeries);
  if (!nul(vr) && vr > e.rMax) e.rMax = vr;
  if (!nul(va) && va > e.aMax) e.aMax = va;
  let rs = e.randSeries, rM = e.rMax, aM = e.aMax;
  if (e.fcond === 0) { e.randSeries = 0; rs = 0; rM = 0; aM = 0; }
  const prev = p.affichage === 'Forecast', comp = !prev, f = e.fcond === 1;
  S.reel[i] = comp ? reel : null; S.alea[i] = comp ? rs : null; S.rMax[i] = comp ? rM : null; S.aMax[i] = comp ? aM : null;
  S.hors[i] = prev && !f ? src : null; S.dans[i] = prev && f ? src : null;
  S.base[i] = prev && f ? e.fBasis : null;
  for (let k = 0; k < 12; k++) { S[`h${k}`][i] = prev && f ? e.hb[k] : null; S[`l${k}`][i] = prev && f ? e.lb[k] : null; }
  S.dh[i] = prev && f && p.extremes ? e.devH : null; S.dl[i] = prev && f && p.extremes ? e.devL : null;
  S.sim[i] = prev && f && p.montrerSimulation ? e.randPrice : null;
  // fill() entre niveaux voisins, transparence 60.
  const niveaux = [S.base, ...Array.from({ length: 12 }, (_, k) => S[`h${k}`])], bas = [S.base, ...Array.from({ length: 12 }, (_, k) => S[`l${k}`])];
  for (let k = 0; k < 12; k++) remplir(e.o, e.f[k], niveaux[k], niveaux[k + 1], i, transparence(FILLS[k], 60), derniere);
  for (let k = 0; k < 12; k++) remplir(e.o, e.f[12 + k], bas[k], bas[k + 1], i, transparence(FILLS[k], 60), derniere);
  // draw_info_panel(show and max(fcond, fcond[1]), start_time, prix, texte) : position et texte mis a jour quand il est montre.
  if (p.panneau && Math.max(e.fcond, e.fcond1) > 0) e.etiquette = { x: e.debut, y: prev ? e.startPrice : 0, texte: e.info };
  e.fcond1 = e.fcond;
}

const TAILLES = { Auto: 'auto', Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large', Huge: 'huge' };
const SORTIES = [
  ['reel', 'Variations réelles', '#2962FF', 1], ['alea', 'Variations aléatoires', ACT, 1],
  ['rMaxH', 'Variation réelle maximale (haut)', '#00ff8b', 1], ['rMaxB', 'Variation réelle maximale (bas)', '#00ff8b', 1],
  ['aMaxH', 'Variation aléatoire maximale (haut)', '#ffff00', 1], ['aMaxB', 'Variation aléatoire maximale (bas)', '#ffff00', 1],
  ['hors', 'Prix hors de la prévision', INACT, 1], ['dans', 'Prix pendant la prévision', ACT, 3], ['base', 'Valeur attendue', B_COL, 3],
  ...Array.from({ length: 12 }, (_, k) => [`h${k}`, `${String((k + 1) * 0.25).replace('.', ',')} σ (haut)`, FILLS[k], k % 4 === 3 ? 3 : 1]),
  ...Array.from({ length: 12 }, (_, k) => [`l${k}`, `${String((k + 1) * 0.25).replace('.', ',')} σ (bas)`, FILLS[k], k % 4 === 3 ? 3 : 1]),
  ['dh', 'Issue haute en cours', ACT2, 3], ['dl', 'Issue basse en cours', ACT2, 3], ['sim', 'Simulation montrée', ACT3, 2],
];

function rendre(p, e, d) {
  const S = e.sorties, n = d.length, o = e.o;
  const pt = (vals, c, j, signe = 1) => { const v = vals[j], sv = vals[j + 1]; return { time: d[j].time, value: nul(v) ? null : signe * v, color: nul(sv) ? TRANSPARENT : c }; };
  const serie = (id, vals, c, signe) => pointsStables(S, `_p${id}`, n, n - 2, (j) => pt(vals, c, j, signe));
  const out = {};
  for (const [id, , c] of SORTIES) {
    if (id === 'rMaxH') out[id] = serie(id, S.rMax, c, 1);
    else if (id === 'rMaxB') out[id] = serie(id, S.rMax, c, -1);
    else if (id === 'aMaxH') out[id] = serie(id, S.aMax, c, 1);
    else if (id === 'aMaxB') out[id] = serie(id, S.aMax, c, -1);
    else out[id] = serie(id, S[id], c, 1);
  }
  if (e.etiquette && !nul(e.etiquette.x) && !nul(e.etiquette.y)) {
    o.etiquette({ x: e.etiquette.x, xloc: 'bar_time', y: e.etiquette.y, texte: e.etiquette.texte, style: 'label_right', couleur: p.fondPanneau, couleurTexte: p.textePanneau,
      taille: TAILLES[p.tailleTexte], alignTexte: 'left' });
  }
  out.objets = o.resultat();
  return out;
}

export default class PrevisionMonteCarloIndicator {
  static metadata = {
    id: 'prevision_monte_carlo',
    name: 'Prévision de plage par Monte-Carlo',
    shortName: 'MC-PREV',
    description: 'prevision_monte_carlo',
    version: '1.0.0',
    overlay: false,
    type: 'volatility',
    category: 'Volatility',
    source: 'builtin',
    tags: ['monte carlo', 'prevision', 'ecart-type', 'simulation', 'plage'],
    inputs: INPUTS,
    outputs: SORTIES.map(([id, name, color, lineWidth]) => ({ id, name, type: 'line', color, lineWidth })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { dans: [] };
    const p = this.params;
    const v = Number(p.debut);
    // Heure de depart vide : `Barres` bougies avant la derniere.
    const debut = p.debut !== null && p.debut !== undefined && p.debut !== '' && Number.isFinite(v) ? v
      : data[Math.min(data.length - 1, Math.max(1, data.length - p.barres))].time * 1000;   // une seule bougie : la premiere
    return executer(PrevisionMonteCarloIndicator._memo, JSON.stringify([p, debut]), data, {
      creer: () => creer(p, debut),
      etape: (e, d, i, derniere) => etape(p, e, d, i, derniere),
      rendre: (e, d) => rendre(p, e, d),
    });
  }
}
