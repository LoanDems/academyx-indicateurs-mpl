// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « SuperTrend Take-Profit Dimensions [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/tb1TiNJe-SuperTrend-Take-Profit-Dimensions-AlgoAlpha/
// Adaptation : textes en francais ; les etiquettes des bascules (plotshape labelup / labeldown) deviennent des caracteres ▲ ▼
// poses sur le Supertrend ; barcolor() passe par la sortie cachee des bougies ; les deux tableaux d'avertissement ne sont
// crees que lorsqu'ils ont un texte (vides et transparents sinon dans le script). Pas intraday : timeframe.isintraday du
// contexte, sinon ecart des deux premieres bougies < 1 jour. Un indice de case na (centile de volume ou position dans la plage
// encore na) rend le score de l'axe na. Les profils et tableaux sont dessines a la derniere barre. Calcul barre par barre.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence, degrade, remplir, suiteVide, pointsStables, pointTrace, bit } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
  { label: 'Volume', value: 'volume' },
];
const POSITIONS = ['bottom center', 'bottom left', 'bottom right', 'middle center', 'middle left', 'middle right', 'top center', 'top left', 'top right'];
const NOMS_POS = { 'bottom center': 'En bas au centre', 'bottom left': 'En bas à gauche', 'bottom right': 'En bas à droite', 'middle center': 'Au milieu',
  'middle left': 'Au milieu à gauche', 'middle right': 'Au milieu à droite', 'top center': 'En haut au centre', 'top left': 'En haut à gauche', 'top right': 'En haut à droite' };
const SI = 'Signal', AX = 'Axes du contexte', AF = 'Affichage', S = 'Style';
const INPUTS = [
  { id: 'periodeAtr', name: 'Période de l’ATR', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: SI },
  { id: 'facteur', name: 'Facteur du Supertrend', type: 'number', default: 3.0, min: 0.1, max: 50, step: 0.1, group: SI },
  { id: 'pivot', name: 'Barres de part et d’autre du pivot', type: 'number', entier: true, default: 3, min: 2, max: 50, step: 1, group: SI,
    description: 'Les sommets (tendance haussière) et creux (baissière) confirmés alimentent les relevés de contexte, pris à la barre du pivot.' },
  { id: 'axeVolume', name: 'Centile du volume relatif', type: 'boolean', default: true, group: AX },
  { id: 'axeHeure', name: 'Heure de la journée', type: 'boolean', default: true, group: AX, description: 'Pas intraday seulement.' },
  { id: 'axePlage', name: 'Position dans la plage récente', type: 'boolean', default: true, group: AX },
  { id: 'axePerso', name: 'Signal personnalisé', type: 'boolean', default: false, group: AX,
    description: 'Ajouté seulement si la source reste entre 0 et 100 sur tout l’historique et sur la barre en cours.' },
  { id: 'sourcePerso', name: 'Source du signal personnalisé', type: 'select', default: 'close', options: SOURCES, group: AX },
  { id: 'cases', name: 'Cases des profils', type: 'number', entier: true, default: 5, min: 2, max: 100, step: 1, group: AF },
  { id: 'rangeesJauge', name: 'Rangées de la jauge', type: 'number', entier: true, default: 15, min: 3, max: 40, step: 1, group: AF },
  { id: 'signauxSortie', name: 'Signaux de sortie', type: 'boolean', default: true, group: AF },
  { id: 'colorerBougies', name: 'Colorer les bougies', type: 'boolean', default: true, group: AF },
  { id: 'profils', name: 'Profils du contexte', type: 'boolean', default: true, group: AF },
  { id: 'supertrend', name: 'Supertrend et remplissage', type: 'boolean', default: true, group: AF },
  { id: 'jauge', name: 'Jauge de sortie', type: 'boolean', default: true, group: AF },
  { id: 'tableau', name: 'Tableau du détail', type: 'boolean', default: true, group: AF },
  { id: 'positionTableau', name: 'Position du tableau', type: 'select', default: 'top right', options: POSITIONS.map((v) => ({ label: NOMS_POS[v], value: v })), group: AF },
  { id: 'tailleTableau', name: 'Taille du texte du tableau', type: 'select', default: 'Small', group: AF,
    options: [{ label: 'Très petite', value: 'Tiny' }, { label: 'Petite', value: 'Small' }, { label: 'Moyenne', value: 'Medium' }, { label: 'Grande', value: 'Large' }] },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const ORANGE = '#FF9800', GRIS = 'rgb(130, 130, 130)', MAX_HIST = 2000, DECALAGE = 70, ESPACE = 12;
const TITRES = ['Centile du volume relatif', 'Heure de la journée', 'Position dans la plage récente', 'Signal personnalisé'];
const TAILLES = { Tiny: 'tiny', Small: 'small', Medium: 'normal', Large: 'large' };
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low, volume: (b) => b.volume,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const borne = (k, B) => (nul(k) ? null : Math.max(0, Math.min(B - 1, k)));
const caseDe = (v, bw, B) => (nul(v) ? null : borne(Math.floor(v / bw), B));

function creer(p) {
  const S = { dir: [], st: [], rv: [], tod: [], rp: [], cu: [], score: [], mid: [], up: [], dn: [], bc: [], rg: [], dyn: [], m: [], tpRaw: [] };
  return {
    o: creerObjets({ maxBoites: 500, maxLignes: 500, maxEtiquettes: 500, maxPolylignes: 500 }), sorties: S, f1: suiteVide(), f2: suiteVide(),
    atr: A.ema(p.periodeAtr, { rma: true }), sma: A.sma(S, 50), x80h: A.croisement(1), x50b: A.croisement(-1), x80b: A.croisement(-1), x50h: A.croisement(1),
    bas: null, haut: null, prec: null, cmax: null, cmin: null,
    // Piles du script (valeurs) et, pour chaque valeur, sa case (calculee une fois, na = null).
    bull: [[], [], [], [], [], [], [], []], bear: [[], [], [], [], [], [], [], []], agg: null, bins: null, scores: null,
  };
}

/** scoreAggregate : 100 x cases[case courante] / case la plus haute (na si vide ou case na). */
function score(agg, cur, B) {
  if (agg.length === 0 || nul(cur)) return null;
  const bw = 100.0 / B, bc = new Array(B).fill(0);
  for (const v of agg) { const k = Math.max(0, Math.min(B - 1, Math.floor(v / bw))); bc[k] = bc[k] + 1; }
  let pic = bc[0];
  for (const c of bc) if (c > pic) pic = c;
  return pic > 0 ? 100.0 * bc[cur] / pic : null;
}

function etape(p, e, d, i, derniere, env) {
  const S = e.sorties, o = e.o, b = d[i], B = p.cases, zz = p.pivot;
  // ta.supertrend(facteur, periode) : bandes hl2 +/- facteur x ATR, comme academyscript/ta.js.
  const pc = i > 0 ? d[i - 1].close : null;
  const tr = pc === null ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  const atr = A.pas(S, e.atr, i, tr);
  let dir = null, st = null;
  if (!nul(atr)) {
    const mil = (b.high + b.low) / 2;
    let lo = mil - p.facteur * atr, up = mil + p.facteur * atr;
    if (e.bas !== null && !(lo > e.bas || (pc !== null && pc < e.bas))) lo = e.bas;
    if (e.haut !== null && !(up < e.haut || (pc !== null && pc > e.haut))) up = e.haut;
    if (e.prec === null) dir = 1; else if (e.prec === e.haut) dir = b.close > up ? -1 : 1; else dir = b.close < lo ? 1 : -1;
    st = dir === -1 ? lo : up;
    e.bas = lo; e.haut = up; e.prec = st;
  }
  S.dir[i] = dir; S.st[i] = st;
  // Axes : centile du volume (ta.percentrank 50), heure, position dans la plage de 20 barres, signal personnalise.
  let rv = null;
  if (i >= 50) { let n = 0; for (let k = 1; k <= 50; k++) if (d[i - k].volume <= b.volume) n++; rv = (100 * n) / 50; }
  const valide = env.intraday;
  const tod = valide ? (((b.time * 1000) % 86400000) / 800000.0) * (100.0 / 108.0) : null;
  let rp = null;
  if (i >= 19) {
    let hh = -Infinity, ll = Infinity;
    for (let k = 0; k < 20; k++) { const x = d[i - k]; if (x.high > hh) hh = x.high; if (x.low < ll) ll = x.low; }
    rp = (b.close - ll) / Math.max(hh - ll, env.mintick) * 100.0;
  }
  const cu = choix[p.sourcePerso](b);
  if (p.axePerso) { e.cmax = e.cmax === null || cu > e.cmax ? cu : e.cmax; e.cmin = e.cmin === null || cu < e.cmin ? cu : e.cmin; }
  S.rv[i] = rv; S.tod[i] = tod; S.rp[i] = rp; S.cu[i] = cu;
  const persoHist = p.axePerso && e.cmax !== null && e.cmin !== null && e.cmax <= 100.0 && e.cmin >= 0.0;
  const persoActif = persoHist && !nul(cu) && cu >= 0.0 && cu <= 100.0;
  // Pivots (regles d'egalite de TradingView) : releves pris a la barre du pivot.
  const c = i - zz;
  let ph = false, pl = false;
  if (c - zz >= 0) {
    ph = true; pl = true;
    const vh = d[c].high, vl = d[c].low;
    for (let j = 1; j <= zz; j++) { if (d[c - j].high > vh) ph = false; if (d[c - j].low < vl) pl = false; }
    for (let j = 1; j <= zz; j++) { if (d[c + j].high >= vh) ph = false; if (d[c + j].low <= vl) pl = false; }
  }
  const dz = c >= 0 ? S.dir[c] : null;
  const bw = 100.0 / B;
  const releve = (pool) => {
    const c4 = S.cu[c];
    const v = [p.axeVolume ? S.rv[c] : null, p.axeHeure && valide ? S.tod[c] : null, p.axePlage ? S.rp[c] : null,
      p.axePerso && persoHist && !nul(c4) && c4 >= 0.0 && c4 <= 100.0 ? c4 : null];
    for (let a = 0; a < 4; a++) { pool[a].unshift(v[a]); pool[4 + a].unshift(nul(v[a]) ? null : Math.max(0, Math.min(B - 1, Math.floor(v[a] / bw)))); }
  };
  if (ph && !nul(dz) && dz < 0) releve(e.bull);
  if (pl && !nul(dz) && dz > 0) releve(e.bear);
  for (const pool of [e.bull, e.bear]) for (const t of pool) while (t.length > MAX_HIST) t.pop();
  // Distributions conditionnelles et score.
  const cases = [caseDe(rv, bw, B), valide && !nul(tod) ? caseDe(tod, bw, B) : 0, caseDe(rp, bw, B), persoActif ? caseDe(cu, bw, B) : 0];
  const actifs = [p.axeVolume, p.axeHeure && valide, p.axePlage, persoActif];
  const pool = !nul(dir) && dir < 0 ? e.bull : !nul(dir) && dir > 0 ? e.bear : null;
  const hN = pool ? pool[0].length : 0;
  const agg = [[], [], [], []];
  for (let a = 0; a < 4; a++) {
    if (!actifs[a] || hN === 0) continue;
    // Autres axes actifs : la case de la valeur relevee doit etre celle de la barre (valeur na ou case na : rejet).
    const autres = [];
    for (let q = 0; q < 4; q++) if (q !== a && actifs[q]) { if (nul(cases[q])) { autres.length = 0; autres.push(-1); break; } autres.push(q); }
    if (autres[0] === -1) continue;
    const V = pool[a], C0 = autres.length > 0 ? pool[4 + autres[0]] : null, C1 = autres.length > 1 ? pool[4 + autres[1]] : null, C2 = autres.length > 2 ? pool[4 + autres[2]] : null;
    const k0 = C0 ? cases[autres[0]] : 0, k1 = C1 ? cases[autres[1]] : 0, k2 = C2 ? cases[autres[2]] : 0;
    for (let k = 0; k < hN; k++) {
      const v = V[k];
      if (v === null) continue;
      if (C0 && C0[k] !== k0) continue;
      if (C1 && C1[k] !== k1) continue;
      if (C2 && C2[k] !== k2) continue;
      agg[a].push(v);
    }
  }
  const sc = [null, null, null, null];
  let cs = null;
  if (hN > 0) {
    let somme = 0.0, n = 0;
    for (let a = 0; a < 4; a++) {
      if (!actifs[a]) continue;
      sc[a] = score(agg[a], cases[a], B);
      if (!nul(sc[a])) { somme += sc[a] / 100.0; n += 1; }
    }
    if (n > 0) cs = 100.0 * somme / n;
  }
  S.score[i] = cs;
  const verts = p.couleurHausse, rouges = p.couleurBaisse;
  const opp = !nul(dir) && dir < 0 ? rouges : !nul(dir) && dir > 0 ? verts : GRIS;
  const sb = Math.min(100.0, Math.max(0.0, nul(cs) ? 0.0 : cs));
  S.bc[i] = p.colorerBougies ? degrade(sb, 50, 100, GRIS, opp) : null;
  const d1 = i > 0 ? S.dir[i - 1] : null;
  const flipH = !nul(dir) && !nul(d1) && d1 > 0 && dir < 0, flipB = !nul(dir) && !nul(d1) && d1 < 0 && dir > 0;
  if (p.supertrend && flipH) o.plotchar(i, { position: 'absolute', y: st, caractere: '▲', couleur: verts, taille: 'small' });
  if (p.supertrend && flipB) o.plotchar(i, { position: 'absolute', y: st, caractere: '▼', couleur: rouges, taille: 'small' });
  const tpRaw = !nul(cs) && cs >= 99.999 && !nul(dir);
  if (p.signauxSortie && tpRaw && dir < 0) o.plotchar(i, { position: 'abovebar', caractere: '🔸', couleur: ORANGE, taille: 'tiny' });
  if (p.signauxSortie && tpRaw && dir > 0) o.plotchar(i, { position: 'belowbar', caractere: '🔸', couleur: ORANGE, taille: 'tiny' });
  // Plage dynamique des profils : sma(highest(highest(100) - lowest(100), 50) x 2, 50).
  let rg = null;
  if (i >= 99) { let hh = -Infinity, ll = Infinity; for (let k = 0; k < 100; k++) { const x = d[i - k]; if (x.high > hh) hh = x.high; if (x.low < ll) ll = x.low; } rg = hh - ll; }
  S.rg[i] = rg;
  let raw = null;
  if (i >= 49) { let h = null; for (let k = 0; k < 50; k++) { const v = S.rg[i - k]; if (nul(v)) break; if (h === null || v > h) h = v; } raw = h === null ? null : h * 2; }
  S.dyn[i] = A.pas(S, e.sma, i, raw);
  // Supertrend trace et remplissages.
  S.mid[i] = i === 0 ? null : (b.open + b.close) / 2.0;
  S.up[i] = p.supertrend && !nul(dir) && dir < 0 ? st : null;
  S.dn[i] = p.supertrend && !nul(dir) && dir > 0 ? st : null;
  remplir(o, e.f1, S.mid, S.up, i, transparence(verts, 90), derniere);
  remplir(o, e.f2, S.mid, S.dn, i, transparence(rouges, 90), derniere);
  // Alertes.
  const prevTp = i > 0 ? S.tpRaw[i - 1] : false;
  S.tpRaw[i] = tpRaw;
  const x80h = A.pas(S, e.x80h, i, cs, 80.0), x50b = A.pas(S, e.x50b, i, cs, 50.0), x80b = A.pas(S, e.x80b, i, cs, 80.0), x50h = A.pas(S, e.x50h, i, cs, 50.0);
  const conds = [tpRaw && !prevTp, flipH, flipB, x80h, x80b || (x50h && cs <= 80.0), x50b];
  let m = 0;
  for (let k = 0; k < conds.length; k++) if (conds[k]) m |= 1 << k;
  S.m[i] = m;
  if (derniere) { e.agg = agg; e.cases = cases; e.scores = sc; e.cs = cs; e.dir = dir; e.actifs = actifs; e.persoActif = persoActif; e.valide = valide; }
}

function profil(o, agg, titre, B, cur, base, marque, rang, hauteur, haut, x0, env) {
  if (agg.length === 0) return;
  const bc = new Array(B).fill(0), bw = 100.0 / B;
  for (const v of agg) { const k = Math.max(0, Math.min(B - 1, Math.floor(v / bw))); bc[k] = bc[k] + 1; }
  let mx = bc[0];
  for (const c of bc) if (c > mx) mx = c;
  if (!(mx > 0)) return;
  const utile = hauteur * 0.7, sommet = haut - hauteur * rang, bas = sommet - hauteur;
  for (let k = 0; k <= B - 1; k++) {
    const cnt = bc[k], h = (cnt * 1.0 / mx) * utile, nh = cnt * 1.0 / mx, tr = 50 + Math.round(40 * (1 - nh));
    const xl = x0 + k * ESPACE;
    o.boite({ gauche: xl, haut: bas + h, droite: xl + ESPACE - 1, bas, fond: transparence(base, tr), couleurBordure: transparence('#ffffff', 70), epaisseurBordure: 1, styleBordure: 'solid' });
  }
  const yh = bas + utile, xd = x0 + B * ESPACE - 1;
  o.ligne({ x1: x0, y1: bas, x2: x0, y2: yh, couleur: env.texte, style: 'solid', epaisseur: 4 });
  o.ligne({ x1: x0, y1: bas, x2: xd, y2: bas, couleur: env.texte, style: 'solid', epaisseur: 4 });
  const xc = x0 + cur * ESPACE + Math.round(ESPACE / 2);
  o.ligne({ x1: xc, y1: bas, x2: xc, y2: bas + hauteur * 0.8, couleur: transparence(marque, 0), style: 'dashed', epaisseur: 3 });
  const midX = x0 + (B * ESPACE - 1) / 2.0, transp = transparence(env.fond, 100);
  o.etiquette({ x: Math.round(midX), y: bas - hauteur * 0.2, texte: titre, style: 'label_down', couleur: transp, couleurTexte: env.texte, taille: 'normal' });
  const xr = Math.round(xd - (xd - x0) * 0.18);
  o.etiquette({ x: x0, y: yh - utile * 0.18, texte: '▲', style: 'label_down', couleur: transp, couleurTexte: env.texte, taille: 'large' });
  o.etiquette({ x: xr, y: bas, texte: '▶', style: 'label_left', couleur: transp, couleurTexte: env.texte, taille: 'large' });
  o.etiquette({ x: Math.round(x0 - ESPACE * 0.35), y: bas + utile / 2.0, texte: 'Nombre', style: 'label_right', couleur: transp, couleurTexte: env.texte, taille: 'normal' });
}

const texteScore = (s) => (nul(s) ? '— / 100' : formaterMotif(s, '#.#') + ' / 100');
const alphaCase = (v, vmax) => (vmax <= 0 ? 85 : Math.max(50, Math.round(85 - Math.min(1.0, v / vmax) * 70)));

function rendre(p, e, d, env) {
  const S = e.sorties, o = e.o, n = d.length, last = n - 1, B = p.cases;
  const verts = p.couleurHausse, rouges = p.couleurBaisse, dir = e.dir;
  if (p.profils && e.agg) {
    const base = !nul(dir) && dir > 0 ? rouges : verts, marque = !nul(dir) && dir > 0 ? verts : rouges;
    const dyn = S.dyn[last], h = nul(dyn) ? null : dyn / 4.0, haut = nul(dyn) ? null : d[last].close + dyn / 2.0;
    if (!nul(h)) for (let a = 0; a < 4; a++) profil(o, e.agg[a], TITRES[a], B, e.cases[a], base, marque, a, h, haut, last + DECALAGE, env);
  }
  if (e.agg) {
    if (p.axePerso && !e.persoActif) {
      const t = o.tableau({ position: 'bottom_center', colonnes: 1, lignes: 1, fond: null, couleurCadre: null, epaisseurCadre: 1, couleurBordure: null, epaisseurBordure: 0 });
      t.cellule(0, 0, { texte: 'Avertissement : le signal personnalisé doit rester entre 0 et 100 sur tout l’historique chargé et sur cette barre.\nSinon il n’entre ni dans les calculs ni dans l’affichage.', couleurTexte: '#FFFFFF', fond: '#F23645', alignH: 'center', taille: 'small' });
    }
    if (p.axeHeure && !e.valide) {
      const t = o.tableau({ position: 'bottom_left', colonnes: 1, lignes: 1, fond: null, couleurCadre: null, epaisseurCadre: 1, couleurBordure: null, epaisseurBordure: 0 });
      t.cellule(0, 0, { texte: 'Note : l’axe de l’heure est désactivé sur les pas d’un jour et plus (l’heure n’y a pas de sens). Le score combine les autres axes.', couleurTexte: '#FFFFFF', fond: ORANGE, alignH: 'center', taille: 'small' });
    }
    const sc = e.scores, cs = e.cs, act = e.actifs;
    if (p.tableau) {
      const lignes = 1 + act.filter(Boolean).length + 1, tz = TAILLES[p.tailleTableau];
      const t = o.tableau({ position: p.positionTableau.replace(' ', '_'), colonnes: 2, lignes, fond: env.fond, couleurBordure: env.texte, epaisseurBordure: 1, couleurCadre: env.texte, epaisseurCadre: 1 });
      const cel = (c, l, texte, fond) => t.cellule(c, l, { texte, couleurTexte: env.texte, alignH: 'center', taille: tz, ...(fond !== undefined ? { fond } : {}) });
      cel(0, 0, 'Mesure'); cel(1, 0, 'Accord avec le pic (0-100)');
      let r = 1;
      const noms = ['Centile du volume relatif', 'Heure de la journée', 'Position dans la plage récente', 'Signal personnalisé'];
      for (let a = 0; a < 4; a++) {
        if (!act[a]) continue;
        cel(0, r, noms[a]); cel(1, r, texteScore(sc[a]), nul(sc[a]) ? env.fond : transparence(verts, alphaCase(sc[a], 100.0)));
        r += 1;
      }
      const etat = nul(cs) ? '—' : cs > 80.0 ? 'Favorables (>80)' : cs > 50.0 ? 'Neutres (>50)' : 'Défavorables (<50)';
      const fond = nul(cs) ? env.fond : cs > 80.0 ? transparence(verts, 55) : cs > 50.0 ? transparence(env.texte, 88) : transparence(rouges, 55);
      cel(0, r, 'Conditions de sortie'); cel(1, r, etat, fond);
    }
    if (p.jauge) {
      const tc = p.rangeesJauge;
      const t = o.tableau({ position: 'bottom_right', colonnes: 3, lignes: tc + 1, couleurCadre: transparence(env.texte, 50), epaisseurCadre: 0, epaisseurBordure: 1, fond: transparence(env.fond, 85) });
      for (let k = 1; k <= tc; k++) { const g = degrade(k, 1, tc, verts, rouges); t.cellule(1, k, { texte: '', fond: g, couleurTexte: g }); }
      const pct = Math.min(100.0, Math.max(0.0, nul(cs) ? 0.0 : cs));
      const mr = Math.max(1, Math.min(tc, Math.round(tc - pct * (tc - 1) / 100.0)));
      t.cellule(1, mr, { texte: '>', fond: transparence('#ffffff', 100), couleurTexte: env.texte, taille: 'normal' });
      t.cellule(0, 0, { texte: 'Sortie favorable', couleurTexte: env.texte, fond: transparence(env.fond, 80) });
      t.cellule(1, 0, { texte: nul(cs) ? '—' : formaterMotif(cs, '#.#'), couleurTexte: env.texte, fond: transparence(env.fond, 80) });
    }
  }
  const verte = S._v || (S._v = []), rouge = S._r || (S._r = []);
  for (let j = Math.max(0, verte.length - 2); j < n; j++) { verte[j] = verts; rouge[j] = rouges; }
  return {
    hausse: pointsStables(S, '_ph', n, n - 2, (j) => pointTrace(d, S.up, verte, j)),
    baisse: pointsStables(S, '_pb', n, n - 2, (j) => pointTrace(d, S.dn, rouge, j)),
    bougies: pointsStables(S, '_c', n, n - 1, (j) => ({ time: d[j].time, value: S.bc[j] ? 1 : null, color: S.bc[j] })),
    signaux: pointsStables(S, '_s', n, n - 1, (j) => ({ time: d[j].time, value: S.m[j] ? S.m[j] : null })),
    objets: o.resultat(),
  };
}

const ALERTES = [
  ['supertrend_sorties_pic', 'Contexte de sortie : accord complet avec le pic (score 100)'],
  ['supertrend_sorties_hausse', 'Supertrend : passage haussier'],
  ['supertrend_sorties_baisse', 'Supertrend : passage baissier'],
  ['supertrend_sorties_favorable', 'Contexte de sortie : favorable (>80)'],
  ['supertrend_sorties_neutre', 'Contexte de sortie : neutre (50-80]'],
  ['supertrend_sorties_defavorable', 'Contexte de sortie : défavorable (≤50)'],
];

export default class SupertrendContexteSortiesIndicator {
  static metadata = {
    id: 'supertrend_contexte_sorties',
    name: 'Supertrend et contexte des sorties',
    shortName: 'ST-CTX',
    description: 'supertrend_contexte_sorties',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['supertrend', 'sortie', 'contexte', 'profil', 'volume relatif'],
    inputs: INPUTS,
    outputs: [
      { id: 'hausse', name: 'Supertrend haussier', type: 'line', color: '#00ffbb', lineWidth: 2, reglageCouleur: 'couleurHausse' },
      { id: 'baisse', name: 'Supertrend baissier', type: 'line', color: '#ff1100', lineWidth: 2, reglageCouleur: 'couleurBaisse' },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#828282', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { hausse: [] };
    const p = this.params;
    const c = contexte(data, ctx);
    const tf = ctx && ctx.timeframe;
    const intraday = tf && typeof tf.isintraday === 'boolean' ? tf.isintraday : (data.length > 1 ? data[1].time - data[0].time < 86400 : true);
    const env = { ...c, intraday };
    return executer(SupertrendContexteSortiesIndicator._memo, JSON.stringify([p, env.texte, env.fond, env.mintick, intraday]), data, {
      creer: () => creer(p),
      etape: (e, d, i, derniere) => etape(p, e, d, i, derniere, env),
      rendre: (e, d) => rendre(p, e, d, env),
    });
  }
}
