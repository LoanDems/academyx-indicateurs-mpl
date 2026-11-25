// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Trinity Reversal Pattern [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/tpwLa60j-Trinity-Reversal-Pattern-AlgoAlpha/
// Adaptation : textes en francais ; pas d'erreur d'execution quand la moyenne rapide n'est pas plus courte que la lente
// (le filtre fonctionne avec les longueurs saisies) ; le degrade vertical entre les deux moyennes prend sa couleur a mi-hauteur.
import { creerObjets } from '../academyscript/objets.js';
import { ema, crossover, crossunder } from '../academyscript/ta.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence, milieu, remplir, suiteVide, masque, bit } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const TAILLES = [{ label: 'Très petit', value: 'tiny' }, { label: 'Petit', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Grand', value: 'large' }];
const C = 'Calcul', T = 'Filtre de tendance', S = 'Style';
const INPUTS = [
  { id: 'reculForce', name: 'Recul de la force', type: 'number', entier: true, default: 100, min: 2, max: 5000, step: 1, group: C,
    description: 'Corps gardés (bougie courante comprise) : la force est le corps de la bougie du signal rapporté au plus grand d’entre eux.' },
  { id: 'forceMin', name: 'Force minimale (%)', type: 'number', default: 0, min: 0, max: 100, step: 1, group: C, legende: false },
  { id: 'expiration', name: 'Expiration des niveaux (barres)', type: 'number', entier: true, default: 100, min: 1, max: 5000, step: 1, group: C },
  { id: 'confirmerCloture', name: 'Confirmer à la clôture', type: 'boolean', default: true, group: C,
    description: 'Attend la clôture de la bougie du signal ; sinon le signal, le niveau et la force peuvent changer avant.' },
  { id: 'filtreTendance', name: 'Filtrer par la tendance des moyennes', type: 'boolean', default: false, group: T },
  { id: 'longueurRapide', name: 'Moyenne rapide', type: 'number', entier: true, default: 21, min: 1, max: 500, step: 1, group: T },
  { id: 'longueurLente', name: 'Moyenne lente', type: 'number', entier: true, default: 50, min: 2, max: 1000, step: 1, group: T },
  { id: 'source', name: 'Source des moyennes', type: 'select', default: 'close', options: SOURCES, group: T },
  { id: 'signaux', name: 'Afficher les signaux', type: 'boolean', default: true, group: S },
  { id: 'niveaux', name: 'Afficher les niveaux', type: 'boolean', default: true, group: S },
  { id: 'force', name: 'Afficher la force', type: 'boolean', default: true, group: S },
  { id: 'tailleTexte', name: 'Taille du texte', type: 'select', default: 'small', options: TAILLES, group: S },
  { id: 'prolongement', name: 'Prolongement des niveaux actifs', type: 'number', entier: true, default: 5, min: 1, max: 100, step: 1, group: S },
  { id: 'transparenceInactifs', name: 'Transparence des niveaux arrêtés', type: 'number', entier: true, default: 75, min: 0, max: 100, step: 1, group: S },
  { id: 'niveauxMax', name: 'Niveaux gardés au plus', type: 'number', entier: true, default: 500, min: 10, max: 500, step: 1, group: S },
  { id: 'croisements', name: 'Afficher les croisements des moyennes', type: 'boolean', default: true, group: S },
  { id: 'transparenceDegrade', name: 'Transparence du dégradé', type: 'number', entier: true, default: 70, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const GRIS = '#787B86';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};

function series(p, d) {
  const src = d.map(choix[p.source]);
  const rapide = ema(src, p.longueurRapide), lente = ema(src, p.longueurLente);
  return { rapide, lente, xh: crossover(rapide, lente), xb: crossunder(rapide, lente) };
}

function creer(p) {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500, maxPolylignes: 500 }), f: suiteVide(),
    corps: [], actifs: [], inactives: [], tendance: 0,
    sorties: { tend: [], hausse: [], baisse: [], toucheH: [], toucheB: [], expire: [], xh: [], xb: [] },
  };
}

function retirerActif(e, k) {
  const [a] = e.actifs.splice(k, 1);
  if (a.etiquette) e.o.supprimer(a.etiquette);
  return a.ligne;
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], S = e.sorties, conf = derniere ? env.derniereConfirmee : true;
  const corps = Math.abs(b.close - b.open);
  e.corps.push(corps);
  if (e.corps.length > p.reculForce) e.corps.shift();
  let plus = -Infinity;
  for (const v of e.corps) if (v > plus) plus = v;
  const force = plus > 0 ? Math.min(100, corps / plus * 100) : 0;
  const xh = s.xh[i], xb = s.xb[i];
  if (xh) e.tendance = 1;
  else if (xb) e.tendance = -1;
  else if (e.tendance === 0) e.tendance = gt(s.rapide[i], s.lente[i]) ? 1 : lt(s.rapide[i], s.lente[i]) ? -1 : 0;
  const tend = e.tendance;
  let bull = false, bear = false;
  if (i >= 2) {
    const b1 = d[i - 1], b2 = d[i - 2];
    bull = b.close > b.open && b.high > b2.high && b1.low < b2.low && b1.high < b2.high && b1.close < b1.open && b2.close < b2.open;
    bear = b.close < b.open && b.low < b2.low && b1.high > b2.high && b1.low > b2.low && b1.close > b1.open && b2.close > b2.open;
  }
  const pret = i >= 2 && (!p.confirmerCloture || conf);
  const hausse = bull && pret && force >= p.forceMin && (!p.filtreTendance || tend === 1);
  const baisse = bear && pret && force >= p.forceMin && (!p.filtreTendance || tend === -1);

  let toucheH = false, toucheB = false, expire = false;
  for (let k = e.actifs.length - 1; k >= 0; k--) {
    const a = e.actifs[k], niveau = a.ligne.y1, age = i - a.debut;
    if (age > 0) {
      const touche = a.sens === 1 ? b.low <= niveau : b.high >= niveau;
      const exp = age >= p.expiration && conf;
      const finX = touche || exp ? i : i + p.prolongement;
      a.ligne.x2 = finX;
      if (touche || exp) {
        a.ligne.couleur = p.niveaux ? transparence(a.sens === 1 ? p.couleurHausse : p.couleurBaisse, p.transparenceInactifs) : null;
        a.ligne.style = 'dotted';
        e.inactives.push(retirerActif(e, k));
        toucheH = toucheH || (touche && a.sens === 1);
        toucheB = toucheB || (touche && a.sens === -1);
        expire = expire || (exp && !touche);
      } else if (a.etiquette) {
        a.etiquette.x = Math.floor((a.ligne.x1 + finX) * 0.5);
      }
    }
  }
  if (hausse || baisse) {
    while (e.actifs.length + e.inactives.length >= p.niveauxMax) {
      if (e.inactives.length > 0) o.supprimer(e.inactives.shift());
      else o.supprimer(retirerActif(e, 0));
    }
    const sens = hausse ? 1 : -1;
    const bas3 = Math.min(b.low, d[i - 1].low, d[i - 2].low), haut3 = Math.max(b.high, d[i - 1].high, d[i - 2].high);
    const decBas = b.low === bas3 ? 0 : d[i - 1].low === bas3 ? 1 : 2, decHaut = b.high === haut3 ? 0 : d[i - 1].high === haut3 ? 1 : 2;
    const niveau = hausse ? bas3 : haut3, debut = i - (hausse ? decBas : decHaut), finX = i + p.prolongement;
    const couleur = hausse ? p.couleurHausse : p.couleurBaisse;
    const ligne = o.ligne({ x1: debut, y1: niveau, x2: finX, y2: niveau, couleur: p.niveaux ? couleur : null, epaisseur: 3 });
    const etiquette = p.niveaux && p.force
      ? o.etiquette({ x: Math.floor((debut + finX) * 0.5), y: niveau, yloc: 'price', texte: `${formaterMotif(force, '#.#')} % de force`, style: 'label_center',
        couleur: env.fond, couleurTexte: couleur, taille: p.tailleTexte, alignTexte: 'center' })
      : null;
    e.actifs.push({ ligne, etiquette, sens, debut: i });
  }
  // moyennes, degrade, croisements, signaux
  const cT = tend === 1 ? p.couleurHausse : tend === -1 ? p.couleurBaisse : GRIS;
  const fondu = Math.min(100, p.transparenceDegrade + 25);
  const haut = tend === 1 ? transparence(cT, fondu) : transparence(cT, p.transparenceDegrade);
  const bas = tend === 1 ? transparence(cT, p.transparenceDegrade) : transparence(cT, fondu);
  S.tend[i] = cT;
  if (p.filtreTendance) remplir(o, e.f, s.rapide, s.lente, i, milieu(haut, bas), derniere);
  if (p.signaux && hausse) o.etiquette({ x: i, y: b.low, yloc: 'belowbar', texte: '▲', style: 'label_up', couleur: p.couleurHausse, couleurTexte: env.texte, taille: 'tiny' });
  if (p.signaux && baisse) o.etiquette({ x: i, y: b.high, yloc: 'abovebar', texte: '▼', style: 'label_down', couleur: p.couleurBaisse, couleurTexte: env.texte, taille: 'tiny' });
  S.hausse[i] = hausse; S.baisse[i] = baisse; S.toucheH[i] = toucheH; S.toucheB[i] = toucheB; S.expire[i] = expire;
  S.xh[i] = p.filtreTendance && xh && pret; S.xb[i] = p.filtreTendance && xb && pret;
}

const ALERTES = [
  ['trinite_hausse', 'Retournement haussier en trois bougies'], ['trinite_baisse', 'Retournement baissier en trois bougies'],
  ['trinite_niveau_haussier', 'Niveau haussier touché'], ['trinite_niveau_baissier', 'Niveau baissier touché'],
  ['trinite_niveau_expire', 'Niveau expiré'], ['trinite_croisement_haussier', 'Croisement haussier des moyennes'], ['trinite_croisement_baissier', 'Croisement baissier des moyennes'],
];

function rendre(p, e, d, s) {
  const S = e.sorties, vide = d.map((b) => ({ time: b.time, value: null }));
  const avec = (t) => S.tend.map((c) => transparence(c, t));
  return {
    rapide: p.filtreTendance ? tracer(d, s.rapide, avec(15)) : vide,
    lente: p.filtreTendance ? tracer(d, s.lente, avec(45)) : vide,
    croisement: p.filtreTendance && p.croisements
      ? d.map((b, i) => ({ time: b.time, value: (s.xh[i] || s.xb[i]) && !nul(s.lente[i]) ? s.lente[i] : null, color: S.tend[i] }))
      : vide,
    signaux: masque(d, [S.hausse, S.baisse, S.toucheH, S.toucheB, S.expire, S.xh, S.xb]),
    objets: e.o.resultat(),
  };
}

export default class RetournementTriniteIndicator {
  static metadata = {
    id: 'retournement_trinite',
    name: 'Retournement en trois bougies et ses niveaux',
    shortName: 'R3B',
    description: 'retournement_trinite',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['retournement', 'figure', 'bougies', 'niveaux', 'moyennes'],
    inputs: INPUTS,
    outputs: [
      { id: 'rapide', name: 'Moyenne rapide', type: 'line', color: '#00ffbb', lineWidth: 2 },
      { id: 'lente', name: 'Moyenne lente', type: 'line', color: '#00ffbb', lineWidth: 2 },
      { id: 'croisement', name: 'Croisement des moyennes', type: 'line', color: '#00ffbb', lineWidth: 4, trace: 'cercles' },
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: ALERTES.map(([id, title], k) => ({ id, title, message: title, when: 'custom', source: 'signaux', condition: bit(k) })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { signaux: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(RetournementTriniteIndicator._memo, JSON.stringify([p, env.texte, env.fond, env.derniereConfirmee]), data, {
      creer: () => creer(p),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d, s) => rendre(p, etat, d, s),
    });
  }
}
