// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Filtered Volume Profile [ChartPrime] » © Chartprime — https://www.tradingview.com/script/EPciWdx9-Filtered-Volume-Profile-ChartPrime/
// Adaptation : textes des cadres en francais ; tout se calcule a la derniere barre comme au chargement sur TradingView. La
// valeur critique de Student (bisection du script) est calculee une fois par reglage, plafonnee a 10 000 iterations.
// Il faut au moins `longueur` barres et une moyenne de score definie a la derniere barre : sinon rien n'est dessine.
import { creerObjets } from '../academyscript/objets.js';
import { sma } from '../academyscript/ta.js';
import { sum } from '../academyscript/math.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, transparence, degrade } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 200, min: 1, max: 500, step: 1, group: P,
    description: 'Barres réparties sur les 100 rangées du profil.' },
  { id: 'lissage', name: 'Lissage', type: 'number', entier: true, default: 3, min: 1, max: 6, step: 1, group: P,
    description: 'Largeur du noyau sinc qui lisse le profil avant la recherche des pics.' },
  { id: 'sensibilite', name: 'Sensibilité des pics', type: 'number', entier: true, default: 3, min: 1, max: 10, step: 1, group: P,
    description: 'Rangées comparées de part et d’autre d’un pic ; la zone autour de chaque pic en fait autant de rangées.' },
  { id: 'seuilPics', name: 'Seuil des pics (centile)', type: 'number', entier: true, default: 80, min: 0, max: 100, step: 1, group: P },
  { id: 'longueurScore', name: 'Longueur du score moyen', type: 'number', entier: true, default: 20, min: 3, max: 500, step: 1, group: P,
    description: 'Moyenne des clôtures et écart des ouvertures utilisés pour le score de chaque pic (loi de Student).' },
  { id: 'niveaux', name: 'Lignes de contrôle', type: 'select', default: 'POC', options: [{ label: 'POC seul', value: 'POC' }, { label: 'Toutes', value: 'All' }, { label: 'Aucune', value: 'None' }], group: P },
  { id: 'couleurHaute', name: 'Histogramme (acheteurs)', type: 'color', default: '#EBAAFC', group: S },
  { id: 'couleurBasse', name: 'Histogramme (vendeurs)', type: 'color', default: '#A32EC0', group: S },
  { id: 'transparence', name: 'Transparence', type: 'number', entier: true, default: 10, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurPoc', name: 'POC', type: 'color', default: '#F23645', group: S },
  { id: 'couleurNiveaux', name: 'Niveaux des pics', type: 'color', default: '#FF8641', group: S },
];
const NOIR = '#363A45', TRANSPARENT = 'rgba(0, 0, 0, 0)', CNUM = 100;
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const pt = (v) => (Number.isFinite(v) ? formaterMotif(v, '#.##########') : 'NaN');

const DK = [2.48574089138753565546e-5, 1.05142378581721974210, -3.45687097222016235469, 4.51227709466894823700, -2.98285225323576655721,
  1.05639711577126713077, -1.95428773191645869583e-1, 1.70970543404441224307e-2, -5.71926117404305781283e-4, 4.63399473359905636708e-6,
  -2.71994908488607703910e-9];
function gamma(z) {
  const R = 10.900511, T = 1.8603827342052657173362492472666631120594218414085755;
  let s = DK[0];
  if (z < 0.5) {
    for (let i = 1; i <= 10; i++) s += DK[i] / (i - z);
    return Math.PI / Math.sin(Math.PI * z) * s * T * Math.pow((0.5 - z + R) / Math.E, 0.5 - z);
  }
  for (let i = 1; i <= 10; i++) s += DK[i] / (z + i - 1.0);
  return s * T * Math.pow((z - 0.5 + R) / Math.E, z - 0.5);
}
const pdfStudent = (x, v) => gamma((v + 1) / 2) / (Math.sqrt(v * Math.PI) * gamma(v / 2)) * Math.pow(1 + x * x / v, -(v + 1) / 2);
const factMontante = (c, n) => { let p = 1.0; for (let i = 0; i < n; i++) p *= (c + i); return p; };
const hyper = (a, b, c, z) => { let s = 0.0; for (let i = 0; i <= 2; i++) s += factMontante(a, i) * factMontante(b, i) * Math.pow(z, i) / (factMontante(c, i) * factMontante(i, i)); return s; };
const cdfStudent = (x, v) => 1 / 2.0 + x * gamma((v + 1) / 2.0) * (hyper(1 / 2.0, (v + 1) / 2.0, 3.0 / 2, x * x / v) / (Math.sqrt(v * Math.PI) * gamma(v / 2)));

const CRITIQUE = new Map();
function valeurCritique(v) {
  if (CRITIQUE.has(v)) return CRITIQUE.get(v);
  const p = (1 - 0.99) / 2;
  let bas = -100, haut = 100, mid = (bas + haut) / 2, k = 0;
  while (Math.abs(cdfStudent(mid, v) - p) > 0.000001 && k++ < 10000) {
    if (cdfStudent(mid, v) > p) haut = mid; else bas = mid;
    mid = (bas + haut) / 2;
  }
  const t = mid < 0 ? -mid : mid;
  CRITIQUE.set(v, t);
  return t;
}

const arrondi = (x, d) => { const f = Math.pow(10, d); return Math.round(x * f) / f; };
function abrege(x) {
  if (x >= 1000000000) return pt(arrondi(x / 1000000000, 2)) + ' B';
  if (x >= 1000000) return pt(arrondi(x / 1000000, 2)) + ' M';
  if (x >= 1000) return pt(arrondi(x / 1000, 2)) + ' K';
  return pt(arrondi(x, 2));
}
const sinc = (s, bw) => (s === 0 ? 1 : Math.sin(Math.PI * s / bw) / (Math.PI * s / bw));
function noyau(src, L) {
  const n = src.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, w = 0;
    for (let j = 0; j < n; j++) { const k = sinc(i - j, L); s += src[j] * k; w += k; }
    const c = s / w;
    out[i] = c >= 0 ? c : 0;
  }
  return out;
}
function partVolume(a, b, x, y, vol) {
  if (y < a || x > b) return 0;
  if (x >= a && y <= b) return ((y - x) / (b - a)) * vol;
  if (x <= a && y >= b) return ((b - a) / (y - x)) * vol;
  if (x < a && y <= b) return ((y - a) / (y - x)) * vol;
  if (x >= a && y > b) return ((b - x) / (y - x)) * vol;
  return vol;
}
const nieme = (arr, k) => arr.slice().sort((x, y) => y - x)[k];
const centileRang = (arr, pc) => { const s = arr.slice().sort((x, y) => x - y); const r = Math.min(Math.max(Math.ceil((pc / 100) * s.length) - 1, 0), s.length - 1); return s[r]; };

function calculer(p, d) {
  const o = creerObjets({ maxBoites: 500, maxLignes: 500 }), n = d.length, last = n - 1, LB = p.longueur, SL = p.longueurScore;
  if (n < LB) return { objets: o.resultat() };
  const moy = sma(d.map((b) => b.close), SL);
  const carre = d.map((b, i) => (nul(moy[i]) ? null : Math.pow(b.open - moy[i], 2)));
  const somme = sum(carre, SL);
  const mean = moy[last], sq = carre[last], ss = somme[last];
  if (nul(mean) || nul(sq) || nul(ss)) return { objets: o.resultat() };
  const t = valeurCritique(SL - 1);
  const rmse = Math.sqrt(ss / (SL - 1)), rse = Math.sqrt(1 + 1 / SL + sq / ss), ecart = t * rmse * rse;
  let top = -Infinity, bot = Infinity;
  for (let k = 0; k < LB; k++) { const b = d[last - k]; if (b.high > top) top = b.high; if (b.low < bot) bot = b.low; }
  const dist = (top - bot) / 500, pas = (top - bot) / CNUM, RANGE = pas * p.sensibilite;
  const niv = Array.from({ length: CNUM + 1 }, (_, x) => bot + pas * x);
  const vols = new Array(CNUM).fill(0.0), acheteurs = new Array(CNUM).fill(0.0);
  for (let k = 0; k < LB; k++) {
    const b = d[last - k], hausse = b.open < b.close;
    for (let x = 0; x < CNUM; x++) {
      vols[x] = vols[x] + partVolume(niv[x], niv[x + 1], b.low, b.high, b.volume);
      if (hausse) acheteurs[x] = acheteurs[x] + partVolume(niv[x], niv[x + 1], b.low, b.high, b.volume);
    }
  }
  const lisse = noyau(vols, p.lissage), seuil = centileRang(lisse, p.seuilPics), K = p.sensibilite;
  const pocs = [], vpoc = [], hl = new Array(K).fill(null), hr = new Array(K).fill(null);
  for (let i = 0; i < lisse.length; i++) {
    const mx = nieme(lisse, i), idx = lisse.indexOf(mx);
    if (!(mx > seuil)) continue;
    for (let j = 0; j < K; j++) { hl[j] = lisse[Math.max(0, idx - 1 - j)]; hr[j] = lisse[Math.min(lisse.length - 1, idx + 1 + j)]; }
    let pic = true;
    for (let j = 0; j < K; j++) {
      if ((mx < hr[j] || mx < hl[j]) && (hr[Math.min(K - 1, j + 1)] <= hl[j] || hl[Math.min(K - 1, j + 1)] <= hl[j])) { pic = false; break; }
    }
    if (!pic) continue;
    const POC = (niv[idx] + niv[idx < niv.length ? idx + 1 : idx - 1]) / 2;
    if (i === 0) { pocs.push(POC); vpoc.push(mx); continue; }
    const fin = pocs.length;
    for (let j = 0; j <= fin; j++) {
      if (j < pocs.length && !(POC > pocs[j] ? POC - RANGE > RANGE + pocs[j] : POC + RANGE < pocs[j] - RANGE)) break;
      if (j === pocs.length) { pocs.push(POC); vpoc.push(mx); }
    }
  }
  const part = acheteurs.map((a, i) => a / vols[i]);
  let vmax = vols[0];
  for (const v of vols) if (v > vmax) vmax = v;
  const norm = noyau(vols.map((v) => v * LB / (3 * vmax)), p.lissage), bord = last - LB + 1;
  for (let i = 0; i < CNUM; i++) {
    o.boite({ gauche: bord, haut: niv[i + 1] - dist, droite: bord + Math.round(norm[i]), bas: niv[i] + dist, epaisseurBordure: 0, couleurBordure: '#2962FF',
      fond: transparence(degrade(part[i], 0, 1, p.couleurBasse, p.couleurHaute), p.transparence) });
  }
  for (let i = 0; i < pocs.length; i++) {
    const POC = pocs[i], c = transparence(`rgb(${(23 * (i + 4)) % 255}, ${(79 * (i + 4)) % 255}, ${(127 * (i + 4)) % 255})`, 60);
    const la = o.ligne({ x1: bord, y1: POC + RANGE, x2: last + 1, y2: POC + RANGE, couleur: c, extend: 'right' });
    const lb = o.ligne({ x1: bord, y1: POC - RANGE, x2: last + 1, y2: POC - RANGE, couleur: c, extend: 'right' });
    const cp = i === 0 ? (p.niveaux !== 'None' ? p.couleurPoc : TRANSPARENT) : (p.niveaux === 'All' ? p.couleurNiveaux : TRANSPARENT);
    o.ligne({ x1: bord, y1: POC, x2: last + 1, y2: POC, couleur: cp, extend: 'right' });
    o.remplissage(la, lb, { couleur: c });
    const z = (POC - mean) / (ecart * 1.5), prob = arrondi(pdfStudent(z, SL - 1), 2);
    const cadre = { haut: POC + RANGE, bas: POC - RANGE, couleurBordure: transparence(NOIR, 30), fond: transparence(NOIR, 30), couleurTexte: '#FFFFFF' };
    o.boite({ ...cadre, gauche: last + 32, droite: last + 48, texte: 'Score moyen\n' + pt(prob * 100 / 40 * 100) });
    o.boite({ ...cadre, gauche: last + 16, droite: last + 32, texte: 'Volume\n' + abrege(vpoc[i]) });
  }
  return { objets: o.resultat() };
}

export default class ProfilVolumeFiltreIndicator {
  static metadata = {
    id: 'profil_volume_filtre',
    name: 'Profil de volume filtré et pics',
    shortName: 'PVF',
    description: 'profil_volume_filtre',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['profil de volume', 'poc', 'pics', 'noyau', 'student'],
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
    return executer(ProfilVolumeFiltreIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets({}) }),
      etape: () => {},
      rendre: (e, dd) => calculer(p, dd),
    });
  }
}
