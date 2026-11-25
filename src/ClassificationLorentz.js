// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Machine Learning: Lorentzian Classification » © jdehorty — https://www.tradingview.com/script/WhBzgfDu-Machine-Learning-Lorentzian-Classification/
// avec les bibliotheques qu'il importe, aux versions exactes : « MLExtensions » version 2 © jdehorty — https://www.tradingview.com/script/ia5ozyMF-MLExtensions/
// et « KernelFunctions » version 2 © jdehorty — https://www.tradingview.com/script/e0Ek9x99-KernelFunctions/
import { creerObjets } from '../academyscript/objets.js';
import { ema, sma, rsi, cci, atr, crossover, crossunder } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const TYPES = [{ label: 'RSI', value: 'RSI' }, { label: 'WaveTrend', value: 'WT' }, { label: 'CCI', value: 'CCI' }, { label: 'ADX', value: 'ADX' }];
const G = 'Général', C = 'Caractéristiques', F = 'Filtres', N = 'Noyau', S = 'Style';
const caracteristique = (k, type, a, b) => [
  { id: `c${k}Type`, name: `Caractéristique ${k}`, type: 'select', default: type, options: TYPES, group: C },
  { id: `c${k}A`, name: `Caractéristique ${k} : paramètre A`, type: 'number', entier: true, default: a, min: 1, max: 200, step: 1, group: C },
  { id: `c${k}B`, name: `Caractéristique ${k} : paramètre B`, type: 'number', entier: true, default: b, min: 1, max: 200, step: 1, group: C,
    description: 'Lissage (moyenne exponentielle) du RSI et du CCI, second lissage du WaveTrend ; sans effet sur l’ADX.' },
];
const INPUTS = [
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: G,
    description: 'Prix dont le sens à 4 barres sert d’étiquette d’apprentissage, lissé par le noyau.' },
  { id: 'voisins', name: 'Nombre de voisins', type: 'number', entier: true, default: 8, min: 1, max: 100, step: 1, group: G },
  { id: 'barresMax', name: 'Barres d’apprentissage', type: 'number', entier: true, default: 2000, min: 10, max: 5000, step: 1, group: G,
    description: 'Le modèle ne prédit que sur ces dernières barres, et ne compare qu’aux barres de cette profondeur (comme le script).' },
  { id: 'nbCaracteristiques', name: 'Caractéristiques utilisées', type: 'number', entier: true, default: 5, min: 2, max: 5, step: 1, group: C },
  { id: 'compression', name: 'Compression des couleurs', type: 'number', entier: true, default: 1, min: 1, max: 10, step: 1, group: G, legende: false,
    description: 'Teintes des bougies en mode « Pleine » : divise le nombre de voisins pour graduer l’intensité.' },
  { id: 'sortiesFixes', name: 'Afficher les sorties', type: 'boolean', default: false, group: G,
    description: 'Sorties 4 barres après une entrée (durée d’apprentissage du modèle), ou dynamiques.' },
  { id: 'sortiesDynamiques', name: 'Sorties dynamiques', type: 'boolean', default: false, group: G,
    description: 'Sortie au changement de pente du noyau ; seulement sans filtre de moyenne ni lissage du noyau.' },
  { id: 'statistiques', name: 'Statistiques des signaux', type: 'boolean', default: true, group: G },
  { id: 'pireCas', name: 'Statistiques au pire cas', type: 'boolean', default: false, group: G,
    description: 'Prix d’entrée et de sortie = la source à la clôture, au lieu de (haut + bas + 2 × ouverture) / 4.' },
  { id: 'historiqueComplet', name: 'Tout l’historique', type: 'boolean', default: false, group: G,
    description: 'Compare à toutes les barres depuis le début, au lieu de partir de la profondeur d’apprentissage.' },
  ...caracteristique(1, 'RSI', 14, 1), ...caracteristique(2, 'WT', 10, 11), ...caracteristique(3, 'CCI', 20, 1),
  ...caracteristique(4, 'ADX', 20, 2), ...caracteristique(5, 'RSI', 9, 1),
  { id: 'filtreVolatilite', name: 'Filtre de volatilité', type: 'boolean', default: true, group: F,
    description: 'Prédiction retenue seulement quand l’ATR 1 dépasse l’ATR 10.' },
  { id: 'filtreRegime', name: 'Filtre de régime', type: 'boolean', default: true, group: F },
  { id: 'seuilRegime', name: 'Seuil du régime', type: 'number', default: -0.1, min: -10, max: 10, step: 0.1, group: F,
    description: 'Pente normalisée d’un filtre adaptatif d’ohlc4 : prédiction retenue au-dessus du seuil (marché en tendance).' },
  { id: 'filtreAdx', name: 'Filtre ADX', type: 'boolean', default: false, group: F },
  { id: 'seuilAdx', name: 'Seuil de l’ADX', type: 'number', entier: true, default: 20, min: 0, max: 100, step: 1, group: F },
  { id: 'filtreEma', name: 'Filtre de moyenne exponentielle', type: 'boolean', default: false, group: F },
  { id: 'periodeEma', name: 'Période de la moyenne exponentielle', type: 'number', entier: true, default: 200, min: 1, max: 1000, step: 1, group: F },
  { id: 'filtreSma', name: 'Filtre de moyenne simple', type: 'boolean', default: false, group: F },
  { id: 'periodeSma', name: 'Période de la moyenne simple', type: 'number', entier: true, default: 200, min: 1, max: 1000, step: 1, group: F },
  { id: 'filtreNoyau', name: 'Signaux dans le sens du noyau', type: 'boolean', default: true, group: N },
  { id: 'lissageNoyau', name: 'Sens du noyau par croisement', type: 'boolean', default: false, group: N,
    description: 'Sens donné par le croisement d’un second noyau (gaussien) au lieu de la pente : moins de changements de couleur.' },
  { id: 'fenetreNoyau', name: 'Fenêtre du noyau', type: 'number', entier: true, default: 8, min: 3, max: 50, step: 1, group: N },
  { id: 'ponderation', name: 'Pondération relative', type: 'number', default: 8, min: 0.25, max: 25, step: 0.25, group: N,
    description: 'Plus elle est faible, plus les barres lointaines pèsent ; très élevée, le noyau devient gaussien.' },
  { id: 'niveauRegression', name: 'Barres de la régression', type: 'number', entier: true, default: 25, min: 2, max: 100, step: 1, group: N,
    description: 'Le noyau pondère les (barres + 2) dernières valeurs de la source.' },
  { id: 'retardNoyau', name: 'Retard du second noyau', type: 'number', entier: true, default: 2, min: 1, max: 2, step: 1, group: N },
  { id: 'afficherNoyau', name: 'Afficher le noyau', type: 'boolean', default: true, group: S },
  { id: 'couleurBougies', name: 'Colorer les bougies', type: 'boolean', default: true, group: S },
  { id: 'afficherPredictions', name: 'Afficher la prédiction de chaque barre', type: 'boolean', default: true, group: S },
  { id: 'decalageAtr', name: 'Prédictions à un ATR de la barre', type: 'boolean', default: true, group: S },
  { id: 'decalagePredictions', name: 'Écart des prédictions', type: 'number', default: 0, min: 0, max: 100, step: 0.1, group: S, legende: false,
    description: 'Sans l’écart ATR : écart de la valeur au-dessus du haut ou sous le bas, en part du prix médian.' },
  { id: 'degradeConfiance', name: 'Intensité selon la confiance', type: 'boolean', default: true, group: S },
  { id: 'schemaBougies', name: 'Teinte des bougies', type: 'select', default: 'Default', group: S,
    options: [{ label: 'Transparence', value: 'Default' }, { label: 'Pleine', value: 'Solid' }] },
];

const VERT = '#009988', ROUGE = '#CC3311';
const C_VERT = transparence(VERT, 20), C_ROUGE = transparence(ROUGE, 20), C_NEUTRE = transparence('#787b86', 25);
const GRIS_TEXTE = '#787B86';

// ---------------------------------------------------------------- outils na (NaN = na de Pine)
const nan = (a) => { const t = new Float64Array(a.length); for (let i = 0; i < a.length; i++) { const v = a[i]; t[i] = typeof v === 'number' && Number.isFinite(v) ? v : NaN; } return t; };
const nz = (v, r = 0) => (Number.isNaN(v) ? r : v);
const div = (a, b) => (b === 0 ? NaN : a / b);
const nul = (v) => (Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------- MLExtensions (version 2)
function normaliser(src, min, max) {
  const out = new Float64Array(src.length);
  let hMin = 10e10, hMax = -10e10;
  for (let i = 0; i < src.length; i++) {
    hMin = Math.min(nz(src[i], hMin), hMin);
    hMax = Math.max(nz(src[i], hMax), hMax);
    out[i] = min + (max - min) * (src[i] - hMin) / Math.max(hMax - hMin, 10e-10);
  }
  return out;
}
const reechelle = (v, oldMin, oldMax, newMin, newMax) => newMin + (newMax - newMin) * (v - oldMin) / Math.max(oldMax - oldMin, 10e-10);

/** ADX du script (lissages de Wilder amorces a 0 par nz), haut / bas / cloture donnes. */
function adxScript(h, l, c, n) {
  const out = new Array(h.length);
  let trL = 0, dmpL = 0, dmmL = 0;
  for (let i = 0; i < h.length; i++) {
    const c1 = i > 0 ? c[i - 1] : NaN, h1 = i > 0 ? h[i - 1] : NaN, l1 = i > 0 ? l[i - 1] : NaN;
    const tr = Math.max(Math.max(h[i] - l[i], Math.abs(h[i] - nz(c1))), Math.abs(l[i] - nz(c1)));
    const dmp = h[i] - nz(h1) > nz(l1) - l[i] ? Math.max(h[i] - nz(h1), 0) : 0;
    const dmm = nz(l1) - l[i] > h[i] - nz(h1) ? Math.max(nz(l1) - l[i], 0) : 0;
    trL = nz(trL) - div(nz(trL), n) + tr;
    dmpL = nz(dmpL) - div(nz(dmpL), n) + dmp;
    dmmL = nz(dmmL) - div(nz(dmmL), n) + dmm;
    const dip = div(dmpL, trL) * 100, dim = div(dmmL, trL) * 100;
    out[i] = div(Math.abs(dip - dim), dip + dim) * 100;
  }
  return rmaNan(out, n);
}
/** ta.rma sur une serie a NaN (na saute, etat garde). */
function rmaNan(v, n) {
  const out = new Float64Array(v.length).fill(NaN);
  let prec = NaN, somme = 0, vus = 0;
  for (let i = 0; i < v.length; i++) {
    const x = v[i];
    if (Number.isNaN(x)) continue;
    if (Number.isNaN(prec)) { somme += x; vus++; if (vus === n) { prec = somme / n; out[i] = prec; } continue; }
    prec = (prec * (n - 1) + x) / n;
    out[i] = prec;
  }
  return out;
}

function caracteristiqueSerie(type, a, b, d, cl, hl, lo, hlc3) {
  if (type === 'RSI') return nan(ema(rsi(cl, a), b)).map((v) => reechelle(v, 0, 100, 0, 1));
  if (type === 'CCI') return normaliser(nan(ema(cci(cl, a), b)), 0, 1);
  if (type === 'WT') {
    const e1 = nan(ema(hlc3, a));
    const e2 = nan(ema(Array.from(hlc3, (v, i) => nul(Math.abs(v - e1[i]))), a));
    const ci = Array.from(hlc3, (v, i) => nul(div(v - e1[i], 0.015 * e2[i])));
    const wt1 = nan(ema(ci, b));
    const wt2 = nan(sma(Array.from(wt1, nul), 4));
    return normaliser(wt1.map((v, i) => v - wt2[i]), 0, 1);
  }
  return adxScript(hl, lo, cl, a).map((v) => reechelle(v, 0, 100, 0, 1));
}

function filtreRegime(d, o4, seuil) {
  const n = d.length;
  const pente = new Array(n);
  let v1 = NaN, v2 = NaN, k = NaN, k1;
  for (let i = 0; i < n; i++) {
    const s1 = i > 0 ? o4[i - 1] : NaN;
    v1 = 0.2 * (o4[i] - s1) + 0.8 * nz(v1);
    v2 = 0.1 * (d[i].high - d[i].low) + 0.8 * nz(v2);
    const om = Math.abs(div(v1, v2));
    const al = (-Math.pow(om, 2) + Math.sqrt(Math.pow(om, 4) + 16 * Math.pow(om, 2))) / 8;
    k1 = k;
    k = al * o4[i] + (1 - al) * nz(k);
    pente[i] = nul(Math.abs(k - k1));
  }
  const moy = nan(ema(pente, 200));
  return pente.map((v, i) => div((v === null ? NaN : v) - 1.0 * moy[i], 1.0 * moy[i]) >= seuil);
}

function filtreAdx(d, src, n, seuil) {
  const h = d.map((b) => b.high), l = d.map((b) => b.low);
  const out = new Array(d.length);
  let trL = 0, dmpL = 0, dmmL = 0;
  const dx = new Float64Array(d.length);
  for (let i = 0; i < d.length; i++) {
    const s1 = i > 0 ? src[i - 1] : NaN, h1 = i > 0 ? h[i - 1] : NaN, l1 = i > 0 ? l[i - 1] : NaN;
    const tr = Math.max(Math.max(h[i] - l[i], Math.abs(h[i] - nz(s1))), Math.abs(l[i] - nz(s1)));
    const dmp = h[i] - nz(h1) > nz(l1) - l[i] ? Math.max(h[i] - nz(h1), 0) : 0;
    const dmm = nz(l1) - l[i] > h[i] - nz(h1) ? Math.max(nz(l1) - l[i], 0) : 0;
    trL = nz(trL) - div(nz(trL), n) + tr;
    dmpL = nz(dmpL) - div(nz(dmpL), n) + dmp;
    dmmL = nz(dmmL) - div(nz(dmmL), n) + dmm;
    const dip = div(dmpL, trL) * 100, dim = div(dmmL, trL) * 100;
    dx[i] = div(Math.abs(dip - dim), dip + dim) * 100;
  }
  const adx = rmaNan(dx, n);
  for (let i = 0; i < d.length; i++) out[i] = adx[i] > seuil;
  return out;
}

// ---------------------------------------------------------------- KernelFunctions (version 2)
/** Estimateur de Nadaraya-Watson non repeint : poids w(i) sur source[i], i = 0 .. 1 + depart. */
function noyau(src, poids) {
  const out = new Float64Array(src.length);
  for (let b = 0; b < src.length; b++) {
    let cour = 0, cumul = 0;
    for (let i = 0; i < poids.length; i++) {
      const y = b - i >= 0 ? src[b - i] : NaN;
      cour += y * poids[i];
      cumul += poids[i];
    }
    out[b] = cour / cumul;
  }
  return out;
}
const poidsRationnel = (h, r, x) => Array.from({ length: x + 2 }, (_, i) => Math.pow(1 + (Math.pow(i, 2) / ((Math.pow(h, 2) * 2 * r))), -r));
const poidsGaussien = (h, x) => Array.from({ length: x + 2 }, (_, i) => Math.exp(-Math.pow(i, 2) / (2 * Math.pow(h, 2))));

// ---------------------------------------------------------------- couleurs
function nuance(base, pred, degrade) {
  const s = Math.min(Math.abs(pred), 10);
  if (!degrade) return base;
  for (let k = 9; k >= 1; k--) if (s >= k) return k === 9 ? base : transparence(base, (9 - k) * 10);
  return transparence(base, 90);
}
function teintePleine(p, pred) {
  const comp = Math.max(p.voisins / p.compression, 1.0);
  const idx = Math.trunc(Math.min(Math.round(Math.abs(pred) / comp * 9.0), 9.0));
  const f = (idx + 1) / 10.0;
  const rgb = (r, g, b) => `rgb(${Math.trunc(r)}, ${Math.trunc(g)}, ${Math.trunc(b)})`;
  if (pred > 0) return rgb(255 - f * 255, 255 - f * (255 - 153), 255 - f * (255 - 136));
  if (pred < 0) return rgb(255 - f * (255 - 204), 255 - f * (255 - 51), 255 - f * (255 - 17));
  return '#787B86';
}
const nan2 = (v) => (Number.isFinite(v) ? tostring(v, null) : 'NaN');
const texteMotif = (v, motif) => (Number.isFinite(v) ? tostring(v, motif) : 'NaN');

// ---------------------------------------------------------------- execution par barre
function creer() {
  return {
    o: creerObjets({ maxEtiquettes: 500 }),
    sorties: { signal: [], debutAchat: [], debutVente: [], finAchat: [], finVente: [], alertes: [], prediction: [], validAchat: [], validVente: [], couleurBougie: [] },
    predictions: [], distances: [], prediction: 0, tenues: 0,
    depuis: { achat: NaN, vente: NaN, hausse: NaN, baisse: NaN },
    bt: null, cumul: { long: 0, court: 0, retournements: 0, gains: 0, pertes: 0, trades: 0 },
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const O = e.sorties, b = d[i], last = d.length - 1;
  const mbbi = last >= p.barresMax ? last - p.barresMax : 0;
  // --- voisins approches en distance de Lorentz
  if (i >= mbbi) {
    let dernier = -1.0;
    const fin = Math.min(p.barresMax - 1, Math.min(p.barresMax - 1, i));
    const debut = p.historiqueComplet ? 0 : mbbi;
    const pas = debut <= fin ? 1 : -1;
    const F = s.f, nf = p.nbCaracteristiques, k34 = Math.round(p.voisins * 3 / 4);
    const x1 = F[0][i], x2 = F[1][i], x3 = F[2][i], x4 = F[3][i], x5 = F[4][i];
    for (let k = debut; pas > 0 ? k <= fin : k >= fin; k += pas) {
      let dist;
      if (nf === 5) dist = Math.log(1 + Math.abs(x1 - F[0][k])) + Math.log(1 + Math.abs(x2 - F[1][k])) + Math.log(1 + Math.abs(x3 - F[2][k])) + Math.log(1 + Math.abs(x4 - F[3][k])) + Math.log(1 + Math.abs(x5 - F[4][k]));
      else if (nf === 4) dist = Math.log(1 + Math.abs(x1 - F[0][k])) + Math.log(1 + Math.abs(x2 - F[1][k])) + Math.log(1 + Math.abs(x3 - F[2][k])) + Math.log(1 + Math.abs(x4 - F[3][k]));
      else if (nf === 3) dist = Math.log(1 + Math.abs(x1 - F[0][k])) + Math.log(1 + Math.abs(x2 - F[1][k])) + Math.log(1 + Math.abs(x3 - F[2][k]));
      else dist = Math.log(1 + Math.abs(x1 - F[0][k])) + Math.log(1 + Math.abs(x2 - F[1][k]));
      if (dist >= dernier && k % 4 !== 0) {
        dernier = dist;
        e.distances.push(dist);
        e.predictions.push(Math.round(s.y[k]));
        if (e.predictions.length > p.voisins) {
          dernier = e.distances[k34];
          e.distances.shift();
          e.predictions.shift();
        }
      }
    }
    let somme = 0;
    for (const v of e.predictions) somme += v;
    e.prediction = somme;
  }
  const pred = e.prediction;
  O.prediction[i] = pred;

  // --- signal filtre et filtres de duree
  const tous = s.volatilite[i] && s.regime[i] && s.adx[i];
  const sig = pred > 0 && tous ? 1 : pred < 0 && tous ? -1 : (i > 0 ? O.signal[i - 1] : 0);
  O.signal[i] = sig;
  const sg = (k) => (i - k >= 0 ? O.signal[i - k] : NaN);
  const change = (k) => sg(k) - sg(k + 1);
  const vrai = (v) => !Number.isNaN(v) && v !== 0;
  e.tenues = vrai(change(0)) ? 0 : e.tenues + 1;
  const tenuQuatre = e.tenues === 4, tenuMoins = e.tenues > 0 && e.tenues < 4;
  const retournement = vrai(change(0)) && (vrai(change(1)) || vrai(change(2)) || vrai(change(3)));
  const hautEma = (k) => i - k >= 0 && s.emaHaut[i - k], basEma = (k) => i - k >= 0 && s.emaBas[i - k];
  const hautSma = (k) => i - k >= 0 && s.smaHaut[i - k], basSma = (k) => i - k >= 0 && s.smaBas[i - k];
  const achat = sig === 1 && hautEma(0) && hautSma(0), vente = sig === -1 && basEma(0) && basSma(0);
  const dernierAchat = sg(4) === 1 && hautEma(4) && hautSma(4), derniereVente = sg(4) === -1 && basEma(4) && basSma(4);
  const nouvelAchat = achat && vrai(change(0)), nouvelleVente = vente && vrai(change(0));

  // --- noyau
  const y1 = s.yhat1, y = (k) => (i - k >= 0 ? y1[i - k] : NaN);
  const etaitBaisse = y(2) > y(1), etaitHausse = y(2) < y(1);
  const estBaisse = y(1) > y(0), estHausse = y(1) < y(0);
  const virageBaisse = estBaisse && etaitHausse, virageHausse = estHausse && etaitBaisse;
  const lisseHausse = s.yhat2[i] >= y1[i], lisseBaisse = s.yhat2[i] <= y1[i];
  const alerteHausse = p.lissageNoyau ? s.croiseHausse[i] : virageHausse;
  const alerteBaisse = p.lissageNoyau ? s.croiseBaisse[i] : virageBaisse;
  const haussier = p.filtreNoyau ? (p.lissageNoyau ? lisseHausse : estHausse) : true;
  const baissier = p.filtreNoyau ? (p.lissageNoyau ? lisseBaisse : estBaisse) : true;

  // --- entrees et sorties
  const debutAchat = nouvelAchat && haussier && hautEma(0) && hautSma(0);
  const debutVente = nouvelleVente && baissier && basEma(0) && basSma(0);
  O.debutAchat[i] = debutAchat; O.debutVente[i] = debutVente;
  const D = e.depuis;
  const plus1 = (v) => (Number.isNaN(v) ? NaN : v + 1);
  D.achat = debutAchat ? 0 : plus1(D.achat);
  D.vente = debutVente ? 0 : plus1(D.vente);
  D.hausse = alerteHausse ? 0 : plus1(D.hausse);
  D.baisse = alerteBaisse ? 0 : plus1(D.baisse);
  O.validVente[i] = D.hausse > D.vente;
  O.validAchat[i] = D.baisse > D.achat;
  const finAchatDyn = virageBaisse && i > 0 && O.validAchat[i - 1];
  const finVenteDyn = virageHausse && i > 0 && O.validVente[i - 1];
  const da4 = i >= 4 && O.debutAchat[i - 4], dv4 = i >= 4 && O.debutVente[i - 4];
  const finAchatFixe = ((tenuQuatre && dernierAchat) || (tenuMoins && nouvelleVente && dernierAchat)) && da4;
  const finVenteFixe = ((tenuQuatre && derniereVente) || (tenuMoins && nouvelAchat && derniereVente)) && dv4;
  const dynValide = !p.filtreEma && !p.filtreSma && !p.lissageNoyau;
  const finAchat = p.sortiesDynamiques && dynValide ? finAchatDyn : finAchatFixe;
  const finVente = p.sortiesDynamiques && dynValide ? finVenteDyn : finVenteFixe;
  O.alertes[i] = (debutAchat ? 1 : 0) | (finAchat ? 2 : 0) | (debutVente ? 4 : 0) | (finVente ? 8 : 0) | (alerteHausse ? 16 : 0) | (alerteBaisse ? 32 : 0);

  // --- formes
  const o = e.o;
  if (debutAchat) o.plotchar(i, { position: 'belowbar', caractere: '▲', couleur: nuance(VERT, pred, p.degradeConfiance), taille: 'small' });
  if (debutVente) o.plotchar(i, { position: 'abovebar', caractere: '▼', couleur: nuance(ROUGE, -pred, p.degradeConfiance), taille: 'small' });
  if (finAchat && p.sortiesFixes) o.plotchar(i, { position: 'absolute', y: b.high, caractere: '✕', couleur: p.degradeConfiance ? C_VERT : VERT, taille: 'tiny' });
  if (finVente && p.sortiesFixes) o.plotchar(i, { position: 'absolute', y: b.low, caractere: '✕', couleur: p.degradeConfiance ? C_ROUGE : ROUGE, taille: 'tiny' });

  // --- prediction de la barre et couleur des bougies
  const cPred = pred > 0 ? nuance(VERT, pred, p.degradeConfiance) : pred < 0 ? nuance(ROUGE, -pred, p.degradeConfiance) : C_NEUTRE;
  O.couleurBougie[i] = p.couleurBougies ? (p.schemaBougies === 'Solid' ? teintePleine(p, pred) : transparence(cPred, p.degradeConfiance ? 50 : 30)) : null;
  if (p.afficherPredictions) {
    const hl2 = (b.high + b.low) / 2;
    const yv = p.decalageAtr ? (pred > 0 ? b.high + s.atr1[i] : b.low - s.atr1[i])
      : (pred > 0 ? b.high + hl2 * p.decalagePredictions / 20 : b.low - hl2 * p.decalagePredictions / 30);
    o.etiquette({ x: i, y: nul(yv), texte: nan2(pred), couleur: null, style: pred > 0 ? 'label_down' : 'label_up', couleurTexte: cPred, taille: 'normal', alignTexte: 'left' });
  }

  // --- statistiques (MLExtensions.backtest, version 2)
  const prix = p.pireCas ? s.src[i] : (b.high + b.low + b.open + b.open) / 4;
  if (e.bt === null) e.bt = { long: prix, court: prix, profitCourt: 0, profitLong: 0, gains: 0, pertes: 0, trades: 0, ret: 0 };
  const T = e.bt;
  if (i > mbbi) {
    T.trades = 0; T.gains = 0; T.pertes = 0; T.ret = 0;
    if (debutAchat) { T.court = 0; T.ret = retournement ? 1 : 0; T.long = prix; T.trades = 1; }
    if (finAchat) { const dl = prix - T.long; T.gains = dl > 0 ? 1 : 0; T.pertes = dl < 0 ? 1 : 0; T.profitLong = dl * 1; }
    if (debutVente) { T.long = 0; T.court = prix; T.trades = 1; }
    if (finVente) { T.ret = retournement ? 1 : 0; const dl = T.court - prix; T.gains = dl > 0 ? 1 : 0; T.pertes = dl < 0 ? 1 : 0; T.profitCourt = dl * 1; }
  }
  const K = e.cumul;
  K.long += T.profitLong; K.court += T.profitCourt; K.retournements += T.ret; K.gains += T.gains; K.pertes += T.pertes; K.trades += T.gains + T.pertes;

  if (derniere && p.statistiques) {
    const tb = o.tableau({ position: 'top_right', colonnes: 2, lignes: 7, couleurCadre: null, epaisseurCadre: 1, couleurBordure: null, epaisseurBordure: 1 });
    const cel = (c, l, texte, fond) => tb.cellule(c, l, { texte, couleurTexte: GRIS_TEXTE, alignH: 'center', taille: 'normal', ...(fond ? { fond } : {}) });
    cel(0, 0, '📈 Statistiques');
    cel(0, 1, 'Réussite');
    cel(1, 1, texteMotif(div(K.gains, K.trades), '#.#%'));
    cel(0, 2, 'Signaux');
    cel(1, 2, `${texteMotif(K.trades, '#')} (${texteMotif(K.gains, '#')}|${texteMotif(K.pertes, '#')})`);
    cel(0, 5, 'Gains / pertes');
    cel(1, 5, texteMotif(div(K.gains, K.pertes), '0.00'));
    cel(0, 6, 'Retournements précoces');
    cel(1, 6, texteMotif(K.retournements, '#'));
  }
  void env;
}

function series(p, d) {
  const n = d.length;
  const cl = d.map((b) => b.close), hl = d.map((b) => b.high), lo = d.map((b) => b.low);
  const hlc3 = d.map((b) => (b.high + b.low + b.close) / 3);
  const choix = {
    close: cl, open: d.map((b) => b.open), high: hl, low: lo, hl2: d.map((b) => (b.high + b.low) / 2), hlc3,
    ohlc4: d.map((b) => (b.open + b.high + b.low + b.close) / 4),
  };
  const src = Float64Array.from(choix[p.source]);
  const f = [1, 2, 3, 4, 5].map((k) => caracteristiqueSerie(p[`c${k}Type`], p[`c${k}A`], p[`c${k}B`], d, cl, hl, lo, hlc3));
  const y = new Int8Array(n);
  for (let i = 0; i < n; i++) { const s4 = i >= 4 ? src[i - 4] : NaN; y[i] = s4 < src[i] ? -1 : s4 > src[i] ? 1 : 0; }
  const a1 = nan(atr(d, 1)), a10 = nan(atr(d, 10));
  const volatilite = p.filtreVolatilite ? Array.from(a1, (v, i) => v > a10[i]) : new Array(n).fill(true);
  const o4 = d.map((b) => (b.open + b.high + b.low + b.close) / 4);
  const regime = p.filtreRegime ? filtreRegime(d, o4, p.seuilRegime) : new Array(n).fill(true);
  const adx = p.filtreAdx ? filtreAdx(d, src, 14, p.seuilAdx) : new Array(n).fill(true);
  const e = nan(ema(cl, p.periodeEma)), m = nan(sma(cl, p.periodeSma));
  const emaHaut = cl.map((c, i) => (p.filtreEma ? c > e[i] : true)), emaBas = cl.map((c, i) => (p.filtreEma ? c < e[i] : true));
  const smaHaut = cl.map((c, i) => (p.filtreSma ? c > m[i] : true)), smaBas = cl.map((c, i) => (p.filtreSma ? c < m[i] : true));
  const yhat1 = noyau(src, poidsRationnel(p.fenetreNoyau, p.ponderation, p.niveauRegression));
  const yhat2 = noyau(src, poidsGaussien(p.fenetreNoyau - p.retardNoyau, p.niveauRegression));
  const l1 = Array.from(yhat1, nul), l2 = Array.from(yhat2, nul);
  return {
    src, f, y, volatilite, regime, adx, emaHaut, emaBas, smaHaut, smaBas, yhat1, yhat2, atr1: a1,
    croiseHausse: crossover(l2, l1), croiseBaisse: crossunder(l2, l1),
  };
}

function rendre(p, e, d, s) {
  const n = d.length, O = e.sorties;
  const couleurs = new Array(n), bougies = new Array(n), alertes = new Array(n);
  for (let i = 0; i < n; i++) {
    const y1 = s.yhat1, h = i >= 1 && y1[i - 1] < y1[i];
    couleurs[i] = p.afficherNoyau ? (p.lissageNoyau ? (s.yhat2[i] >= y1[i] ? C_VERT : C_ROUGE) : (h ? C_VERT : C_ROUGE)) : null;
    const c = O.couleurBougie[i];
    bougies[i] = { time: d[i].time, value: c ? 1 : null, color: c };
    alertes[i] = { time: d[i].time, value: O.alertes[i] || null };
  }
  return { noyau: tracer(d, Array.from(s.yhat1, nul), couleurs), bougies, alertes, objets: e.o.resultat() };
}

const ALERTES = [
  ['achat', 'Entrée à l’achat', 1], ['fin_achat', 'Sortie de l’achat', 2], ['vente', 'Entrée à la vente', 4], ['fin_vente', 'Sortie de la vente', 8],
  ['entree', 'Entrée (achat ou vente)', 5], ['sortie', 'Sortie (achat ou vente)', 10],
  ['noyau_hausse', 'Le noyau passe haussier', 16], ['noyau_baisse', 'Le noyau passe baissier', 32],
];

export default class ClassificationLorentzIndicator {
  static metadata = {
    id: 'classification_lorentz',
    name: 'Classification par voisins en distance de Lorentz',
    shortName: 'LORENTZ',
    description: 'classification_lorentz',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['apprentissage', 'plus proches voisins', 'classification', 'noyau', 'nadaraya-watson', 'signaux'],
    inputs: INPUTS,
    outputs: [
      { id: 'noyau', name: 'Estimation du noyau', type: 'line', color: '#009988', lineWidth: 2 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'alertes', name: 'Alertes', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#009988', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: ALERTES.map(([id, title, masque]) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && (pt.value & masque) !== 0,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { noyau: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    // last_bar_index entre dans tout le calcul (debut des predictions) : un etat par valeur.
    const last = data.length - 1;
    const mbbi = last >= p.barresMax ? last - p.barresMax : 0;
    return executer(ClassificationLorentzIndicator._memo, JSON.stringify([p, mbbi]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
