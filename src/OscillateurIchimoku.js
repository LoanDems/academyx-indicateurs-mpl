// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Ichimoku Oscillator With Divergences [ChartPrime] » (titre du script : « Ichimoku Oscillator [ChartPrime] ») © ChartPrime — https://www.tradingview.com/script/y3NTW7he-Ichimoku-Oscillator-With-Divergences-ChartPrime/
// Adaptation : la ligne zero (hline) est en trait plein ; l'epaisseur du signal (2) est celle de sa sortie ; textes des divergences en francais ; les fill() de la plateforme
// sont des polygones (500 derniers segments). Calcul barre par barre (pasAPas.js), points stables.
import { creerObjets } from '../academyscript/objets.js';
import { wma, ema, sma, croisement, pas } from './pasAPas.js';
import { lireReglages, executer, contexte, transparence, remplir, suiteVide, pointsStables, bit, TRANSPARENT } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', LI = 'Lissage', NO = 'Normalisation', DV = 'Divergences', AF = 'Affichage', S = 'Style';
const INPUTS = [
  { id: 'source', name: 'Source du signal', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'conversion', name: 'Ligne de conversion', type: 'number', entier: true, default: 9, min: 1, max: 500, step: 1, group: P },
  { id: 'base', name: 'Ligne de base', type: 'number', entier: true, default: 26, min: 1, max: 500, step: 1, group: P },
  { id: 'spanB', name: 'Seconde ligne du nuage', type: 'number', entier: true, default: 52, min: 1, max: 500, step: 1, group: P },
  { id: 'decalage', name: 'Décalage', type: 'number', entier: true, default: 26, min: 1, max: 500, step: 1, group: P,
    description: 'Le nuage du moment est celui calculé ce nombre de barres plus tôt, moins une.' },
  { id: 'longueurMoyenne', name: 'Moyenne du signal', type: 'number', entier: true, default: 12, min: 1, max: 500, step: 1, group: P },
  { id: 'lissage', name: 'Lissage', type: 'number', entier: true, default: 3, min: 1, max: 100, step: 1, group: LI,
    description: 'Longueur du filtre de Tchebychev appliqué au nuage, au signal et aux lignes.' },
  { id: 'lissageGaussien', name: 'Lissage supplémentaire', type: 'boolean', default: true, group: LI },
  { id: 'normalisation', name: 'Normalisation', type: 'select', default: 'Window', group: NO,
    options: [{ label: 'Tout l’historique', value: 'All' }, { label: 'Fenêtre', value: 'Window' }, { label: 'Aucune', value: 'Disabled' }],
    description: 'Ramène le signal entre -100 et +100 selon son écart quadratique (sur la fenêtre ou depuis le début).' },
  { id: 'fenetre', name: 'Fenêtre de normalisation', type: 'number', entier: true, default: 20, min: 5, max: 1000, step: 1, group: NO },
  { id: 'borner', name: 'Borner à ±100', type: 'boolean', default: true, group: NO },
  { id: 'bandeMax', name: 'Bande extrême (écarts)', type: 'number', default: 2, min: 0, max: 10, step: 0.25, group: NO },
  { id: 'bandeMoyenne', name: 'Bande intermédiaire (écarts)', type: 'number', default: 1.5, min: 0, max: 10, step: 0.25, group: NO },
  { id: 'droite', name: 'Barres à droite du pivot', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: DV },
  { id: 'gauche', name: 'Barres à gauche du pivot', type: 'number', entier: true, default: 15, min: 0, max: 100, step: 1, group: DV },
  { id: 'ecartMax', name: 'Écart maximal entre pivots', type: 'number', entier: true, default: 100, min: 0, max: 1000, step: 1, group: DV },
  { id: 'ecartMin', name: 'Écart minimal entre pivots', type: 'number', entier: true, default: 5, min: 0, max: 1000, step: 1, group: DV },
  { id: 'etiquettes', name: 'Étiquettes', type: 'select', default: 'Symbol', group: DV,
    options: [{ label: 'Aucune', value: 'Disabled' }, { label: 'Symbole', value: 'Symbol' }, { label: 'Texte', value: 'Text' }] },
  { id: 'divHaussiere', name: 'Divergence haussière', type: 'boolean', default: true, group: DV },
  { id: 'divHaussiereCachee', name: 'Divergence haussière cachée', type: 'boolean', default: false, group: DV },
  { id: 'divBaissiere', name: 'Divergence baissière', type: 'boolean', default: true, group: DV },
  { id: 'divBaissiereCachee', name: 'Divergence baissière cachée', type: 'boolean', default: false, group: DV },
  { id: 'afficherSignal', name: 'Signal', type: 'boolean', default: true, group: AF },
  { id: 'afficherChikou', name: 'Chikou', type: 'boolean', default: false, group: AF },
  { id: 'afficherConversionBase', name: 'Conversion et base', type: 'boolean', default: false, group: AF },
  { id: 'afficherMoyenne', name: 'Moyenne du signal', type: 'boolean', default: false, group: AF },
  { id: 'afficherBandes', name: 'Bandes', type: 'boolean', default: true, group: AF },
  { id: 'nuage', name: 'Nuage', type: 'select', default: 'Full', group: AF,
    options: [{ label: 'Projeté (en avance)', value: 'Full' }, { label: 'Du moment', value: 'Current' }, { label: 'Masqué', value: 'Disabled' }] },
  { id: 'lignesNuage', name: 'Bords du nuage', type: 'boolean', default: false, group: AF },
  { id: 'couleurParConversion', name: 'Signal coloré par conversion / base', type: 'boolean', default: true, group: S },
  { id: 'couleurSignal', name: 'Signal', type: 'color', default: '#F36B16', group: S },
  { id: 'couleurNuageHausse', name: 'Nuage haussier', type: 'color', default: '#22EA70', group: S },
  { id: 'couleurNuageBaisse', name: 'Nuage baissier', type: 'color', default: '#FF2F1C', group: S },
  { id: 'opaciteNuage', name: 'Opacité du nuage', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurChikou', name: 'Chikou', type: 'color', default: '#787B86', group: S },
  { id: 'couleurConversion', name: 'Conversion', type: 'color', default: '#79D8E0', group: S },
  { id: 'couleurBase', name: 'Base', type: 'color', default: '#E462B2', group: S },
  { id: 'couleurConversionHausse', name: 'Signal au-dessus, conversion > base', type: 'color', default: '#1c7a24', group: S },
  { id: 'couleurBaseHausse', name: 'Signal au-dessus, conversion < base', type: 'color', default: '#64a568', group: S },
  { id: 'couleurConversionBaisse', name: 'Signal en dessous, conversion > base', type: 'color', default: '#df8c8c', group: S },
  { id: 'couleurBaseBaisse', name: 'Signal en dessous, conversion < base', type: 'color', default: '#ff4444', group: S },
  { id: 'couleurNeutre', name: 'Signal dans le nuage', type: 'color', default: '#F2DB2E', group: S },
  { id: 'opaciteConversionBase', name: 'Opacité conversion / base', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurMoyenne', name: 'Moyenne du signal', type: 'color', default: '#5398ff', group: S },
  { id: 'couleurMax', name: 'Bande haute extrême', type: 'color', default: '#5C9970', group: S },
  { id: 'couleurHaut', name: 'Bande haute', type: 'color', default: '#32533D', group: S },
  { id: 'opaciteHaut', name: 'Opacité de la zone haute', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurMin', name: 'Bande basse extrême', type: 'color', default: '#DD6055', group: S },
  { id: 'couleurBas', name: 'Bande basse', type: 'color', default: '#CF3729', group: S },
  { id: 'opaciteBas', name: 'Opacité de la zone basse', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurTexte', name: 'Texte des étiquettes', type: 'color', default: '#111122', group: S },
  { id: 'couleurDivHaussiere', name: 'Divergence haussière', type: 'color', default: '#46c47a', group: S },
  { id: 'couleurDivHaussiereCachee', name: 'Divergence haussière cachée', type: 'color', default: '#802ac7', group: S },
  { id: 'couleurDivBaissiere', name: 'Divergence baissière', type: 'color', default: '#f82e2e', group: S },
  { id: 'couleurDivBaissiereCachee', name: 'Divergence baissière cachée', type: 'color', default: '#3176f5', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const fin = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const cosh = (x) => (Math.exp(x) + Math.exp(-x)) / 2, sinh = (x) => (Math.exp(x) - Math.exp(-x)) / 2;
const acosh = (x) => (x < 1 ? null : Math.log(x + Math.sqrt(x * x - 1))), asinh = (x) => Math.log(x + Math.sqrt(x * x + 1));
const gauss = (x, bw) => Math.exp(-Math.pow(x / bw, 2) / 2) / Math.sqrt(2 * Math.PI);
const NOYAU = [0, 1, 2, 3, 4].map((i) => gauss(Math.pow(i, 2) / (Math.pow(2, 2) * 1), 1));
const ALERTES = [
  ['entree_nuage', 'Signal dans le nuage'], ['sortie_nuage_haut', 'Signal au-dessus du nuage'], ['sortie_nuage_bas', 'Signal sous le nuage'],
  ['nuage_futur_hausse', 'Nuage projeté : croisement haussier'], ['nuage_futur_baisse', 'Nuage projeté : croisement baissier'],
  ['nuage_hausse', 'Nuage du moment : croisement haussier'], ['nuage_baisse', 'Nuage du moment : croisement baissier'],
  ['conversion_base_hausse', 'Conversion au-dessus de la base'], ['conversion_base_baisse', 'Conversion sous la base'],
  ['signal_conversion_base_hausse', 'Signal au-dessus de conversion et base'], ['signal_conversion_base_baisse', 'Signal sous conversion et base'],
  ['chikou_hausse', 'Chikou au-dessus de zéro'], ['chikou_baisse', 'Chikou sous zéro'],
  ['signal_max', 'Signal au-dessus de la bande extrême'], ['signal_haut', 'Signal au-dessus de la bande haute'],
  ['signal_min', 'Signal sous la bande extrême basse'], ['signal_bas', 'Signal sous la bande basse'],
  ['chikou_max', 'Chikou au-dessus de la bande extrême'], ['chikou_haut', 'Chikou au-dessus de la bande haute'],
  ['chikou_min', 'Chikou sous la bande extrême basse'], ['chikou_bas', 'Chikou sous la bande basse'],
  ['signal_moyenne_hausse', 'Signal au-dessus de sa moyenne'], ['signal_moyenne_baisse', 'Signal sous sa moyenne'],
  ['div_haussiere', 'Divergence haussière'], ['div_haussiere_cachee', 'Divergence haussière cachée'],
  ['div_baissiere', 'Divergence baissière'], ['div_baissiere_cachee', 'Divergence baissière cachée'],
  ['rebond_haut', 'Rebond sur le nuage vers le haut'], ['rebond_bas', 'Rebond sur le nuage vers le bas'],
].map(([id, t]) => [`ichimoku_osc_${id}`, t]);
// croisements : [a, b, sens] dans l'ordre des alertes 1..23 (les memes paires servent au rebond)
const CROIS = ['sigKmin+', 'sigKmax-', 'sigKmax+', 'sigKmin-', 'kab+', 'kab-', 'kabo+', 'kabo-', 'cb+', 'cb-', 'sigCbMax+', 'sigCbMin-', 'ch0+', 'ch0-',
  'sigMax+', 'sigHigh+', 'sigMin-', 'sigLow-', 'chMax+', 'chHigh+', 'chMin-', 'chLow-', 'sigMa+', 'sigMa-'];

function creer(p, S) {
  const L = p.lissage, a = cosh(1 / L * acosh(1 / (1 - 0.5))), b = sinh(1 / L * asinh(1 / 0.5));
  const m = { ma: wma(S, p.longueurMoyenne), rma: ema(50, { rma: true }), sma: sma(S, 10), x: {} };
  for (const c of CROIS) m.x[c] = croisement(c.endsWith('+') ? 1 : -1);
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500, maxPolylignes: 500 }), sorties: S, m, c: (a - b) / (a + b),
    drapeau: 0, cumC: 0, cumN: 0, somme: 0,
    pl: { bs: null, vS: [], vP: [] }, ph: { bs: null, vS: [], vP: [] },
    cb: 0, cbi: 0, lb: 0, lbi: 0, chb: 0, chbi: 0, lhb: 0, lhbi: 0, cbe: 0, cbei: 0, lbe: 0, lbei: 0, chbe: 0, chbei: 0, lhbe: 0, lhbei: 0,
    fK: suiteVide(), fH: suiteVide(), fB: suiteVide(), fC: suiteVide(),
  };
}

/** smoothing() du script : filtre de Tchebychev (etat = sa sortie precedente) puis, en option, noyau gaussien sur 5 barres. */
function lisser(p, e, S, cle, i, x) {
  const H = S[cle] || (S[cle] = []), pr = i > 0 ? H[i - 1] : null;
  H[i] = nul(x) ? null : (1 - e.c) * x + e.c * (nul(pr) ? 0 : pr);
  if (!p.lissageGaussien) return H[i];
  let w = 0, ws = 0;
  for (let k = 0; k <= 4; k++) {
    const v = i - k >= 0 ? H[i - k] : null;
    if (nul(v)) return null;
    w = w + v * NOYAU[k]; ws = ws + NOYAU[k];
  }
  return w / ws;
}

function minMax(p, x, mn, mx) {
  if (p.normalisation === 'Disabled') return fin(x);
  if (nul(x) || nul(mn) || nul(mx)) return null;
  // (x - min) / (max - min) : division par zero = na (dev nul), avant le bornage.
  const r = fin((x - mn) / (mx - mn));
  if (r === null) return null;
  return fin(p.borner ? (Math.max(Math.min(1, r), 0) - 0.5) * 200 : (r - 0.5) * 200);
}

function extreme(H, i, L, haut) {
  if (i < L - 1) return null;
  let r = null;
  for (let k = 0; k < L; k++) { const v = H[i - k]; if (nul(v)) break; if (r === null || (haut ? v > r : v < r)) r = v; }
  return r;
}

function pivot(H, i, gauche, droite, haut) {
  if (i < gauche + droite) return false;
  const c = H[i - droite];
  if (nul(c)) return false;
  for (let j = 1; j <= gauche; j++) { const v = H[i - droite - j]; if (nul(v)) break; if (haut ? v > c : v < c) return false; }
  for (let j = 1; j <= droite; j++) { const v = H[i - droite + j]; if (nul(v)) break; if (haut ? v >= c : v <= c) return false; }
  return true;
}

function etape(p, e, d, i, derniere, env) {
  const S = e.sorties, m = e.m, b = d[i], src = choix[p.source](b), D = p.decalage - 1;
  for (const k of ['ka', 'kb', 'ctr', 'src', 'minL', 'maxL', 'ns', 'sq', 'kAs', 'kBs', 'kCs', 'out']) if (!S[k]) S[k] = [];
  if (!S.v) S.v = {};
  const don = (L) => {
    if (i < L - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let k = 0; k < L; k++) { const x = d[i - k]; if (x.high > hh) hh = x.high; if (x.low < ll) ll = x.low; }
    return (ll + hh) / 2;
  };
  S.src[i] = src;
  const conv = don(p.conversion), base = don(p.base), lag = don(p.spanB);
  const ka = lisser(p, e, S, '_ka', i, nul(conv) || nul(base) ? null : (conv + base) / 2), kb = lisser(p, e, S, '_kb', i, lag);
  S.ka[i] = ka; S.kb[i] = kb;
  const kaO = i - D >= 0 ? S.ka[i - D] : null, kbO = i - D >= 0 ? S.kb[i - D] : null;
  const ctr = nul(ka) || nul(kb) ? null : (ka + kb) / 2;
  S.ctr[i] = ctr;
  const ctrO = i - D >= 0 ? S.ctr[i - D] : null;
  const kaC = nul(ka) || nul(ctr) ? null : ka - ctr, kbC = nul(kb) || nul(ctr) ? null : kb - ctr;
  const kaOC = nul(kaO) || nul(ctrO) ? null : kaO - ctrO, kbOC = nul(kbO) || nul(ctrO) ? null : kbO - ctrO;
  const chik = i - (p.decalage + 1) >= 0 ? S.src[i - (p.decalage + 1)] : null;
  const chC = lisser(p, e, S, '_ch', i, nul(chik) ? null : src - chik);
  const cbCond = gt(conv, base);
  const convC = lisser(p, e, S, '_cv', i, nul(conv) || nul(ctrO) ? null : conv - ctrO);
  const baseC = lisser(p, e, S, '_bs', i, nul(base) || nul(ctrO) ? null : base - ctrO);
  const sig = lisser(p, e, S, '_sg', i, nul(ctrO) ? null : src - ctrO);
  const ma = pas(S, m.ma, i, sig);
  // var float dev : cumul conditionnel (All), somme glissante (Window, na compte pour 0), ou 0.
  const sq = nul(sig) ? null : Math.pow(sig, 2);
  S.sq[i] = sq;
  let dev;
  if (p.normalisation === 'All' && !nul(kaO)) {
    e.cumN += 1;
    if (sq !== null) e.cumC += sq;
    dev = sq === null ? null : fin(Math.sqrt(e.cumC / e.cumN));
  } else if (p.normalisation === 'Window') {
    const L = p.fenetre;
    e.somme += sq === null ? 0 : sq;
    if (i >= L) { const ancien = S.sq[i - L]; e.somme -= ancien === null ? 0 : ancien; }
    dev = i >= L - 1 ? fin(Math.sqrt(e.somme / (L - 1))) : null;
  } else dev = 0;
  const maxL = dev === null ? null : dev * p.bandeMax, minL = dev === null ? null : -dev * p.bandeMax;
  const hiL = dev === null ? null : dev * p.bandeMoyenne, loL = dev === null ? null : -dev * p.bandeMoyenne;
  S.minL[i] = minL; S.maxL[i] = maxL;
  const full = p.nuage === 'Current', cur = p.nuage === 'Full';
  const kk = full ? D : 0, off = full ? 0 : D;
  const psA = full ? kaOC : cur ? kaC : null, psB = full ? kbOC : cur ? kbC : null;
  const colK = full ? (gt(kaO, kbO) ? p.couleurNuageHausse : p.couleurNuageBaisse) : cur ? (gt(ka, kb) ? p.couleurNuageHausse : p.couleurNuageBaisse) : null;
  const mnK = i - kk >= 0 ? S.minL[i - kk] : null, mxK = i - kk >= 0 ? S.maxL[i - kk] : null;
  const nA = minMax(p, psA, mnK, mxK), nB = minMax(p, psB, mnK, mxK);
  const nMax = minMax(p, maxL, minL, maxL), nHigh = minMax(p, hiL, minL, maxL), nMin = minMax(p, minL, minL, maxL), nLow = minMax(p, loL, minL, maxL);
  const nConv = minMax(p, convC, minL, maxL), nBase = minMax(p, baseC, minL, maxL), nCh = minMax(p, chC, minL, maxL), nMa = minMax(p, ma, minL, maxL);
  const nSig = minMax(p, sig, minL, maxL);
  const mnD = i - D >= 0 ? S.minL[i - D] : null, mxD = i - D >= 0 ? S.maxL[i - D] : null;
  const nkA = minMax(p, kaOC, mnD, mxD), nkB = minMax(p, kbOC, mnD, mxD);
  const kMax = nul(nkA) || nul(nkB) ? null : Math.max(nkA, nkB), kMin = nul(nkA) || nul(nkB) ? null : Math.min(nkA, nkB);
  const cbMax = nul(nConv) || nul(nBase) ? null : Math.max(nConv, nBase), cbMin = nul(nConv) || nul(nBase) ? null : Math.min(nConv, nBase);
  const cbCol = !nul(nSig) && !nul(kMax) && nSig >= kMax ? (cbCond ? p.couleurConversionHausse : p.couleurBaseHausse)
    : !nul(nSig) && !nul(kMin) && nSig <= kMin ? (cbCond ? p.couleurConversionBaisse : p.couleurBaseBaisse) : p.couleurNeutre;
  const mainCol = p.couleurParConversion ? cbCol : p.couleurSignal;
  const X = {};
  const paire = { sigKmin: [nSig, kMin], sigKmax: [nSig, kMax], kab: [ka, kb], kabo: [kaO, kbO], cb: [nConv, nBase], sigCbMax: [nSig, cbMax], sigCbMin: [nSig, cbMin],
    ch0: [nCh, 0], sigMax: [nSig, nMax], sigHigh: [nSig, nHigh], sigMin: [nSig, nMin], sigLow: [nSig, nLow], chMax: [nCh, nMax], chHigh: [nCh, nHigh],
    chMin: [nCh, nMin], chLow: [nCh, nLow], sigMa: [nSig, nMa] };
  for (const c of CROIS) { const [a, bb] = paire[c.slice(0, -1)]; X[c] = pas(S, m.x[c], i, a, bb); }
  let rebondHaut = false, rebondBas = false;
  if (X['sigKmax-'] && e.drapeau === 0) e.drapeau = 1;
  if (X['sigKmin-'] && e.drapeau === 1) e.drapeau = 0;
  if (X['sigKmin+'] && e.drapeau === 0) e.drapeau = -1;
  if (X['sigKmin+'] && e.drapeau === -1) e.drapeau = 0;
  if (X['sigKmax+'] && e.drapeau === 1) { rebondHaut = true; e.drapeau = 0; }
  if (X['sigKmin-'] && e.drapeau === -1) { rebondBas = true; e.drapeau = 0; }

  // Sorties (valeurs et couleurs par barre ; le nuage est decale de `off` barres).
  const V = S.v, put = (k, v) => { (V[k] || (V[k] = []))[i] = v; };
  S.kAs[i + off] = nA; S.kBs[i + off] = nB; S.kCs[i + off] = colK;
  const bandes = p.afficherBandes && p.normalisation !== 'Disabled', cbv = p.afficherConversionBase;
  put('max', bandes ? nMax : null); put('haut', bandes ? nHigh : null); put('min', bandes ? nMin : null); put('bas', bandes ? nLow : null);
  put('conv', cbv ? nConv : null); put('base', cbv ? nBase : null);
  put('chikou', p.afficherChikou && i >= p.spanB + p.decalage - 1 ? nCh : null);
  put('moyenne', p.afficherMoyenne ? nMa : null);
  put('signal', p.afficherSignal ? nSig : null); put('cSignal', mainCol); put('cbCol', cbCol);
  const o = e.o;
  remplir(o, e.fK, S.kAs, S.kBs, i + off, transparence(colK, 100 - p.opaciteNuage), derniere);
  remplir(o, e.fH, V.max, V.haut, i, transparence(p.couleurMax, 100 - p.opaciteHaut), derniere);
  remplir(o, e.fB, V.min, V.bas, i, transparence(p.couleurMin, 100 - p.opaciteBas), derniere);
  remplir(o, e.fC, V.conv, V.base, i, transparence(cbCol, 100 - p.opaciteConversionBase), derniere);

  // divergence(min_max(signal)) : pivots du signal normalise, repeint seulement sur une barre confirmee.
  S.ns[i] = nSig;
  const R = p.droite, ok = !derniere || env.derniereConfirmee;
  const pl = pivot(S.ns, i, p.gauche, R, false), ph = pivot(S.ns, i, p.gauche, R, true);
  const sR = i - R >= 0 ? S.ns[i - R] : null, lowR = i - R >= 0 ? d[i - R].low : null, highR = i - R >= 0 ? d[i - R].high : null;
  const pl1 = S.pl1 || (S.pl1 = []), ph1 = S.ph1 || (S.ph1 = []);
  pl1[i] = pl; ph1[i] = ph;
  const dans = (z, prec) => { z.bs = prec ? 0 : z.bs === null ? null : z.bs + 1; return z.bs !== null && p.ecartMin <= z.bs && z.bs <= p.ecartMax; };
  const inL = dans(e.pl, i > 0 && pl1[i - 1]), inH = dans(e.ph, i > 0 && ph1[i - 1]);
  const vw = (z, vrai, vs, vp) => { if (vrai) { z.vS.unshift(nul(vs) ? null : vs); z.vP.unshift(nul(vp) ? null : vp); z.vS.length = Math.min(z.vS.length, 2); z.vP.length = Math.min(z.vP.length, 2); } return [z.vS[1] ?? null, z.vP[1] ?? null]; };
  const [lS, lP] = vw(e.pl, pl, sR, lowR), [hS, hP] = vw(e.ph, ph, sR, highR);
  const rb = p.divHaussiere && lt(lowR, lP) && gt(sR, lS) && inL && pl && ok;
  const hb = p.divHaussiereCachee && gt(lowR, lP) && lt(sR, lS) && inL && pl && ok;
  const rbe = p.divBaissiere && gt(highR, hP) && lt(sR, hS) && inH && ph && ok;
  const hbe = p.divBaissiereCachee && lt(highR, hP) && gt(sR, hS) && inH && ph && ok;
  if (pl) { e.lb = e.cb; e.lbi = e.cbi; e.cb = sR; e.cbi = i - R; e.lhb = e.chb; e.lhbi = e.chbi; e.chb = sR; e.chbi = i - R; }
  if (ph) { e.lbe = e.cbe; e.lbei = e.cbei; e.cbe = sR; e.cbei = i - R; e.lhbe = e.chbe; e.lhbei = e.chbei; e.chbe = sR; e.chbei = i - R; }
  const txt = p.etiquettes === 'Text';
  const stH = txt ? 'label_up' : p.etiquettes === 'Symbol' ? 'triangleup' : 'none', stB = txt ? 'label_down' : p.etiquettes === 'Symbol' ? 'triangledown' : 'none';
  const taille = txt ? 'small' : p.etiquettes === 'Symbol' ? 'tiny' : 'auto';
  const hh = extreme(S.ns, i, 10, true), ll = extreme(S.ns, i, 10, false);
  const r50 = pas(S, m.rma, i, nul(hh) || nul(ll) ? null : hh - ll);
  const sAtr = pas(S, m.sma, i, nul(r50) ? null : r50 / (txt ? 4 : 1));
  const etiq = (y, texte, c, st) => { if (p.etiquettes !== 'Disabled') o.etiquette({ x: i - R, y, texte: txt ? texte : '', couleur: c, couleurTexte: p.couleurTexte, style: st, taille }); };
  const yH = nul(sR) || nul(sAtr) ? null : sR - sAtr, yB = nul(sR) || nul(sAtr) ? null : sR + sAtr;
  if (rb) { o.ligne({ x1: e.lbi, y1: e.lb, x2: e.cbi, y2: e.cb, epaisseur: 2, couleur: p.couleurDivHaussiere }); etiq(yH, 'Haussière', p.couleurDivHaussiere, stH); }
  if (hb) { o.ligne({ x1: e.lhbi, y1: e.lhb, x2: e.chbi, y2: e.chb, epaisseur: 2, couleur: p.couleurDivHaussiereCachee }); etiq(yH, 'Haussière cachée', p.couleurDivHaussiereCachee, stH); }
  if (rbe) { o.ligne({ x1: e.lbei, y1: e.lbe, x2: e.cbei, y2: e.cbe, epaisseur: 2, couleur: p.couleurDivBaissiere }); etiq(yB, 'Baissière', p.couleurDivBaissiere, stB); }
  if (hbe) { o.ligne({ x1: e.lhbei, y1: e.lhbe, x2: e.chbei, y2: e.chbe, epaisseur: 2, couleur: p.couleurDivBaissiereCachee }); etiq(yB, 'Baissière cachée', p.couleurDivBaissiereCachee, stB); }

  const al = [X['sigKmin+'] || X['sigKmax-'], X['sigKmax+'], X['sigKmin-'], X['kab+'], X['kab-'], X['kabo+'], X['kabo-'], X['cb+'], X['cb-'], X['sigCbMax+'], X['sigCbMin-'],
    X['ch0+'], X['ch0-'], X['sigMax+'], X['sigHigh+'], X['sigMin-'], X['sigLow-'], X['chMax+'], X['chHigh+'], X['chMin-'], X['chLow-'], X['sigMa+'], X['sigMa-'],
    rb, hb, rbe, hbe, rebondHaut, rebondBas];
  let msk = 0;
  for (let k = 0; k < al.length; k++) if (al[k]) msk |= 1 << k;
  S.out[i] = msk;
}

/** Point j d'un plot() decale de `off` barres : valeur de la barre j - off, couleur de la barre suivante. */
function point(d, vals, cols, j, off) {
  const s = j - off, v = s >= 0 ? vals[s] : null;
  const pt = { time: d[j].time, value: nul(v) ? null : v };
  if (cols) { const sv = s + 1 >= 0 ? vals[s + 1] : null; pt.color = (!nul(sv) && (typeof cols === 'string' ? cols : cols[s + 1])) || TRANSPARENT; }
  return pt;
}

function rendre(p, e, d) {
  const S = e.sorties, V = S.v, n = d.length;
  const st = (cle, vals, cols, o = 0) => pointsStables(S, `_p${cle}`, n, n - 2 - o, (j) => point(d, vals, cols, j, o));
  const bordH = p.lignesNuage ? p.couleurNuageHausse : TRANSPARENT, bordB = p.lignesNuage ? p.couleurNuageBaisse : TRANSPARENT;
  return {
    nuageHaut: st('kA', S.kAs, bordH), nuageBas: st('kB', S.kBs, bordB),
    max: st('max', V.max, p.couleurMax), haut: st('haut', V.haut, p.couleurHaut), min: st('min', V.min, p.couleurMin), bas: st('bas', V.bas, p.couleurBas),
    conversion: st('conv', V.conv, p.couleurConversion), base: st('base', V.base, p.couleurBase),
    chikou: st('chikou', V.chikou, p.couleurChikou), moyenne: st('moyenne', V.moyenne, p.couleurMoyenne),
    signal: st('signal', V.signal, V.cSignal),
    zero: pointsStables(S, '_z', n, n, (j) => ({ time: d[j].time, value: 0 })),
    signaux: pointsStables(S, '_s', n, n - 1, (j) => ({ time: d[j].time, value: S.out[j] ? S.out[j] : null })),
    objets: e.o.resultat(),
  };
}

export default class OscillateurIchimokuIndicator {
  static metadata = {
    id: 'oscillateur_ichimoku',
    name: 'Oscillateur Ichimoku et divergences',
    shortName: 'OSC-ICHI',
    description: 'oscillateur_ichimoku',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['ichimoku', 'nuage', 'oscillateur', 'divergence', 'normalisation'],
    inputs: INPUTS,
    outputs: [
      { id: 'signal', name: 'Signal', type: 'line', color: '#F36B16', lineWidth: 2, reglageCouleur: 'couleurSignal' },
      { id: 'nuageHaut', name: 'Nuage (bord haut)', type: 'line', color: '#22EA70', lineWidth: 1 },
      { id: 'nuageBas', name: 'Nuage (bord bas)', type: 'line', color: '#FF2F1C', lineWidth: 1 },
      { id: 'max', name: 'Bande haute extrême', type: 'line', color: '#5C9970', lineWidth: 1 },
      { id: 'haut', name: 'Bande haute', type: 'line', color: '#32533D', lineWidth: 1 },
      { id: 'min', name: 'Bande basse extrême', type: 'line', color: '#DD6055', lineWidth: 1 },
      { id: 'bas', name: 'Bande basse', type: 'line', color: '#CF3729', lineWidth: 1 },
      { id: 'conversion', name: 'Conversion', type: 'line', color: '#79D8E0', lineWidth: 1 },
      { id: 'base', name: 'Base', type: 'line', color: '#E462B2', lineWidth: 1 },
      { id: 'chikou', name: 'Chikou', type: 'line', color: '#787B86', lineWidth: 1 },
      { id: 'moyenne', name: 'Moyenne du signal', type: 'line', color: '#5398ff', lineWidth: 2 },
      { id: 'zero', name: 'Zéro', type: 'line', color: '#787B86', lineWidth: 1 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { signal: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(OscillateurIchimokuIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer: () => creer(p, {}),
      etape: (e, d, i, derniere) => etape(p, e, d, i, derniere, env),
      rendre: (e, d) => rendre(p, e, d),
    });
  }
}
