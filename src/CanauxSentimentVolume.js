// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Volume Sentiment Breakout Channels [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/t2D9irXp-Volume-Sentiment-Breakout-Channels-AlgoAlpha/
import { creerObjets } from '../academyscript/objets.js';
import { stdev, wma, atr, crossover } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, tracer, transparence, degrade, milieu, remplir, suiteVide, signaux } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'normalisation', name: 'Barres de normalisation', type: 'number', entier: true, default: 100, min: 1, max: 1000, step: 1, group: P,
    description: 'Le prix est ramené entre 0 et 1 sur le plus haut et le plus bas de ces barres ; sa volatilité sert à détecter les canaux.' },
  { id: 'detection', name: 'Barres de détection', type: 'number', entier: true, default: 14, min: 1, max: 200, step: 1, group: P },
  { id: 'cloturesFortes', name: 'Cassure par le milieu du corps', type: 'boolean', default: true, group: P,
    description: 'La cassure exige que le milieu du corps de la bougie sorte du canal (sinon la clôture suffit).' },
  { id: 'couleurHausse', name: 'Haussier', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurBaisse', name: 'Baissier', type: 'color', default: '#ff1100', group: S },
];
const RES = 20, ECHELLE = 30;
const nb = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const maxNa = (t) => { let m = null; for (let k = 0; k < t.length; k++) { const v = t[k]; if (v !== null && (m === null || v > m)) m = v; } return m; };
const minNa = (t) => { let m = null; for (let k = 0; k < t.length; k++) { const v = t[k]; if (v !== null && (m === null || v < m)) m = v; } return m; };
// [PERF 2026-11-26] Volume maximal d'un profil, lu une fois (teinte() le relisait pour chacune
// des 20 rangees) ; le profil est un objet local, rendu par profil() a chaque appel.
const maxVol = (prof) => (prof._mx === undefined ? (prof._mx = maxNa(prof.vol)) : prof._mx);
const pct = (v) => (Number.isFinite(v) ? `${tostring(v, '0.00')}%` : 'NaN');
const flottant = (v) => (Number.isFinite(v) ? tostring(v, '#.##########') : 'NaN');

function series(p, d) {
  const n = d.length, L = p.normalisation;
  const norm = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < L - 1) { norm[i] = null; continue; }
    let h = -Infinity, l = Infinity;
    for (let k = 0; k < L; k++) { const b = d[i - k]; if (b.high > h) h = b.high; if (b.low < l) l = b.low; }
    norm[i] = h - l === 0 ? null : (d[i].close - l) / (h - l);
  }
  const haut = stdev(norm, 14), bas = wma(haut, p.detection);
  const ouvre = crossover(haut, bas), ferme = crossover(bas, haut);
  const duree = new Array(n), hh = new Array(n), ll = new Array(n);
  let depuis = null;
  for (let i = 0; i < n; i++) {
    depuis = ferme[i] ? 0 : depuis === null ? null : depuis + 1;
    const dur = Math.max(depuis === null ? 0 : depuis, 1);
    duree[i] = dur;
    if (i - dur + 1 < 0) { hh[i] = null; ll[i] = null; continue; }
    let h = -Infinity, l = Infinity;
    for (let k = 0; k < dur; k++) { const b = d[i - k]; if (b.high > h) h = b.high; if (b.low < l) l = b.low; }
    hh[i] = h; ll[i] = l;
  }
  return { ouvre, duree, hh, ll, vola: atr(d, p.detection).map((v) => (v === null ? NaN : v / 2)) };
}

/** profileCalculation du script : 20 rangees entre les bornes tronquees, volume total et signe. */
function profil(d, i, debut, fin, haut, bas) {
  const H = [], B = [], V = [], D = [];
  for (let k = i - debut; k >= i - fin; k--) { const b = d[i - k]; H.push(b.high); B.push(b.low); V.push(b.volume); D.push(b.close > b.open ? 1 : -1); }
  let maxx = maxNa(H), minn = minNa(B);
  if (haut !== null) maxx = Math.min(maxx, haut);
  if (bas !== null) minn = Math.max(minn, bas);
  const hauts = [], bass = [], vol = [], signe = [];
  if (H.length > 0 && maxx > minn) {
    const pas = (maxx - minn) / RES;
    for (let r = 0; r < RES; r++) {
      let t = 0, s = 0;
      const bo = minn + r * pas, to = minn + (r + 1) * pas;
      for (let j = 0; j < H.length; j++) if (!(B[j] > to || H[j] < bo)) { t += V[j]; s += V[j] * D[j]; }
      bass.push(bo); hauts.push(to); vol.push(t); signe.push(s);
    }
  }
  // array.new_float(res) puis insert : 20 valeurs suivies de 20 na
  for (let r = 0; r < RES; r++) { hauts.push(null); bass.push(null); vol.push(null); signe.push(null); }
  return { hauts, bass, vol, signe };
}

function creer() {
  return {
    o: creerObjets({ maxBoites: 500, maxLignes: 50, maxEtiquettes: 50 }),
    canaux: [], sentiments: [], profilVif: [],
    actifHaut: false, actifBas: false, depuisH: null, depuisB: null,
    suiteH: suiteVide(), suiteB: suiteVide(),
    sorties: { nouveau: [], casseHaut: [], casseBas: [], tH: [], tB: [], mid: [], tHv: [], tBv: [] },
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], S = e.sorties, vola = s.vola[i];
  const g90 = transparence(p.couleurHausse, 90), r90 = transparence(p.couleurBaisse, 90);
  const teinte = (r, prof) => {
    const mx = maxVol(prof);
    return prof.signe[r] !== null && prof.signe[r] > 0 ? degrade(prof.vol[r], 0, mx, g90, p.couleurHausse) : degrade(prof.vol[r], 0, mx, r90, p.couleurBaisse);
  };
  const textes = (c, prof, cy, double) => {
    let k = null;
    for (let r = 0; r < RES; r++) { const bo = prof.bass[r], to = prof.hauts[r]; if (bo !== null && to !== null && b.close >= bo && b.close <= to) { k = r; break; } }
    if (k === null) return;
    const mxS = maxNa(prof.signe), mnS = minNa(prof.signe);
    const maxAbs = Math.max(Math.abs(mxS), Math.abs(mnS));
    const cur = prof.signe[k];
    const valeur = cur / maxAbs * 100;
    // [FIX 2026-11-26] pct() porte deja son « % » : le script en ajoutait un second (« 12.34%% »).
    const sentiment = `Sentiment actuel : ${double ? pct(valeur) : `${flottant(valeur)}%`}`;
    let somme = 0;
    for (let r = 0; r < RES; r++) somme += prof.signe[r];
    const global = `Sentiment global : ${somme > 0 ? 'haussier' : 'baissier'}`;
    const [ici, la] = b.close > cy ? [c.bas, c.haut] : [c.haut, c.bas];
    ici.texte = sentiment; ici.couleurTexte = cur >= 0 ? p.couleurHausse : p.couleurBaisse;
    la.texte = global; la.couleurTexte = env.texte;
  };

  let nouveau = false;
  const h = s.hh[i], l = s.ll[i], dur = s.duree[i];
  if (s.ouvre[i] && dur > 10) {
    let libre = true;
    for (const c of e.canaux) if (h > c.boite.bas && l < c.boite.haut) { libre = false; break; }
    if (libre) {
      const g = i - dur;
      const c = {
        boite: o.boite({ gauche: g, haut: h, droite: i, bas: l, fond: transparence(env.texte, 90), couleurBordure: null }),
        haut: o.boite({ gauche: g, haut: h, droite: i, bas: nb(h - vola), fond: transparence(p.couleurBaisse, 70), couleurBordure: null }),
        bas: o.boite({ gauche: g, haut: nb(l + vola), droite: i, bas: l, fond: transparence(p.couleurHausse, 70), couleurBordure: null }),
      };
      e.canaux.unshift(c);
      const prof = profil(d, i, g, i, h, l);
      for (let r = 0; r < RES; r++) {
        const droite = g, gauche = Math.trunc(droite - (i - droite) * 0.15), col = teinte(r, prof);
        e.sentiments.push(o.boite({ gauche, haut: prof.hauts[r], droite, bas: prof.bass[r], styleBordure: 'solid', couleurBordure: col, epaisseurBordure: 1, fond: col, tailleTexte: 'auto' }));
      }
      const cy = (h + l) / 2;
      c.milieu = o.ligne({ x1: g, y1: cy, x2: i, y2: cy, couleur: transparence(env.texte, 50), epaisseur: 1, style: 'dashed' });
      c.l1 = o.ligne({ x1: g, y1: h, x2: i, y2: h, couleur: transparence(p.couleurBaisse, 0), epaisseur: 2 });
      c.l2 = o.ligne({ x1: g, y1: nb(h - vola), x2: i, y2: nb(h - vola), couleur: transparence(p.couleurBaisse, 20), epaisseur: 1, style: 'dotted' });
      c.l3 = o.ligne({ x1: g, y1: nb(l + vola), x2: i, y2: nb(l + vola), couleur: transparence(p.couleurHausse, 20), epaisseur: 1, style: 'dotted' });
      c.l4 = o.ligne({ x1: g, y1: l, x2: i, y2: l, couleur: transparence(p.couleurHausse, 0), epaisseur: 2 });
      textes(c, prof, cy, false);
      nouveau = true;
    }
  }
  while (e.profilVif.length) o.supprimer(e.profilVif.shift());

  let casseH = false, casseB = false;
  const n0 = e.canaux.length;
  const prix = p.cloturesFortes ? (b.close + b.open) / 2 : b.close;
  for (let k = 0; k < n0; k++) {
    const c = e.canaux[k];
    if (!c) break; // Pine : indice hors du tableau apres une suppression (erreur d'execution)
    if (prix > c.boite.haut || prix < c.boite.bas) {
      if (prix > c.boite.haut) casseH = true; else casseB = true;
      e.canaux.splice(k, 1);
      e.sentiments.length = 0;
      continue;
    }
    for (const x of [c.boite, c.haut, c.bas]) x.droite = i;
    for (const x of [c.milieu, c.l1, c.l2, c.l3, c.l4]) x.x2 = i;
    const g = c.boite.gauche;
    const prof = profil(d, i, g, i, c.boite.haut, c.boite.bas);
    const mxS = maxNa(prof.signe), mnS = minNa(prof.signe), maxAbs = Math.max(Math.abs(mxS), Math.abs(mnS));
    const mxV = maxVol(prof);
    for (let r = 0; r < RES; r++) {
      const droite = i + 7 + ECHELLE;
      const gauche = prof.vol[r] === null ? null : droite - Math.round(prof.vol[r]) / Math.round(mxV) * ECHELLE;
      const col = teinte(r, prof);
      e.profilVif.push(o.boite({ gauche: nb(gauche), haut: prof.hauts[r], droite, bas: prof.bass[r], styleBordure: 'solid', couleurBordure: col, epaisseurBordure: 1, fond: col }));
      const gL = c.boite.gauche, gR = c.boite.droite;
      const st = e.sentiments[r];
      if (st) {
        st.gauche = Math.trunc(gL - (gR - gL) * 0.15);
        const sv = prof.signe[r];
        const ratio = maxAbs > 0 ? Math.abs(sv) / maxAbs : 0.0;
        const tr = Math.trunc(100 - Math.round(ratio * 100));
        const cc = degrade(tr, 0, 100, sv !== null && sv > 0 ? p.couleurHausse : p.couleurBaisse, env.fond);
        st.fond = cc; st.couleurBordure = cc;
        // [FIX 2026-11-26] rapporte au plus grand |sentiment| (comme la teinte juste au-dessus) :
        // le script divisait par le plus grand sentiment SIGNE, d'ou des parts au-dela de 100 %
        // des qu'une rangee baissiere l'emportait (ecart volontaire).
        st.texte = pct(100 * Math.abs(sv) / maxAbs);
      }
      if (r === RES - 1) { const x1 = Math.trunc(gL - (gR - gL) * 0.15); for (const x of [c.milieu, c.l1, c.l2, c.l3, c.l4]) x.x1 = x1; }
    }
    textes(c, prof, (c.boite.haut + c.boite.bas) / 2, true);
  }

  // tendances apres cassure : moyenne des bas (hauts) depuis la cassure
  e.depuisH = casseH ? 0 : e.depuisH === null ? null : e.depuisH + 1;
  e.depuisB = casseB ? 0 : e.depuisB === null ? null : e.depuisB + 1;
  const moy = (champ, n) => { if (i - n + 1 < 0) return null; let t = 0; for (let k = 0; k < n; k++) t += d[i - k][champ]; return t / n; };
  const tH = moy('low', Math.max(e.depuisH === null ? 0 : e.depuisH, 1)), tB = moy('high', Math.max(e.depuisB === null ? 0 : e.depuisB, 1));
  const tH1 = i > 0 ? S.tHv[i - 1] : null, tB1 = i > 0 ? S.tBv[i - 1] : null;
  S.tHv[i] = tH; S.tBv[i] = tB;
  if (casseH) e.actifHaut = true;
  if (e.actifHaut && tH !== null && tH1 !== null && b.close < tH && d[i - 1].close >= tH1) e.actifHaut = false;
  if (casseB) e.actifBas = true;
  if (e.actifBas && tB !== null && tB1 !== null && b.close > tB && d[i - 1].close <= tB1) e.actifBas = false;
  S.tH[i] = e.actifHaut ? tH : null;
  S.tB[i] = e.actifBas ? tB : null;
  S.mid[i] = (b.close + b.open) / 2;
  remplir(o, e.suiteH, S.mid, S.tH, i, milieu(transparence(env.fond, 70), transparence(p.couleurHausse, 70)), derniere);
  remplir(o, e.suiteB, S.tB, S.mid, i, milieu(transparence(p.couleurBaisse, 70), transparence(env.fond, 70)), derniere);
  if (casseH && i >= 2) o.plotchar(i, { position: 'absolute', y: Math.min(b.low, d[i - 1].low, d[i - 2].low), caractere: '▲', couleur: p.couleurHausse, taille: 'tiny' });
  if (casseB && i >= 2) o.plotchar(i, { position: 'absolute', y: Math.max(b.high, d[i - 1].high, d[i - 2].high), caractere: '▼', couleur: p.couleurBaisse, taille: 'tiny' });
  S.nouveau[i] = nouveau; S.casseHaut[i] = casseH; S.casseBas[i] = casseB;
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class CanauxSentimentVolumeIndicator {
  static metadata = {
    id: 'canaux_sentiment_volume',
    name: 'Canaux de cassure et sentiment du volume',
    shortName: 'CANAL-SV',
    description: 'canaux_sentiment_volume',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['canal', 'cassure', 'profil de volume', 'sentiment', 'volatilite'],
    inputs: INPUTS,
    outputs: [
      { id: 'tendanceHausse', name: 'Tendance après cassure haussière', type: 'line', color: '#00ffbb', lineWidth: 1 },
      { id: 'tendanceBaisse', name: 'Tendance après cassure baissière', type: 'line', color: '#ff1100', lineWidth: 1 },
      { id: 'nouveau', name: 'Nouveau canal', type: 'line', hidden: true },
      { id: 'casseHaut', name: 'Cassure haussière', type: 'line', hidden: true },
      { id: 'casseBas', name: 'Cassure baissière', type: 'line', hidden: true },
    ],
    alertConditions: [
      alerte('nouveau_canal', 'Nouveau canal', 'nouveau'),
      alerte('cassure_haussiere', 'Cassure haussière du canal', 'casseHaut'),
      alerte('cassure_baissiere', 'Cassure baissière du canal', 'casseBas'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { tendanceHausse: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CanauxSentimentVolumeIndicator._memo, JSON.stringify([p, env.texte, env.fond]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => {
        const S = etat.sorties;
        return {
          tendanceHausse: tracer(d, S.tH, d.map(() => p.couleurHausse)),
          tendanceBaisse: tracer(d, S.tB, d.map(() => p.couleurBaisse)),
          nouveau: signaux(d, S.nouveau), casseHaut: signaux(d, S.casseHaut), casseBas: signaux(d, S.casseBas),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
