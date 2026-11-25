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

/** calcRatingAll() de TechnicalRating/3 : [total, oscillateurs, moyennes]. */
function notations(d) {
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

/** countRising(plot) de TechnicalRating/3 (un `var` par site d'appel). */
function compter(valeurs) {
  let res = 0;
  return valeurs.map((v, i) => {
    const a = Math.abs(v), a1 = i > 0 ? Math.abs(valeurs[i - 1]) : null;
    if (a === 0) res = 0;
    else if (a1 !== null && a >= a1) res = res === null ? null : Math.min(5, res + 1);
    else if (a1 !== null && a < a1) res = res === null ? null : Math.max(1, res - 1);
    else res = null;
    return res;
  });
}

const couleurNote = (r, p) => (sup(r, FORT) ? transparence(p.couleurHausse, 20) : sup(r, FAIBLE) ? transparence(p.couleurHausse, 40)
  : inf(r, -FORT) ? transparence(p.couleurBaisse, 20) : inf(r, -FAIBLE) ? transparence(p.couleurBaisse, 40) : transparence(p.couleurNeutre, 20));
const texteNote = (r) => (sup(r, FORT) ? 'Achat fort' : sup(r, FAIBLE) ? 'Achat' : inf(r, -FORT) ? 'Vente forte' : inf(r, -FAIBLE) ? 'Vente' : 'Neutre');
const memeCouleur = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

function series(p, d, env) {
  const n = d.length;
  const { tot: totLib, osc, mas } = notations(d);
  const w = p.poidsMoyennes / 100;
  // ratingTotChart = nz(ratingMasChart * maInput) + nz(ratingOscChart * (1.0 - maInput))
  const tot = mas.map((m, i) => (nul(m) ? 0 : m * w) + (nul(osc[i]) ? 0 : osc[i] * (1 - w)));
  void totLib;
  const user = p.calcul === RT2 ? mas : p.calcul === RT3 ? osc : tot;
  const achat = user.map((v) => sup(v, FAIBLE)), vente = user.map((v) => inf(v, -FAIBLE));
  const hausses = compter(user.map((v, i) => (achat[i] ? v : 0))), baisses = compter(user.map((v, i) => (vente[i] ? v : 0)));
  const niveau = user.map((_, i) => (achat[i] ? hausses[i] : vente[i] ? (baisses[i] === null ? null : -baisses[i]) : 0));
  const couleurSignal = niveau.map((g) => {
    if (nul(g)) return transparence(p.couleurNeutre, 75);
    const col = g > 0 ? p.couleurHausse : g < 0 ? p.couleurBaisse : p.couleurNeutre;
    let t = 100 - Math.abs(g) * 20;
    if (t === 80) t = 75;
    return memeCouleur(col, p.couleurNeutre) ? transparence(p.couleurNeutre, 75) : transparence(col, t);
  });
  const doLongs = p.direction === TD1 || p.direction === TD3, doShorts = p.direction === TD2 || p.direction === TD3;
  const alt = p.alterner && p.direction === TD3;
  let lastDir = 0;
  const longs = new Array(n).fill(false), shorts = new Array(n).fill(false), alertes = [];
  for (let i = 0; i < n; i++) {
    const v = user[i], v1 = at(user, i - 1);
    const xUp = sup(v, p.niveauAchat) && !nul(v1) && v1 <= p.niveauAchat && p.niveauAchat !== 0;
    const xDn = inf(v, p.niveauVente) && !nul(v1) && v1 >= p.niveauVente && p.niveauVente !== 0;
    const g = niveau[i], g1 = at(niveau, i - 1);
    const gUp = p.progression !== 0 && g === p.progression && inf(g1, p.progression);
    const gDn = p.progression !== 0 && g === -p.progression && sup(g1, -p.progression);
    const allowLong = !alt || lastDir === 0 || lastDir === -1, allowShort = !alt || lastDir === 0 || lastDir === 1;
    const allowAlert = p.repeindre || i < n - 1 || env.derniereConfirmee;
    longs[i] = allowAlert && (xUp || gUp) && allowLong && doLongs;
    shorts[i] = allowAlert && (xDn || gDn) && allowShort && doShorts;
    if (longs[i]) { alertes.push({ time: d[i].time, message: p.messageAchat, freq: 'once_per_bar' }); lastDir = 1; } else if (shorts[i]) { alertes.push({ time: d[i].time, message: p.messageVente, freq: 'once_per_bar' }); lastDir = -1; }
  }
  return { tot, osc, mas, user, couleurSignal, longs, shorts, alertes, doLongs, doShorts };
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
      creer: () => ({ o: creerObjets() }),
      series: (d) => series(p, d, env),
      etape: () => {},
      rendre: (etat, d, s) => rendre(p, d, s),
    });
  }
}
