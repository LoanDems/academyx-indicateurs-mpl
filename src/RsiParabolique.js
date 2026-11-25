// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Parabolic RSI [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/NI0Qhwy7-Parabolic-RSI-ChartPrime/
// Adaptation : les losanges que le script pose aussi sur le graphique des prix (force_overlay) restent dans le panneau du RSI.
import { creerObjets } from '../academyscript/objets.js';
import { rsi as taRsi } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide } from './commun.js';

const P = 'RSI', SAR = 'SAR parabolique', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur du RSI', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P },
  { id: 'seuilHaut', name: 'Seuil haut', type: 'number', entier: true, default: 70, min: 0, max: 100, step: 1, group: P },
  { id: 'seuilBas', name: 'Seuil bas', type: 'number', entier: true, default: 30, min: 0, max: 100, step: 1, group: P },
  { id: 'afficherSar', name: 'Afficher le SAR', type: 'boolean', default: true, group: SAR },
  { id: 'depart', name: 'Départ', type: 'number', default: 0.02, min: 0, max: 1, step: 0.01, group: SAR,
    description: 'Facteur d’accélération du SAR calculé sur le RSI au début de chaque tendance.' },
  { id: 'increment', name: 'Incrément', type: 'number', default: 0.02, min: 0, max: 1, step: 0.01, group: SAR },
  { id: 'maximum', name: 'Maximum', type: 'number', default: 0.2, min: 0, max: 1, step: 0.01, group: SAR },
  { id: 'couleurHausse', name: 'SAR sous le RSI', type: 'color', default: '#EEA47F', group: S },
  { id: 'couleurBaisse', name: 'SAR au-dessus du RSI', type: 'color', default: '#00539C', group: S },
];
const GRIS = '#787B86', ROUGE = '#F23645', ORANGE = '#FF9800', FOND = '#c292571a';
const nmin = (a, b) => (a === null || b === null ? null : Math.min(a, b));
const nmax = (a, b) => (a === null || b === null ? null : Math.max(a, b));
const sup = (a, b) => a !== null && b !== null && a > b;
const inf = (a, b) => a !== null && b !== null && a < b;

/** pine_sar(rsi, start, inc, max) du script : SAR parabolique sur le RSI (bornes rsi +/- 1). */
function series(p, d, env) {
  const n = d.length;
  const r = taRsi(d.map((b) => b.close), p.longueur);
  const H = (j) => (j >= 0 && r[j] !== null ? r[j] + 1 : null), L = (j) => (j >= 0 && r[j] !== null ? r[j] - 1 : null);
  const sarRsi = new Array(n), dessous = new Array(n), sar = new Array(n), couleurs = new Array(n);
  const hausse = new Array(n), baisse = new Array(n), forteHausse = new Array(n), forteBaisse = new Array(n);
  let result = null, maxMin = null, acc = null, isBelow = false, sarVar = null;
  for (let i = 0; i < n; i++) {
    const src = r[i], hi = H(i), lo = L(i);
    let premier = false;
    if (i <= p.longueur + 2) {
      if (sup(src, i > 0 ? r[i - 1] : null)) { isBelow = true; maxMin = hi; result = L(i - 1); } else { isBelow = false; maxMin = lo; result = H(i - 1); }
      premier = true; acc = p.depart;
    }
    result = result === null || maxMin === null ? null : result + acc * (maxMin - result);
    if (isBelow) {
      if (sup(result, lo)) { premier = true; isBelow = false; result = nmax(hi, maxMin); maxMin = lo; acc = p.depart; }
    } else if (inf(result, hi)) { premier = true; isBelow = true; result = nmin(lo, maxMin); maxMin = hi; acc = p.depart; }
    if (!premier) {
      if (isBelow) { if (sup(hi, maxMin)) { maxMin = hi; acc = Math.min(acc + p.increment, p.maximum); } } else if (inf(lo, maxMin)) { maxMin = lo; acc = Math.min(acc + p.increment, p.maximum); }
    }
    if (isBelow) { result = nmin(result, L(i - 1)); if (i > 1) result = nmin(result, L(i - 2)); } else { result = nmax(result, H(i - 1)); if (i > 1) result = nmax(result, H(i - 2)); }
    sarRsi[i] = result; dessous[i] = isBelow;
    const bascule = isBelow !== (i > 0 ? dessous[i - 1] : false);
    const confirmee = i < n - 1 || env.derniereConfirmee;
    hausse[i] = bascule && isBelow && confirmee;
    baisse[i] = bascule && !isBelow && confirmee;
    forteHausse[i] = hausse[i] && result !== null && result <= p.seuilBas;
    forteBaisse[i] = baisse[i] && result !== null && result >= p.seuilHaut;
    if (p.afficherSar) sarVar = bascule ? null : result;
    sar[i] = sarVar;
    couleurs[i] = isBelow ? p.couleurHausse : p.couleurBaisse;
  }
  return {
    r, sarRsi, sar, couleurs, hausse, baisse, forteHausse, forteBaisse,
    // fill(rsi, 50, 100, 70, rouge, orange 100) et fill(rsi, 50, 30, 0, rouge 100, orange) : seule la part
    // au-dela de 70 (en deca de 30) est coloree, a la couleur de mi-hauteur du degrade.
    hautClip: r.map((v) => (v === null ? null : Math.max(v, 70))), basClip: r.map((v) => (v === null ? null : Math.min(v, 30))),
    soixanteDix: new Array(n).fill(70), trente: new Array(n).fill(30),
    seuilHaut: new Array(n).fill(p.seuilHaut), seuilBas: new Array(n).fill(p.seuilBas),
  };
}

const COUL_HAUT = milieu(transparence(ORANGE, 100), ROUGE), COUL_BAS = milieu(transparence(ROUGE, 100), ORANGE);

function etape(p, e, d, i, derniere, s) {
  const o = e.o, v = s.sarRsi[i], c = s.couleurs[i];
  remplir(o, e.fondZone, s.seuilHaut, s.seuilBas, i, FOND, derniere);
  remplir(o, e.fondHaut, s.hautClip, s.soixanteDix, i, COUL_HAUT, derniere);
  remplir(o, e.fondBas, s.trente, s.basClip, i, COUL_BAS, derniere);
  if (s.hausse[i] && v !== null && v >= p.seuilBas) o.plotchar(i, { position: 'absolute', y: v, caractere: '◆', couleur: c, taille: 'tiny' });
  if (s.baisse[i] && v !== null && v <= p.seuilHaut) o.plotchar(i, { position: 'absolute', y: v, caractere: '◆', couleur: c, taille: 'tiny' });
  if (s.forteHausse[i]) o.plotchar(i, { position: 'absolute', y: v, caractere: '◈', couleur: c, taille: 'tiny' });
  if (s.forteBaisse[i]) o.plotchar(i, { position: 'absolute', y: v, caractere: '◈', couleur: c, taille: 'tiny' });
}

export default class RsiParaboliqueIndicator {
  static metadata = {
    id: 'rsi_parabolique',
    name: 'RSI et son SAR parabolique',
    shortName: 'RSI-SAR',
    description: 'rsi_parabolique',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['rsi', 'sar parabolique', 'surachat', 'survente', 'retournement'],
    inputs: INPUTS,
    outputs: [
      { id: 'rsi', name: 'RSI', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'sar', name: 'SAR', type: 'line', color: '#EEA47F', lineWidth: 1, trace: 'cercles' },
    ],
    levels: [
      { value: 70, inputId: 'seuilHaut', color: GRIS, style: 'dashed' },
      { value: 50, color: 'rgba(120, 123, 134, 0.5)', style: 'dashed' },
      { value: 30, inputId: 'seuilBas', color: GRIS, style: 'dashed' },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { rsi: [], sar: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(RsiParaboliqueIndicator._memo, JSON.stringify([p, env.texte, env.derniereConfirmee]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), fondZone: suiteVide(), fondHaut: suiteVide(), fondBas: suiteVide() }),
      series: (d) => series(p, d, env),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d, s) => ({
        rsi: tracer(d, s.r, new Array(d.length).fill(env.texte)),
        sar: d.map((b, i) => ({ time: b.time, value: s.sar[i], color: s.couleurs[i] })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
