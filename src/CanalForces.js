// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Support and Resistance Power Channel [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/6WDeQiyp-Support-and-Resistance-Power-Channel-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { atr } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const GRIS = '#787B86';
const INPUTS = [
  { id: 'longueur', name: 'Barres du canal', type: 'number', entier: true, default: 130, min: 1, max: 500, step: 1, group: 'Paramètres',
    description: 'Le canal part du plus haut et du plus bas de ces dernières barres ; les forces comptent leurs bougies haussières et baissières.' },
  { id: 'prolongement', name: 'Prolongement à droite (barres)', type: 'number', entier: true, default: 30, min: 20, max: 100, step: 1, group: 'Paramètres' },
  { id: 'couleurHaut', name: 'Haut du canal', type: 'color', default: '#E040FB', group: 'Style' },
  { id: 'couleurBas', name: 'Bas du canal', type: 'color', default: '#00E676', group: 'Style' },
];

const creer = () => ({ o: creerObjets({ maxEtiquettes: 12 }) });

function dessiner(p, o, data, s, env) {
  const i = data.length - 1;
  const L = p.longueur, E = p.prolongement;
  let haut = null, bas = null, iHaut = -1, iBas = -1;
  for (let k = 0; k < L; k++) {
    const b = data[i - k];
    if (!b) break;
    if (haut === null || b.high > haut) { haut = b.high; iHaut = k; }
    if (bas === null || b.low < bas) { bas = b.low; iBas = k; }
  }
  const milieu = (haut + bas) / 2;
  const sansFond = { couleur: null, style: 'label_center' };
  o.etiquette({ x: i + E + 15, y: haut, texte: tostring(haut, '🡅 #.##'), ...sansFond, couleurTexte: env.texte });
  o.etiquette({ x: i + E + 15, y: bas, texte: tostring(bas, '🡇 #.##'), ...sansFond, couleurTexte: env.texte });
  o.etiquette({ x: i + E, y: milieu, texte: tostring(milieu, '🡆 #.##'), couleur: null, style: 'label_left', couleurTexte: GRIS });
  o.ligne({ x1: i - L, y1: milieu, x2: i + E, y2: milieu, couleur: GRIS, style: 'dotted' });
  o.etiquette({ x: i - iHaut, y: haut, texte: '✖', ...sansFond, couleurTexte: p.couleurHaut, taille: 'normal' });
  o.etiquette({ x: i - iBas, y: bas, texte: '✖', ...sansFond, couleurTexte: p.couleurBas, taille: 'normal' });

  const demi = s.atr[i] === null ? null : s.atr[i] * 0.5;
  const plus = (v, d) => (d === null ? null : v + d);
  const moins = (v, d) => (d === null ? null : v - d);
  o.ligne({ x1: i - L, y1: plus(haut, demi), x2: i + E + 30, y2: plus(haut, demi), couleur: p.couleurHaut, style: 'solid' });
  o.ligne({ x1: i - L, y1: moins(bas, demi), x2: i + E + 30, y2: moins(bas, demi), couleur: p.couleurBas, style: 'solid' });
  const zoneHaut = o.boite({ gauche: i - L, haut: plus(haut, demi), droite: i + E, bas: moins(haut, demi), couleurBordure: null, fond: transparence(p.couleurHaut, 80) });
  const zoneBas = o.boite({ gauche: i - L, haut: plus(bas, demi), droite: i + E, bas: moins(bas, demi), couleurBordure: null, fond: transparence(p.couleurBas, 80) });

  for (let k = 0; k < L; k++) {
    const b1 = data[i - k], b2 = data[i - (k > 0 ? k + 1 : k)];
    if (!b1 || !b2) continue;
    if (zoneBas.haut !== null && b1.low > zoneBas.haut && b2.low <= zoneBas.haut) {
      o.etiquette({ x: i - k, y: b2.low, texte: '◈', couleurTexte: p.couleurBas, couleur: null, style: 'label_up', taille: 'large' });
    }
    if (zoneHaut.bas !== null && b1.high < zoneHaut.bas && b2.high >= zoneHaut.bas) {
      o.etiquette({ x: i - k, y: b2.high, texte: '◈', couleurTexte: p.couleurHaut, couleur: null, style: 'label_down', taille: 'large' });
    }
  }

  let achats = 0, ventes = 0;
  for (let k = 0; k < L; k++) {
    const b = data[i - k];
    if (!b) continue;
    if (b.close > b.open) achats++;
    if (b.close < b.open) ventes++;
  }
  const force = { couleurTexte: env.texte, alignH: 'left', tailleTexte: 'normal' };
  Object.assign(zoneBas, force, { texte: tostring(achats, '            Force acheteuse : #') });
  Object.assign(zoneHaut, force, { texte: tostring(ventes, '            Force vendeuse : #') });
}

export default class CanalForcesIndicator {
  static metadata = {
    id: 'canal_forces',
    name: 'Canal haut-bas avec forces acheteuse et vendeuse',
    shortName: 'CANAL-F',
    description: 'canal_forces',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['canal', 'support', 'resistance', 'plus haut', 'plus bas', 'force'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CanalForcesIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => ({ atr: atr(d, 200) }),
      etape: (etat, d, i, derniere, s) => { if (derniere) dessiner(p, etat.o, d, s, env); },
      rendre: (etat) => ({ objets: etat.o.resultat() }),
    });
  }
}
