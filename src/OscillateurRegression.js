// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Linear Regression Oscillator [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/MyKmv8br-Linear-Regression-Oscillator-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, signaux, degrade, transparence, milieu } from './commun.js';

const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 20, min: 2, max: 500, step: 1, group: 'Paramètres',
    description: 'Barres de la régression linéaire des clôtures ; l’oscillateur est ensuite centré et réduit sur 100 barres.' },
  { id: 'seuilHaut', name: 'Seuil haut', type: 'number', default: 1.5, min: -4, max: 4, step: 0.1, group: 'Paramètres' },
  { id: 'seuilBas', name: 'Seuil bas', type: 'number', default: -1.5, min: -4, max: 4, step: 0.1, group: 'Paramètres' },
  { id: 'colorerBougies', name: 'Colorer les bougies', type: 'boolean', default: false, group: 'Style' },
  { id: 'couleurHausse', name: 'Au-dessus de zéro', type: 'color', default: '#10cab8', group: 'Style' },
  { id: 'couleurBaisse', name: 'Sous zéro', type: 'color', default: '#2962FF', group: 'Style' },
];

const NORMALISATION = 100;

function creer() {
  return {
    o: creerObjets({ maxEtiquettes: 500 }),
    sorties: { source: [], lro: [], colOsc: [], colZero: [], hausse: [], baisse: [], haut: [], bas: [] },
    fenetre: [], somme: 0,
  };
}

/** Regression du script, rejouee a chaque barre (le terme m * bar_index est celui du script). */
function regression(source, i, n) {
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let k = 0; k < n; k++) {
    const y = i - k >= 0 ? source[i - k] : null;
    if (y === null) return null;
    sx += k; sy += y; sxy += k * y; sxx += k * k;
  }
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const c = (sy - m * sx) / n;
  return (m * i + c) * -1;
}

/**
 * (x - ta.sma(x, 100)) / ta.stdev(x, 100) sur les valeurs definies : somme
 * glissante (ajout puis retrait), carres des ecarts de la plus recente a la plus
 * ancienne, comme AcademyScript.
 */
function normaliser(e, x) {
  if (x === null) return null;
  const f = e.fenetre;
  e.somme += x;
  f.push(x);
  if (f.length > NORMALISATION) e.somme -= f.shift();
  if (f.length < NORMALISATION) return null;
  const moyenne = e.somme / NORMALISATION;
  let carres = 0;
  for (let k = f.length - 1; k >= 0; k--) { const d = f[k] - moyenne; carres += d * d; }
  return (x - moyenne) / Math.sqrt(carres / NORMALISATION);
}

function etape(p, e, data, i, derniere, env) {
  const S = e.sorties, o = e.o;
  S.source[i] = derniere && !env.derniereConfirmee ? (i > 0 ? data[i - 1].close : null) : data[i].close;
  const v = normaliser(e, regression(S.source, i, p.longueur));
  S.lro[i] = v;
  S.colOsc[i] = v !== null && v > 0 ? degrade(v, 0, 2, null, p.couleurHausse) : degrade(v, -2, 0, p.couleurBaisse, null);
  S.colZero[i] = v !== null && v > 0 ? degrade(v, 0, 2, null, env.fg50) : degrade(v, -2, 0, env.fg50, null);
  const L = S.lro;
  const ok = (j) => j >= 0 && L[j] !== null;
  const croise = ok(i) && ok(i - 1);
  const avec2 = croise && ok(i - 2) && ok(i - 3);
  S.baisse[i] = croise && v < 0 && L[i - 1] >= 0;
  S.hausse[i] = croise && v > 0 && L[i - 1] <= 0;
  S.haut[i] = avec2 && v < L[i - 2] && L[i - 1] >= L[i - 3] && v > p.seuilHaut;
  S.bas[i] = avec2 && v > L[i - 2] && L[i - 1] <= L[i - 3] && v < p.seuilBas;
  if (S.haut[i]) o.plotchar(i - 1, { position: 'absolute', y: L[i - 1], caractere: '◇', couleur: p.couleurBaisse, taille: 'small' });
  if (S.bas[i]) o.plotchar(i - 1, { position: 'absolute', y: L[i - 1], caractere: '◇', couleur: p.couleurHausse, taille: 'small' });
  if (S.baisse[i]) o.plotchar(i - 1, { position: 'absolute', y: 0, caractere: '◆', couleur: p.couleurBaisse, taille: 'tiny' });
  if (S.hausse[i]) o.plotchar(i - 1, { position: 'absolute', y: 0, caractere: '◆', couleur: p.couleurHausse, taille: 'tiny' });
}

function rendre(p, e, data, env) {
  const S = e.sorties, n = data.length, o = e.o;
  const osc = new Array(n), bougies = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = S.lro[i];
    osc[i] = { time: data[i].time, value: v, color: S.colOsc[i] || 'rgba(0, 0, 0, 0)' };
    const c = p.colorerBougies && v !== null ? (v < 0 ? p.couleurBaisse : p.couleurHausse) : null;
    bougies[i] = { time: data[i].time, value: c ? 1 : null, color: c };
  }
  const bande = (a, b, c) => o.polyligne({
    points: [{ x: 0, y: a }, { x: n - 1, y: a }, { x: n - 1, y: b }, { x: 0, y: b }], fermee: true, couleur: null, fond: c,
  });
  bande(4, p.seuilHaut, milieu(null, transparence(p.couleurHausse, 75)));
  bande(p.seuilBas, -4, milieu(transparence(p.couleurBaisse, 75), null));
  o.etiquette({ x: n - 1, y: p.seuilHaut, texte: tostring(p.seuilHaut, '#.##########'), style: 'diamond', taille: 'tiny', couleurTexte: env.texte, couleur: p.couleurHausse });
  o.etiquette({ x: n - 1, y: p.seuilBas, texte: tostring(p.seuilBas, '#.##########'), style: 'diamond', taille: 'tiny', couleurTexte: env.texte, couleur: p.couleurBaisse });
  return {
    oscillateur: osc,
    zero: tracer(data, new Array(n).fill(0), S.colZero),
    bougies,
    croisementHausse: signaux(data, S.hausse),
    croisementBaisse: signaux(data, S.baisse),
    retourHaut: signaux(data, S.haut),
    retourBas: signaux(data, S.bas),
    objets: o.resultat(),
  };
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class OscillateurRegressionIndicator {
  static metadata = {
    id: 'oscillateur_regression',
    name: 'Oscillateur de régression linéaire',
    shortName: 'LRO',
    description: 'oscillateur_regression',
    version: '1.0.0',
    overlay: false,
    type: 'oscillator',
    category: 'Momentum',
    source: 'builtin',
    tags: ['regression lineaire', 'oscillateur', 'retour a la moyenne', 'seuils'],
    inputs: INPUTS,
    outputs: [
      { id: 'oscillateur', name: 'Oscillateur', type: 'histogram', color: '#10cab8' },
      { id: 'zero', name: 'Zéro', type: 'line', color: '#787B86', lineWidth: 2 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'croisementHausse', name: 'Passage au-dessus de zéro', type: 'line', hidden: true },
      { id: 'croisementBaisse', name: 'Passage sous zéro', type: 'line', hidden: true },
      { id: 'retourHaut', name: 'Retournement au-dessus du seuil haut', type: 'line', hidden: true },
      { id: 'retourBas', name: 'Retournement sous le seuil bas', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#10cab8', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: [
      alerte('passage_hausse', 'Passage au-dessus de zéro', 'croisementHausse'),
      alerte('passage_baisse', 'Passage sous zéro', 'croisementBaisse'),
      alerte('retour_haut', 'Retournement au-dessus du seuil haut', 'retourHaut'),
      alerte('retour_bas', 'Retournement sous le seuil bas', 'retourBas'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { oscillateur: [], zero: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    env.fg50 = transparence(env.texte, 50);
    return executer(OscillateurRegressionIndicator._memo, JSON.stringify([p, env.derniereConfirmee, env.texte]), data, {
      creer,
      etape: (etat, d, i, derniere) => etape(p, etat, d, i, derniere, env),
      rendre: (etat, d) => rendre(p, etat, d, env),
    });
  }
}
