// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Channels With Patterns [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/Sxg2rJ7L-Channels-With-Patterns-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { sma, ema, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const R = 'Réglages', AT = 'ATR', PV = 'Pivots', LI = 'Lissage', FI = 'Figures de bougies', VU = 'Affichage', CO = 'Couleurs', AL = 'Alertes';
const INPUTS = [
  { id: 'preselection', name: 'Préréglage', type: 'select', default: 'User', group: R,
    options: [{ label: 'Réglages ci-dessous', value: 'User' }, { label: 'Actions', value: 'Stocks' }, { label: 'Forex', value: 'Forex' }, { label: 'Crypto', value: 'Crypto' }],
    description: 'Les préréglages fixent le style, la cassure, le mode instantané, l’ATR, la taille, les pivots et le lissage ; les autres réglages restent lus.' },
  { id: 'style', name: 'Pivots sur', type: 'select', default: 'Wick', group: R, options: [{ label: 'Mèches', value: 'Wick' }, { label: 'Corps', value: 'Body' }] },
  { id: 'cassure', name: 'Cassure sur', type: 'select', default: 'High/Low', group: R, options: [{ label: 'Clôture', value: 'Close' }, { label: 'Plus haut / plus bas', value: 'High/Low' }] },
  { id: 'instantane', name: 'Mode instantané', type: 'boolean', default: true, group: R,
    description: 'Ouvre un canal dès que le pivot opposé est plus récent, sans attendre un nouveau pivot.' },
  { id: 'longueurAtr', name: 'Longueur de l’ATR', type: 'number', entier: true, default: 10, min: 1, max: 500, step: 1, group: AT },
  { id: 'decalage', name: 'Décalage du centre', type: 'number', default: 5, min: -50, max: 50, step: 0.5, group: AT },
  { id: 'taille', name: 'Taille', type: 'number', default: 4, min: 0.25, max: 50, step: 0.25, group: AT },
  { id: 'marge', name: 'Bandes extrêmes (%)', type: 'number', default: 50, min: 0, max: 100, step: 1, group: AT,
    description: 'Position des lignes intermédiaires : 50 % à mi-chemin entre le bord et le centre, 100 % sur le centre.' },
  { id: 'longueurPivot', name: 'Longueur des pivots', type: 'number', entier: true, default: 10, min: 1, max: 200, step: 1, group: PV },
  { id: 'avancePivot', name: 'Confirmation des pivots (barres)', type: 'number', entier: true, default: 15, min: 1, max: 200, step: 1, group: PV },
  { id: 'longueurMoyenne', name: 'Lissage des hauts / bas', type: 'number', entier: true, default: 18, min: 1, max: 500, step: 1, group: LI },
  { id: 'marteau', name: 'Marteau', type: 'boolean', default: true, group: FI },
  { id: 'marteauInverse', name: 'Marteau inversé', type: 'boolean', default: true, group: FI },
  { id: 'avalementHaussier', name: 'Avalement haussier', type: 'boolean', default: true, group: FI },
  { id: 'avalementBaissier', name: 'Avalement baissier', type: 'boolean', default: true, group: FI },
  { id: 'prolonger', name: 'Prolonger le canal actif', type: 'boolean', default: true, group: VU },
  { id: 'etiquetteCassure', name: 'Étiquette de cassure', type: 'boolean', default: true, group: VU },
  { id: 'historique', name: 'Canaux gardés', type: 'number', entier: true, default: 5, min: 1, max: 100, step: 1, group: VU, legende: false },
  { id: 'couleurHaut', name: 'Bande haute', type: 'color', default: '#337c4f', group: CO },
  { id: 'couleurBas', name: 'Bande basse', type: 'color', default: '#a52d2d', group: CO },
  { id: 'opaciteLignes', name: 'Opacité des lignes', type: 'number', entier: true, default: 100, min: 0, max: 100, step: 1, group: CO, legende: false },
  { id: 'couleurCentre', name: 'Centre', type: 'color', default: '#787b86', group: CO },
  { id: 'opaciteCentre', name: 'Opacité du centre', type: 'number', entier: true, default: 100, min: 0, max: 100, step: 1, group: CO, legende: false },
  { id: 'opaciteFond', name: 'Opacité du remplissage', type: 'number', entier: true, default: 30, min: 0, max: 100, step: 1, group: CO, legende: false },
  { id: 'couleurCassureHaut', name: 'Cassure par le haut', type: 'color', default: '#337c4f88', group: CO },
  { id: 'couleurCassureBas', name: 'Cassure par le bas', type: 'color', default: '#a52d2d88', group: CO },
  { id: 'couleurTexteCassure', name: 'Texte des cassures', type: 'color', default: '#EAEAEA', group: CO },
  { id: 'couleurMarteau', name: 'Marteau', type: 'color', default: '#337c4f88', group: CO },
  { id: 'couleurMarteauInverse', name: 'Marteau inversé', type: 'color', default: '#2d3fa588', group: CO },
  { id: 'couleurAvalementHaussier', name: 'Avalement haussier', type: 'color', default: '#337c4f88', group: CO },
  { id: 'couleurAvalementBaissier', name: 'Avalement baissier', type: 'color', default: '#a53b2d88', group: CO },
  { id: 'couleurTexteFigures', name: 'Texte des figures', type: 'color', default: '#EAEAEA', group: CO },
  { id: 'alerteCassure', name: 'Alerte de cassure', type: 'boolean', default: true, group: AL },
  { id: 'alerteMarteau', name: 'Alerte marteau', type: 'boolean', default: true, group: AL },
  { id: 'alerteMarteauInverse', name: 'Alerte marteau inversé', type: 'boolean', default: true, group: AL },
  { id: 'alerteAvalementHaussier', name: 'Alerte avalement haussier', type: 'boolean', default: true, group: AL },
  { id: 'alerteAvalementBaissier', name: 'Alerte avalement baissier', type: 'boolean', default: true, group: AL },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const ajoute = (...v) => (v.some(nul) ? null : v.reduce((a, b) => a + b, 0));

/** Reglages effectifs : preselection du script (Stocks / Forex / Crypto) ou reglages saisis. */
function reglagesEffectifs(r) {
  const s = { ...r, offset: r.decalage * 0.125, cassureCloture: r.cassure === 'Close', lineTrans: 100 - r.opaciteLignes, centerTrans: 100 - r.opaciteCentre, fillTrans: 100 - r.opaciteFond };
  const P = { Stocks: [10, 10, 4], Forex: [14, 100, 5], Crypto: [8, 10, 4] }[r.preselection];
  if (P) Object.assign(s, { style: 'Wick', cassureCloture: false, instantane: true, offset: P[0] * 0.125, longueurAtr: P[1], taille: P[2], longueurPivot: 10, avancePivot: 15, longueurMoyenne: 18 });
  return s;
}

function series(s, d) {
  const n = d.length;
  const top = d.map((b) => (s.style === 'Wick' ? b.high : Math.max(b.open, b.close)));
  const bottom = d.map((b) => (s.style === 'Wick' ? b.low : Math.min(b.open, b.close)));
  // atr(length) du script : rma maison, alpha = 1 / (length + 1), depart nz(...) = 0
  const atr = new Array(n), catr = new Array(n);
  let sm = null, ce = null, count = 0;
  const alpha = 1 / (s.longueurAtr + 1);
  for (let i = 0; i < n; i++) {
    const b = d[i];
    const tr1 = i === 0 ? b.high - b.low : Math.max(Math.max(b.high - b.low, Math.abs(b.high - d[i - 1].close)), Math.abs(b.low - d[i - 1].close));
    sm = alpha * tr1 + (1 - alpha) * (sm === null ? 0 : sm);
    atr[i] = sm;
    // cema(ta.tr) : ta.tr na a la premiere barre
    count += 1;
    const tr = i === 0 ? null : tr1;
    ce = tr === null ? null : (1 - 2 / (count + 1)) * (ce === null ? 0 : ce) + (2 / (count + 1)) * tr;
    catr[i] = ce === null ? null : ce / 8.71875;
  }
  const avgH = sma(top, s.longueurMoyenne), avgL = sma(bottom, s.longueurMoyenne);
  const ph = pivothigh(top, s.longueurPivot, s.avancePivot), pl = pivotlow(bottom, s.longueurPivot, s.avancePivot);
  const highFlag = ph.map((v) => v !== null), lowFlag = pl.map((v) => v !== null);
  const sinceH = new Array(n), sinceL = new Array(n), hp = new Array(n), lp = new Array(n), hi = new Array(n), li = new Array(n);
  let dh = null, dl = null, vhp = null, vlp = null, vhi = null, vli = null;
  for (let i = 0; i < n; i++) {
    if (highFlag[i]) { dh = i; vhp = top[i - s.avancePivot]; vhi = i - s.avancePivot; }
    if (lowFlag[i]) { dl = i; vlp = bottom[i - s.avancePivot]; vli = i - s.avancePivot; }
    sinceH[i] = dh === null ? null : i - dh; sinceL[i] = dl === null ? null : i - dl;
    hp[i] = vhp; lp[i] = vlp; hi[i] = vhi; li[i] = vli;
  }
  const corps = d.map((b) => Math.max(b.open, b.close) - Math.min(b.open, b.close));
  const mecheHaut = d.map((b) => b.high - Math.max(b.open, b.close)), mecheBas = d.map((b) => Math.min(b.open, b.close) - b.low);
  const mCorps = ema(corps, 14), mHaut = ema(mecheHaut, 14), mBas = ema(mecheBas, 14);
  return { top, bottom, atr, catr, avgH, avgL, highFlag, lowFlag, sinceH, sinceL, hp, lp, hi, li, corps, mecheHaut, mecheBas, mCorps, mHaut, mBas };
}

function bougie(s, d, i) {
  const b = d[i], bt = Math.max(b.open, b.close), bb = Math.min(b.open, b.close);
  const gt = (a, c) => !nul(a) && !nul(c) && a > c;
  return {
    polarite: b.open < b.close, haut: bt, bas: bb, corps: s.corps[i], mecheHaut: s.mecheHaut[i], mecheBas: s.mecheBas[i],
    aCorps: s.corps[i] !== 0, aMecheHaut: s.mecheHaut[i] !== 0, aMecheBas: s.mecheBas[i] !== 0,
    grandCorps: gt(s.corps[i], s.mCorps[i]), grandeMecheHaut: gt(s.mecheHaut[i], s.mHaut[i]), grandeMecheBas: gt(s.mecheBas[i], s.mBas[i]),
  };
}

function creer() {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }),
    sorties: { alertes: [] },
    historique: [], actif: false, dernier: null, etiquettesHausse: [], etiquettesBaisse: [], bougiePrec: null,
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], al = [];
  const confirmee = !derniere || env.derniereConfirmee;
  const breakUp = p.cassureCloture ? b.close : b.low, breakDown = p.cassureCloture ? b.close : b.high;
  const notActive = !e.actif && confirmee;
  const goingUp = !nul(s.lp[i]) && s.lp[i] < b.low, goingDown = !nul(s.hp[i]) && s.hp[i] > b.high;
  const instantUp = !nul(s.li[i]) && !nul(s.hi[i]) && s.li[i] > s.hi[i] && e.dernier === false && p.instantane;
  const instantDown = !nul(s.li[i]) && !nul(s.hi[i]) && s.li[i] < s.hi[i] && e.dernier === true && p.instantane;
  const prolonger = (h, c) => { for (const k of ['top', 'midTop', 'center', 'midBottom', 'bottom']) if (h[k]) h[k].extend = c ? 'right' : 'none'; };
  const detruire = (c) => {
    for (let k = c.labels.length - 1; k >= 0; k--) { o.supprimer(c.labels[k]); c.labels.splice(k, 1); }
    o.supprimer(c.topFill); o.supprimer(c.bottomFill);
    for (const k of ['top', 'midTop', 'center', 'midBottom', 'bottom']) o.supprimer(c[k]);
  };
  const initialiser = (hausse) => {
    const delta = hausse ? ajoute(s.avgL[i], -(s.catr[i] ?? NaN), -(s.lp[i] ?? NaN)) : ajoute(s.avgH[i], s.catr[i], -(s.hp[i] ?? NaN));
    const div = hausse ? (nul(s.sinceL[i]) ? null : p.avancePivot + s.sinceL[i]) : (nul(s.sinceH[i]) ? null : p.avancePivot + s.sinceH[i]);
    const dl = nul(delta) || nul(div) || div === 0 ? null : delta / div;
    // get_points
    const atr = s.atr[i] * p.taille, buffer = atr / 7, offset = ((s.atr[i] * 4) / 7) * p.offset, padding = (p.marge / 100) * 4;
    const catr = s.catr[i];
    let t1, t2, b1, b2, start;
    if (hausse) {
      t1 = ajoute(s.lp[i], atr, buffer, -offset); t2 = nul(catr) ? null : ajoute(s.avgL[i], -catr, atr, buffer, -offset);
      b1 = ajoute(s.lp[i], -buffer, -offset); b2 = nul(catr) ? null : ajoute(s.avgL[i], -catr, -buffer, -offset);
      start = nul(s.sinceL[i]) ? null : i - p.avancePivot - s.sinceL[i];
    } else {
      t1 = ajoute(s.hp[i], buffer, offset); t2 = ajoute(s.avgH[i], catr, buffer, offset);
      b1 = ajoute(s.hp[i], -atr, -buffer, offset); b2 = ajoute(s.avgH[i], catr, -atr, -buffer, offset);
      start = nul(s.sinceH[i]) ? null : i - p.avancePivot - s.sinceH[i];
    }
    const moins = (a) => (nul(a) ? null : a - buffer * padding), plus = (a) => (nul(a) ? null : a + buffer * padding);
    const moy = (a, c) => (nul(a) || nul(c) ? null : (a + c) / 2);
    const L = (couleur, style) => o.ligne({ x1: null, y1: null, x2: null, y2: null, couleur, ...(style ? { style } : {}) });
    const top = L(transparence(p.couleurHaut, p.lineTrans)), midTop = L(transparence(p.couleurHaut, p.lineTrans));
    const center = L(transparence(p.couleurCentre, p.centerTrans), 'dashed');
    const midBottom = L(transparence(p.couleurBas, p.lineTrans)), bottom = L(transparence(p.couleurBas, p.lineTrans));
    const topFill = o.remplissage(top, midTop, { couleur: transparence(p.couleurHaut, p.fillTrans) });
    const bottomFill = o.remplissage(bottom, midBottom, { couleur: transparence(p.couleurBas, p.fillTrans) });
    const c = { top, midTop, center, midBottom, bottom, topFill, bottomFill, labels: hausse ? e.etiquettesHausse : e.etiquettesBaisse, delta: dl };
    const pose = (l, y1, y2) => { l.x1 = start; l.y1 = y1; l.x2 = i; l.y2 = y2; };
    pose(top, t1, t2); pose(midTop, moins(t1), moins(t2)); pose(center, moy(t1, b1), moy(t2, b2)); pose(midBottom, plus(b1), plus(b2)); pose(bottom, b1, b2);
    prolonger(c, p.prolonger);
    return c;
  };
  const casse = (c, haut, bas, supprimer) => {
    const up = !nul(c.top.y2) && haut > c.top.y2, down = !nul(c.bottom.y2) && bas < c.bottom.y2;
    if (supprimer) { if (up || down) detruire(c); return up || down; }
    if (up) {
      if (p.etiquetteCassure) c.labels.push(o.etiquette({ x: i, y: b.low, yloc: 'belowbar', texte: 'Cassure haute', couleur: p.couleurCassureHaut, style: 'label_up', couleurTexte: p.couleurTexteCassure }));
      if (p.alerteCassure) al.push('Cassure du canal par le haut');
    }
    if (down) {
      if (p.etiquetteCassure) c.labels.push(o.etiquette({ x: i, y: b.high, yloc: 'abovebar', texte: 'Cassure basse', couleur: p.couleurCassureBas, style: 'label_down', couleurTexte: p.couleurTexteCassure }));
      if (p.alerteCassure) al.push('Cassure du canal par le bas');
    }
    return up || down;
  };
  if ((s.lowFlag[i] || instantUp) && notActive && goingUp) {
    e.actif = true;
    const c = initialiser(true);
    if (casse(c, b.high, b.low, true)) e.actif = false;
    else { al.push('Nouveau canal haussier'); e.dernier = true; if (e.historique.length) prolonger(e.historique[e.historique.length - 1], false); e.historique.push(c); }
  }
  if ((s.highFlag[i] || instantDown) && notActive && goingDown) {
    e.actif = true;
    const c = initialiser(false);
    if (casse(c, b.high, b.low, true)) { detruire(c); e.actif = false; } else { al.push('Nouveau canal baissier'); e.dernier = false; if (e.historique.length) prolonger(e.historique[e.historique.length - 1], false); e.historique.push(c); }
  }
  if (e.actif) {
    const c = e.historique[e.historique.length - 1];
    for (const k of ['top', 'midTop', 'center', 'midBottom', 'bottom']) { c[k].x2 = i; c[k].y2 = nul(c[k].y2) || nul(c.delta) ? null : c[k].y2 + c.delta; }
    figures(p, e, c, d, i, s, confirmee, al);
    if (casse(c, breakUp, breakDown, false) && confirmee) e.actif = false;
  }
  if (e.historique.length > p.historique) { detruire(e.historique[0]); e.historique.shift(); }
  e.sorties.alertes[i] = al.length ? al : null;
}

/** candle_patterns : les [1] des avalements lisent la bougie de l'appel precedent (barre active precedente). */
function figures(p, e, c, d, i, s, confirmee, al) {
  const o = e.o, b = d[i], k = bougie(s, d, i), k1 = e.bougiePrec, hl2 = (b.high + b.low) / 2;
  e.bougiePrec = k;
  const ratio = (a, z) => (z === 0 ? null : a / z);
  const marteau = k.haut >= hl2 && !k.aMecheHaut && ratio(k.mecheBas, k.corps) !== null && ratio(k.mecheBas, k.corps) >= 2 && !k.grandCorps && k.grandeMecheBas && p.marteau && confirmee;
  const marteauInv = k.haut <= hl2 && !k.aMecheBas && ratio(k.mecheHaut, k.corps) !== null && ratio(k.mecheHaut, k.corps) >= 2 && !k.grandCorps && k.grandeMecheHaut && p.marteauInverse && confirmee;
  const avalH = k1 !== null && k.polarite && !k1.polarite && k.haut > k1.haut && k.bas <= k1.bas && k.grandCorps && !k1.grandCorps && !k.grandeMecheBas && p.avalementHaussier;
  const avalB = k1 !== null && !k.polarite && k1.polarite && k.haut >= k1.haut && k.bas < k1.bas && k.grandCorps && !k1.grandCorps && !k.grandeMecheHaut && p.avalementBaissier;
  const [top, midTop, center, midBottom, bottom] = ['top', 'midTop', 'center', 'midBottom', 'bottom'].map((x) => c[x].y2);
  const ge = (a, z) => !nul(a) && !nul(z) && a >= z, le = (a, z) => !nul(a) && !nul(z) && a <= z;
  const condHaut = ge(b.high, midTop) && ge(b.low, center) && le(hl2, top);
  const condBas = le(b.low, midBottom) && le(b.high, center) && ge(hl2, bottom);
  const et = (y, yloc, texte, couleur, style, infobulle) => c.labels.push(o.etiquette({ x: i, y, yloc, texte, couleur, style, couleurTexte: p.couleurTexteFigures, infobulle }));
  if (condHaut) {
    if (marteauInv) { et(b.high, 'abovebar', 'iH', p.couleurMarteauInverse, 'label_down', 'Marteau inversé'); if (p.alerteMarteauInverse) al.push('Marteau inversé'); }
    if (avalB) { et(b.high, 'abovebar', 'EG', p.couleurAvalementBaissier, 'label_down', 'Avalement baissier'); if (p.alerteAvalementBaissier) al.push('Avalement baissier'); }
  }
  if (condBas) {
    if (marteau) { et(b.low, 'belowbar', 'H', p.couleurMarteau, 'label_up', 'Marteau'); if (p.alerteMarteau) al.push('Marteau'); }
    if (avalH) { et(b.high, 'belowbar', 'EG', p.couleurAvalementHaussier, 'label_up', 'Avalement haussier'); if (p.alerteAvalementHaussier) al.push('Avalement haussier'); }
  }
}

export default class CanauxFiguresIndicator {
  static metadata = {
    id: 'canaux_figures',
    name: 'Canaux prédictifs et figures de bougies',
    shortName: 'CANAUX-FIG',
    description: 'canaux_figures',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['canal', 'pivots', 'cassure', 'marteau', 'avalement', 'figures de bougies'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { objets: creerObjets().resultat() };
    const p = reglagesEffectifs(this.params);
    const env = contexte(data, ctx);
    return executer(CanauxFiguresIndicator._memo, JSON.stringify([p, env.derniereConfirmee]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => {
        const r = { objets: etat.o.resultat() };
        const A = etat.sorties.alertes, alertes = [];
        for (let i = 0; i < d.length; i++) if (A[i]) for (const message of A[i]) alertes.push({ time: d[i].time, message, freq: 'once_per_bar' });
        r.alertes = alertes;
        return r;
      },
    });
  }
}
