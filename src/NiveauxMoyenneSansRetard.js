// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Zero-Lag MA Trend Levels [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/pP2FhzAX-Zero-Lag-MA-Trend-Levels-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { atr, ema } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, signaux, transparence, milieu, remplir, suiteVide } from './commun.js';

const INPUTS = [
  { id: 'longueur', name: 'Longueur', type: 'number', entier: true, default: 15, min: 1, max: 500, step: 1, group: 'Paramètres',
    description: 'Longueur de la moyenne exponentielle et de la moyenne sans retard (moyenne exponentielle de la clôture corrigée de son écart à la première).' },
  { id: 'niveaux', name: 'Niveaux de tendance', type: 'boolean', default: true, group: 'Paramètres',
    description: 'À chaque croisement, une zone d’un ATR 200 posée sur la moyenne sans retard, et les sorties du prix de cette zone.' },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#30d453', group: 'Style' },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#4043f1', group: 'Style' },
];

function creer() {
  return {
    o: creerObjets({ maxBoites: 50, maxEtiquettes: 50 }),
    sorties: { hausse: [], baisse: [], signal: [], cz: [], cm: [] },
    fond: suiteVide(),
    boite: null,
    croise: { haut: null, bas: null },
    sortie: { bas: null, haut: null },
  };
}

function couleurs(p, s, i) {
  const z = s.zlma[i], z3 = i >= 3 ? s.zlma[i - 3] : null, m = s.ema[i];
  const cz = z !== null && z3 !== null && z > z3 ? p.couleurHausse : z !== null && z3 !== null && z < z3 ? p.couleurBaisse : null;
  const cm = m !== null && z !== null && m < z ? p.couleurHausse : p.couleurBaisse;
  return [cz, cm];
}

function etape(p, e, data, i, derniere, s, env) {
  const S = e.sorties;
  const b = data[i], z = s.zlma[i], m = s.ema[i];
  [S.cz[i], S.cm[i]] = couleurs(p, s, i);
  remplir(e.o, e.fond, s.zlma, s.ema, i, milieu(transparence(S.cz[i], 80), transparence(S.cm[i], 80)), derniere);
  const z1 = i > 0 ? s.zlma[i - 1] : null, m1 = i > 0 ? s.ema[i - 1] : null;
  const defini = z !== null && m !== null && z1 !== null && m1 !== null;
  const hausse = defini && z > m && z1 <= m1;
  const baisse = defini && z < m && z1 >= m1;
  S.hausse[i] = hausse; S.baisse[i] = baisse;
  S.signal[i] = hausse || baisse;
  if (hausse) e.o.plotchar(i, { position: 'absolute', y: z, caractere: '◆', couleur: p.couleurHausse, taille: 'tiny' });
  if (baisse) e.o.plotchar(i, { position: 'absolute', y: z, caractere: '◆', couleur: p.couleurBaisse, taille: 'tiny' });
  if (!p.niveaux) return;

  const a = s.atr[i];
  const zone = (couleur, haut, bas) => e.o.boite({
    gauche: i, haut, droite: i, bas, couleurBordure: couleur, epaisseurBordure: 1, fond: transparence(couleur, 90),
    texte: tostring(Math.round(b.close * 100) / 100, '#.##########'), tailleTexte: 'tiny', couleurTexte: env.texte, alignH: 'right',
  });
  if (hausse) e.boite = zone(p.couleurHausse, z, a === null ? null : z - a);
  else if (baisse) e.boite = zone(p.couleurBaisse, a === null ? null : z + a, z);
  if (e.boite) e.boite.droite = i + 4;

  const signalPrec = i > 0 && S.signal[i - 1];
  const bas = e.boite ? e.boite.bas : null;
  const q = e.sortie;
  const sousLaZone = b.high !== null && bas !== null && q.haut !== null && q.bas !== null && b.high < bas && q.haut >= q.bas;
  e.sortie = { haut: b.high, bas };
  if (sousLaZone && !signalPrec && !S.signal[i] && m !== null && z !== null && m > z) {
    e.o.etiquette({ x: i - 1, y: data[i - 1].high, texte: '▼', couleur: null, couleurTexte: p.couleurBaisse, style: 'label_down' });
    return;
  }
  const haut = e.boite ? e.boite.haut : null;
  const c = e.croise;
  const surLaZone = haut !== null && c.bas !== null && c.haut !== null && b.low > haut && c.bas <= c.haut;
  e.croise = { bas: b.low, haut };
  if (surLaZone && !S.signal[i] && !signalPrec && m !== null && z !== null && m < z) {
    e.o.etiquette({ x: i - 1, y: data[i - 1].low, texte: '▲', couleur: null, couleurTexte: p.couleurHausse, style: 'label_up' });
  }
}

function rendre(e, data, s) {
  return {
    moyenneSansRetard: tracer(data, s.zlma, e.sorties.cz),
    moyenne: tracer(data, s.ema, e.sorties.cm),
    croisementHausse: signaux(data, e.sorties.hausse),
    croisementBaisse: signaux(data, e.sorties.baisse),
    objets: e.o.resultat(),
  };
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class NiveauxMoyenneSansRetardIndicator {
  static metadata = {
    id: 'niveaux_moyenne_sans_retard',
    name: 'Niveaux de la moyenne sans retard',
    shortName: 'ZLMA-N',
    description: 'niveaux_moyenne_sans_retard',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['moyenne', 'sans retard', 'zero lag', 'croisement', 'niveaux', 'tendance'],
    inputs: INPUTS,
    outputs: [
      { id: 'moyenneSansRetard', name: 'Moyenne sans retard', type: 'line', color: '#30d453', lineWidth: 1 },
      { id: 'moyenne', name: 'Moyenne exponentielle', type: 'line', color: '#4043f1', lineWidth: 1 },
      { id: 'croisementHausse', name: 'Croisement haussier', type: 'line', hidden: true },
      { id: 'croisementBaisse', name: 'Croisement baissier', type: 'line', hidden: true },
    ],
    alertConditions: [
      alerte('croisement_haussier', 'Croisement haussier', 'croisementHausse'),
      alerte('croisement_baissier', 'Croisement baissier', 'croisementBaisse'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { moyenneSansRetard: [], moyenne: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NiveauxMoyenneSansRetardIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => {
        const m = ema(d.map((c) => c.close), p.longueur);
        const correction = d.map((c, i) => (m[i] === null ? null : c.close + (c.close - m[i])));
        return { ema: m, zlma: ema(correction, p.longueur), atr: atr(d, 200) };
      },
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(etat, d, s),
    });
  }
}
