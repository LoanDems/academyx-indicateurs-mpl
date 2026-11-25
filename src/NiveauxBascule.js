// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Market Shift Levels [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/urTBALXa-Market-Shift-Levels-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { hma, crossover, crossunder } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 55, min: 2, max: 500, step: 1, group: P,
    description: 'Moyenne de Hull des clôtures : un niveau est posé quand elle croise sa valeur d’il y a 5 barres.' },
  { id: 'donnee', name: 'Valeur des étiquettes', type: 'select', default: 'Volume', group: P,
    options: [{ label: 'Volume des 3 barres', value: 'Volume' }, { label: 'Prix', value: 'Price' }] },
  { id: 'couleurHausse', name: 'Au-dessus du niveau', type: 'color', default: '#24d580', group: S },
  { id: 'couleurBaisse', name: 'Sous le niveau', type: 'color', default: '#e12b2b', group: S },
];
const ROUGE = '#F23645', VERT = '#00E676';

function series(p, d) {
  const n = d.length;
  const h1 = hma(d.map((b) => b.close), p.longueur);
  const h2 = h1.map((_, i) => (i >= 5 ? h1[i - 5] : null));
  const xo = crossover(h1, h2), xu = crossunder(h1, h2);
  const niveau = new Array(n), trace = new Array(n), couleurs = new Array(n), bougies = new Array(n);
  let lv = null;
  for (let i = 0; i < n; i++) {
    if (xo[i]) lv = d[i].low;
    if (xu[i]) lv = d[i].high;
    niveau[i] = lv;
    const prec = i > 0 ? niveau[i - 1] : null;
    // level != level[1] (comparaison avec na fausse) ? na : level
    trace[i] = lv !== null && prec !== null && lv !== prec ? null : lv;
    couleurs[i] = i % 2 === 0 ? null : 'fg';
    bougies[i] = lv !== null && d[i].close < lv ? p.couleurBaisse : p.couleurHausse;
  }
  return { niveau, trace, couleurs, bougies };
}

function etape(p, e, d, i, s) {
  const lv = s.niveau[i];
  if (lv === null || i < 2) return;
  const b = d[i], b1 = d[i - 1], b2 = d[i - 2];
  const vol = b2.volume + b1.volume + b.volume;
  const texte = () => (p.donnee === 'Volume' ? tostring(vol, 'volume') : tostring(b1.high, '#,####.###'));
  if (b2.high < lv && b.high < lv && b1.high > lv) e.o.etiquette({ x: i - 1, y: b1.high, texte: `${texte()}\n⬙`, couleur: null, couleurTexte: ROUGE, style: 'label_down' });
  if (b2.low > lv && b1.low < lv && b.low > lv) e.o.etiquette({ x: i - 1, y: b1.low, texte: `⬘\n${texte()}`, couleur: null, couleurTexte: VERT, style: 'label_up' });
}

export default class NiveauxBasculeIndicator {
  static metadata = {
    id: 'niveaux_bascule',
    name: 'Niveaux de bascule de la moyenne de Hull',
    shortName: 'BASCULE',
    description: 'niveaux_bascule',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['niveaux', 'moyenne de hull', 'croisement', 'retournement', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'niveau', name: 'Niveau', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#24d580', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { niveau: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NiveauxBasculeIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500 }) }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, s),
      rendre: (etat, d, s) => ({
        niveau: tracer(d, s.trace, s.couleurs.map((c) => (c ? env.texte : null))),
        bougies: d.map((b, i) => ({ time: b.time, value: 1, color: s.bougies[i] })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
