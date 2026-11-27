// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « WaveTrend 3D » © jdehorty — https://www.tradingview.com/script/clUzC70G-WaveTrend-3D/
// (bibliotheque KernelFunctions version 2 du meme auteur, fonction gaussian).
// Adaptation : les remplissages entre chaque oscillateur et sa ligne de base sont des colonnes depuis 0 (meme couleur
// par barre) tant que l'ecart des oscillateurs est nul ; avec un ecart, ils restent des remplissages (500 derniers
// segments) ; l'epaisseur de la vitesse mise en avant (« Width ») n'est pas reprise ; les cercles des croisements et des
// divergences (plot.style_circles) sont des points ● poses sur le panneau (petits : croisement, plus grands : divergence).
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, transparence, degrade, remplir, suiteVide, bit, pointsStables, pointTrace } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const VITESSES = [{ label: 'Lente', value: 'Slow' }, { label: 'Normale', value: 'Normal' }, { label: 'Rapide', value: 'Fast' }, { label: 'Aucune', value: 'None' }];
const SI = 'Signal', OS = 'Oscillateurs', DV = 'Divergences', ZO = 'Zones de surachat et de survente', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: SI },
  { id: 'lisserEma', name: 'Lisser par une moyenne exponentielle', type: 'boolean', default: false, group: SI },
  { id: 'longueurEma', name: 'Longueur de la moyenne', type: 'number', entier: true, default: 3, min: 1, max: 200, step: 1, group: SI, legende: false },
  { id: 'centreGravite', name: 'Centre de gravité', type: 'boolean', default: false, group: SI,
    description: 'Remplace le signal par son centre de gravité.' },
  { id: 'longueurCentre', name: 'Longueur du centre de gravité', type: 'number', entier: true, default: 6, min: 1, max: 200, step: 1, group: SI, legende: false },
  { id: 'recul', name: 'Recul', type: 'number', entier: true, default: 20, min: 2, max: 500, step: 1, group: SI,
    description: 'Barres de lissage, multipliées par le facteur de chaque vitesse.' },
  { id: 'moyenneQuadratique', name: 'Moyenne quadratique', type: 'number', entier: true, default: 50, min: 2, max: 500, step: 1, group: SI,
    description: 'Racine de la moyenne des carrés de la variation sur 2 barres, qui la normalise.' },
  { id: 'vitesse', name: 'Vitesse mise en avant', type: 'select', default: 'Slow', options: VITESSES, group: SI },
  { id: 'noyauTendance', name: 'Moyenne à noyau (tendance)', type: 'boolean', default: false, group: SI },
  { id: 'noyauSignal', name: 'Signal à noyau', type: 'boolean', default: false, group: SI },
  { id: 'ecart', name: 'Écart entre les oscillateurs', type: 'number', entier: true, default: 0, min: -50, max: 50, step: 1, group: OS,
    description: 'Décale l’oscillateur rapide vers le haut et le lent vers le bas.' },
  { id: 'facteurRapide', name: 'Longueur rapide (facteur)', type: 'number', default: 0.75, min: 0.05, max: 10, step: 0.05, group: OS },
  { id: 'lissageRapide', name: 'Lissage rapide (facteur)', type: 'number', default: 0.45, min: 0.05, max: 10, step: 0.05, group: OS },
  { id: 'facteurNormal', name: 'Longueur normale (facteur)', type: 'number', default: 1, min: 0.05, max: 10, step: 0.05, group: OS },
  { id: 'lissageNormal', name: 'Lissage normal (facteur)', type: 'number', default: 1, min: 0.05, max: 10, step: 0.05, group: OS },
  { id: 'facteurLent', name: 'Longueur lente (facteur)', type: 'number', default: 1.75, min: 0.05, max: 10, step: 0.05, group: OS },
  { id: 'lissageLent', name: 'Lissage lent (facteur)', type: 'number', default: 2.5, min: 0.05, max: 10, step: 0.05, group: OS },
  { id: 'distanceDivergence', name: 'Distance de divergence (barres)', type: 'number', entier: true, default: 30, min: 1, max: 500, step: 1, group: DV },
  { id: 'taillePourcent', name: 'Taille relative de la vague (%)', type: 'number', entier: true, default: 40, min: 1, max: 500, step: 1, group: DV,
    description: 'Une vague plus petite que ce pourcentage de la précédente, juste après elle, annonce une divergence possible.' },
  { id: 'zones', name: 'Zones de surachat et de survente', type: 'boolean', default: false, group: ZO },
  { id: 'inverserZones', name: 'Inverser les couleurs des zones', type: 'boolean', default: false, group: ZO },
  { id: 'surachat1', name: 'Surachat principal', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, group: ZO },
  { id: 'surachat2', name: 'Surachat secondaire', type: 'number', default: 0.75, min: 0, max: 1, step: 0.05, group: ZO },
  { id: 'survente1', name: 'Survente principale', type: 'number', default: -0.5, min: -1, max: 0, step: 0.05, group: ZO },
  { id: 'survente2', name: 'Survente secondaire', type: 'number', default: -0.75, min: -1, max: 0, step: 0.05, group: ZO },
  { id: 'miroir', name: 'Miroir', type: 'boolean', default: false, group: S,
    description: 'Dessine aussi chaque oscillateur retourné autour de sa ligne de base.' },
  { id: 'oscillateurs', name: 'Afficher les trois oscillateurs', type: 'boolean', default: true, group: S },
  { id: 'transpFondAire', name: 'Transparence des aires d’arrière-plan (facteur)', type: 'number', default: 128, min: 0, max: 1000, step: 1, group: S },
  { id: 'transpAvantAire', name: 'Transparence de l’aire mise en avant (facteur)', type: 'number', default: 64, min: 0, max: 1000, step: 1, group: S },
  { id: 'transpFondLigne', name: 'Transparence des lignes d’arrière-plan (facteur)', type: 'number', default: 2.6, min: 0, max: 100, step: 0.1, group: S },
  { id: 'transpAvantLigne', name: 'Transparence de la ligne mise en avant (facteur)', type: 'number', default: 2, min: 0, max: 100, step: 0.1, group: S },
  { id: 'transpPerso', name: 'Transparence (multiplicateur)', type: 'number', entier: true, default: 30, min: 0, max: 100, step: 5, group: S },
  { id: 'etapesDegrade', name: 'Étapes du dégradé', type: 'number', entier: true, default: 8, min: 2, max: 256, step: 1, group: S },
  { id: 'rapideHausse', name: 'Rapide haussier', type: 'color', default: 'rgba(0, 153, 136, 0.7)', group: S },
  { id: 'normalHausse', name: 'Normal haussier', type: 'color', default: 'rgba(0, 153, 136, 0.4)', group: S },
  { id: 'lentHausse', name: 'Lent haussier', type: 'color', default: 'rgba(0, 153, 136, 0.3)', group: S },
  { id: 'rapideBaisse', name: 'Rapide baissier', type: 'color', default: 'rgba(204, 51, 17, 0.7)', group: S },
  { id: 'normalBaisse', name: 'Normal baissier', type: 'color', default: 'rgba(204, 51, 17, 0.4)', group: S },
  { id: 'lentBaisse', name: 'Lent baissier', type: 'color', default: 'rgba(204, 51, 17, 0.3)', group: S },
  { id: 'divergenceHausse', name: 'Signaux haussiers', type: 'color', default: '#009988', group: S },
  { id: 'divergenceBaisse', name: 'Signaux baissiers', type: 'color', default: '#CC3311', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const fini = (v) => typeof v === 'number' && Number.isFinite(v);
const nz = (v) => (fini(v) ? v : 0);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

const VITESSES_DEF = [['Fast', 'rapide'], ['Normal', 'normale'], ['Slow', 'lente']];
// [PERF 2026-11-26] Noms des series par vitesse, construits une fois (etape() en composait
// une trentaine par barre, chaque chaine neuve rehachee a chaque acces).
const CLES = Object.fromEntries(VITESSES_DEF.map(([k]) => [k, Object.fromEntries(['ser', 'mir', 'cl', 'ca', 'cs', 'cas', 'casi', 'coulSerie'].map((c) => [c, `${c}${k}`]))]));

/** Constantes des reglages : transparences multipliees, filtre et bornes de chaque vitesse. */
function preparer(p) {
  const m = p.transpPerso, v = p.vitesse;
  const lF = p.transpFondLigne * m, aF = p.transpFondAire * m, lA = p.transpAvantLigne * m, aA = p.transpAvantAire * m;
  const T = { Fast: v === 'Fast' ? [aA, lA] : [aF, lF], Normal: v === 'Normal' ? [aA, lA] : [aF, lF], Slow: v === 'Slow' ? [aA, lA] : [aF, lF] };
  const off = p.ecart;
  const def = {
    Fast: [p.facteurRapide, p.lissageRapide, off, 1, p.rapideHausse, p.rapideBaisse],
    Normal: [p.facteurNormal, p.lissageNormal, 0, 1, p.normalHausse, p.normalBaisse],
    Slow: [p.facteurLent, p.lissageLent, -off, 1.75, p.lentHausse, p.lentBaisse],
  };
  const K = {};
  for (const [k] of VITESSES_DEF) {
    const [longueur, lissage, decal, amp, haus, bais] = def[k], [aT, lT] = T[k];
    const recul = lissage * p.recul, omega = -99 * Math.PI / (70 * recul), alpha = Math.exp(omega), beta = -Math.pow(alpha, 2), gamma = Math.cos(omega) * 2 * alpha;
    const mn = -amp + decal, mx = amp + decal;
    const pas = Math.max(1, p.etapesDegrade), hL = transparence(haus, lT), bL = transparence(bais, lT), hA = transparence(haus, aT), bA = transparence(bais, aT);
    // Degrades par etapes : le compteur ne prend que les valeurs 0 .. pas, tables par sens (haussier = 1, baissier = 0).
    const table = (faible, fort) => Array.from({ length: pas + 1 }, (_, q) => degrade(q, 1, pas, faible, fort));
    K[k] = {
      longueur, decal, haus, bais, aT, lT, beta, gamma, delta: 1 - gamma - beta, mn, mx, base: mn + (mx - mn) / 2, montrer: p.oscillateurs || v === k,
      hL, bL, hA, bA, cs: [table(bL, bais), table(hL, haus)], cas: [table(bA, bais), table(hA, haus)],
    };
  }
  return { K, pas: Math.max(1, p.etapesDegrade) };
}

function creer(p) {
  const S = { src: [], cog: [], der: [], th: [], serE: [], baisse: [], hausse: [], fortB: [], fortH: [], k0: [], k1: [], coulE: [], al: [], cOff: [], cMoins: [], ob1: [], ob2: [], os1: [], os2: [] };
  const V = {};
  for (const [k] of VITESSES_DEF) {
    for (const c of ['ser', 'mir', 'cl', 'ca', 'cs', 'cas', 'casi', 'coulSerie']) S[`${c}${k}`] = [];
    V[k] = { f1: null, f2: null, q: 0, xu: A.croisement(1), xd: A.croisement(-1), x0b: A.croisement(-1), x0h: A.croisement(1) };
  }
  return {
    o: creerObjets({ maxPolylignes: 500 }), sorties: S, V, somme: 0, depuis: 0, ema: A.ema(p.longueurEma),
    xb: A.croisement(-1), xh: A.croisement(1), valB: [], valH: [], depB: null, depH: null,
    f: { k0: suiteVide(), k1: suiteVide(), ob: suiteVide(), os: suiteVide(), sl: suiteVide(), slm: suiteVide(), fa: suiteVide(), fam: suiteVide() },
  };
}

/** KernelFunctions v2 : gaussian(src, lookback, startAtBar) a la barre b, i = 0 .. 1 + startAtBar ; na si un na dans la fenetre. */
function gaussien(v, b, look, depart) {
  let cour = 0, cumul = 0;
  for (let i = 0; i <= 1 + depart; i++) {
    const y = b - i >= 0 ? v[b - i] : null;
    if (!fini(y)) return null;
    const w = Math.exp(-Math.pow(i, 2) / (2 * Math.pow(look, 2)));
    cour += y * w; cumul += w;
  }
  return cour / cumul;
}

/** Une couleur entierement transparente ne dessine rien : pas de polygone. */
const visible = (c) => (typeof c === 'string' && /,\s*0\)$/.test(c) ? null : c);

function etape(p, e, d, i, derniere, C) {
  const S = e.sorties, o = e.o, b = d[i];
  // source (ta.ema, ta.cog)
  let x = choix[p.source](b);
  if (p.lisserEma) x = A.pas(S, e.ema, i, x);
  S.src[i] = x;
  if (p.centreGravite) {
    const L = p.longueurCentre;
    let r = null;
    if (i >= L - 1) {
      let s = 0, num = 0, ok = true;
      for (let k = 0; k < L; k++) { const v = S.src[i - k]; if (!fini(v)) { ok = false; break; } s += v; num += v * (k + 1); }
      if (ok) { const q = s === 0 ? null : -num / s; r = fini(q) ? q : null; }
    }
    x = r;
  }
  S.cog[i] = x;
  // normalizeDeriv (math.sum, nz) et tanh : communs aux trois vitesses
  const der = i >= 2 && fini(x) && fini(S.cog[i - 2]) ? x - S.cog[i - 2] : null;
  S.der[i] = der;
  const L = p.moyenneQuadratique;
  let somme = null;
  if (der === null) { e.somme = 0; e.depuis = 0; } else {
    e.somme += Math.pow(der, 2); e.depuis++;
    if (e.depuis > L) e.somme -= Math.pow(S.der[i - L], 2);
    if (e.depuis >= L) somme = e.somme;
  }
  const qm = Math.sqrt(nz(somme === null ? null : somme / L));
  const nd = der === null ? null : der / qm;
  const th = fini(nd) ? -1 + 2 / (1 + Math.exp(-2 * nd)) : null;
  S.th[i] = th;
  const th1 = i > 0 ? S.th[i - 1] : null;
  for (const [k] of VITESSES_DEF) {
    const K = C.K[k], W = e.V[k], NK = CLES[k];
    let f = null;
    if (th !== null) {
      const moy = 0.5 * (th + (th1 !== null ? th1 : th));
      f = (K.delta * moy) + K.gamma * nz(W.f1) + K.beta * nz(W.f2);
    }
    W.f2 = W.f1; W.f1 = f;
    const ser = f === null ? null : K.longueur * f + K.decal;
    S[NK.ser][i] = ser; S[NK.mir][i] = p.miroir && ser !== null ? -ser + 2 * K.decal : null;
    // compteur d'etapes (getColorGradientFromSteps)
    const xu = A.pas(S, W.xu, i, ser, K.decal), xd = A.pas(S, W.xd, i, ser, K.decal);
    const s1 = i > 0 ? S[NK.ser][i - 1] : null;
    const chg = ser !== null && s1 !== null ? ser - s1 : null;
    const up = gt(chg, 0), dn = lt(chg, 0);
    if (gt(ser, K.decal)) W.q = xu ? 1 : up ? Math.min(C.pas, W.q + 1) : dn ? Math.max(1, W.q - 1) : W.q;
    else if (lt(ser, K.decal)) W.q = xd ? 1 : dn ? Math.min(C.pas, W.q + 1) : up ? Math.max(1, W.q - 1) : W.q;
    const haussier = f !== null && f >= 0, bc = haussier ? K.haus : K.bais;
    const src2 = (faible) => (ser !== null && ser >= K.base ? degrade(ser, K.base, K.mx, faible, bc) : degrade(ser, K.mn, K.base, bc, faible));
    const cl = src2(haussier ? K.hL : K.bL);
    S[NK.cl][i] = cl; S[NK.ca][i] = src2(haussier ? K.hA : K.bA);
    const sens = haussier ? 1 : 0;
    S[NK.cs][i] = K.cs[sens][W.q]; S[NK.cas][i] = K.cas[sens][W.q]; S[NK.casi][i] = K.cas[1 - sens][W.q];
    // color.new(degrade, lT) : les deux bornes du degrade ont les canaux de bc, seule l'opacite varie.
    S[NK.coulSerie][i] = K.montrer && cl !== null ? (haussier ? K.hL : K.bL) : null;
  }
  const v = p.vitesse, ek = v === 'Fast' || v === 'Normal' || v === 'Slow' ? v : null;
  S.serE[i] = ek ? S[CLES[ek].ser][i] : null; S.coulE[i] = ek ? S[CLES[ek].cl][i] : null;
  const k0 = gaussien(S.serE, i, 6, 6), k1 = gaussien(S.serE, i, 3, 2);
  S.k0[i] = k0; S.k1[i] = k1;
  const F = S.serFast[i], N = S.serNormal[i], Lt = S.serSlow[i];
  const baisse = A.pas(S, e.xb, i, F, N) && gt(N, 0), hausse = A.pas(S, e.xh, i, F, N) && lt(N, 0);
  S.baisse[i] = baisse; S.hausse[i] = hausse;
  // ta.valuewhen(_, seriesNormal, 1) et ta.barssince(cond[1])
  if (baisse) { e.valB.unshift(N); if (e.valB.length > 2) e.valB.pop(); }
  if (hausse) { e.valH.unshift(N); if (e.valH.length > 2) e.valH.pop(); }
  if (i > 0 && S.baisse[i - 1]) e.depB = i;
  if (i > 0 && S.hausse[i - 1]) e.depH = i;
  const fac = p.taillePourcent / 100;
  const lb = e.valB.length > 1 ? e.valB[1] : null, lh = e.valH.length > 1 ? e.valH[1] : null;
  const zb = e.depB === null ? null : i - e.depB, zh = e.depH === null ? null : i - e.depH;
  S.fortB[i] = baisse && lt(N, nul(lb) ? null : lb * fac) && lt(zb, p.distanceDivergence) && lt(k0, Lt);
  S.fortH[i] = hausse && gt(N, nul(lh) ? null : lh * fac) && lt(zh, p.distanceDivergence) && gt(k0, Lt);
  const X = e.V;
  const med = [A.pas(S, X.Slow.x0b, i, Lt, 0), A.pas(S, X.Slow.x0h, i, Lt, 0), A.pas(S, X.Normal.x0b, i, N, 0), A.pas(S, X.Normal.x0h, i, N, 0), A.pas(S, X.Fast.x0b, i, F, 0), A.pas(S, X.Fast.x0h, i, F, 0)];
  let m = (baisse ? 1 : 0) | (hausse ? 2 : 0) | (S.fortB[i] ? 4 : 0) | (S.fortH[i] ? 8 : 0);
  med.forEach((c, k) => { if (c) m |= 1 << (4 + k); });
  S.al[i] = m;
  // plot(..., style = plot.style_circles, offset = -1) : un point par signal, pose a la barre precedente.
  if (i > 0) {
    const y = p.miroir ? 0 : N;
    if (baisse) o.plotchar(i - 1, { position: 'absolute', y, caractere: '●', couleur: p.divergenceBaisse, taille: 'tiny' });
    if (S.fortB[i]) o.plotchar(i - 1, { position: 'absolute', y, caractere: '●', couleur: p.divergenceBaisse, taille: 'small' });
    if (hausse) o.plotchar(i - 1, { position: 'absolute', y, caractere: '●', couleur: p.divergenceHausse, taille: 'tiny' });
    if (S.fortH[i]) o.plotchar(i - 1, { position: 'absolute', y, caractere: '●', couleur: p.divergenceHausse, taille: 'small' });
  }
  // remplissages en polygones
  S.cOff[i] = p.ecart; S.cMoins[i] = -p.ecart; S.ob1[i] = p.surachat1; S.ob2[i] = p.surachat2; S.os1[i] = p.survente1; S.os2[i] = p.survente2;
  if (p.noyauTendance) remplir(o, e.f.k0, S.serE, S.k0, i, visible(S.clFast[i]), derniere);
  if (p.noyauSignal) remplir(o, e.f.k1, S.serE, S.k1, i, visible(S.clFast[i]), derniere);
  if (p.ecart === 0 && p.zones) {
    const c = visible(p.inverserZones ? S.casiNormal[i] : S.casNormal[i]);
    remplir(o, e.f.ob, S.ob1, S.ob2, i, c, derniere);
    remplir(o, e.f.os, S.os1, S.os2, i, c, derniere);
  }
  if (p.ecart !== 0) {
    remplir(o, e.f.sl, S.cMoins, S.serSlow, i, visible(S.caSlow[i]), derniere);
    remplir(o, e.f.slm, S.cMoins, S.mirSlow, i, visible(S.caSlow[i]), derniere);
    remplir(o, e.f.fa, S.cOff, S.serFast, i, visible(S.caFast[i]), derniere);
    remplir(o, e.f.fam, S.cOff, S.mirFast, i, visible(S.caFast[i]), derniere);
  }
}

const ALERTES = [
  ['vague_croisement_baissier', 'Croisement baissier'], ['vague_croisement_haussier', 'Croisement haussier'],
  ['vague_divergence_baissiere', 'Divergence baissière'], ['vague_divergence_haussiere', 'Divergence haussière'],
  ['vague_lent_sous_zero', 'Oscillateur lent sous 0'], ['vague_lent_sur_zero', 'Oscillateur lent au-dessus de 0'],
  ['vague_normal_sous_zero', 'Oscillateur normal sous 0'], ['vague_normal_sur_zero', 'Oscillateur normal au-dessus de 0'],
  ['vague_rapide_sous_zero', 'Oscillateur rapide sous 0'], ['vague_rapide_sur_zero', 'Oscillateur rapide au-dessus de 0'],
];

function rendre(p, e, d) {
  const S = e.sorties, n = d.length, r = {};
  const vide = () => pointsStables(S, '_vide', n, n - 1, (j) => ({ time: d[j].time, value: null }));
  const ligne = (cle, v, c) => pointsStables(S, `_${cle}`, n, n - 2, (j) => pointTrace(d, v, c, j));
  const colonnes = (cle, v, c) => pointsStables(S, `_${cle}`, n, n - 1, (i) => ({ time: d[i].time, value: nul(v[i]) || !c[i] ? null : v[i], color: c[i] }));
  for (const [k, nom] of VITESSES_DEF) {
    const hist = k === 'Normal' || p.ecart === 0;
    if (!S[`base${k}`]) S[`base${k}`] = [];
    const bv = S[`base${k}`], dec = k === 'Fast' ? p.ecart : k === 'Slow' ? -p.ecart : 0;
    for (let j = bv.length; j < n; j++) bv[j] = dec;
    r[nom] = ligne(nom, S[`ser${k}`], S[`coulSerie${k}`]);
    r[`${nom}Miroir`] = p.miroir ? ligne(`${nom}M`, S[`mir${k}`], S[`coulSerie${k}`]) : vide();
    r[`${nom}Base`] = ligne(`${nom}B`, bv, S[`cs${k}`]);
    r[`${nom}Aire`] = hist ? colonnes(`${nom}A`, S[`ser${k}`], S[`ca${k}`]) : vide();
    r[`${nom}AireMiroir`] = hist && p.miroir ? colonnes(`${nom}AM`, S[`mir${k}`], S[`ca${k}`]) : vide();
  }
  r.noyauTendance = p.noyauTendance ? ligne('k0', S.k0, S.coulE) : vide();
  r.noyauSignal = p.noyauSignal ? ligne('k1', S.k1, S.coulE) : vide();
  r.signaux = pointsStables(S, '_sig', n, n - 1, (i) => ({ time: d[i].time, value: S.al[i] === 0 ? null : S.al[i] }));
  r.objets = e.o.resultat();
  return r;
}

const sortiesVitesse = (nom, libelle, c) => [
  { id: `${nom}Aire`, name: `Aire ${libelle}`, type: 'histogram', color: c },
  { id: `${nom}AireMiroir`, name: `Aire ${libelle} (miroir)`, type: 'histogram', color: c },
  { id: nom, name: `Oscillateur ${libelle}`, type: 'line', color: c, lineWidth: 1 },
  { id: `${nom}Miroir`, name: `Oscillateur ${libelle} (miroir)`, type: 'line', color: c, lineWidth: 1 },
  { id: `${nom}Base`, name: `Ligne de base ${libelle}`, type: 'line', color: c, lineWidth: 1 },
];

export default class VagueTendance3DIndicator {
  static metadata = {
    id: 'vague_tendance_3d',
    name: 'Vague de tendance en trois vitesses',
    shortName: 'VT3',
    description: 'vague_tendance_3d',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['wavetrend', 'oscillateur', 'vitesses', 'noyau', 'divergence'],
    inputs: INPUTS,
    outputs: [
      ...sortiesVitesse('lente', 'lent', 'rgba(0, 153, 136, 0.3)'),
      ...sortiesVitesse('normale', 'normal', 'rgba(0, 153, 136, 0.4)'),
      ...sortiesVitesse('rapide', 'rapide', 'rgba(0, 153, 136, 0.7)'),
      { id: 'noyauTendance', name: 'Moyenne à noyau (tendance)', type: 'line', color: '#009988', lineWidth: 1 },
      { id: 'noyauSignal', name: 'Signal à noyau', type: 'line', color: '#009988', lineWidth: 1 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { normale: [] };
    const p = this.params, C = preparer(p);
    return executer(VagueTendance3DIndicator._memo, JSON.stringify(p), data, {
      creer: () => creer(p),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, C),
      rendre: (etat, d) => rendre(p, etat, d),
    });
  }
}
