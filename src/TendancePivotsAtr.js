// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Pivot Trend [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/AOTPWbpq-Pivot-Trend-ChartPrime/
// Adaptation : marques 🅑 / 🅢 du script rendues 🅐 (achat) / 🅥 (vente) ; le degrade vertical du fill() prend la couleur a mi-hauteur.
import { creerObjets } from '../academyscript/objets.js';
import { atr, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, tracer, transparence, milieu, remplir, suiteVide, masque, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'gauche', name: 'Barres à gauche', type: 'number', entier: true, default: 10, min: 1, max: 200, step: 1, group: P,
    description: 'Un sommet (creux) doit dépasser autant de barres avant lui.' },
  { id: 'droite', name: 'Barres à droite', type: 'number', entier: true, default: 10, min: 1, max: 200, step: 1, group: P,
    description: 'Et autant de barres après lui : il n’est confirmé qu’après ces barres.' },
  { id: 'decalage', name: 'Décalage (× ATR 200)', type: 'number', default: 2, min: 0, max: 20, step: 0.01, group: P,
    description: 'Les sommets sont cherchés sur le plus haut plus ce multiple de l’ATR, les creux sur le plus bas moins ce multiple.' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#2962FF', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#F23645', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

function series(p, d) {
  const n = d.length;
  const a = atr(d, 200);
  const ph = pivothigh(d.map((b, i) => (nul(a[i]) ? null : b.high + a[i] * p.decalage)), p.gauche, p.droite);
  const pl = pivotlow(d.map((b, i) => (nul(a[i]) ? null : b.low - a[i] * p.decalage)), p.gauche, p.droite);
  const tendance = new Array(n), sens = new Array(n), haut = new Array(n), basT = new Array(n), couleurs = new Array(n);
  const hl2 = d.map((b) => (b.high + b.low) / 2), achat = new Array(n), vente = new Array(n), fonds = new Array(n);
  let phy = null, ply = null;
  for (let i = 0; i < n; i++) {
    // bool(x) : faux pour na et pour 0
    if (!nul(ph[i]) && ph[i] !== 0) phy = ph[i];
    if (!nul(pl[i]) && pl[i] !== 0) ply = pl[i];
    const precHaut = i > 0 && !nul(haut[i - 1]) ? haut[i - 1] : 0;
    haut[i] = phy; basT[i] = ply;
    const precTendance = i > 0 ? tendance[i - 1] : null;
    let t;
    // prevTrend == prevUpperBand : faux si prevTrend est na
    if (!nul(precTendance) && precTendance === precHaut) t = phy !== null && d[i].close > phy ? 1 : -1;
    else t = ply !== null && d[i].close < ply ? -1 : 1;
    sens[i] = t;
    tendance[i] = t === 1 ? ply : phy;
    const c = t === 1 ? p.couleurHausse : p.couleurBaisse;
    couleurs[i] = c;
    fonds[i] = milieu(transparence(c, 85), transparence(c, 99));
    achat[i] = i > 0 && t > 0 && sens[i - 1] <= 0;
    vente[i] = i > 0 && t < 0 && sens[i - 1] >= 0;
  }
  return {
    tendance, hl2, fonds, achat, vente,
    baisse: tendance.map((v, i) => (sens[i] < 0 ? v : null)), hausse: tendance.map((v, i) => (sens[i] < 0 ? null : v)), couleurs,
  };
}

function etape(p, e, d, i, derniere, s) {
  remplir(e.o, e.fond, s.tendance, s.hl2, i, s.fonds[i], derniere);
  if (s.achat[i] && !nul(s.tendance[i])) e.o.plotchar(i, { position: 'absolute', y: s.tendance[i], caractere: '🅐', couleur: p.couleurHausse, taille: 'small' });
  if (s.vente[i] && !nul(s.tendance[i])) e.o.plotchar(i, { position: 'absolute', y: s.tendance[i], caractere: '🅥', couleur: p.couleurBaisse, taille: 'small' });
}

const ALERTES = [['passage_hausse', 'Passage en tendance haussière'], ['passage_baisse', 'Passage en tendance baissière']];

export default class TendancePivotsAtrIndicator {
  static metadata = {
    id: 'tendance_pivots_atr',
    name: 'Tendance des sommets et creux décalés de l’ATR',
    shortName: 'PIV-TEND',
    description: 'tendance_pivots_atr',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'pivots', 'sommets', 'creux', 'atr', 'stop suiveur'],
    inputs: INPUTS,
    outputs: [
      { id: 'baisse', name: 'Tendance baissière', type: 'line', color: '#F23645' },
      { id: 'hausse', name: 'Tendance haussière', type: 'line', color: '#2962FF' },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data) {
    if (!Array.isArray(data) || data.length === 0) return { baisse: [], hausse: [], signaux: [] };
    const p = this.params;
    return executer(TendancePivotsAtrIndicator._memo, JSON.stringify(p), data, {
      creer: () => ({ o: creerObjets({ maxPolylignes: 500 }), fond: suiteVide() }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s),
      rendre: (etat, d, s) => ({
        baisse: tracer(d, s.baisse, s.couleurs),
        hausse: tracer(d, s.hausse, s.couleurs),
        signaux: masque(d, [s.achat, s.vente]),
        objets: etat.o.resultat(),
      }),
    });
  }
}
