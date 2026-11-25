// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Fonctions ta.* calculees BARRE PAR BARRE pour les portages JavaScript (AcademyX) des scripts Pine publies sous MPL-2.0.

/**
 * Meme resultat, bit a bit, que les fonctions de `academyscript/ta.js` sur la serie entiere (memes
 * operations dans le meme ordre), mais une barre a la fois : une barre close est calculee une seule
 * fois, la barre en cours seule a chaque tick (cf. `executer` de commun.js).
 *
 * Chaque machine a deux parties :
 *  - son ETAT (petit objet, copie a chaque tick avec l'etat du script) ;
 *  - ses HISTORIQUES, ranges dans `S` (= `etat.sorties`, partage entre l'etat et sa copie) et ecrits
 *    par INDEX (barre ou rang de valeur non na) : le tick ecrit toujours la meme case, que la barre
 *    close reecrit ensuite avec sa valeur definitive.
 * Une machine s'appelle exactement une fois par barre, dans l'ordre des barres.
 * Banc d'egalite avec ta.js : tests/indicateurs/mpl/pas-a-pas.mjs.
 */
const fini = (v) => typeof v === 'number' && Number.isFinite(v);
let compteur = 0;
const cle = (S, nom) => { const k = `__${nom}${compteur++}`; S[k] = []; return k; };

/** ta.sma (les na sont sautes ; barre na = valeur de la fenetre courante). `stdev: true` rend aussi ta.stdev. */
export function sma(S, L, { stdev = false } = {}) {
  return { t: 'sma', L, s: 0, n: 0, cur: null, et: null, avecEt: stdev, h: cle(S, 'sma') };
}
function pasSma(S, m, x) {
  if (fini(x)) {
    const H = S[m.h], L = m.L;
    H[m.n] = x; m.s += x;
    if (m.n >= L) m.s -= H[m.n - L];
    m.n++;
    if (m.n >= L) {
      const r = m.s / L;
      m.cur = fini(r) ? r : null;
      if (m.avecEt) {
        const moy = m.s / L;
        let q = 0;
        for (let k = 0; k < L; k++) { const d = H[m.n - 1 - k] - moy; q += d * d; }
        const e = Math.sqrt(q / L);
        m.et = fini(e) ? e : null;
      }
    }
  }
  return m.cur;
}

/** ta.ema (alpha = 2 / (L + 1)) ou ta.rma (`rma: true`) : amorce par la moyenne des L premieres valeurs non na ; barre na -> na. */
export function ema(L, { rma = false } = {}) { return { t: rma ? 'rma' : 'ema', L, prec: null, somme: 0, compte: 0 }; }
function pasLisse(m, v) {
  if (!fini(v)) return null;
  if (m.prec === null) {
    m.somme += v; m.compte++;
    if (m.compte === m.L) { m.prec = m.somme / m.L; return m.prec; }
    return null;
  }
  m.prec = m.t === 'rma' ? (m.prec * (m.L - 1) + v) / m.L : (2 / (m.L + 1)) * v + (1 - 2 / (m.L + 1)) * m.prec;
  return m.prec;
}

/** ta.wma : barre na -> na ; dans la fenetre, une barre na pese avec la derniere valeur non na qui la precede. */
export function wma(S, L) { return { t: 'wma', L, dernier: null, h: cle(S, 'wma') }; }
function pasWma(S, m, i, v) {
  const R = S[m.h], L = m.L;
  if (fini(v)) m.dernier = v;
  R[i] = m.dernier;
  if (!(L >= 1) || i < L - 1 || !fini(v)) return null;
  let s = 0;
  for (let k = 0; k < L; k++) { const x = R[i - k]; if (x === null) return null; s += x * (L - k); }
  return s / ((L * (L + 1)) / 2);
}

/** ta.hma = wma(2 wma(x, L/2) - wma(x, L), sqrt(L)), longueurs tronquees. */
export function hma(S, L) { return { t: 'hma', a: wma(S, Math.floor(L / 2)), b: wma(S, L), c: wma(S, Math.floor(Math.sqrt(L))) }; }
function pasHma(S, m, i, v) {
  const d = pasWma(S, m.a, i, v), p = pasWma(S, m.b, i, v);
  return pasWma(S, m.c, i, d === null || p === null ? null : 2 * d - p);
}

/** ta.alma(x, L, offset, sigma) : na si un na est dans la fenetre. */
export function alma(S, L, offset = 0.85, sigma = 6) {
  const mm = offset * (L - 1), s = L / sigma, poids = [];
  let norme = 0;
  for (let k = 0; k < L; k++) { const w = Math.exp(-((k - mm) ** 2) / (2 * s * s)); poids.push(w); norme += w; }
  return { t: 'alma', L, poids, norme, dernierNa: -1, h: cle(S, 'alma') };
}
function pasAlma(S, m, i, v) {
  const V = S[m.h], L = m.L, x = fini(v) ? v : null;
  V[i] = x;
  if (x === null) m.dernierNa = i;
  if (!(L >= 1) || i < L - 1 || m.dernierNa > i - L) return null;
  let s = 0;
  const a = i - L + 1;
  for (let k = 0; k < L; k++) s += V[a + k] * m.poids[k];
  const r = s / m.norme;
  return fini(r) ? r : null;
}

/** ta.stoch(x, x, x, L) : extremes lus vers le passe jusqu'au premier na, regles de TradingView sur na et amplitude nulle. */
export function stoch(S, L) { return { t: 'stoch', L, prec: null, h: cle(S, 'stoch') }; }
function pasStoch(S, m, i, v) {
  const V = S[m.h], L = m.L;
  V[i] = v;
  if (!(L >= 1) || i < L - 1) return null;
  let hh = null, ll = null;
  for (let k = 0; k < L; k++) { const x = V[i - k]; if (!fini(x)) break; if (hh === null || x > hh) hh = x; }
  for (let k = 0; k < L; k++) { const x = V[i - k]; if (!fini(x)) break; if (ll === null || x < ll) ll = x; }
  if (hh === null || ll === null) return m.prec;
  const amp = hh - ll;
  if (amp === 0) { if (v === ll) return m.prec; m.prec = null; return null; }
  if (!fini(v)) return m.prec;
  m.prec = 100 * (v - ll) / amp;
  return m.prec;
}

/** ta.vwma(source, L) = sma(source x volume) / sma(volume). */
export function vwma(S, L) { return { t: 'vwma', num: sma(S, L), den: sma(S, L) }; }
function pasVwma(S, m, v, vol) {
  const n = pasSma(S, m.num, fini(v) && fini(vol) ? v * vol : null), d = pasSma(S, m.den, vol);
  return n === null || d === null || d === 0 ? null : n / d;
}

/** ta.crossover / crossunder / cross (sens 1 / -1 / 0) : comparaison a la derniere barre ou les deux valeurs existaient. */
export function croisement(sens) { return { t: 'x', sens, pa: null, pb: null }; }
function pasCroisement(m, a, b) {
  if (!fini(a) || !fini(b)) return false;
  let r = false;
  if (m.pa !== null) { const h = m.pa <= m.pb && a > b, d = m.pa >= m.pb && a < b; r = m.sens > 0 ? h : m.sens < 0 ? d : h || d; }
  m.pa = a; m.pb = b;
  return r;
}

/**
 * Une barre d'une machine : `pas(S, m, i, x)` (vwma : `pas(S, m, i, x, volume)`, croisement :
 * `pas(S, m, i, a, b)`). Rend la valeur de la barre (null = na).
 */
export function pas(S, m, i, x, y) {
  switch (m.t) {
    case 'sma': return pasSma(S, m, x);
    case 'ema': case 'rma': return pasLisse(m, x);
    case 'wma': return pasWma(S, m, i, x);
    case 'hma': return pasHma(S, m, i, x);
    case 'alma': return pasAlma(S, m, i, x);
    case 'stoch': return pasStoch(S, m, i, x);
    case 'vwma': return pasVwma(S, m, x, y);
    case 'x': return pasCroisement(m, x, y);
    default: throw new Error(`machine inconnue ${m.t}`);
  }
}
