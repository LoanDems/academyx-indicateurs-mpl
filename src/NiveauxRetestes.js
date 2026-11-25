// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Retest Support Resistance Signals [ChartPrime] » (titre du script : « Support/Resistance Re-test Finder [ChartPrime] ») © ChartPrime — https://www.tradingview.com/script/E4joH77u-Retest-Support-Resistance-Signals-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, degrade, transparence } from './commun.js';

const P = 'Paramètres', SU = 'Fin des niveaux', S = 'Style';
const ARRET = 'Stop Updating Level', EFFACE = 'Completely Delete Level', TEINTE = 'Stop Updating Level & Turn Level Unique Color';
const PRIX = 'Price Above/Below', AGE = 'Fade Out Based On Age';
const INPUTS = [
  { id: 'methode', name: 'Sommets et creux sur', type: 'select', default: 'Wick', group: P,
    options: [{ label: 'Les mèches', value: 'Wick' }, { label: 'Les corps', value: 'Body' }] },
  { id: 'gauche', name: 'Barres à gauche', type: 'number', entier: true, default: 20, min: 1, max: 200, step: 1, group: P },
  { id: 'droite', name: 'Barres à droite', type: 'number', entier: true, default: 20, min: 1, max: 200, step: 1, group: P,
    description: 'Un sommet ou un creux n’est confirmé que ce nombre de barres plus tard.' },
  { id: 'retestAffaiblit', name: 'Le retest affaiblit le niveau', type: 'boolean', default: false, group: P,
    description: 'Inverse le sens des marqueurs « R » : un retest annonce alors la cassure du niveau plutôt que son maintien.' },
  { id: 'fin', name: 'À la fin d’un niveau', type: 'select', default: ARRET, group: SU,
    options: [{ label: 'Il cesse d’avancer', value: ARRET }, { label: 'Il est effacé', value: EFFACE }, { label: 'Il cesse d’avancer et prend la couleur de fin', value: TEINTE }] },
  { id: 'cassures', name: 'Cassures avant la fin', type: 'number', entier: true, default: 1, min: 1, max: 50, step: 1, group: SU, legende: false },
  { id: 'age', name: 'Barres avant la fin', type: 'number', entier: true, default: 300, min: 1, max: 5000, step: 10, group: SU, legende: false },
  { id: 'couleurSupport', name: 'Support retesté', type: 'color', default: 'rgba(76, 175, 79, 0.5)', group: S },
  { id: 'couleurResistance', name: 'Résistance retestée', type: 'color', default: 'rgba(255, 82, 82, 0.5)', group: S },
  { id: 'couleurFin', name: 'Couleur de fin', type: 'color', default: 'rgba(120, 123, 134, 0.5)', group: S },
  { id: 'couleurSelon', name: 'Couleur des niveaux', type: 'select', default: PRIX, group: S,
    options: [{ label: 'Selon la position du prix', value: PRIX }, { label: 'Fondu avec l’âge', value: AGE }] },
  { id: 'epaisseur', name: 'Épaisseur', type: 'number', entier: true, default: 10, min: 1, max: 20, step: 1, group: S },
];
const ROUGE = '#F23645', VERT = '#4CAF50', BLANC = '#FFFFFF';
// Bits de la sortie d'alertes (une par alertcondition du script).
const ALERTES = [
  ['nouveau_support', 'Nouveau support retesté', 1],
  ['nouvelle_resistance', 'Nouvelle résistance retestée', 2],
  ['support_casse_bas', 'Support retesté cassé vers le bas', 4],
  ['support_casse_haut', 'Support retesté repassé vers le haut', 8],
  ['resistance_casse_bas', 'Résistance retestée repassée vers le bas', 16],
  ['resistance_casse_haut', 'Résistance retestée cassée vers le haut', 32],
  ['cassure_bas', 'Toute cassure vers le bas', 20],
  ['cassure_haut', 'Toute cassure vers le haut', 40],
];

function series(p, d) {
  const corpsHaut = d.map((b) => (p.methode === 'Wick' ? b.high : b.close > b.open ? b.close : b.open));
  const corpsBas = d.map((b) => (p.methode === 'Wick' ? b.low : b.close < b.open ? b.close : b.open));
  return { ph: pivothigh(corpsHaut, p.gauche, p.droite), pl: pivotlow(corpsBas, p.gauche, p.droite) };
}

const creer = () => ({
  o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }),
  h1: [], h1i: [], l1: [], l1i: [], h2: [], h2i: [], l2: [], l2i: [],
  lignes: [], types: [], ages: [], flips: [], phases: [],
  sorties: { alertes: [] },
});

function retirer(e, k) {
  e.lignes.splice(k, 1); e.ages.splice(k, 1); e.flips.splice(k, 1); e.types.splice(k, 1); e.phases.splice(k, 1);
}

function etape(p, e, d, i, derniere, s, env) {
  const b = d[i];
  let bits = 0;
  e.sorties.alertes[i] = null;
  // if barstate.isconfirmed : rien sur la barre en cours tant qu'elle n'est pas close.
  if (derniere && !env.derniereConfirmee) return;
  const o = e.o;
  if (s.ph[i] !== null) { e.h1.push(s.ph[i]); e.h1i.push(i - p.droite); }
  if (s.pl[i] !== null) { e.l1.push(s.pl[i]); e.l1i.push(i - p.droite); }

  for (let k = e.h2.length - 1; k >= 0; k--) {
    const prix = e.h2[k], idx = e.h2i[k];
    if (b.low <= prix && b.close > prix && b.close > b.open) {
      e.lignes.push(o.ligne({ x1: idx, y1: prix, x2: i, y2: prix, couleur: p.couleurSupport, epaisseur: p.epaisseur }));
      e.types.push('S'); e.ages.push(0); e.flips.push(0); e.phases.push(1);
      e.h2.splice(k, 1); e.h2i.splice(k, 1);
      bits |= 1;
    } else if (i - idx > 1000 || b.close < prix) { e.h2.splice(k, 1); e.h2i.splice(k, 1); }
  }
  for (let k = e.l2.length - 1; k >= 0; k--) {
    const prix = e.l2[k], idx = e.l2i[k];
    if (b.high >= prix && b.close < prix && b.close < b.open) {
      e.lignes.push(o.ligne({ x1: idx, y1: prix, x2: i, y2: prix, couleur: p.couleurResistance, epaisseur: p.epaisseur }));
      e.types.push('R'); e.ages.push(0); e.flips.push(0); e.phases.push(-1);
      e.l2.splice(k, 1); e.l2i.splice(k, 1);
      bits |= 2;
    } else if (i - idx > 1000 || b.close > prix) { e.l2.splice(k, 1); e.l2i.splice(k, 1); }
  }
  for (let k = e.h1.length - 1; k >= 0; k--) {
    const prix = e.h1[k], idx = e.h1i[k];
    if (b.low > prix) { e.h2.push(prix); e.h2i.push(idx); e.h1.splice(k, 1); e.h1i.splice(k, 1); } else if (i - idx > 1000) { e.h1.splice(k, 1); e.h1i.splice(k, 1); }
  }
  for (let k = e.l1.length - 1; k >= 0; k--) {
    const prix = e.l1[k], idx = e.l1i[k];
    if (b.high < prix) { e.l2.push(prix); e.l2i.push(idx); e.l1.splice(k, 1); e.l1i.splice(k, 1); } else if (i - idx > 1000) { e.l1.splice(k, 1); e.l1i.splice(k, 1); }
  }

  for (let k = e.lignes.length - 1; k >= 0; k--) {
    const l = e.lignes[k], age = e.ages[k], type = e.types[k], phase = e.phases[k];
    const prix = l.y1;
    l.x2 = i + 1;
    const c = type === 'S' ? p.couleurSupport : p.couleurResistance;
    l.couleur = p.couleurSelon === AGE ? degrade(age, 0, p.age, c, transparence(c, 100)) : b.close > prix ? p.couleurSupport : p.couleurResistance;
    e.ages[k] = age + 1;
    if (type === 'S') {
      if (phase === 1 && b.close < prix) { e.flips[k]++; e.phases[k] = -1; bits |= 4; } else if (phase === -1 && b.close > prix) { e.flips[k]++; e.phases[k] = 1; bits |= 8; }
    } else if (phase === -1 && b.close > prix) { e.flips[k]++; e.phases[k] = 1; bits |= 32; } else if (phase === 1 && b.close < prix) { e.flips[k]++; e.phases[k] = -1; bits |= 16; }
    if (e.flips[k] >= p.cassures || age >= p.age) {
      if (p.fin === EFFACE) o.supprimer(l);
      else if (p.fin === TEINTE) l.couleur = p.couleurFin;
      retirer(e, k);
    }
  }

  const affaiblit = p.retestAffaiblit;
  if (bits & 1) o.etiquette({ x: i, y: affaiblit ? b.high : b.low, yloc: affaiblit ? 'abovebar' : 'belowbar', texte: 'R', style: affaiblit ? 'label_down' : 'label_up', couleur: affaiblit ? ROUGE : VERT, couleurTexte: BLANC, taille: 'tiny' });
  if (bits & 2) o.etiquette({ x: i, y: affaiblit ? b.low : b.high, yloc: affaiblit ? 'belowbar' : 'abovebar', texte: 'R', style: affaiblit ? 'label_up' : 'label_down', couleur: affaiblit ? VERT : ROUGE, couleurTexte: BLANC, taille: 'tiny' });
  e.sorties.alertes[i] = bits || null;
}

export default class NiveauxRetestesIndicator {
  static metadata = {
    id: 'niveaux_retestes',
    name: 'Supports et résistances retestés',
    shortName: 'RETEST',
    description: 'niveaux_retestes',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['support', 'resistance', 'retest', 'cassure', 'sommets', 'creux'],
    inputs: INPUTS,
    outputs: [{ id: 'alertes', name: 'Alertes', type: 'line', hidden: true }],
    alertConditions: ALERTES.map(([id, title, masque]) => ({
      id, title, message: title, when: 'custom', source: 'alertes', condition: (pt) => pt.value !== null && (pt.value & masque) !== 0,
    })),
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { alertes: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(NiveauxRetestesIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({
        alertes: d.map((b, i) => ({ time: b.time, value: etat.sorties.alertes[i] ?? null })),
        objets: etat.o.resultat(),
      }),
    });
  }
}
