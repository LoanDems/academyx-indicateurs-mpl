// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « HTF Candle Volume Thermometer [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/Vo99POv0-HTF-Candle-Volume-Thermometer-ChartPrime/
// Adaptation : periodes de l'unite superieure agregees depuis les bougies du graphique (request.securite, grille UTC,
// semaines au lundi) ; la premiere barre du graphique ne compte pas comme un changement de periode.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr } from '../academyscript/ta.js';
import { securite } from '../academyscript/request.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, transparence, degrade } from './commun.js';

const P = 'Paramètres', S = 'Style';
const RESOLUTIONS = [{ label: 'Fine (ATR / 5)', value: 'High' }, { label: 'Moyenne (ATR / 3)', value: 'Mid' }, { label: 'Grossière (ATR)', value: 'Low' }];
const INPUTS = [
  { id: 'unite', name: 'Unité supérieure', type: 'timeframe', default: '1D', group: P,
    description: 'À chaque nouvelle période, la période précédente est découpée en rangées et chaque rangée prend la couleur du volume des clôtures qu’elle contient.' },
  { id: 'resolution', name: 'Hauteur des rangées', type: 'select', default: 'Mid', options: RESOLUTIONS, group: P },
  { id: 'couleurHausse', name: 'Période haussière', type: 'color', default: '#00E676', group: S },
  { id: 'couleurBaisse', name: 'Période baissière', type: 'color', default: '#F23645', group: S },
  { id: 'transparence', name: 'Transparence des rangées faibles', type: 'number', entier: true, default: 80, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurChaleur', name: 'Volume fort', type: 'color', default: '#FDD835', group: S },
  { id: 'couleurMax', name: 'Rangée la plus forte', type: 'color', default: '#F23645', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const DIV = { High: 5, Mid: 3, Low: 1 };

function series(p, d, ctx) {
  const opt = { ctx, lookahead: true };
  const debut = securite(d, p.unite, (h) => h.map((b) => b.time), opt);
  // request.security(_, close[1], lookahead_on) : cloture et ouverture de la periode precedente.
  const cH = securite(d, p.unite, (h) => h.map((_, k) => (k > 0 ? h[k - 1].close : null)), opt);
  const oH = securite(d, p.unite, (h) => h.map((_, k) => (k > 0 ? h[k - 1].open : null)), opt);
  const a = taAtr(d, 200);
  return { change: debut.map((t, i) => i > 0 && !nul(t) && !nul(debut[i - 1]) && t !== debut[i - 1]), cH, oH, pas: a.map((v) => (nul(v) ? null : v / DIV[p.resolution])) };
}

function etape(p, e, d, i, s) {
  const o = e.o;
  if (s.change[i]) {
    const debutPrec = e.index;
    e.index = i;
    const taille = nul(e.H) || nul(e.L) ? null : e.H - e.L;
    const niv = taille === null || nul(s.pas[i]) ? null : Math.trunc(taille / s.pas[i]);
    if (niv !== null && Number.isFinite(niv) && !nul(debutPrec)) {
      const bin = taille / niv, L = e.L;
      // for i = 0 to levels - 1 : avec levels = 0, Pine parcourt 0 puis -1 (deux cases vides, aucune boite).
      const vols = niv >= 1 ? new Array(niv).fill(0) : [0, 0];
      if (niv >= 1) {
        for (let j = 0; j <= i - debutPrec; j++) {
          const b = d[i - j];
          for (let k = 0; k < niv; k++) {
            const bas = L + bin * k, haut = bas + bin;
            if (b.close >= bas && b.close <= haut) vols[k] = vols[k] + b.volume;
          }
        }
      }
      let mn = Infinity, mx = -Infinity;
      for (const v of vols) { if (v < mn) mn = v; if (v > mx) mx = v; }
      if (vols.length > 0 && mx > mn) {
        const hausse = !nul(s.cH[i]) && !nul(s.oH[i]) && s.cH[i] > s.oH[i];
        const c1Bas = transparence(p.couleurHausse, p.transparence), c2Bas = transparence(p.couleurBaisse, p.transparence);
        for (let k = 0; k < niv; k++) {
          const v = vols[k], norme = (v - mn) / (mx - mn);
          const c = mx === v ? p.couleurMax : hausse ? degrade(norme, 0, 1, c1Bas, p.couleurChaleur) : degrade(norme, 0, 1, c2Bas, p.couleurChaleur);
          const bas = L + bin * k, haut = bas + bin;
          o.boite({ gauche: debutPrec, haut, droite: i, bas, fond: c, couleurBordure: null, texte: mx === v ? tostring(v, 'volume') : '', couleurTexte: '#000000' });
        }
      }
    }
    // highh.clear() : H et L gardent leur valeur jusqu'a la prochaine barre de la periode (array.max d'un seul element).
    e.vide = true;
  } else {
    const b = d[i];
    e.H = e.vide || nul(e.H) ? b.high : Math.max(e.H, b.high);
    e.L = e.vide || nul(e.L) ? b.low : Math.min(e.L, b.low);
    e.vide = false;
  }
}

export default class ThermometreVolumeSuperieurIndicator {
  static metadata = {
    id: 'thermometre_volume_superieur',
    name: 'Thermomètre du volume par période supérieure',
    shortName: 'TVS',
    description: 'thermometre_volume_superieur',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['volume', 'profil', 'unite superieure', 'chaleur', 'poc'],
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
    const pas = ctx && ctx.timeframe && ctx.timeframe.platform;
    return executer(ThermometreVolumeSuperieurIndicator._memo, JSON.stringify([p, pas || '']), data, {
      creer: () => ({ o: creerObjets({ maxBoites: 500 }), index: null, H: null, L: null, vide: true }),
      series: (d) => series(p, d, ctx),
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, s),
      rendre: (e) => ({ objets: e.o.resultat() }),
    });
  }
}
