// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Multi Deviation Scaled Moving Average [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/Yqc5d8Lc-Multi-Deviation-Scaled-Moving-Average-ChartPrime/
// Adaptation : couleurs reglables (fixes dans le script) ; les losanges (plotshape) deviennent des caracteres ◆ poses sur la
// moyenne. Comme le script, chaque moyenne lit la cloture (sa source hlc3 n'est pas utilisee) et part de 0 a la premiere barre.
import { creerObjets } from '../academyscript/objets.js';
import { ema, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, tracer, transparence, degrade, masque, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'periode', name: 'Période', type: 'number', entier: true, default: 30, min: 1, max: 500, step: 1, group: P,
    description: 'Période de la première des huit moyennes ; les sept suivantes l’allongent chacune d’un pas.' },
  { id: 'sensibilite', name: 'Sensibilité', type: 'number', entier: true, default: 60, min: 0, max: 100, step: 1, group: P,
    description: 'Le pas entre deux moyennes vaut 100 - sensibilité : plus elle est basse, plus les huit moyennes sont écartées.' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#41a1ce', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#ce8541', group: S },
];
const VAL = 0.14285714285714285714285714285714;

/** dsma(close, L) du script : super lisseur de close - close[2], ramene a son ecart quadratique, puis moyenne a alpha variable. */
function dsma(d, L) {
  const n = d.length, pi = 3.1415926535897932, g = Math.sqrt(2);
  const s = 2 * pi / L, a1 = Math.exp(-g * pi / (0.5 * L)), b1 = 2 * a1 * Math.cos(g * s / (0.5 * L));
  const c2 = b1, c3 = -a1 * a1, c1 = 1 - c2 - c3;
  const filt = new Array(n).fill(null), carre = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const z = i >= 2 ? d[i].close - d[i - 2].close : null, z1 = i >= 3 ? d[i - 1].close - d[i - 3].close : null;
    if (z === null || z1 === null) continue;
    const f1 = i >= 1 && filt[i - 1] !== null ? filt[i - 1] : 0, f2 = i >= 2 && filt[i - 2] !== null ? filt[i - 2] : 0;
    filt[i] = c1 * (z + z1) / 2 + c2 * f1 + c3 * f2;
    carre[i] = Math.pow(filt[i], 2);
  }
  const m = ema(carre, L), out = new Array(n);
  let prec = 0;
  for (let i = 0; i < n; i++) {
    const rms = m[i] === null ? null : Math.sqrt(m[i]);
    const ech = rms !== null && rms !== 0 ? filt[i] / rms : 0;
    const alpha = Math.abs(ech) * 5 / L;
    const v = alpha * d[i].close + (1 - alpha) * prec;
    out[i] = Number.isFinite(v) ? v : null;
    prec = out[i] === null ? 0 : out[i];
  }
  return out;
}

function series(p, d) {
  const n = d.length, pas = 100 - p.sensibilite, m = [];
  for (let k = 0; k < 8; k++) m.push(dsma(d, p.periode + pas * k));
  const score = new Array(n), moy = new Array(n), couleur = new Array(n);
  for (let i = 0; i < n; i++) {
    let sc = 0, somme = 0;
    const ref = m[7][i];
    for (let k = 0; k < 8; k++) { const v = m[k][i]; if (v !== null && ref !== null && v > ref) sc += VAL; }
    for (let k = 0; k < 8; k++) somme += m[k][i];
    score[i] = sc; moy[i] = somme / 8;
    couleur[i] = sc > 0.5 ? degrade(sc, 0.5, 1, null, p.couleurHausse) : degrade(sc, 0, 0.5, p.couleurBaisse, null);
  }
  return { score, moy, couleur, hausse: crossover(score, 0.3), baisse: crossunder(score, 0.7) };
}

function etape(p, e, d, i, derniere, s) {
  const o = e.o;
  for (const [vrai, c] of [[s.hausse[i], p.couleurHausse], [s.baisse[i], p.couleurBaisse]]) {
    if (!vrai || !Number.isFinite(s.moy[i])) continue;
    o.plotchar(i, { position: 'absolute', y: s.moy[i], caractere: '◆', couleur: transparence(c, 50), taille: 'small' });
    o.plotchar(i, { position: 'absolute', y: s.moy[i], caractere: '◆', couleur: c, taille: 'tiny' });
  }
  if (!derniere) return;
  const haut = s.score[i] * 100, bas = 100 - haut;
  const t = o.tableau({ position: 'bottom_right', colonnes: 100, lignes: 100 });
  for (const [col, pc, c] of [[0, haut, p.couleurHausse], [1, bas, p.couleurBaisse]]) {
    const r = Math.round(pc / 2), sens = r >= 1 ? 1 : -1;
    for (let k = 1; sens > 0 ? k <= r : k >= r; k += sens) {
      const ck = degrade(k, 0, 50, transparence(c, 80), c);
      t.cellule(col, 50 - k, { texte: '', largeur: 1, hauteur: 1, fond: ck });
      if (k === r) t.cellule(col, 50 - k, { texte: String(Math.round(pc)), largeur: 1, hauteur: 2, couleurTexte: ck, taille: 'small' });
    }
  }
}

const ALERTES = [['moyennes_ecart_type_hausse', 'Score au-dessus de 30 %'], ['moyennes_ecart_type_baisse', 'Score sous 70 %']];

export default class MoyennesEcartTypeMultiplesIndicator {
  static metadata = {
    id: 'moyennes_ecart_type_multiples',
    name: 'Huit moyennes adaptées à l’écart-type',
    shortName: 'MAE8',
    description: 'moyennes_ecart_type_multiples',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['moyenne', 'adaptative', 'ecart-type', 'score', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenne', name: 'Moyenne des huit', type: 'line', color: '#41a1ce', lineWidth: 2 },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { moyenne: [] };
    const p = this.params;
    return executer(MoyennesEcartTypeMultiplesIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets() }),
      series: (d) => series(p, d),
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, derniere, s),
      rendre: (e, d, s) => ({ moyenne: tracer(d, s.moy, s.couleur), signaux: masque(d, [s.hausse, s.baisse]), objets: e.o.resultat() }),
    });
  }
}
