// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Higher Timeframe High & Low [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/foH3S980-Higher-Timeframe-High-Low-ChartPrime/
// Adaptation : unite superieure agregee depuis les bougies du graphique (request.securite, sans lecture du futur) ; textes en francais ;
// couleurs reglables ; fond des changements de periode a la couleur du texte du theme sombre ; moyenne en points ou en marches selon « Tendance ».
import { creerObjets } from '../academyscript/objets.js';
import { crossover, crossunder } from '../academyscript/ta.js';
import { securite } from '../academyscript/request.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'unite', name: 'Unité supérieure', type: 'timeframe', default: '1D', group: P,
    description: 'Le plus haut et le plus bas de la dernière période close de cette unité, connus à l’ouverture de la période suivante.' },
  { id: 'separateur', name: 'Marquer le début des périodes', type: 'boolean', default: false, group: P },
  { id: 'tendance', name: 'Tendance', type: 'boolean', default: false, group: P,
    description: 'Bougies colorées par la dernière cassure (au lieu de la seule bougie de cassure), niveaux en continu.' },
  { id: 'cassures', name: 'Étiquettes de cassure', type: 'boolean', default: false, group: P },
  { id: 'extension', name: 'Prolongement à droite (barres)', type: 'number', entier: true, default: 50, min: 0, max: 500, step: 1, group: S },
  { id: 'couleurHaut', name: 'Plus haut', type: 'color', default: '#d41919', group: S },
  { id: 'couleurBas', name: 'Plus bas', type: 'color', default: '#13b818', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const SEPARATION = 'rgba(241, 241, 241, 0.1)';

function pasDuGraphique(data, ctx) {
  const s = ctx && ctx.timeframe && ctx.timeframe.in_seconds;
  if (s > 0) return s;
  const ecarts = [];
  for (let k = Math.max(1, data.length - 200); k < data.length; k++) { const e = data[k].time - data[k - 1].time; if (e > 0) ecarts.push(e); }
  ecarts.sort((a, b) => a - b);
  return ecarts.length ? ecarts[ecarts.length >> 1] : 60;
}

function series(p, d, ctx, env) {
  const n = d.length, pas = pasDuGraphique(d, ctx);
  // request.security(tf, high[0])[1] sur l'historique (high[1])[0] en temps reel : la meme valeur,
  // le plus haut de la derniere periode close a l'ouverture de la barre.
  const opt = { ctx, pasGraphique: `${pas}s`, derniereEnCours: false };
  const sH = securite(d, p.unite, (h) => h.map((b) => b.high), opt), sL = securite(d, p.unite, (h) => h.map((b) => b.low), opt);
  const haut = d.map((_, i) => (i > 0 ? sH[i - 1] : null)), bas = d.map((_, i) => (i > 0 ? sL[i - 1] : null));
  const close = d.map((b) => b.close);
  const cH = crossover(close, haut), cB = crossunder(close, bas);
  const resistance = crossunder(d.map((b) => b.high), haut), support = crossover(d.map((b) => b.low), bas);
  const change = new Array(n), couleur = new Array(n), couleur1 = new Array(n), check = new Array(n);
  let col = null, chk = null;
  for (let i = 0; i < n; i++) {
    let c1 = null;
    if (cH[i]) { chk = true; c1 = p.couleurBas; col = p.couleurBas; } else if (cB[i]) { chk = false; c1 = p.couleurHaut; col = p.couleurHaut; }
    couleur[i] = col; couleur1[i] = c1; check[i] = chk;
    const dh = i > 0 && !nul(haut[i]) && !nul(haut[i - 1]) ? haut[i] - haut[i - 1] : null;
    const dl = i > 0 && !nul(bas[i]) && !nul(bas[i - 1]) ? bas[i] - bas[i - 1] : null;
    // not ta.change(x) : vrai si la variation est nulle ou na (na converti en faux)
    change[i] = !dh || !dl;
  }
  const affiche = (v, i) => (p.tendance ? v[i] : change[i] ? v[i] : null);
  const moy = haut.map((h, i) => (nul(h) || nul(bas[i]) ? null : (bas[i] + h) / 2));
  const pH = haut.map((_, i) => affiche(haut, i)), pB = bas.map((_, i) => affiche(bas, i)), pM = moy.map((_, i) => affiche(moy, i));
  const fond = p.tendance ? null : milieu(transparence(p.couleurHaut, env.fond.toLowerCase() === '#ffffff' ? 80 : 92), transparence(p.couleurBas, env.fond.toLowerCase() === '#ffffff' ? 80 : 92));
  return { haut, bas, moy, pH, pB, pM, cH, cB, resistance, support, change, couleur, couleur1, check, fond };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], chk1 = i > 0 ? s.check[i - 1] : null;
  remplir(o, e.remp, s.pH, s.pB, i, s.fond, derniere);
  if (s.cH[i] && chk1 === false && p.cassures) o.etiquette({ x: i, y: b.low * 0.99, texte: `${p.unite}\nCassure du haut`, style: 'label_up', couleurTexte: env.texte, couleur: '#0e4e11', taille: 'small' });
  if (s.cB[i] && chk1 === true && p.cassures) o.etiquette({ x: i, y: b.high * 1.01, texte: `${p.unite}\nCassure du bas`, style: 'label_down', couleurTexte: env.texte, couleur: '#6e1414', taille: 'small' });
  if (s.resistance[i] && i > 0) o.plotchar(i - 1, { position: 'abovebar', caractere: '◆', couleur: p.couleurHaut, taille: 'tiny' });
  if (s.support[i] && i > 0) o.plotchar(i - 1, { position: 'belowbar', caractere: '◆', couleur: p.couleurBas, taille: 'tiny' });
  if (derniere) {
    const x = i + p.extension, h = s.haut[i], l = s.bas[i];
    o.etiquette({ x, y: h, texte: `⮪ ${p.unite} Haut`, style: 'label_left', couleurTexte: env.texte, couleur: p.couleurHaut, taille: 'normal' });
    o.etiquette({ x, y: l, texte: `⮨ ${p.unite} Bas`, style: 'label_left', couleurTexte: env.texte, couleur: '#158d19', taille: 'normal' });
    if (s.change[i]) {
      o.ligne({ x1: i, y1: h, x2: x, y2: h, couleur: p.couleurHaut, epaisseur: 2 });
      o.ligne({ x1: i, y1: l, x2: x, y2: l, couleur: p.couleurBas, epaisseur: 2 });
      o.ligne({ x1: i, y1: s.moy[i], x2: x, y2: s.moy[i], couleur: env.texte, epaisseur: p.tendance ? 1 : 2, style: p.tendance ? 'solid' : 'dotted' });
    }
  }
}

export default class HautBasUniteSuperieureIndicator {
  static metadata = {
    id: 'haut_bas_unite_superieure',
    name: 'Plus haut et plus bas de l’unité supérieure',
    shortName: 'H/B SUP',
    description: 'haut_bas_unite_superieure',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['unite superieure', 'plus haut', 'plus bas', 'cassure', 'niveaux'],
    inputs: INPUTS,
    outputs: [
      { id: 'haut', name: 'Plus haut', type: 'line', color: '#d41919', lineWidth: 2 },
      { id: 'bas', name: 'Plus bas', type: 'line', color: '#13b818', lineWidth: 2 },
      { id: 'milieu', name: 'Milieu', type: 'line', color: 'rgba(241, 241, 241, 0.5)', lineWidth: 1, trace: 'cercles' },
      { id: 'milieuMarches', name: 'Milieu (tendance)', type: 'line', color: 'rgba(241, 241, 241, 0.1)', lineWidth: 1, trace: 'escalier' },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'separation', name: 'Début de période', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#13b818', couleurDuPoint: true },
    ],
    barColorMode: 'full',
    bgColors: [
      { when: 'custom', source: 'separation', condition: (pt) => pt.value === 1, color: SEPARATION },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { haut: [] };
    const p = this.params;
    if (typeof p.unite !== 'string' || !p.unite) p.unite = '1D';
    const env = contexte(data, ctx);
    return executer(HautBasUniteSuperieureIndicator._memo, JSON.stringify([p, env.texte, env.fond, pasDuGraphique(data, ctx)]), data, {
      // [FIX 2026-11-26] 3 lignes (haut, bas, milieu) : avec le max_lines_count = 2 du
      // script, la plus ancienne (le prolongement du HAUT) partait toujours. Ecart volontaire.
      creer: () => ({ o: creerObjets({ maxLignes: 3, maxEtiquettes: 10, maxPolylignes: 500 }), remp: suiteVide() }),
      series: (d) => series(p, d, ctx, env),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => {
        const n = d.length, vide = d.map((b) => ({ time: b.time, value: null }));
        const cH = p.tendance ? transparence(p.couleurHaut, 80) : p.couleurHaut, cB = p.tendance ? transparence(p.couleurBas, 80) : p.couleurBas;
        const cM = p.tendance ? transparence(env.texte, 90) : transparence(env.texte, 50);
        const plein = (c) => new Array(n).fill(c);
        const milieuPts = d.map((b, i) => ({ time: b.time, value: s.pM[i], color: cM }));
        return {
          haut: tracer(d, s.pH, plein(cH)),
          bas: tracer(d, s.pB, plein(cB)),
          milieu: p.tendance ? vide : milieuPts,
          milieuMarches: p.tendance ? tracer(d, s.pM, plein(cM)) : vide,
          bougies: d.map((b, i) => {
            const c = p.tendance ? s.couleur[i] : s.couleur1[i];
            return { time: b.time, value: c ? 1 : null, color: c };
          }),
          separation: d.map((b, i) => ({ time: b.time, value: p.separateur && !s.change[i] ? 1 : null })),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
