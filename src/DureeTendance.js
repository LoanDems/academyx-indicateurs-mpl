// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trend Duration Forecast [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/L3SJFfAQ-Trend-Duration-Forecast-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { hma } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'lissage', name: 'Lissage (moyenne de Hull)', type: 'number', entier: true, default: 50, min: 2, max: 500, step: 1, group: P },
  { id: 'sensibilite', name: 'Barres de pente', type: 'number', entier: true, default: 3, min: 1, max: 50, step: 1, group: P,
    description: 'La tendance passe haussière quand la moyenne monte sur autant de barres de suite (baissière quand elle descend).' },
  { id: 'echantillons', name: 'Tendances mémorisées', type: 'number', entier: true, default: 10, min: 2, max: 50, step: 1, group: P,
    description: 'Durées passées dont la moyenne donne la durée probable de la tendance en cours.' },
  { id: 'couleurHausse', name: 'Tendance haussière', type: 'color', default: '#12e49e', group: S },
  { id: 'couleurBaisse', name: 'Tendance baissière', type: 'color', default: '#ec5610', group: S },
];

const GRIS = '#787B86';
/** array.avg d'un tableau d'entiers : entier (le script le passe a line.set_x2, qui veut un int) ; tronque. */
const moyenne = (t) => { if (!t.length) return NaN; let s = 0; for (const v of t) s += v; return Math.trunc(s / t.length); };
const fmt = (v, motif) => (Number.isFinite(v) ? tostring(v, motif) : 'NaN');
const nul = (v) => (Number.isFinite(v) ? v : null);

function creer() {
  return {
    o: creerObjets({ maxEtiquettes: 50, maxLignes: 50 }),
    sorties: { tendance: [] },
    tendance: false, compte: 0, hausses: [], baisses: [], etHaut: null, etBas: null, ligne: null, etDuree: null,
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, S = e.sorties, h = s.hma;
  const conf = !derniere || env.derniereConfirmee;
  const monte = (n) => { for (let k = 1; k <= n; k++) if (!(i - k >= 0 && h[i] !== null && h[i - k] !== null && h[i] > h[i - k])) return false; return true; };
  const descend = (n) => { for (let k = 1; k <= n; k++) if (!(i - k >= 0 && h[i] !== null && h[i - k] !== null && h[i] < h[i - k])) return false; return true; };
  if (conf) {
    if (monte(p.sensibilite)) e.tendance = true;
    if (descend(p.sensibilite)) e.tendance = false;
  }
  S.tendance[i] = e.tendance;
  e.compte += 1;
  const avant = i > 0 ? S.tendance[i - 1] : false;
  const h1 = i > 0 ? nul(h[i - 1]) : null;
  if (e.tendance !== avant) {
    if (e.ligne) o.supprimer(e.ligne);
    if (e.etDuree) o.supprimer(e.etDuree);
    if (e.etHaut) e.etHaut.infobulle = '';
    if (e.etBas) e.etBas.infobulle = '';
    if (e.tendance) {
      e.baisses.push(e.compte);
      e.etHaut = o.etiquette({ x: i, y: nul(h[i]), texte: `Tendance ↑\nDurée probable : ${fmt(moyenne(e.hausses), '##')}`, couleur: null, couleurTexte: p.couleurHausse, style: 'label_up',
        infobulle: 'Nouvelle tendance haussière.\nAffiche la durée réelle de la tendance haussière en cours.' });
      if (e.etBas) e.etBas.texte = `Tendance ↓\n${fmt(e.compte, null)}\n`;
      e.ligne = o.ligne({ x1: i - 1, y1: h1, x2: i, y2: h1, couleur: env.texte, style: 'solid', fleches: 'right' });
      e.etDuree = o.etiquette({ x: i, y: h1, texte: '', style: 'label_up', couleurTexte: env.texte, couleur: null,
        infobulle: 'Prolongement estimé de la tendance haussière, d’après la durée moyenne des précédentes.' });
    } else {
      e.hausses.push(e.compte);
      e.etBas = o.etiquette({ x: i, y: nul(h[i]), texte: `Tendance ↓\nDurée probable : ${fmt(moyenne(e.baisses), '##')}`, couleur: null, couleurTexte: p.couleurBaisse, style: 'label_down',
        infobulle: 'Nouvelle tendance baissière.\nAffiche la durée réelle de la tendance baissière en cours.' });
      if (e.etHaut) e.etHaut.texte = `\n${fmt(e.compte, null)}\nTendance ↑`;
      e.ligne = o.ligne({ x1: i - 1, y1: h1, x2: i, y2: h1, couleur: env.texte, style: 'solid', fleches: 'right' });
      e.etDuree = o.etiquette({ x: i, y: h1, texte: '', style: 'label_down', couleurTexte: env.texte, couleur: null,
        infobulle: 'Prolongement estimé de la tendance baissière, d’après la durée moyenne des précédentes.' });
    }
    e.compte = 0;
  }
  const liste = e.tendance ? e.hausses : e.baisses;
  if (!e.tendance) { if (e.etBas) e.etBas.texte = `Tendance ↓\nDurée réelle : ${fmt(e.compte, null)}\n`; } else if (e.etHaut) e.etHaut.texte = `Tendance ↑\nDurée réelle : ${fmt(e.compte, null)}`;
  if (e.ligne) {
    e.ligne.x2 = nul(e.ligne.x1 + moyenne(liste) + 1);
    const m = (e.ligne.x1 + (e.ligne.x2 === null ? NaN : e.ligne.x2)) / 2;
    e.etDuree.x = Number.isFinite(m) ? Math.trunc(m) : null;
    e.etDuree.texte = `Durée probable\n${fmt(moyenne(liste), '##')}`;
  }
  if (e.hausses.length > p.echantillons) e.hausses.shift();
  if (e.baisses.length > p.echantillons) e.baisses.shift();

  if (!derniere) return;
  const H = e.hausses, B = e.baisses;
  const t = o.tableau({ position: 'bottom_right', colonnes: 100, lignes: 100 });
  const cel = (c, l, texte, couleurTexte, infobulle) => t.cellule(c, l, { texte, couleurTexte, infobulle });
  for (let k = 0; k < H.length; k++) {
    cel(0, k + 1, String(k + 1), GRIS, 'Rang de l’échantillon (1 = la tendance la plus ancienne gardée)');
    if (k === 0) cel(1, k, 'Tendance ↑', p.couleurHausse, 'Durées des tendances haussières (moyenne de Hull qui monte)');
    cel(1, k + 1, String(H[k]), env.texte, `Durée de la tendance haussière n° ${k + 1} (${H[k]} barres)`);
    if (k >= B.length) continue;
    if (k === 0) cel(2, k, 'Tendance ↓', p.couleurBaisse, 'Durées des tendances baissières (moyenne de Hull qui descend)');
    cel(2, k + 1, String(B[k]), env.texte, `Durée de la tendance baissière n° ${k + 1} (${B[k]} barres)`);
  }
  if (H.length) {
    cel(1, H.length + 1, fmt(moyenne(H), '##'), p.couleurHausse, `Durée moyenne des dernières tendances haussières (${fmt(moyenne(H), '##')} barres)`);
    cel(2, H.length + 1, fmt(moyenne(B), '##'), p.couleurBaisse, `Durée moyenne des dernières tendances baissières (${fmt(moyenne(B), '##')} barres)`);
  }
}

function rendre(p, e, d, s) {
  const couleurs = e.sorties.tendance.map((t) => (t ? p.couleurHausse : p.couleurBaisse));
  return { moyenne: tracer(d, s.hma, couleurs), objets: e.o.resultat() };
}

export default class DureeTendanceIndicator {
  static metadata = {
    id: 'duree_tendance',
    name: 'Durée probable de la tendance',
    shortName: 'DUREE-T',
    description: 'duree_tendance',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['tendance', 'duree', 'moyenne de hull', 'statistique'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenne', name: 'Moyenne de Hull', type: 'line', color: '#12e49e', lineWidth: 3 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { moyenne: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(DureeTendanceIndicator._memo, JSON.stringify([p, env.derniereConfirmee, env.texte]), data, {
      creer,
      series: (d) => ({ hma: hma(d.map((b) => b.close), p.lissage) }),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
