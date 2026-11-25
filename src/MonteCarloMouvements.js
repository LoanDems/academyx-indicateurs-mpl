// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Monte Carlo Future Moves [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/LGueefJE-Monte-Carlo-Future-Moves-ChartPrime/
// Adaptation : la distribution est tiree a la derniere barre comme au chargement sur TradingView (le script ne la retire
// ensuite que toutes les `steps` barres closes en temps reel, ou a chaque barre si « Update Every Bar ») ; meme generateur
// pseudo-aleatoire que le script, une graine par appel de prng() comme les `var` de Pine. runtime.error (moins de barres que
// la fenetre ou la derive) : rien n'est dessine. math.sum compte un na pour 0 ; math.round(x, n) = round(x 10^n) / 10^n.
// Les boucles de tirage sont plafonnees a 1 000 000 de pas (le script ne s'arrete qu'a la limite de TradingView).
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, degrade, transparence } from './commun.js';

const P = 'Paramètres', AJ = 'Ajustements', AF = 'Affichage', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Mouvement mesuré', type: 'select', default: 'Candle', group: P,
    options: [{ label: 'Bougie (clôture - ouverture)', value: 'Candle' }, { label: 'Clôture à clôture', value: 'Move' }] },
  { id: 'simulations', name: 'Simulations', type: 'number', entier: true, default: 500, min: 50, max: 1000, step: 50, group: P,
    description: 'Au plus 1 000 (avec 20 barres projetées : 17 ms par tick, la distribution est retirée à chaque tick).' },
  { id: 'fenetre', name: 'Fenêtre (barres)', type: 'number', entier: true, default: 500, min: 50, max: 5000, step: 50, group: P,
    description: 'Barres passées dont les mouvements alimentent le tirage.' },
  { id: 'pas', name: 'Barres projetées', type: 'number', entier: true, default: 10, min: 2, max: 20, step: 1, group: P },
  { id: 'classes', name: 'Rangées de la distribution', type: 'number', entier: true, default: 50, min: 10, max: 200, step: 5, group: P, legende: false },
  { id: 'lissage', name: 'Lissage de la distribution', type: 'number', default: 1.75, min: 0, max: 20, step: 0.25, group: P, legende: false },
  { id: 'granularite', name: 'Classes des mouvements', type: 'number', entier: true, default: 25, min: 5, max: 200, step: 5, group: P, legende: false },
  { id: 'derive', name: 'Longueur de la dérive', type: 'number', entier: true, default: 34, min: 0, max: 5000, step: 1, group: AJ, legende: false,
    description: '0 = la fenêtre.' },
  { id: 'styleDerive', name: 'Dérive', type: 'select', default: 'Standard', group: AJ,
    options: [{ label: 'Régression linéaire', value: 'Linear Regression' }, { label: 'Standard', value: 'Standard' }, { label: 'Aucune', value: 'None' }] },
  { id: 'volatilite', name: 'Ajuster à la volatilité', type: 'boolean', default: true, group: AJ },
  { id: 'rendements', name: 'Rendements', type: 'select', default: 'Log Returns', group: AJ,
    options: [{ label: 'Pourcentages', value: 'Percent' }, { label: 'Logarithmiques', value: 'Log Returns' }] },
  { id: 'precision', name: 'Précision', type: 'number', entier: true, default: 4, min: 1, max: 10, step: 1, group: AJ, legende: false },
  { id: 'cote', name: 'Côté du graphique', type: 'select', default: 'Right', group: AF, options: [{ label: 'Droite', value: 'Right' }, { label: 'Gauche', value: 'Left' }] },
  { id: 'aide', name: 'Flèches', type: 'select', default: 'Both', group: AF,
    options: [{ label: 'Mouvement attendu', value: 'Expected' }, { label: 'Écart-type', value: 'Deviation Range' }, { label: 'Les deux', value: 'Both' }, { label: 'Aucune', value: 'None' }] },
  { id: 'mouvementProbable', name: 'Mouvements les plus probables', type: 'boolean', default: true, group: AF },
  { id: 'ecartType', name: 'Écart-type', type: 'boolean', default: true, group: AF },
  { id: 'deviation', name: 'Multiple de l’écart-type', type: 'number', default: 1, min: 0, max: 10, step: 0.5, group: AF, legende: false },
  { id: 'biais', name: 'Direction la plus probable', type: 'boolean', default: true, group: AF },
  { id: 'zoneMax', name: 'Zone la plus probable', type: 'boolean', default: true, group: AF },
  { id: 'distribution', name: 'Distribution des issues', type: 'boolean', default: true, group: AF },
  { id: 'echelle', name: 'Largeur de la distribution', type: 'number', entier: true, default: 30, min: 10, max: 300, step: 1, group: AF, legende: false },
  { id: 'texte', name: 'Probabilités sur la distribution', type: 'boolean', default: true, group: AF },
  { id: 'fond', name: 'Fond', type: 'boolean', default: true, group: AF },
  { id: 'depart', name: 'Ligne de départ', type: 'boolean', default: true, group: AF },
  { id: 'prolonger', name: 'Prolonger les lignes', type: 'boolean', default: true, group: AF },
  { id: 'baisseMax', name: 'Baisse (clair)', type: 'color', default: '#FFA0CC', group: S },
  { id: 'baisseMin', name: 'Baisse (vif)', type: 'color', default: '#FF22CC', group: S },
  { id: 'hausseMax', name: 'Hausse (clair)', type: 'color', default: '#00FFFF', group: S },
  { id: 'hausseMin', name: 'Hausse (vif)', type: 'color', default: '#0066FF', group: S },
  { id: 'ecartHaut', name: 'Écart-type haut', type: 'color', default: '#FFB617', group: S },
  { id: 'ecartBas', name: 'Écart-type bas', type: 'color', default: '#2672ff', group: S },
  { id: 'couleurDepart', name: 'Ligne de départ', type: 'color', default: '#7E7E7E', group: S },
  { id: 'couleurTexte', name: 'Texte', type: 'color', default: '#FFFFFF', group: S },
];
const INVISIBLE = 'rgba(0, 0, 0, 0)', BORNE = 1000000;
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const arrondi = (x, n) => { const f = Math.pow(10, n); return Math.round(x * f) / f; };
const txt = (v) => (Number.isFinite(v) ? formaterMotif(v, '#.##########') : 'NaN');

/** prng(seed, _range) du script ; `g` = son `var random` (un par appel). */
function prng(g, seed, range = 100) {
  g.r = ((3.1415926 * g.r % seed) * 271.828) % range;
  return [g.r, ((seed * 1.618) % range) + g.r];
}

function creer(p) {
  const S = { ret: [], delta: [], vr: [], lr: [] };
  return { o: creerObjets({}), sorties: S, seed: 1, g: { r: 1.0 }, som: 0, sm: A.sma(S, p.pas) };
}

function etape(p, e, d, i) {
  const S = e.sorties, b = d[i], pc = p.rendements === 'Percent';
  const last = p.source === 'Move' ? (i > 0 ? d[i - 1].close : null) : b.open;
  const ret = nul(last) ? null : (pc ? (b.close - last) / last : Math.log(b.close / last));
  S.ret[i] = ret;
  S.delta[i] = nul(ret) ? null : arrondi(ret, p.precision + (pc ? 6 : 2));
  // volatility_adjustment : sma(sqrt(math.sum(ret^2, steps) / (steps - 1)), steps) * 0.5.
  const st = p.pas, x2 = nul(ret) ? null : Math.pow(ret, 2);
  e.som += nul(x2) ? 0 : x2;
  if (i >= st) { const v = S.ret[i - st]; e.som -= nul(v) ? 0 : Math.pow(v, 2); }
  const q = i >= st - 1 ? Math.sqrt(e.som / (st - 1)) : null;
  const vm = A.pas(S, e.sm, i, Number.isFinite(q) ? q : null);
  S.vr[i] = nul(vm) ? null : vm * 0.5;
  S.lr[i] = i > 0 ? Math.log(b.close / d[i - 1].close) : null;
  const [, re] = prng(e.g, e.seed);
  e.seed = re;
}

/** moves() a la derniere barre. */
function mouvements(p, d, S, i) {
  const L = p.fenetre, bins = p.granularite, pc = p.rendements === 'Percent';
  const vol = p.volatilite ? S.vr[i] : 0.0;
  // ta.highest / ta.lowest(delta[1], lookback) : lecture arretee au premier na.
  let hh = null, ll = null;
  if (i >= L - 1) {
    for (let k = 0; k < L; k++) { const j = i - k - 1, v = j >= 0 ? S.delta[j] : null; if (nul(v)) break; if (hh === null || v > hh) hh = v; }
    for (let k = 0; k < L; k++) { const j = i - k - 1, v = j >= 0 ? S.delta[j] : null; if (nul(v)) break; if (ll === null || v < ll) ll = v; }
  }
  const ext = nul(hh) || nul(ll) ? null : Math.max(Math.abs(hh), Math.abs(ll));
  const dl = p.derive === 0 ? L : p.derive;
  let drift = 0.0;
  if (p.styleDerive === 'Standard') {
    let mean = 0.0, vari = 0.0;
    for (let k = 0; k <= dl - 1; k++) { const v = S.lr[i - k]; mean += v; vari += Math.pow(v, 2); }
    mean /= dl; vari /= dl * 2;
    drift = mean - vari;
  } else if (p.styleDerive === 'Linear Regression') {
    let sx = 0.0, sy = 0.0, sx2 = 0.0, sxy = 0.0;
    for (let k = 0; k <= dl - 1; k++) { const src = d[i - k].close, ix = k + 1; sx += ix; sy += src; sx2 += Math.pow(ix, 2); sxy += src * ix; }
    drift = -((dl * sxy - sx * sy) / (dl * sx2 - sx * sx));
  }
  const bw = nul(ext) ? null : ext / bins;
  const pol = [0, 0], up = new Array(bins + 1).fill(0), dn = new Array(bins + 1).fill(0);
  const ajouter = (t, v) => { const k = Math.trunc(Math.abs(v) / bw); t[k] = t[k] + 1; };
  for (let k = 1; k <= L; k++) {
    const j = i - k, last = p.source === 'Move' ? (j > 0 ? d[j - 1].close : null) : d[j].open;
    if (!nul(last) && d[j].close <= last) { pol[1] += 1; ajouter(dn, S.delta[j]); } else { pol[0] += 1; ajouter(up, S.delta[j]); }
  }
  return { pol, up, dn, bw, drift, vol, pc };
}

const somme = (t) => t.reduce((a, v) => a + v, 0);
const maxi = (t) => { let m = t[0]; for (const v of t) if (v > m) m = v; return m; };
const mini = (t) => { let m = t[0]; for (const v of t) if (v < m) m = v; return m; };

/** monte_carlo(moves, seed, steps) ; G = les `var random` de ses cinq appels de prng(). */
function tirage(mv, G, seed, steps) {
  const monte = new Array(steps).fill(null);
  let s = seed, garde = 0;
  const ps = somme(mv.pol), us = somme(mv.up), ds = somme(mv.dn);
  const pct = (k, pol) => (pol ? 1 : -1) * (k * mv.bw + mv.vol);
  if (maxi(mv.up) > 0 && maxi(mv.dn) > 0) {
    for (let i = 0; i <= steps - 1; i++) {
      const [pr, pss] = prng(G[0], s);
      s = pss;
      const hausse = mv.pol[0] / ps * 100.0 >= pr, T = hausse ? mv.up : mv.dn, tot = hausse ? us : ds, gA = hausse ? G[1] : G[3], gB = hausse ? G[2] : G[4];
      const n1 = T.length - 1;
      const [mr, mrs] = prng(gA, s, n1);
      s = mrs;
      let k = Math.trunc(mr);
      while (garde++ < BORNE) {
        if (k > n1) k = 0;
        if (T[k] === 0) { k += 1; continue; }
        const [fr, fs] = prng(gB, s);
        s = fs;
        if (T[k] / tot * 100.0 >= fr) { monte[i] = pct(k, hausse); break; }
        k += 1;
      }
    }
  }
  return [monte, s];
}

function ajoutDerive(v, drift, style) {
  if (style === 'Standard') return Math.exp(drift) * v;
  if (style === 'Linear Regression') return v + drift;
  return v;
}

function distribution(p, mv, G, seed, open) {
  const bins = p.classes, steps = p.pas, sims = p.simulations;
  const dist = new Array(bins + 1).fill(0), issues = [];
  let sumSd = 0.0, re = seed;
  for (let i = 0; i <= sims - 1; i++) {
    let simu = open;
    const [mvts, s2] = tirage(mv, G, re, steps);
    for (let k = 0; k <= steps - 1; k++) {
      const r = mvts[k], v = nul(r) ? NaN : (mv.pc ? (1.0 + r) * simu : Math.exp(r) * simu);
      simu = ajoutDerive(v, mv.drift, p.styleDerive);
    }
    re = s2;
    sumSd += Math.pow(simu - open, 2);
    issues.push(simu);
  }
  const lo = mini(issues), hi = maxi(issues), bw = (hi - lo) / bins;
  let aU = 0.0, sU = 0.0, aD = 0.0, sD = 0.0;
  for (const x of issues) {
    const k = Math.trunc((x - lo) / bw);
    if (x > open) { aU += k; sU += 1; } else { aD += k; sD += 1; }
    dist[k] = dist[k] + 1;
  }
  return { dist, bw, lo, hi, aU: aU / sU, aD: aD / sD, sd: Math.sqrt(sumSd / sims) };
}

const sinc = (s, bw) => { const om = Math.PI * s / bw; return s !== 0.0 ? Math.sin(om) / om : 1.0; };
function filtreSinc(src, L) {
  if (!(L > 0.0 && src.length > 0)) return src;
  const L1 = L + 1.0, n = src.length, est = new Array(n);
  for (let i = 0; i <= n - 1; i++) {
    let s = 0.0, w = 0.0;
    for (let j = 0; j <= n - 1; j++) { const k = sinc(i - j, L1); s += k * src[j]; w += k; }
    const c = s / w;
    est[i] = c >= 0.0 ? c : 0.0;
  }
  return est;
}

function dessiner(p, o, mv, seed, i, open) {
  const droite = p.cote === 'Right', off = p.pas, dir = droite ? 1 : -1, pos = droite ? 0 : off, larg = (p.echelle + off) * dir;
  const ext = p.prolonger ? 'left' : 'none';
  const G = [{ r: 1.0 }, { r: 1.0 }, { r: 1.0 }, { r: 1.0 }, { r: 1.0 }];
  const D = distribution(p, mv, G, seed, open);
  const monte = filtreSinc(D.dist, p.lissage);
  const mf = maxi(monte), demi = D.bw * 0.5, varia = D.sd * p.deviation;
  const devH = open + varia, devB = Math.max(0.0, open - varia), avH = D.aU * D.bw + D.lo, avB = D.aD * D.bw + D.lo;
  const x2 = p.distribution ? larg + i : droite ? off + i : -1 + i;
  const L = (x1, y1, xx2, y2, couleur, style, extend, epaisseur) => o.ligne({ x1, y1, x2: xx2, y2, couleur, epaisseur, extend,
    ...(style === 'arrow_right' ? { style: 'solid', fleches: 'right' } : { style }) });
  if (p.zoneMax) { const ex = monte.indexOf(mf) * D.bw + D.lo; L(i + pos, ex, x2, ex, ex > open ? p.hausseMin : p.baisseMin, 'solid', ext, 2); }
  if (p.ecartType) {
    L(i + pos, devH, x2, devH, p.ecartHaut, 'dotted', ext, 2);
    L(i + pos, devB, x2, devB, p.ecartBas, 'dotted', ext, 2);
    if (p.aide === 'Deviation Range' || p.aide === 'Both') { L(i, open, i + off, devH, p.ecartHaut, 'arrow_right', 'none', 1); L(i, open, i + off, devB, p.ecartBas, 'arrow_right', 'none', 1); }
  }
  if (p.mouvementProbable) {
    L(i + pos, avH, x2, avH, p.hausseMin, 'dashed', ext, 2);
    L(i + pos, avB, x2, avB, p.baisseMin, 'dashed', ext, 2);
    if (p.aide === 'Expected' || p.aide === 'Both') { L(i, open, i + off, avH, p.hausseMin, 'arrow_right', 'none', 1); L(i, open, i + off, avB, p.baisseMin, 'arrow_right', 'none', 1); }
  }
  if (p.depart) L(i + pos, open, x2, open, p.couleurDepart, 'solid', ext, 1);
  let polarite = 0.0;
  const ms = somme(monte), mn = mini(monte), extB = p.prolonger ? (droite ? 'left' : 'right') : 'none';
  for (let k = 0; k <= monte.length - 1; k++) {
    const top = (1 + k) * D.bw + D.lo - demi, bot = k * D.bw + D.lo - demi, centre = (top + bot) / 2;
    let val = Math.trunc((monte[k] - mn) * (p.echelle - 1) / (mf - mn)) + 1;
    val = p.echelle - val;
    const prob = monte[k] / ms * 100.0;
    if (centre < open) polarite += prob;
    const gc = centre >= open ? degrade(centre, open, D.hi - demi, p.hausseMin, p.hausseMax) : degrade(centre, D.lo + D.bw * 0.5, open, p.baisseMax, p.baisseMin);
    if (prob > 0.0 && p.distribution) {
      o.boite({ gauche: i + (val + off) * dir, haut: top, droite: i + larg, bas: bot, texte: p.texte ? txt(arrondi(prob, 2)) + '%' : '',
        couleurBordure: INVISIBLE, fond: gc, couleurTexte: p.couleurTexte });
    }
    if (p.fond) {
      const dr = p.distribution ? (val + off) * dir + i : droite ? off + i : -1 + i;
      o.boite({ gauche: i + pos, haut: top, droite: dr, bas: bot, couleurBordure: INVISIBLE, fond: degrade(monte[k], 0.0, mf, transparence(gc, 99), transparence(gc, 75)), extend: extB });
    }
  }
  if (p.biais) {
    const g = p.distribution ? larg + i : droite ? off + i : -1 + i, dd = g + 2 * dir, bas = D.lo - demi;
    const dv = (D.hi + demi - (D.lo - demi)) * (polarite / 100.0);
    o.boite({ gauche: g, haut: D.hi + demi, droite: dd, bas: dv + bas, couleurBordure: INVISIBLE, fond: p.hausseMin, texte: '🢁\n\n' + txt(arrondi(100.0 - polarite, 2)) + '%', couleurTexte: p.couleurTexte });
    o.boite({ gauche: g, haut: bas + dv, droite: dd, bas, couleurBordure: INVISIBLE, fond: p.baisseMin, texte: txt(arrondi(polarite, 2)) + '%' + '\n\n🢃', couleurTexte: p.couleurTexte });
  }
}

function rendre(p, e, d) {
  const o = creerObjets({ maxBoites: 500, maxLignes: 500 }), i = d.length - 1;
  const dl = p.derive === 0 ? p.fenetre : p.derive;
  if (i + 1 >= p.fenetre && i + 1 >= dl && i >= p.fenetre && i >= dl) {
    const mv = mouvements(p, d, e.sorties, i);
    if (!nul(mv.bw) && mv.bw > 0) dessiner(p, o, mv, e.seed, i, d[i].open);
  }
  return { objets: o.resultat() };
}

export default class MonteCarloMouvementsIndicator {
  static metadata = {
    id: 'monte_carlo_mouvements',
    name: 'Mouvements simulés (Monte-Carlo)',
    shortName: 'MCM',
    description: 'monte_carlo_mouvements',
    version: '1.0.0',
    overlay: true,
    type: 'volatility',
    category: 'Volatility',
    source: 'builtin',
    tags: ['monte carlo', 'simulation', 'distribution', 'ecart-type', 'projection'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    return executer(MonteCarloMouvementsIndicator._memo, JSON.stringify(p), data, {
      creer: () => creer(p),
      etape: (e, d, i) => etape(p, e, d, i),
      rendre: (e, d) => rendre(p, e, d),
    });
  }
}
