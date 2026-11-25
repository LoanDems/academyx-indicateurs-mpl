// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Ranges With Targets [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/3swrxpw6-Ranges-With-Targets-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr } from '../academyscript/ta.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, degrade, transparence, signaux } from './commun.js';

const P = 'Paramètres';
const INPUTS = [
  { id: 'filtre', name: 'Filtre du corps par l’ATR', type: 'boolean', default: false, group: P,
    description: 'Ne retient une sortie de plage que si le corps de la bougie est plus petit que l’ATR sur 5 barres.' },
  { id: 'objectif', name: 'Multiple de l’objectif', type: 'number', default: 1.3, min: 0.1, max: 20, step: 0.1, group: P,
    description: 'Objectif = ce multiple de la distance entre la clôture d’entrée et le bord opposé de la plage ; le stop est posé sur ce bord.' },
  { id: 'typeStop', name: 'Stop déclenché sur', type: 'select', default: 'Close', group: P,
    options: [{ label: 'Clôture', value: 'Close' }, { label: 'Plus haut / plus bas', value: 'High/Low' }] },
  { id: 'risque', name: 'Risque par trade (USD)', type: 'number', default: 100, min: 0, max: 1000000, step: 1, group: P, legende: false,
    description: 'Sert seulement au tableau : gain simulé = objectifs atteints × risque × multiple, perte = stops × risque.' },
  { id: 'afficherStop', name: 'Afficher le stop', type: 'boolean', default: false, group: 'Style' },
];
const GREEN = 'rgb(4, 191, 101)', TAIL = 'rgb(20, 141, 154)', RED = 'rgb(246, 7, 7)', VERT_FONCE = 'rgb(2, 106, 89)', NEUTRE = 'rgb(52, 52, 54)';
const VIOLET = '#5c439a', BLANC = '#FFFFFF';
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const f = (v) => (nul(v) ? 'NaN' : formaterMotif(v, '#.##########'));

/** ta.atr(30) du script appele seulement aux changements de jour : sa moyenne (rma) ne voit que ces barres. */
function atrEchantillonne(m, tr, n = 30) {
  if (m.prec === null) { m.vus++; m.somme += tr; if (m.vus < n) return null; m.prec = m.somme / n; return m.prec; }
  m.prec = (m.prec * (n - 1) + tr) / n;
  return m.prec;
}

function series(p, d) {
  const n = d.length;
  const atr5 = p.filtre ? taAtr(d, 5) : null;
  const bas5 = new Array(n), haut10 = new Array(n), jour = new Array(n);
  for (let i = 0; i < n; i++) {
    let l = Infinity, h = -Infinity;
    for (let k = Math.max(0, i - 4); k <= i; k++) l = Math.min(l, d[k].low);
    for (let k = Math.max(0, i - 9); k <= i; k++) h = Math.max(h, d[k].high);
    bas5[i] = i >= 4 ? l : null; haut10[i] = i >= 9 ? h : null;
    // timeframe.change("1D") : jour UTC different de la barre precedente (faux a la premiere barre)
    jour[i] = i > 0 && Math.floor(d[i].time / 86400) !== Math.floor(d[i - 1].time / 86400);
  }
  return { atr5, bas5, haut10, jour };
}

function creer() {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }),
    sorties: { achat: [], vente: [], enAchat: [], enVente: [], bougies: [] },
    SCR: 0, ATR: 0, TradeOn: false, score: [0, 0], ShortTrade: false, TradeisON: false, LongTrade: false,
    res: null, sup: null, tpLine: null, SLLine: null, LAB: null, TP: 0, SL: 0, Res: 0, rempl: null, remplPaire: null,
    atr: { vus: 0, somme: 0, prec: null }, historique: [],
    resPrec: null, scrPrec: null,
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], S = e.sorties;
  let BUY = false, SELL = false;
  if (s.jour[i] && !e.TradeisON) {
    // volAdj(30) : math.min(ta.atr(30) * 0.3, close * 0.003)[20] / 2, historique propre a cet appel
    const tr = i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - d[i - 1].close), Math.abs(b.low - d[i - 1].close));
    const a = atrEchantillonne(e.atr, tr);
    e.historique.push(a === null ? null : Math.min(a * 0.3, b.close * (0.3 / 100)));
    const k = e.historique.length - 1 - 20;
    e.ATR = k >= 0 && e.historique[k] !== null ? e.historique[k] / 2 : null;
    const hl2 = (b.high + b.low) / 2;
    e.SCR = e.ATR === null ? null : hl2 - e.ATR * 15;
    e.TradeOn = true;
    e.Res = e.SCR === null ? null : e.SCR + e.ATR * 25;
    e.res = o.ligne({ x1: i, y1: e.Res, x2: i, y2: e.Res, couleur: VIOLET, style: 'solid' });
    e.sup = o.ligne({ x1: i, y1: e.SCR, x2: i, y2: e.SCR, couleur: VIOLET, style: 'solid' });
  }
  if (e.TradeOn) { e.res.x2 = i; e.sup.x2 = i; }
  const c1 = i > 0 ? d[i - 1].close : null, c2 = i > 1 ? d[i - 2].close : null;
  const corps = i > 100 && (!p.filtre || (s.atr5[i] !== null && Math.abs(b.close - b.open) < s.atr5[i]));
  // ta.crossover(close[1], Res) / ta.crossunder(close[1], SCR) : Res et SCR sont des series `var`
  const xo = c1 !== null && c2 !== null && e.Res !== null && e.resPrec !== null && c1 > e.Res && c2 <= e.resPrec;
  const xu = c1 !== null && c2 !== null && e.SCR !== null && e.scrPrec !== null && c1 < e.SCR && c2 >= e.scrPrec;
  if (xo && corps) BUY = true;
  if (xu && corps) SELL = true;
  if (e.res && e.sup) {
    // un seul remplissage par paire de lignes : le nouveau remplace l'ancien
    if (e.remplPaire === e.res) o.supprimer(e.rempl);
    e.remplPaire = e.res;
    const c = degrade(b.close, s.bas5[i], s.haut10[i], '#3a6186', '#89253e');
    e.rempl = o.remplissage(e.res, e.sup, { couleur: c === null ? null : transparence(c, 80) });
  }
  const longDiffSL2 = e.Res === null ? null : Math.abs(b.close - e.Res), longDiffSL = e.SCR === null ? null : Math.abs(b.close - e.SCR);
  const Long = BUY && !e.TradeisON, Short = SELL && !e.TradeisON;
  if (Long && !e.TradeisON) { e.LongTrade = true; e.ShortTrade = false; }
  if (Short && !e.TradeisON) { e.LongTrade = false; e.ShortTrade = true; }
  if ((Long || Short) && !e.TradeisON) {
    e.TP = Long ? b.close + p.objectif * longDiffSL : b.close - p.objectif * longDiffSL2;
    e.SL = Long ? b.close - longDiffSL : b.close + longDiffSL2;
    e.TradeisON = true;
    o.ligne({ x1: i, y1: Long ? b.high : b.low, x2: i, y2: e.TP, epaisseur: 2, couleur: TAIL, style: 'dashed' });
    e.tpLine = o.ligne({ x1: i, y1: e.TP, x2: i + 2, y2: e.TP, style: 'dashed', couleur: TAIL });
    if (p.afficherStop) e.SLLine = o.ligne({ x1: i, y1: e.SL, x2: i + 2, y2: e.SL, style: 'dashed', couleur: RED });
    e.LAB = o.etiquette({ x: i, y: e.TP, texte: 'Objectif', couleur: TAIL, style: 'label_left', taille: 'small', couleurTexte: BLANC });
  }
  if (e.TradeisON) {
    e.tpLine.x2 = i;
    e.LAB.x = i + 1;
    if (p.afficherStop && e.SLLine) e.SLLine.x2 = i;
  }
  const surCloture = p.typeStop === 'Close';
  const stop = () => `Stop touché : ${f(Math.round(e.SL / env.mintick) * env.mintick)}`;
  if (e.LongTrade && e.TradeisON) {
    if (b.high >= e.TP) { e.LAB.couleur = GREEN; e.score[0]++; e.TradeisON = false; }
    if ((surCloture ? b.close : b.low) <= e.SL) { e.score[1]++; e.LAB.couleur = transparence(RED, 70); e.LAB.infobulle = stop(); e.TradeisON = false; }
  } else if (e.ShortTrade && e.TradeisON) {
    if (b.low <= e.TP) { e.LAB.couleur = GREEN; e.score[0]++; e.TradeisON = false; }
    if ((surCloture ? b.close : b.high) >= e.SL) { e.score[1]++; e.LAB.couleur = transparence(RED, 70); e.LAB.infobulle = stop(); e.TradeisON = false; }
  }
  const bear = e.TradeisON && e.ShortTrade, bull = e.TradeisON && e.LongTrade;
  S.achat[i] = Long; S.vente[i] = Short; S.enAchat[i] = bull; S.enVente[i] = bear;
  S.bougies[i] = bear ? RED : bull ? VERT_FONCE : NEUTRE;
  e.resPrec = e.Res; e.scrPrec = e.SCR;
  if (derniere) {
    const t = o.tableau({ position: 'top_right', colonnes: 6, lignes: 6, fond: transparence('#787B86', 80) });
    const gp = e.score[0] * (p.risque * p.objectif), gl = e.score[1] * p.risque, pnl = gp - gl;
    const cel = (c, l, texte, couleurTexte) => t.cellule(c, l, { texte, couleurTexte });
    cel(0, 0, 'Objectifs atteints', '#a3a3b1'); cel(1, 0, String(e.score[0]), '#08c09b');
    cel(0, 1, 'Stops touchés', '#a3a3b1'); cel(1, 1, String(e.score[1]), '#cd0202');
    cel(0, 2, 'Gain brut simulé', '#a3a3b1'); cel(1, 2, f(gp), gp > 0 ? '#1eddd4' : '#cd0202');
    cel(0, 3, 'Perte brute simulée', '#a3a3b1'); cel(1, 3, f(-gl), '#cd0202');
    cel(0, 4, 'Résultat simulé', '#a3a3b1'); cel(1, 4, f(pnl), '#ba7726');
  }
}

export default class PlagesObjectifsIndicator {
  static metadata = {
    id: 'plages_objectifs',
    name: 'Plages journalières avec objectifs',
    shortName: 'PLAGES-OBJ',
    description: 'plages_objectifs',
    version: '1.0.0',
    overlay: true,
    type: 'volatility',
    category: 'Volatility',
    source: 'builtin',
    tags: ['plage', 'cassure', 'objectif', 'stop', 'atr', 'journalier'],
    inputs: INPUTS,
    outputs: [
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
      { id: 'enAchat', name: 'Position acheteuse en cours', type: 'line', hidden: true },
      { id: 'enVente', name: 'Position vendeuse en cours', type: 'line', hidden: true },
      { id: 'achat', name: 'Sortie par le haut', type: 'line', hidden: true },
      { id: 'vente', name: 'Sortie par le bas', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: NEUTRE, couleurDuPoint: true },
    ],
    barColorMode: 'body',
    bgColors: [
      { when: 'custom', source: 'enVente', condition: (pt) => pt.value === 1, color: 'rgba(136, 4, 15, 0.1)' },
      { when: 'custom', source: 'enAchat', condition: (pt) => pt.value === 1, color: 'rgba(8, 191, 158, 0.1)' },
    ],
    alertConditions: [
      { id: 'achat', title: 'BUY', message: 'BUY', when: 'custom', source: 'achat', condition: (pt) => pt.value === 1 },
      { id: 'vente', title: 'Sell', message: 'Sell', when: 'custom', source: 'vente', condition: (pt) => pt.value === 1 },
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { bougies: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(PlagesObjectifsIndicator._memo, JSON.stringify([p, env.mintick]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => {
        const S = etat.sorties;
        return {
          bougies: d.map((b, i) => ({ time: b.time, value: 1, color: S.bougies[i] })),
          enAchat: signaux(d, S.enAchat),
          enVente: signaux(d, S.enVente),
          achat: signaux(d, S.achat),
          vente: signaux(d, S.vente),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
