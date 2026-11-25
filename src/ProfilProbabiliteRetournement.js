// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Reversal Probability Profile [AlgoAlpha] » © AlgoAlpha — https://www.tradingview.com/script/ZWLdxZtM-Reversal-Probability-Profile-AlgoAlpha/
// Adaptation : textes en francais ; le reglage « Broken Line Colour », que le script declare sans le lire (les niveaux
// casses prennent la couleur du texte du graphique), n'est pas propose.
import { creerObjets } from '../academyscript/objets.js';
import { atr as atrTa, pivothigh, pivotlow } from '../academyscript/ta.js';
import { tostring, formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence, masque, bit } from './commun.js';

const TAILLES = [{ label: 'Très petit', value: 'tiny' }, { label: 'Petit', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Grand', value: 'large' }, { label: 'Énorme', value: 'huge' }];
const C = 'Calcul', A = 'Alertes', S = 'Style';
const INPUTS = [
  { id: 'gauche', name: 'Barres à gauche des pivots', type: 'number', entier: true, default: 5, min: 1, max: 50, step: 1, group: C },
  { id: 'droite', name: 'Barres à droite des pivots', type: 'number', entier: true, default: 5, min: 1, max: 50, step: 1, group: C },
  { id: 'recul', name: 'Recul du calcul (barres)', type: 'number', entier: true, default: 600, min: 50, max: 5000, step: 1, group: C,
    description: 'Barres au plus pour garder les pivots, borner le profil et calculer les probabilités.' },
  { id: 'memoire', name: 'Pivots gardés', type: 'number', entier: true, default: 240, min: 20, max: 400, step: 1, group: C },
  { id: 'rayon', name: 'Rayon de lissage des rangées', type: 'number', entier: true, default: 3, min: 0, max: 20, step: 1, group: C,
    description: 'Chaque pivot compte aussi dans ce nombre de rangées au-dessus et au-dessous de la sienne.' },
  { id: 'rangees', name: 'Résolution du profil (rangées)', type: 'number', entier: true, default: 140, min: 20, max: 220, step: 1, group: C },
  { id: 'groupes', name: 'Groupes de prix', type: 'number', entier: true, default: 5, min: 2, max: 8, step: 1, group: C,
    description: 'Groupes de pivots (k-moyennes) qui colorent le profil.' },
  { id: 'iterations', name: 'Itérations du regroupement', type: 'number', entier: true, default: 25, min: 5, max: 50, step: 1, group: C },
  { id: 'longueurAtr', name: 'Longueur de la plage moyenne', type: 'number', entier: true, default: 14, min: 1, max: 200, step: 1, group: C },
  { id: 'multipleAtr', name: 'Écart minimal entre niveaux (× plage moyenne)', type: 'number', default: 2, min: 0, max: 20, step: 0.1, group: C,
    description: 'Un nouveau niveau n’est pas tracé si un niveau actif est déjà à moins de cette distance.' },
  { id: 'seuilProbabilite', name: 'Seuil de probabilité élevée (%)', type: 'number', default: 80, min: 1, max: 100, step: 1, group: A },
  { id: 'profil', name: 'Afficher le profil', type: 'boolean', default: true, group: S },
  { id: 'largeur', name: 'Largeur du profil (barres)', type: 'number', entier: true, default: 70, min: 10, max: 250, step: 1, group: S },
  { id: 'decalage', name: 'Décalage du profil (barres)', type: 'number', entier: true, default: 90, min: 0, max: 250, step: 1, group: S },
  { id: 'transparenceRangees', name: 'Transparence des rangées', type: 'number', entier: true, default: 75, min: 0, max: 100, step: 1, group: S },
  { id: 'transparencePoc', name: 'Transparence de la rangée maximale', type: 'number', entier: true, default: 0, min: 0, max: 100, step: 1, group: S },
  { id: 'texteRangees', name: 'Texte dans les rangées', type: 'boolean', default: false, group: S },
  { id: 'modeTexte', name: 'Texte des rangées', type: 'select', default: 'Probability', options: [{ label: 'Probabilité', value: 'Probability' }, { label: 'Nombre', value: 'Count' }], group: S },
  { id: 'etiquettesProfil', name: 'Étiquettes du profil', type: 'boolean', default: true, group: S },
  { id: 'lignePoc', name: 'Ligne de la rangée maximale', type: 'boolean', default: true, group: S },
  { id: 'lignesGroupes', name: 'Lignes des groupes', type: 'boolean', default: true, group: S },
  { id: 'lignesPivots', name: 'Niveaux des pivots', type: 'boolean', default: true, group: S },
  { id: 'etiquettesNiveaux', name: 'Étiquettes des niveaux', type: 'boolean', default: true, group: S },
  { id: 'garderCasses', name: 'Garder les niveaux cassés', type: 'boolean', default: true, group: S },
  { id: 'niveauxMax', name: 'Niveaux gardés au plus', type: 'number', entier: true, default: 120, min: 10, max: 150, step: 1, group: S },
  { id: 'points', name: 'Points des pivots', type: 'boolean', default: true, group: S },
  { id: 'pointsMax', name: 'Points au plus', type: 'number', entier: true, default: 260, min: 10, max: 300, step: 1, group: S },
  { id: 'taillePoints', name: 'Taille des points', type: 'select', default: 'small', options: TAILLES, group: S },
  { id: 'transparencePoints', name: 'Transparence des points', type: 'number', entier: true, default: 30, min: 0, max: 100, step: 1, group: S },
  { id: 'couleurSupport', name: 'Supports', type: 'color', default: '#00ffbb', group: S },
  { id: 'couleurResistance', name: 'Résistances', type: 'color', default: '#ff1100', group: S },
  { id: 'groupe1', name: 'Groupe 1', type: 'color', default: '#FDD835', group: S },
  { id: 'groupe2', name: 'Groupe 2', type: 'color', default: '#2962FF', group: S },
  { id: 'groupe3', name: 'Groupe 3', type: 'color', default: '#FF9800', group: S },
  { id: 'groupe4', name: 'Groupe 4', type: 'color', default: '#F23645', group: S },
  { id: 'groupe5', name: 'Groupe 5', type: 'color', default: '#089981', group: S },
  { id: 'groupe6', name: 'Groupe 6', type: 'color', default: '#26a69a', group: S },
  { id: 'groupe7', name: 'Groupe 7', type: 'color', default: '#ef5350', group: S },
  { id: 'groupe8', name: 'Groupe 8', type: 'color', default: '#787b86', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

/** pivotKmeans du script : centres repartis du min au max, `iterations` passes, centres tries et etiquettes renumerotees. */
export function kmoyennes(src, k, iterations) {
  const n = src.length, labels = new Array(n).fill(0), K = Math.max(1, k);
  let centres = new Array(K).fill(0);
  if (n > 0) {
    let mn = src[0].price, mx = src[0].price;
    for (let i = 0; i < n; i++) { mn = Math.min(mn, src[i].price); mx = Math.max(mx, src[i].price); }
    const pas = K > 1 ? (mx - mn) / (K - 1) : 0;
    for (let c = 0; c < K; c++) centres[c] = K === 1 ? (mn + mx) / 2 : mn + pas * c;
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < n; i++) {
        let best = 0, dist = 1e10;
        for (let c = 0; c < K; c++) { const dd = Math.abs(src[i].price - centres[c]); if (dd < dist) { dist = dd; best = c; } }
        labels[i] = best;
      }
      const sommes = new Array(K).fill(0), comptes = new Array(K).fill(0);
      for (let i = 0; i < n; i++) { const c = labels[i]; sommes[c] = sommes[c] + src[i].price; comptes[c] = comptes[c] + 1; }
      for (let c = 0; c < K; c++) if (comptes[c] > 0) centres[c] = sommes[c] / comptes[c];
    }
    const tries = centres.slice().sort((a, b) => a - b), carte = new Array(K).fill(0), pris = new Array(K).fill(false);
    for (let c = 0; c < K; c++) {
      let rang = 0, dist = 1e10;
      for (let r = 0; r < K; r++) if (!pris[r]) { const dd = Math.abs(centres[c] - tries[r]); if (dd < dist) { dist = dd; rang = r; } }
      pris[rang] = true; carte[c] = rang;
    }
    for (let i = 0; i < n; i++) labels[i] = carte[labels[i]];
    centres = tries;
  }
  return { centres, labels };
}

function series(p, d) {
  return { ph: pivothigh(d.map((b) => b.high), p.gauche, p.droite), pl: pivotlow(d.map((b) => b.low), p.gauche, p.droite), atr: atrTa(d, p.longueurAtr) };
}

function creer() {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500, maxBoites: 500 }), pivots: [], niveaux: [],
    sorties: { nr: [], ns: [], cr: [], cs: [], pm: [], pe: [], ph: [], pb: [] },
  };
}

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i], ph = s.ph[i], pl = s.pl[i], R = p.droite, mt = env.mintick;
  const pal = [p.groupe1, p.groupe2, p.groupe3, p.groupe4, p.groupe5, p.groupe6, p.groupe7, p.groupe8];
  const coul = (id) => pal[id % pal.length];
  const fmt = (v) => tostring(v, 'mintick', mt);
  const seuil = nul(s.atr[i]) ? mt : s.atr[i] * p.multipleAtr;
  let casseR = false, casseS = false, alMax = false, alHaut = false, alHausse = false, alBaisse = false;
  if (!nul(ph)) e.pivots.unshift({ price: ph, bar: i - R, haut: true });
  if (!nul(pl)) e.pivots.unshift({ price: pl, bar: i - R, haut: false });
  while (e.pivots.length > 0) {
    const vieux = e.pivots[e.pivots.length - 1];
    if (e.pivots.length > p.memoire || i - vieux.bar > p.recul) e.pivots.pop(); else break;
  }
  const L = e.niveaux;
  const effacer = (it) => { o.supprimer(it.ln); o.supprimer(it.lb); };
  if (!p.lignesPivots) while (L.length > 0) effacer(L.pop());
  const chevauche = (prix) => L.some((it) => !it.casse && Math.abs(it.niveau - prix) <= seuil);
  const nouveau = (prix, support) => {
    const c = support ? p.couleurSupport : p.couleurResistance, et = p.etiquettesNiveaux;
    const ln = o.ligne({ x1: i - R, y1: prix, x2: i, y2: prix, couleur: c, epaisseur: 1 });
    const lb = o.etiquette({ x: i, y: prix, yloc: 'price', texte: et ? fmt(prix) : '', style: 'label_left', couleur: et ? transparence(c, 80) : transparence(c, 100),
      couleurTexte: et ? c : transparence(c, 100), taille: 'small' });
    L.push({ ln, lb, niveau: prix, support, casse: false, debut: i - R });
  };
  if (p.lignesPivots && !nul(ph) && !chevauche(ph)) nouveau(ph, false);
  if (p.lignesPivots && !nul(pl) && !chevauche(pl)) nouveau(pl, true);
  if (p.lignesPivots && L.length > 0) {
    for (let k = L.length - 1; k >= 0; k--) {
      const it = L[k];
      if (i - it.debut > p.recul) { effacer(it); L.splice(k, 1); continue; }
      if (it.casse) continue;
      const c = it.support ? p.couleurSupport : p.couleurResistance, et = p.etiquettesNiveaux;
      it.ln.x2 = i; it.ln.couleur = c; it.ln.style = 'solid';
      it.lb.x = i; it.lb.couleur = et ? transparence(c, 80) : transparence(c, 100); it.lb.couleurTexte = et ? c : transparence(c, 100);
      const hausse = !it.support && b.close > it.niveau, baisse = it.support && b.close < it.niveau;
      if (hausse || baisse) {
        casseR = casseR || hausse; casseS = casseS || baisse;
        if (p.garderCasses) {
          it.casse = true;
          it.ln.couleur = transparence(env.texte, 90); it.ln.style = 'dotted';
          it.lb.texte = et ? tostring(b.volume, 'volume') : '';
          it.lb.couleur = transparence(env.fond, 100);
          it.lb.couleurTexte = et ? transparence(env.texte, 90) : transparence(env.texte, 100);
          it.lb.style = hausse ? 'label_lower_right' : 'label_upper_right';
        } else { effacer(it); L.splice(k, 1); }
      }
    }
  }
  while (L.length > p.niveauxMax) effacer(L.shift());

  if (derniere && e.pivots.length > 0) {
    const P = e.pivots, fen = Math.min(p.recul, i);
    let haut = b.high, bas = b.low;
    for (let k = 0; k <= fen; k++) { haut = Math.max(haut, d[i - k].high); bas = Math.min(bas, d[i - k].low); }
    const N = p.rangees, taille = Math.max(haut - bas, mt) / N, K = Math.min(p.groupes, P.length);
    const { centres, labels } = kmoyennes(P, K, p.iterations);
    const cnt = new Array(N).fill(0), hc = new Array(N).fill(0), lc = new Array(N).fill(0), cb = new Array(N * K).fill(0);
    if (haut > bas && K > 0) {
      for (let k = 0; k < P.length; k++) {
        const st = P[k];
        if (!(i - st.bar <= p.recul && st.price >= bas && st.price <= haut)) continue;
        const bi = Math.max(0, Math.min(N - 1, Math.floor((st.price - bas) / taille)));
        const cid = k < labels.length ? labels[k] : 0;
        for (let j = Math.max(0, bi - p.rayon); j <= Math.min(N - 1, bi + p.rayon); j++) {
          cnt[j]++;
          if (st.haut) hc[j]++; else lc[j]++;
          cb[j * K + cid]++;
        }
      }
      let maxC = -Infinity;
      for (const v of cnt) if (v > maxC) maxC = v;
      let poc = 0, pocN = 0;
      for (let k = 0; k < N; k++) if (cnt[k] > pocN) { pocN = cnt[k]; poc = k; }
      const debutP = i + p.decalage, finP = i + Math.min(p.decalage + p.largeur, 500), place = Math.max(1, finP - debutP);
      const gaucheF = Math.max(0, i - p.recul), niveauPoc = bas + poc * taille + taille * 0.5;
      let gPoc = 0, gPocN = 0;
      for (let c = 0; c < K; c++) if (cb[poc * K + c] > gPocN) { gPocN = cb[poc * K + c]; gPoc = c; }
      const cPoc = coul(gPoc);
      for (const it of L) {
        if (it.casse) continue;
        const lb = Math.max(0, Math.min(N - 1, Math.floor((it.niveau - bas) / taille)));
        const lcnt = it.niveau >= bas && it.niveau <= haut ? cnt[lb] : 0;
        const prob = maxC > 0 ? lcnt / maxC : 0;
        const texte = `${fmt(it.niveau)} (${formaterMotif(prob * 100, '#')} % de probabilité de retournement)`;
        const c = it.support ? p.couleurSupport : p.couleurResistance, et = p.etiquettesNiveaux;
        it.lb.texte = et ? texte : '';
        it.lb.couleur = et ? transparence(c, 80) : transparence(c, 100);
        it.lb.couleurTexte = et ? c : transparence(c, 100);
      }
      if (p.profil && p.lignesGroupes) {
        for (let c = 0; c < K; c++) {
          const v = centres[c];
          if (v >= bas && v <= haut) o.ligne({ x1: gaucheF, y1: v, x2: finP, y2: v, couleur: transparence(coul(c), 45), epaisseur: 1, style: 'dashed' });
        }
      }
      if (p.profil && p.lignePoc && pocN > 0) o.ligne({ x1: gaucheF, y1: niveauPoc, x2: finP, y2: niveauPoc, couleur: cPoc, epaisseur: 2, style: 'solid' });
      for (let k = 0; k < N; k++) {
        const n0 = cnt[k];
        if (!(n0 > 0 && maxC > 0)) continue;
        const bb = bas + k * taille, bh = bb + taille, prob = n0 / maxC;
        const larg = Math.max(1, Math.trunc(Math.round(prob * place)));
        const estPoc = k === poc;
        let dom = 0, domN = 0;
        for (let c = 0; c < K; c++) if (cb[k * K + c] > domN) { domN = cb[k * K + c]; dom = c; }
        const cc = coul(dom), tr = estPoc ? p.transparencePoc : p.transparenceRangees, trB = estPoc ? p.transparencePoc : Math.max(0, p.transparenceRangees - 35);
        if (p.profil) {
          const bx = o.boite({ gauche: finP - larg, haut: bh, droite: finP, bas: bb, couleurBordure: transparence(cc, trB), epaisseurBordure: 1, fond: transparence(cc, tr) });
          if (p.texteRangees) {
            bx.texte = p.modeTexte === 'Probability' ? tostring(prob, 'percent') : String(n0);
            bx.couleurTexte = env.texte; bx.tailleTexte = 'tiny'; bx.alignH = 'center'; bx.alignV = 'center';
          }
        }
        const dedans = b.close >= bb && b.close <= bh, eleve = prob * 100 >= p.seuilProbabilite;
        alMax = alMax || (dedans && estPoc);
        alHaut = alHaut || (dedans && eleve);
        alHausse = alHausse || (dedans && eleve && lc[k] > hc[k]);
        alBaisse = alBaisse || (dedans && eleve && hc[k] > lc[k]);
      }
      if (p.points && labels.length > 0) {
        const lim = Math.min(p.pointsMax, P.length);
        for (let k = 0; k < lim; k++) {
          const st = P[k];
          if (i - st.bar > p.recul) continue;
          const cid = k < labels.length ? labels[k] : 0;
          o.etiquette({ x: st.bar, y: st.price, yloc: 'price', texte: '•', couleur: transparence(env.fond, 100), couleurTexte: transparence(coul(cid), p.transparencePoints), style: 'label_center', taille: p.taillePoints });
        }
      }
      if (p.profil && p.etiquettesProfil) {
        o.etiquette({ x: finP, y: haut, yloc: 'price', texte: `Probabilité de retournement\n${fmt(haut)}`, couleur: transparence(env.fond, 100), couleurTexte: env.texte, style: 'label_down', taille: 'small' });
        o.etiquette({ x: finP, y: bas, yloc: 'price', texte: fmt(bas), couleur: transparence(env.fond, 100), couleurTexte: env.texte, style: 'label_up', taille: 'small' });
        o.etiquette({ x: finP, y: niveauPoc, yloc: 'price', texte: `Zone de retournement maximale\nPivots : ${pocN}`, couleur: transparence(env.fond, 100), couleurTexte: cPoc, style: 'label_left', taille: 'small' });
      }
    }
  }
  const S = e.sorties;
  S.nr[i] = !nul(ph); S.ns[i] = !nul(pl); S.cr[i] = casseR; S.cs[i] = casseS; S.pm[i] = alMax; S.pe[i] = alHaut; S.ph[i] = alHausse; S.pb[i] = alBaisse;
}

const ALERTES = [
  ['profil_nouvelle_resistance', 'Nouveau sommet (résistance)'], ['profil_nouveau_support', 'Nouveau creux (support)'],
  ['profil_cassure_resistance', 'Cassure d’une résistance'], ['profil_cassure_support', 'Cassure d’un support'],
  ['profil_zone_maximale', 'Prix dans la zone de probabilité maximale'], ['profil_zone_elevee', 'Prix dans une zone de probabilité élevée'],
  ['profil_zone_haussiere', 'Prix dans une zone élevée dominée par les creux'], ['profil_zone_baissiere', 'Prix dans une zone élevée dominée par les sommets'],
];

export default class ProfilProbabiliteRetournementIndicator {
  static metadata = {
    id: 'profil_probabilite_retournement',
    name: 'Profil de probabilité de retournement',
    shortName: 'PPR',
    description: 'profil_probabilite_retournement',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['pivots', 'retournement', 'profil', 'k-moyennes', 'supports', 'resistances'],
    inputs: INPUTS,
    outputs: [{ id: 'signaux', name: 'Signaux', type: 'line', hidden: true }],
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
    return executer(ProfilProbabiliteRetournementIndicator._memo, JSON.stringify([p, env.texte, env.fond, env.mintick]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat, d) => {
        const S = etat.sorties;
        return { signaux: masque(d, [S.nr, S.ns, S.cr, S.cs, S.pm, S.pe, S.ph, S.pb]), objets: etat.o.resultat() };
      },
    });
  }
}
