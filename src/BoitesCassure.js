// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Breakout Boxes [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/6yyxS28p-Breakout-Boxes-ChartPrime/
// Adaptation : calcul sur toutes les bougies (calc_bars_count = 5000 non repris) ; textes en francais, a la couleur du texte
// du theme (noirs par defaut dans le script, illisibles sur fond sombre).
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow, atr as taAtr } from '../academyscript/ta.js';
import { tostring, formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence, masque, bit } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueurPivot', name: 'Longueur des sommets et creux', type: 'number', entier: true, default: 5, min: 1, max: 100, step: 1, group: P,
    description: 'Deux sommets (ou deux creux) confirmés à moins de 0,2 ATR l’un de l’autre ouvrent une boîte.' },
  { id: 'hauteurHaut', name: 'Hauteur de la boîte haute (dixièmes d’ATR)', type: 'number', entier: true, default: 5, min: 1, max: 100, step: 1, group: P },
  { id: 'hauteurBas', name: 'Hauteur de la boîte basse (dixièmes d’ATR)', type: 'number', entier: true, default: 5, min: 1, max: 100, step: 1, group: P },
  { id: 'couleurHaut', name: 'Boîte haute', type: 'color', default: '#ce1c7b', group: S },
  { id: 'couleurBas', name: 'Boîte basse', type: 'color', default: '#1ed87e', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const pourcent = (v) => (Number.isFinite(v) ? formaterMotif(v, '0.00') + '%' : 'NaN');
const volume = (v) => (Number.isFinite(v) ? tostring(v, 'volume') : 'NaN');
const sansBoite = () => ({ corps: null, ventes: null, achats: null });

function series(p, d) {
  return { ph: pivothigh(d, p.longueurPivot, p.longueurPivot), pl: pivotlow(d, p.longueurPivot, p.longueurPivot), atr: taAtr(d, 200) };
}

/** Detection d'une boite haute (sens 1) ou basse (sens -1) sur un sommet / creux confirme. */
function detecter(p, e, i, piv, sens, aTr) {
  const P0 = sens > 0 ? e.hauts : e.bas, B = sens > 0 ? e.boiteHaute : e.boiteBasse, o = e.o;
  const col = sens > 0 ? p.couleurHaut : p.couleurBas, larg = aTr === null ? null : aTr * ((sens > 0 ? p.hauteurHaut : p.hauteurBas) / 10);
  if (!nul(P0.val) && aTr !== null && Math.abs(P0.val - piv) < aTr * 0.2) {
    if (B.corps && B.corps.droite > i - p.longueurPivot) {
      for (const b of [B.achats, B.ventes, B.corps]) { b.droite = B.corps.gauche; b.couleurBordure = null; }
    }
    const v = P0.val, autre = sens > 0 ? v + larg : v - larg, mil = (autre + v) / 2;
    const base = { couleurBordure: col, couleurTexte: e.texte, tailleTexte: 'auto' };
    B.corps = o.boite({ ...base, gauche: P0.index, haut: sens > 0 ? autre : v, droite: i, bas: sens > 0 ? v : autre, fond: null, alignH: 'right', epaisseurBordure: 2 });
    const fond = transparence(col, 90);
    // Pine : box.new(left, top, right, bottom) sans tri des bornes ; le contrat lit haut / bas tels quels.
    B.achats = o.boite({ ...base, gauche: P0.index, haut: mil, droite: P0.index, bas: sens > 0 ? v : autre, fond, alignH: 'left', epaisseurBordure: 1 });
    B.ventes = o.boite({ ...base, gauche: P0.index, haut: mil, droite: P0.index, bas: sens > 0 ? autre : v, fond, alignH: 'left', epaisseurBordure: 1 });
  }
  P0.val = piv;
  P0.index = i - p.longueurPivot;
}

/** Volume des bougies haussieres / baissieres de la boite (et des 5 barres avant elle), textes et largeurs. */
function mettreAJour(e, d, i, B) {
  if (!B.corps) return;
  let achat = 0.0, vente = 0.0;
  B.corps.droite = i;
  for (let k = 0; k <= i - (B.corps.gauche - 5); k++) {
    const j = i - k, b = j >= 0 ? d[j] : null;
    if (b && b.close > b.open) achat += b.volume;
    else vente = b && vente !== null ? vente + b.volume : null;
  }
  const tot = vente === null ? null : achat + vente;
  B.corps.texte = 'Total ' + volume(tot);
  const taille = Math.trunc(B.corps.droite - B.corps.gauche);
  const ra = tot === null ? NaN : achat / tot, rv = tot === null ? NaN : vente / tot;
  B.achats.droite = Number.isFinite(ra) ? B.corps.gauche + Math.trunc(taille * ra) : null;
  B.achats.texte = 'Volume haussier ' + pourcent(ra * 100);
  B.ventes.droite = Number.isFinite(rv) ? B.corps.gauche + Math.trunc(taille * rv) : null;
  B.ventes.texte = 'Volume baissier ' + pourcent(rv * 100);
}

/** ta.crossover / ta.crossunder evalues aux barres confirmees : derniere paire ou les deux valeurs existaient. */
function croise(etat, a, b, sens) {
  if (nul(a) || nul(b)) return false;
  const r = etat.pa !== null && (sens > 0 ? etat.pa <= etat.pb && a > b : etat.pa >= etat.pb && a < b);
  etat.pa = a; etat.pb = b;
  return r;
}

function etape(p, e, d, i, derniere, s, env) {
  const aTr = nul(s.atr[i]) ? null : s.atr[i], b = d[i];
  if (!nul(s.ph[i])) detecter(p, e, i, s.ph[i], 1, aTr);
  if (!nul(s.pl[i])) detecter(p, e, i, s.pl[i], -1, aTr);
  mettreAJour(e, d, i, e.boiteHaute);
  mettreAJour(e, d, i, e.boiteBasse);
  e.sorties.haut[i] = false; e.sorties.bas[i] = false;
  if (!derniere || env.derniereConfirmee) {
    if (croise(e.xh, b.close, e.boiteHaute.corps ? e.boiteHaute.corps.haut : null, 1)) {
      e.boiteHaute = sansBoite();
      e.o.etiquette({ x: i, y: aTr === null ? null : b.low - aTr, texte: '⯁\nCassure haute', couleurTexte: p.couleurHaut, style: 'label_up', couleur: transparence(p.couleurHaut, 80) });
      e.sorties.haut[i] = true;
    }
    if (croise(e.xb, b.close, e.boiteBasse.corps ? e.boiteBasse.corps.bas : null, -1)) {
      e.boiteBasse = sansBoite();
      e.o.etiquette({ x: i, y: aTr === null ? null : b.high + aTr, texte: 'Cassure basse\n⯁', couleurTexte: p.couleurBas, style: 'label_down', couleur: transparence(p.couleurBas, 80) });
      e.sorties.bas[i] = true;
    }
  }
}

export default class BoitesCassureIndicator {
  static metadata = {
    id: 'boites_cassure',
    name: 'Boîtes de cassure entre sommets ou creux proches',
    shortName: 'BOITES',
    description: 'boites_cassure',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['cassure', 'boite', 'sommets', 'creux', 'volume'],
    inputs: INPUTS,
    outputs: [
      { id: 'signaux', name: 'Signaux', type: 'line', hidden: true },
    ],
    alertConditions: [
      { id: 'cassure_haute', title: 'Cassure de la boîte haute', message: 'Cassure de la boîte haute', when: 'custom', source: 'signaux', condition: bit(0) },
      { id: 'cassure_basse', title: 'Cassure de la boîte basse', message: 'Cassure de la boîte basse', when: 'custom', source: 'signaux', condition: bit(1) },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { signaux: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(BoitesCassureIndicator._memo, JSON.stringify([p, env.texte, env.derniereConfirmee]), data, {
      creer: () => ({
        o: creerObjets({ maxBoites: 500, maxEtiquettes: 500 }), texte: env.texte,
        hauts: { val: null, index: null }, bas: { val: null, index: null }, boiteHaute: sansBoite(), boiteBasse: sansBoite(),
        xh: { pa: null, pb: null }, xb: { pa: null, pb: null }, sorties: { haut: [], bas: [] },
      }),
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => ({ signaux: masque(d, [etat.sorties.haut, etat.sorties.bas]), objets: etat.o.resultat() }),
    });
  }
}
