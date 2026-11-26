// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Step Channel Momentum Trend [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/AsD2fDh7-Step-Channel-Momentum-Trend-ChartPrime/
// Adaptation : etat du marche en francais (« Plage », « Élan haussier », « Élan baissier »).
import { creerObjets } from '../academyscript/objets.js';
import { atr, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, tracer } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur des pivots', type: 'number', entier: true, default: 3, min: 1, max: 100, step: 1, group: P,
    description: 'Barres de chaque côté d’un sommet (creux) : il est confirmé autant de barres après.' },
  { id: 'multiple', name: 'Multiple de l’ATR 200', type: 'number', default: 0.6, min: 0, max: 20, step: 0.1, group: P,
    description: 'Demi-largeur du canal autour du milieu du dernier sommet et du dernier creux.' },
  { id: 'couleurHausse', name: 'Élan haussier', type: 'color', default: '#1ABE7F', group: S },
  { id: 'couleurPlage', name: 'Plage', type: 'color', default: '#FF9800', group: S },
  { id: 'couleurBaisse', name: 'Élan baissier', type: 'color', default: '#CA2641', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

function series(p, d) {
  const n = d.length;
  const ph = pivothigh(d, p.longueur, p.longueur), pl = pivotlow(d, p.longueur, p.longueur);
  const a = atr(d, 200);
  const milieuC = new Array(n), haut = new Array(n), bas = new Array(n), couleurs = new Array(n), etats = new Array(n);
  let h = null, l = null;
  for (let i = 0; i < n; i++) {
    if (!nul(ph[i])) h = ph[i];
    if (!nul(pl[i])) l = pl[i];
    const m = h === null || l === null ? null : (h + l) / 2;
    const e = nul(a[i]) ? null : a[i] * p.multiple;
    const up = m === null || e === null ? null : m + e, dn = m === null || e === null ? null : m - e;
    const hl2 = (d[i].high + d[i].low) / 2;
    let c = p.couleurPlage, etat = 'Plage';
    if (up !== null && hl2 > up) { c = p.couleurHausse; etat = 'Élan haussier'; }
    if (dn !== null && hl2 < dn) { c = p.couleurBaisse; etat = 'Élan baissier'; }
    milieuC[i] = m; haut[i] = up; bas[i] = dn; couleurs[i] = c; etats[i] = etat;
  }
  return { ph, pl, milieuC, haut, bas, couleurs, etats };
}

function etape(p, e, d, i, derniere, s, env) {
  if (!nul(s.ph[i])) e.o.etiquette({ x: i - p.longueur, y: s.ph[i], texte: '⬥', style: 'label_center', couleur: null, couleurTexte: env.texte, taille: 'normal' });
  if (!nul(s.pl[i])) e.o.etiquette({ x: i - p.longueur, y: s.pl[i], texte: '⬥', style: 'label_center', couleur: null, couleurTexte: env.texte, taille: 'normal' });
  if (derniere) e.o.etiquette({ x: i, y: d[i].close, texte: s.etats[i], style: 'label_left', couleur: null, couleurTexte: s.couleurs[i], taille: 'large' });
}

export default class CanalPivotsElanIndicator {
  static metadata = {
    id: 'canal_pivots_elan',
    name: 'Canal des sommets et creux et élan',
    shortName: 'CANAL-ELAN',
    description: 'canal_pivots_elan',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['canal', 'pivots', 'sommets', 'creux', 'atr', 'elan', 'bougies colorees'],
    inputs: INPUTS,
    outputs: [
      { id: 'milieu', name: 'Milieu', type: 'line', color: '#FF9800', lineWidth: 3 },
      { id: 'haut', name: 'Bord haut', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'bas', name: 'Bord bas', type: 'line', color: '#F1F1F1', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#FF9800', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { milieu: [], haut: [], bas: [], bougies: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CanalPivotsElanIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => ({ o: creerObjets({ maxEtiquettes: 500 }) }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => ({
        milieu: tracer(d, s.milieuC, s.couleurs),
        haut: tracer(d, s.haut, new Array(d.length).fill(env.texte)),
        bas: tracer(d, s.bas, new Array(d.length).fill(env.texte)),
        bougies: d.map((b, i) => ({ time: b.time, value: 1, color: s.couleurs[i] })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
