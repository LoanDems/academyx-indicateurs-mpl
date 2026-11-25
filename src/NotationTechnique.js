// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Technical Ratings » © TradingView — https://www.tradingview.com/script/Jdw7wW2g-Technical-Ratings/
// avec les fonctions utilisees de ses bibliotheques TradingView/TechnicalRating/3 et TradingView/ta/9 (MPL-2.0, © TradingView).
// Adaptation : calcul dans l'unite du graphique (l'entree « Timeframe » et son request.security ne sont pas portes).
import { creerObjets } from '../academyscript/objets.js';
import { sma, ema, hma, vwma, rsi as taRsi, cci as taCci, dmi as taDmi, macd as taMacd, wpr as taWpr, stoch as taStoch } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, transparence, TRANSPARENT } from './commun.js';

const C = 'Calcul', A = 'Style', AL = 'Alertes et marqueurs';
const RT1 = 'MAs and Oscillators', RT2 = 'MAs', RT3 = 'Oscillators';
const TD0 = 'None', TD1 = 'Longs', TD2 = 'Shorts', TD3 = 'Longs and Shorts';
const INPUTS = [
  { id: 'calcul', name: 'La notation utilise', type: 'select', default: RT1, group: C,
    options: [{ label: 'Moyennes mobiles', value: RT2 }, { label: 'Oscillateurs', value: RT3 }, { label: 'Moyennes et oscillateurs', value: RT1 }] },
  { id: 'poidsMoyennes', name: 'Poids des moyennes (%)', type: 'number', entier: true, default: 50, min: 0, max: 100, step: 10, group: C,
    description: 'Part des moyennes mobiles dans la notation totale ; les oscillateurs ont le reste.' },
  { id: 'repeindre', name: 'Signaux sur la barre en cours', type: 'boolean', default: true, group: C,
    description: 'Désactivé, un marqueur n’apparaît qu’une fois la barre close.' },
  { id: 'trace', name: 'Tracé', type: 'select', default: 'Columns', group: A,
    options: [{ label: 'Colonnes', value: 'Columns' }, { label: 'Histogramme', value: 'Histogram' }, { label: 'Zone', value: 'Area' }, { label: 'Ligne', value: 'Line' }] },
  { id: 'couleurHausse', name: 'Achat', type: 'color', default: '#00ff00', group: A },
  { id: 'couleurBaisse', name: 'Vente', type: 'color', default: '#ff0080', group: A },
  { id: 'couleurNeutre', name: 'Neutre', type: 'color', default: '#808080', group: A },
  { id: 'direction', name: 'Direction', type: 'select', default: TD0, group: AL,
    options: [{ label: 'Aucune', value: TD0 }, { label: 'Achats', value: TD1 }, { label: 'Ventes', value: TD2 }, { label: 'Achats et ventes', value: TD3 }] },
  { id: 'alterner', name: 'Alterner achats et ventes', type: 'boolean', default: true, group: AL },
  { id: 'niveauAchat', name: 'Niveau des achats', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05, group: AL, legende: false },
  { id: 'niveauVente', name: 'Niveau des ventes', type: 'number', default: -0.5, min: -1, max: 0, step: 0.05, group: AL, legende: false },
  { id: 'progression', name: 'Hausses / baisses cumulées', type: 'number', entier: true, default: 0, min: 0, max: 5, step: 1, group: AL, legende: false,
    description: 'Nombre de hausses successives de la notation (1 à 5) qui déclenche aussi un marqueur ; 0 = désactivé.' },
  { id: 'messageAchat', name: 'Message d’alerte : achat', type: 'string', default: 'Long', group: AL },
  { id: 'messageVente', name: 'Message d’alerte : vente', type: 'string', default: 'Short', group: AL },
];
const FORT = 0.5, FAIBLE = 0.1, GRIS = '#787B86', ARGENT = '#b2b5be';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const sup = (a, b) => !nul(a) && !nul(b) && a > b, inf = (a, b) => !nul(a) && !nul(b) && a < b;
const at = (s, i) => (i >= 0 ? s[i] : null);

/** midpoint(length) de TradingView/ta/9 : math.avg(ta.highest(length), ta.lowest(length)). */
function milieuFenetre(d, n) {
  return d.map((_, i) => {
    if (i < n - 1) return null;
    let h = -Infinity, l = Infinity;
    for (let k = i - n + 1; k <= i; k++) { if (d[k].high > h) h = d[k].high; if (d[k].low < l) l = d[k].low; }
    return (h + l) / 2;
  });
}

/** Somme glissante (math.sum) sur une serie : na si un na est dans la fenetre. */
function sommes(v, n) {
  const out = new Array(v.length).fill(null);
  let s = 0, nas = 0;
  for (let i = 0; i < v.length; i++) {
    if (nul(v[i])) nas++; else s += v[i];
    if (i >= n) { if (nul(v[i - n])) nas--; else s -= v[i - n]; }
    if (i >= n - 1 && nas === 0) out[i] = s;
  }
  return out;
}

const moyenneSansNa = (t) => { let s = 0, k = 0; for (const v of t) if (!nul(v)) { s += v; k++; } return k ? s / k : null; };
const note = (src, haussier, baissier) => (nul(src) ? null : haussier ? 1 : baissier ? -1 : 0);
const noteMoyenne = (ma, c) => (nul(ma) ? null : Math.sign(c - ma));

/**
 * calcRatingAll() de TechnicalRating/3 : [total, oscillateurs, moyennes], sur toutes les bougies d'un coup.
 * N'est plus appele par l'indicateur (cf. reprise d'etat plus bas) : reference du banc d'egalite bit a bit.
 */
export function notations(d) {
  const n = d.length, close = d.map((b) => b.close), high = d.map((b) => b.high), low = d.map((b) => b.low);
  const tenkan = milieuFenetre(d, 9), kijun = milieuFenetre(d, 26), lead2 = milieuFenetre(d, 52);
  const lead1 = tenkan.map((t, i) => (nul(t) || nul(kijun[i]) ? null : (t + kijun[i]) / 2));
  const kStoch = sma(taStoch(close, high, low, 14), 3), dStoch = sma(kStoch, 3);
  const r14 = taRsi(close, 14);
  const kSR = sma(taStoch(r14, r14, r14, 14), 3), dSR = sma(kSR, 3);
  const { plus: diP, minus: diN, adx } = taDmi(d, 14, 14);
  const { macd, signal } = taMacd(close, 12, 26, 9);
  const e13 = ema(close, 13);
  const cciV = taCci(close, 20);
  const mom = close.map((c, i) => (i >= 10 ? c - close[i - 10] : null));
  const priceAvg = ema(close, 50);
  // uo(7, 14, 28) de ta/9
  const bp = [], trg = [];
  for (let i = 0; i < n; i++) {
    const c1 = i > 0 ? close[i - 1] : null;
    const tMax = nul(c1) ? null : Math.max(high[i], c1), tMin = nul(c1) ? null : Math.min(low[i], c1);
    trg.push(nul(tMax) ? null : tMax - tMin); bp.push(nul(tMin) ? null : close[i] - tMin);
  }
  const moyUo = (k) => { const a = sommes(bp, k), b = sommes(trg, k); return a.map((x, i) => (nul(x) || nul(b[i]) ? null : x / b[i])); };
  const u1 = moyUo(7), u2 = moyUo(14), u3 = moyUo(28);
  const uo = u1.map((x, i) => (nul(x) || nul(u2[i]) || nul(u3[i]) ? null : (100 * (4 * x + 2 * u2[i] + u3[i])) / 7));
  const wr = taWpr(d, 14);
  const hl2 = d.map((b) => (b.high + b.low) / 2);
  const s5 = sma(hl2, 5), s34 = sma(hl2, 34);
  const ao = s5.map((x, i) => (nul(x) || nul(s34[i]) ? null : x - s34[i]));
  const MAS = [sma(close, 10), sma(close, 20), sma(close, 30), sma(close, 50), sma(close, 100), sma(close, 200),
    ema(close, 10), ema(close, 20), ema(close, 30), ema(close, 50), ema(close, 100), ema(close, 200), hma(close, 9), vwma(d, close, 20)];
  const tot = new Array(n), osc = new Array(n), mas = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = close[i];
    const notesMa = MAS.map((m) => noteMoyenne(m[i], c));
    const l1 = at(lead1, i - 26), l2 = at(lead2, i - 26);
    notesMa.push(note(lead2[i], sup(l1, l2) && sup(kijun[i], l1) && sup(tenkan[i], kijun[i]) && sup(c, tenkan[i]),
      inf(l1, l2) && inf(kijun[i], l1) && inf(tenkan[i], kijun[i]) && inf(c, tenkan[i])));
    const rMa = moyenneSansNa(notesMa);
    const r = r14[i], r1 = at(r14, i - 1), k = kStoch[i], dd = dStoch[i], cc = cciV[i], cc1 = at(cciV, i - 1);
    const a = ao[i], a1 = at(ao, i - 1), a2 = at(ao, i - 2), a0 = adx[i], a01 = at(adx, i - 1);
    const xoAo = sup(a, 0) && !nul(a1) && a1 <= 0, xuAo = inf(a, 0) && !nul(a1) && a1 >= 0;
    const up = sup(c, priceAvg[i]), dn = inf(c, priceAvg[i]);
    const bear = nul(e13[i]) ? null : low[i] - e13[i], bear1 = i > 0 && !nul(e13[i - 1]) ? low[i - 1] - e13[i - 1] : null;
    const bull = nul(e13[i]) ? null : high[i] - e13[i], bull1 = i > 0 && !nul(e13[i - 1]) ? high[i - 1] - e13[i - 1] : null;
    const notesOsc = [
      note(r1, inf(r, 30) && inf(r1, r), sup(r, 70) && sup(r1, r)),
      note(at(dStoch, i - 1), inf(k, 20) && inf(dd, 20) && sup(k, dd), sup(k, 80) && sup(dd, 80) && inf(k, dd)),
      note(cc1, inf(cc, -100) && sup(cc, cc1), sup(cc, 100) && inf(cc, cc1)),
      note(a0, sup(a0, 20) && sup(a0, a01) && sup(diP[i], diN[i]), sup(a0, 20) && sup(a0, a01) && inf(diP[i], diN[i])),
      note(a1, xoAo || (sup(a, 0) && sup(a1, 0) && sup(a, a1) && sup(a2, a1)), xuAo || (inf(a, 0) && inf(a1, 0) && inf(a, a1) && inf(a2, a1))),
      note(at(mom, i - 1), sup(mom[i], at(mom, i - 1)), inf(mom[i], at(mom, i - 1))),
      note(signal[i], sup(macd[i], signal[i]), inf(macd[i], signal[i])),
      note(priceAvg[i], dn && inf(kSR[i], 20) && inf(dSR[i], 20) && sup(kSR[i], dSR[i]), up && sup(kSR[i], 80) && sup(dSR[i], 80) && inf(kSR[i], dSR[i])),
      note(at(wr, i - 1), inf(wr[i], -80) && sup(wr[i], at(wr, i - 1)), sup(wr[i], -20) && inf(wr[i], at(wr, i - 1))),
      note(priceAvg[i], up && inf(bear, 0) && sup(bear, bear1), dn && sup(bull, 0) && inf(bull, bull1)),
      note(uo[i], sup(uo[i], 70), inf(uo[i], 30)),
    ];
    const rO = moyenneSansNa(notesOsc);
    const total = (nul(rMa) ? 0 : rMa) + (nul(rO) ? 0 : rO);
    tot[i] = !nul(rMa) && !nul(rO) ? total / 2 : !nul(rMa) || !nul(rO) ? total : null;
    osc[i] = rO; mas[i] = rMa;
  }
  return { tot, osc, mas };
}

const couleurNote = (r, p) => (sup(r, FORT) ? transparence(p.couleurHausse, 20) : sup(r, FAIBLE) ? transparence(p.couleurHausse, 40)
  : inf(r, -FORT) ? transparence(p.couleurBaisse, 20) : inf(r, -FAIBLE) ? transparence(p.couleurBaisse, 40) : transparence(p.couleurNeutre, 20));
const texteNote = (r) => (sup(r, FORT) ? 'Achat fort' : sup(r, FAIBLE) ? 'Achat' : inf(r, -FORT) ? 'Vente forte' : inf(r, -FAIBLE) ? 'Vente' : 'Neutre');
const memeCouleur = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// ---------------------------------------------------------------------------
// REPRISE D'ETAT. Le calcul complet ci-dessus (`notations`) refait les ~30 series
// a chaque appel : 79 ms par tick a 20 000 bougies. Les memes ta.* de la plateforme
// (academyscript/ta.js) sont recrits ici BARRE PAR BARRE, memes operations dans le
// meme ordre : `executer` garde l'etat des barres closes et ne rejoue que la barre en
// cours. Egalite bit a bit avec `notations` : tests/indicateurs/mpl/notation-technique-reprise.mjs.
// Etats en donnees simples (copiables par `executer`), historiques dans `sorties`.
// ---------------------------------------------------------------------------
const fini = (v) => typeof v === 'number' && Number.isFinite(v);
/** _lisser de ta.js (ema / rma) : amorce = moyenne des `n` premieres valeurs non na ; na rend na, etat garde. */
const lisseur = () => ({ p: null, s: 0, c: 0 });
function lisser(st, v, n, estEma) {
  if (!fini(v)) return null;
  if (st.p === null) {
    st.s += v; st.c++;
    if (st.c === n) { st.p = st.s / n; return st.p; }
    return null;
  }
  if (estEma) { const a = 2 / (n + 1); st.p = a * v + (1 - a) * st.p; } else st.p = (st.p * (n - 1) + v) / n;
  return st.p;
}
/** ta.sma : somme glissante (ajout puis retrait) des `n` dernieres valeurs non na ; barre na = valeur precedente. */
const moyenneSimple = () => ({ r: [], s: 0, j: 0, v: null });
function moyenne(st, v, n) {
  if (!fini(v)) return st.j >= n ? st.v : null;
  const k = st.j % n, ancien = st.r[k];
  st.s += v;
  if (st.j >= n) st.s -= ancien;
  st.r[k] = v; st.j++;
  if (st.j >= n) { const m = st.s / n; st.v = fini(m) ? m : null; }
  return st.j >= n ? st.v : null;
}
/** ta.wma : poids n..1 ; une barre na rend na, la fenetre lit la derniere valeur non na. */
const moyennePonderee = () => ({ r: [], d: null, i: 0 });
function ponderee(st, v, n) {
  const ok = fini(v);
  if (ok) st.d = v;
  const i = st.i++;
  st.r[i % n] = st.d;
  if (i < n - 1 || !ok) return null;
  let t = 0;
  for (let k = 0; k < n; k++) { const x = st.r[(i - k) % n]; if (x === null) return null; t += x * (n - k); }
  return t / ((n * (n + 1)) / 2);
}
/** ta.stoch(source, haut, bas, n) : extremes lus jusqu'au premier na ; na ou amplitude nulle : regles de ta.js. */
function stochastique(st, src, H, L, i, n) {
  if (i < n - 1) return null;
  let hh = null, ll = null;
  for (let k = 0; k < n; k++) { const v = H[i - k]; if (!fini(v)) break; if (hh === null || v > hh) hh = v; }
  for (let k = 0; k < n; k++) { const v = L[i - k]; if (!fini(v)) break; if (ll === null || v < ll) ll = v; }
  const c = src[i];
  if (hh === null || ll === null) return st.prec;
  const amplitude = hh - ll;
  if (amplitude === 0) { if (c === ll) return st.prec; st.prec = null; return null; }
  if (!fini(c)) return st.prec;
  st.prec = (100 * (c - ll)) / amplitude;
  return st.prec;
}
/** Somme glissante na-sensible (fonction `sommes` du calcul complet). */
const somme = () => ({ s: 0, nas: 0 });
function sommer(st, v, i, n) {
  if (nul(v[i])) st.nas++; else st.s += v[i];
  if (i >= n) { if (nul(v[i - n])) st.nas--; else st.s -= v[i - n]; }
  return i >= n - 1 && st.nas === 0 ? st.s : null;
}
const milieuBarre = (d, i, n) => {
  if (i < n - 1) return null;
  let h = -Infinity, l = Infinity;
  for (let k = i - n + 1; k <= i; k++) { if (d[k].high > h) h = d[k].high; if (d[k].low < l) l = d[k].low; }
  return (h + l) / 2;
};
const LONGUEURS = [10, 20, 30, 50, 100, 200];
function creerEtat() {
  const H = {};
  for (const k of ['close', 'high', 'low', 'lead1', 'lead2', 'stoch', 'dStoch', 'r14', 'kSR', 'dSR', 'cci', 'ao', 'adx', 'mom', 'wr', 'e13', 'bp', 'trg',
    'user', 'niveau', 'couleur', 'longs', 'shorts', 'tot', 'osc', 'mas', 'alerte']) H[k] = [];
  return {
    t: {
      sma: LONGUEURS.map(moyenneSimple), ema: LONGUEURS.map(lisseur), hDemi: moyennePonderee(), hPlein: moyennePonderee(), hBrut: moyennePonderee(),
      vNum: moyenneSimple(), vDen: moyenneSimple(), stK: { prec: null }, kS: moyenneSimple(), dS: moyenneSimple(),
      rsiPrec: null, rsiU: lisseur(), rsiD: lisseur(), stR: { prec: null }, kR: moyenneSimple(), dR: moyenneSimple(),
      trur: lisseur(), dmP: lisseur(), dmM: lisseur(), fixP: null, fixM: null, adx: lisseur(),
      m12: lisseur(), m26: lisseur(), sig: lisseur(), e13: lisseur(), e50: lisseur(), a5: moyenneSimple(), a34: moyenneSimple(),
      u7: [somme(), somme()], u14: [somme(), somme()], u28: [somme(), somme()],
      hausses: 0, baisses: 0, dir: 0,
    },
    sorties: H,
  };
}

/** calcRatingAll() a la barre i : [osc, mas] (meme calcul que `notations`). */
function notationBarre(e, d, i) {
  const t = e.t, H = e.sorties, b = d[i], c = b.close, c1 = i > 0 ? d[i - 1].close : null;
  H.close[i] = c; H.high[i] = b.high; H.low[i] = b.low;
  // moyennes
  const notesMa = [];
  for (let k = 0; k < 6; k++) notesMa.push(noteMoyenne(moyenne(t.sma[k], c, LONGUEURS[k]), c));
  for (let k = 0; k < 6; k++) notesMa.push(noteMoyenne(lisser(t.ema[k], c, LONGUEURS[k], true), c));
  const dm = ponderee(t.hDemi, c, 4), pl = ponderee(t.hPlein, c, 9);
  notesMa.push(noteMoyenne(ponderee(t.hBrut, dm === null || pl === null ? null : 2 * dm - pl, 3), c));
  const vol = fini(b.volume) ? b.volume : null;
  const num = moyenne(t.vNum, vol === null ? null : c * vol, 20), den = moyenne(t.vDen, vol, 20);
  notesMa.push(noteMoyenne(num === null || den === null || den === 0 ? null : num / den, c));
  const tenkan = milieuBarre(d, i, 9), kijun = milieuBarre(d, i, 26), lead2 = milieuBarre(d, i, 52);
  H.lead1[i] = nul(tenkan) || nul(kijun) ? null : (tenkan + kijun) / 2; H.lead2[i] = lead2;
  const l1 = at(H.lead1, i - 26), l2 = at(H.lead2, i - 26);
  notesMa.push(note(lead2, sup(l1, l2) && sup(kijun, l1) && sup(tenkan, kijun) && sup(c, tenkan),
    inf(l1, l2) && inf(kijun, l1) && inf(tenkan, kijun) && inf(c, tenkan)));
  const rMa = moyenneSansNa(notesMa);
  // oscillateurs
  H.stoch[i] = stochastique(t.stK, H.close, H.high, H.low, i, 14);
  const k = moyenne(t.kS, H.stoch[i], 3), dd = moyenne(t.dS, k, 3);
  H.dStoch[i] = dd;
  let r = null;
  { const p = t.rsiPrec; t.rsiPrec = c;
    if (fini(c) && fini(p)) {
      const delta = c - p, g = lisser(t.rsiU, delta > 0 ? delta : 0, 14, false), l = lisser(t.rsiD, delta < 0 ? -delta : 0, 14, false);
      r = g === null || l === null ? null : l === 0 ? 100 : g === 0 ? 0 : 100 - 100 / (1 + g / l);
    } }
  H.r14[i] = r;
  const kSR = moyenne(t.kR, stochastique(t.stR, H.r14, H.r14, H.r14, i, 14), 3), dSR = moyenne(t.dR, kSR, 3);
  // dmi(14, 14)
  const up = i > 0 ? b.high - d[i - 1].high : null, down = i > 0 ? -(b.low - d[i - 1].low) : null;
  const plusDM = up === null ? null : (down !== null && up > down && up > 0 ? up : 0);
  const minusDM = down === null ? null : (up !== null && down > up && down > 0 ? down : 0);
  const trF = c1 === null ? null : Math.max(b.high - b.low, Math.abs(b.high - c1), Math.abs(b.low - c1));
  const trur = lisser(t.trur, trF, 14, false);
  const rp = lisser(t.dmP, plusDM, 14, false), rm = lisser(t.dmM, minusDM, 14, false);
  const ratio = (v) => (v === null || trur === null || trur === 0 ? null : (100 * v) / trur);
  const qp = ratio(rp), qm = ratio(rm);
  if (fini(qp)) t.fixP = qp;
  if (fini(qm)) t.fixM = qm;
  const diP = t.fixP, diN = t.fixM;
  const dx = diP === null || diN === null ? null : Math.abs(diP - diN) / (diP + diN === 0 ? 1 : diP + diN);
  const ax = lisser(t.adx, dx, 14, false);
  H.adx[i] = ax === null ? null : 100 * ax;
  // macd(12, 26, 9)
  const f12 = lisser(t.m12, c, 12, true), s26 = lisser(t.m26, c, 26, true);
  const macd = f12 === null || s26 === null ? null : f12 - s26, signal = lisser(t.sig, macd, 9, true);
  // cci(20) : fenetre refaite a chaque barre
  let cc = null;
  if (i >= 19) {
    let s = 0;
    for (let j = i - 19; j <= i; j++) s += d[j].close;
    const m = s / 20;
    let dv = 0;
    for (let j = i - 19; j <= i; j++) dv += Math.abs(d[j].close - m);
    dv /= 20;
    const x = dv === 0 ? 0 : (c - m) / (0.015 * dv);
    cc = fini(x) ? x : null;
  }
  H.cci[i] = cc;
  H.mom[i] = i >= 10 ? c - d[i - 10].close : null;
  const e13 = lisser(t.e13, c, 13, true), priceAvg = lisser(t.e50, c, 50, true);
  H.e13[i] = e13;
  // uo(7, 14, 28)
  H.trg[i] = c1 === null ? null : Math.max(b.high, c1) - Math.min(b.low, c1);
  H.bp[i] = c1 === null ? null : c - Math.min(b.low, c1);
  const u = (st, n) => { const a = sommer(st[0], H.bp, i, n), z = sommer(st[1], H.trg, i, n); return nul(a) || nul(z) ? null : a / z; };
  const u1 = u(t.u7, 7), u2 = u(t.u14, 14), u3 = u(t.u28, 28);
  const uo = nul(u1) || nul(u2) || nul(u3) ? null : (100 * (4 * u1 + 2 * u2 + u3)) / 7;
  // wpr(14) : fenetre refaite a chaque barre
  let wr = null;
  if (i >= 13) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - 13; j <= i; j++) { if (d[j].high > hh) hh = d[j].high; if (d[j].low < ll) ll = d[j].low; }
    wr = hh === ll ? 0 : (-100 * (hh - c)) / (hh - ll);
  }
  H.wr[i] = wr;
  const hl2 = (b.high + b.low) / 2, a5 = moyenne(t.a5, hl2, 5), a34 = moyenne(t.a34, hl2, 34);
  const ao = nul(a5) || nul(a34) ? null : a5 - a34;
  H.ao[i] = ao;
  const r1 = at(H.r14, i - 1), cc1 = at(H.cci, i - 1), a1 = at(H.ao, i - 1), a2 = at(H.ao, i - 2), a01 = at(H.adx, i - 1), a0 = H.adx[i];
  const xoAo = sup(ao, 0) && !nul(a1) && a1 <= 0, xuAo = inf(ao, 0) && !nul(a1) && a1 >= 0;
  const upP = sup(c, priceAvg), dnP = inf(c, priceAvg);
  const bear = nul(e13) ? null : b.low - e13, bear1 = i > 0 && !nul(H.e13[i - 1]) ? d[i - 1].low - H.e13[i - 1] : null;
  const bull = nul(e13) ? null : b.high - e13, bull1 = i > 0 && !nul(H.e13[i - 1]) ? d[i - 1].high - H.e13[i - 1] : null;
  const notesOsc = [
    note(r1, inf(r, 30) && inf(r1, r), sup(r, 70) && sup(r1, r)),
    note(at(H.dStoch, i - 1), inf(k, 20) && inf(dd, 20) && sup(k, dd), sup(k, 80) && sup(dd, 80) && inf(k, dd)),
    note(cc1, inf(cc, -100) && sup(cc, cc1), sup(cc, 100) && inf(cc, cc1)),
    note(a0, sup(a0, 20) && sup(a0, a01) && sup(diP, diN), sup(a0, 20) && sup(a0, a01) && inf(diP, diN)),
    note(a1, xoAo || (sup(ao, 0) && sup(a1, 0) && sup(ao, a1) && sup(a2, a1)), xuAo || (inf(ao, 0) && inf(a1, 0) && inf(ao, a1) && inf(a2, a1))),
    note(at(H.mom, i - 1), sup(H.mom[i], at(H.mom, i - 1)), inf(H.mom[i], at(H.mom, i - 1))),
    note(signal, sup(macd, signal), inf(macd, signal)),
    note(priceAvg, dnP && inf(kSR, 20) && inf(dSR, 20) && sup(kSR, dSR), upP && sup(kSR, 80) && sup(dSR, 80) && inf(kSR, dSR)),
    note(at(H.wr, i - 1), inf(wr, -80) && sup(wr, at(H.wr, i - 1)), sup(wr, -20) && inf(wr, at(H.wr, i - 1))),
    note(priceAvg, upP && inf(bear, 0) && sup(bear, bear1), dnP && sup(bull, 0) && inf(bull, bull1)),
    note(uo, sup(uo, 70), inf(uo, 30)),
  ];
  return [moyenneSansNa(notesOsc), rMa];
}

/** countRising : un etat par site d'appel ; `prec` = valeur masquee de la barre precedente. */
function monter(res, a, a1) {
  if (a === 0) return 0;
  if (a1 !== null && a >= a1) return res === null ? null : Math.min(5, res + 1);
  if (a1 !== null && a < a1) return res === null ? null : Math.max(1, res - 1);
  return null;
}

function etape(p, e, d, i, derniere, env) {
  const t = e.t, H = e.sorties;
  const [osc, mas] = notationBarre(e, d, i);
  const w = p.poidsMoyennes / 100;
  const tot = (nul(mas) ? 0 : mas * w) + (nul(osc) ? 0 : osc * (1 - w));
  const v = p.calcul === RT2 ? mas : p.calcul === RT3 ? osc : tot;
  H.tot[i] = tot; H.osc[i] = osc; H.mas[i] = mas; H.user[i] = v;
  const achat = sup(v, FAIBLE), vente = inf(v, -FAIBLE);
  const v1 = at(H.user, i - 1);
  const m1A = i > 0 ? (sup(v1, FAIBLE) ? v1 : 0) : null, m1V = i > 0 ? (inf(v1, -FAIBLE) ? v1 : 0) : null;
  t.hausses = monter(t.hausses, Math.abs(achat ? v : 0), m1A === null ? null : Math.abs(m1A));
  t.baisses = monter(t.baisses, Math.abs(vente ? v : 0), m1V === null ? null : Math.abs(m1V));
  const g = achat ? t.hausses : vente ? (t.baisses === null ? null : -t.baisses) : 0;
  H.niveau[i] = g;
  if (nul(g)) H.couleur[i] = transparence(p.couleurNeutre, 75);
  else {
    const col = g > 0 ? p.couleurHausse : g < 0 ? p.couleurBaisse : p.couleurNeutre;
    let tr = 100 - Math.abs(g) * 20;
    if (tr === 80) tr = 75;
    H.couleur[i] = memeCouleur(col, p.couleurNeutre) ? transparence(p.couleurNeutre, 75) : transparence(col, tr);
  }
  const doLongs = p.direction === TD1 || p.direction === TD3, doShorts = p.direction === TD2 || p.direction === TD3;
  const alt = p.alterner && p.direction === TD3;
  const xUp = sup(v, p.niveauAchat) && !nul(v1) && v1 <= p.niveauAchat && p.niveauAchat !== 0;
  const xDn = inf(v, p.niveauVente) && !nul(v1) && v1 >= p.niveauVente && p.niveauVente !== 0;
  const g1 = at(H.niveau, i - 1);
  const gUp = p.progression !== 0 && g === p.progression && inf(g1, p.progression);
  const gDn = p.progression !== 0 && g === -p.progression && sup(g1, -p.progression);
  const allowLong = !alt || t.dir === 0 || t.dir === -1, allowShort = !alt || t.dir === 0 || t.dir === 1;
  const allowAlert = p.repeindre || !derniere || env.derniereConfirmee;
  H.longs[i] = allowAlert && (xUp || gUp) && allowLong && doLongs;
  H.shorts[i] = allowAlert && (xDn || gDn) && allowShort && doShorts;
  H.alerte[i] = null;
  if (H.longs[i]) { H.alerte[i] = { time: d[i].time, message: p.messageAchat, freq: 'once_per_bar' }; t.dir = 1; } else if (H.shorts[i]) { H.alerte[i] = { time: d[i].time, message: p.messageVente, freq: 'once_per_bar' }; t.dir = -1; }
}

function rendre(p, d, s) {
  const n = d.length, o = creerObjets({ maxLignes: 500, maxEtiquettes: 500 });
  const last = n - 1;
  const ligneH = (y, couleur, style) => o.ligne({ x1: 0, y1: y, x2: last, y2: y, extend: 'both', couleur, style });
  ligneH(FORT, transparence(p.couleurHausse, 50), 'dashed');
  ligneH(FAIBLE, transparence(p.couleurHausse, 65), 'dashed');
  ligneH(0, transparence(GRIS, 50), 'dashed');
  ligneH(-FAIBLE, transparence(p.couleurBaisse, 75), 'dashed');
  ligneH(-FORT, transparence(p.couleurBaisse, 50), 'dashed');
  if (s.doLongs && p.niveauAchat !== 0) ligneH(p.niveauAchat, p.couleurHausse, 'dotted');
  if (s.doShorts && p.niveauVente !== 0) ligneH(p.niveauVente, p.couleurBaisse, 'dotted');
  const t1 = p.calcul === RT2 ? 'Moy.' : p.calcul === RT3 ? 'Osc.' : 'Tout', t2 = p.calcul === RT2 ? 'Osc.' : 'Moy.', t3 = p.calcul === RT1 ? 'Osc.' : 'Tout';
  const [r2, r3] = p.calcul === RT2 ? [s.osc, s.tot] : p.calcul === RT3 ? [s.mas, s.tot] : [s.mas, s.osc];
  const u = s.user[last];
  const imprimer = (txt, ligne, couleurTexte) => o.etiquette({
    x: last, y: 0, texte: '\n'.repeat(Math.max(0, ligne - 1)) + txt + '\n'.repeat(Math.max(0, 4 - ligne)),
    couleur: TRANSPARENT, style: 'label_left', couleurTexte, alignTexte: 'left',
  });
  imprimer(`  ${t1}:`, 1, ARGENT); imprimer(`  ${t2}:`, 2, GRIS); imprimer(`  ${t3}:`, 3, GRIS);
  imprimer(`      ${texteNote(u)}`, 1, couleurNote(u, p));
  imprimer(`      ${texteNote(r2[last])}`, 2, couleurNote(r2[last], p));
  imprimer(`      ${texteNote(r3[last])}`, 3, couleurNote(r3[last], p));
  for (let i = 0; i < n; i++) {
    if (s.longs[i]) o.plotchar(i, { position: 'bottom', caractere: '▲', couleur: p.couleurHausse, taille: 'tiny' });
    if (s.shorts[i]) o.plotchar(i, { position: 'top', caractere: '▼', couleur: p.couleurBaisse, taille: 'tiny' });
  }
  const colonnes = p.trace === 'Columns' || p.trace === 'Histogram';
  const points = d.map((b, i) => ({ time: b.time, value: nul(s.user[i]) ? null : s.user[i], color: s.couleurSignal[i] }));
  const vide = d.map((b) => ({ time: b.time, value: null }));
  const r = {
    colonnes: colonnes ? points : vide,
    ligne: colonnes ? vide : points.map((pt, i) => ({ ...pt, color: i + 1 < n ? s.couleurSignal[i + 1] : TRANSPARENT })),
    objets: o.resultat(),
  };
  r.alertes = s.alertes;
  return r;
}

export default class NotationTechniqueIndicator {
  static metadata = {
    id: 'notation_technique',
    name: 'Notation technique',
    shortName: 'NOTATION',
    description: 'notation_technique',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['notation', 'moyennes mobiles', 'oscillateurs', 'consensus', 'synthese'],
    inputs: INPUTS,
    outputs: [
      { id: 'colonnes', name: 'Notation (colonnes)', type: 'histogram', color: '#00ff00' },
      { id: 'ligne', name: 'Notation (ligne)', type: 'line', color: '#00ff00', lineWidth: 1 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { colonnes: [], ligne: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NotationTechniqueIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer: () => ({ o: creerObjets(), ...creerEtat() }),
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat, d) => {
        const H = etat.sorties;
        return rendre(p, d, {
          user: H.user, osc: H.osc, tot: H.tot, mas: H.mas, longs: H.longs, shorts: H.shorts, couleurSignal: H.couleur,
          alertes: H.alerte.filter(Boolean),
          doLongs: p.direction === TD1 || p.direction === TD3, doShorts: p.direction === TD2 || p.direction === TD3,
        });
      },
    });
  }
}
