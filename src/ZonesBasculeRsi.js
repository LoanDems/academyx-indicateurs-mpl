// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « RSI Shift Zone [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/5azMGL1V-RSI-Shift-Zone-ChartPrime/
// Adaptation : seule la partie que le script pose sur le graphique des prix (force_overlay : canal, milieu, remplissage, bougies,
// valeurs du RSI) est dessinee, sur les prix ; le panneau du RSI (courbe, niveaux, cercles) ne l'est pas.
import { creerObjets } from '../academyscript/objets.js';
import { rsi, crossover, crossunder } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, remplir, suiteVide, masque, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur du RSI', type: 'number', entier: true, default: 14, min: 1, max: 500, step: 1, group: P,
    description: 'Une zone s’ouvre quand le RSI passe au-dessus de 70 ou sous 30 ; elle prend le plus haut et le plus bas de cette bougie.' },
  { id: 'dureeMin', name: 'Durée minimale d’une zone (barres)', type: 'number', entier: true, default: 15, min: 1, max: 500, step: 1, group: P,
    description: 'Aucune nouvelle zone ne s’ouvre avant ce nombre de barres.' },
  { id: 'afficherValeurs', name: 'Afficher le niveau et le RSI à l’ouverture', type: 'boolean', default: false, group: S,
    description: 'Étiquette « <niveau> · RSI <valeur> » sur la bougie d’ouverture, par exemple « 70 · RSI 73,4 » : le niveau haut ou bas affiché ci-dessous, puis la valeur du RSI à la clôture de cette bougie.' },
  { id: 'niveauHaut', name: 'Niveau haut affiché', type: 'number', entier: true, default: 70, min: 50, max: 100, step: 1, group: S },
  { id: 'niveauBas', name: 'Niveau bas affiché', type: 'number', entier: true, default: 30, min: 0, max: 50, step: 1, group: S },
  { id: 'couleurHausse', name: 'Au-dessus de 70', type: 'color', default: '#21c997', group: S },
  { id: 'couleurBaisse', name: 'Sous 30', type: 'color', default: '#cc24e2', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
// « 70 · RSI 73,4 » : niveau reglé, puis RSI de la bougie d'ouverture (une décimale, virgule).
const texteEtiquette = (niveau, valeur) => (nul(valeur) ? `${niveau}` : `${niveau} · RSI ${valeur.toFixed(1).replace('.', ',')}`);

function series(p, d) {
  const n = d.length, r = rsi(d.map((b) => b.close), p.longueur);
  const xh = crossover(r, 70), xb = crossunder(r, 30);
  const haut = new Array(n), bas = new Array(n), couleur = new Array(n), bougie = new Array(n), ch = new Array(n), cb = new Array(n), cr = new Array(n);
  let debut = null, actif = false, up = null, lo = null, cc = null;
  for (let i = 0; i < n; i++) {
    const b = d[i];
    ch[i] = xh[i] && !actif; cb[i] = xb[i] && !actif;
    cr[i] = degrade(r[i], 30, 70, p.couleurBaisse, p.couleurHausse);
    bougie[i] = null;
    if (ch[i] || cb[i]) { debut = i; actif = true; up = b.high; lo = b.low; cc = cr[i]; bougie[i] = cr[i]; }
    if (debut !== null && i - debut >= p.dureeMin) actif = false;
    const change = ch[i] !== (i > 0 ? ch[i - 1] : false) || cb[i] !== (i > 0 ? cb[i - 1] : false);
    haut[i] = change ? null : up; bas[i] = change ? null : lo; couleur[i] = cc;
  }
  const milieu = haut.map((h, i) => (nul(h) || nul(bas[i]) ? null : (h + bas[i]) / 2));
  return { haut, bas, milieu, couleur, bougie, ch, cb, r };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i];
  remplir(o, e.fond, s.haut, s.bas, i, transparence(s.couleur[i], 90), derniere);
  if (p.afficherValeurs && (s.ch[i] || s.cb[i])) {
    o.etiquette({ x: i, y: (b.high + b.low) / 2, texte: texteEtiquette(s.ch[i] ? p.niveauHaut : p.niveauBas, s.r[i]), style: 'label_right', couleur: null, couleurTexte: env.texte });
  }
}

function rendre(p, e, d, s) {
  const n = d.length, gris = new Array(n).fill(GRIS), large = s.couleur.map((c) => transparence(c, 70));
  return {
    haut: tracer(d, s.haut, s.couleur, -1),
    bas: tracer(d, s.bas, s.couleur, -1),
    hautLarge: tracer(d, s.haut, large),
    basLarge: tracer(d, s.bas, large),
    milieu: tracer(d, s.milieu, gris, -1),
    milieuLarge: tracer(d, s.milieu, gris),
    bougies: d.map((b, i) => ({ time: b.time, value: s.bougie[i] ? 1 : null, color: s.bougie[i] })),
    signaux: masque(d, [s.ch, s.cb]),
    objets: e.o.resultat(),
  };
}

export default class ZonesBasculeRsiIndicator {
  static metadata = {
    id: 'zones_bascule_rsi',
    name: 'Zones de bascule du RSI',
    shortName: 'RSI-ZONES',
    description: 'zones_bascule_rsi',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['rsi', 'zone', 'canal', 'surachat', 'survente'],
    inputs: INPUTS,
    outputs: [
      { id: 'haut', name: 'Haut de la zone', type: 'line', color: '#21c997', lineWidth: 1 },
      { id: 'bas', name: 'Bas de la zone', type: 'line', color: '#21c997', lineWidth: 1 },
      { id: 'hautLarge', name: 'Haut de la zone (trait large)', type: 'line', color: 'rgba(33, 201, 151, 0.3)', lineWidth: 3 },
      { id: 'basLarge', name: 'Bas de la zone (trait large)', type: 'line', color: 'rgba(33, 201, 151, 0.3)', lineWidth: 3 },
      { id: 'milieu', name: 'Milieu', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'milieuLarge', name: 'Milieu (prolongé)', type: 'line', color: GRIS, lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#21c997', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    alertConditions: [
      { id: 'zone_haute', title: 'Zone ouverte (RSI au-dessus de 70)', message: 'Zone ouverte (RSI au-dessus de 70)', when: 'custom', source: 'signaux', condition: bit(0) },
      { id: 'zone_basse', title: 'Zone ouverte (RSI sous 30)', message: 'Zone ouverte (RSI sous 30)', when: 'custom', source: 'signaux', condition: bit(1) },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { haut: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(ZonesBasculeRsiIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500, maxPolylignes: 500 }), fond: suiteVide() }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
