// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Outils communs aux portages JavaScript (AcademyX) des scripts Pine publies sous MPL-2.0.

/**
 * Chaque portage decrit son script comme le runtime Pine : un etat (les `var`,
 * tableaux et objets dessines, `etat.o`) et une etape par barre. `executer`
 * garde l'etat des barres closes, ne traite que les barres nouvelles et rejoue
 * la derniere barre sur une copie de l'etat, comme Pine annule a chaque tick les
 * effets de la barre en cours. `etat.sorties` (series ecrites a l'index de la
 * barre) est partage entre l'etat et sa copie.
 */
import { CHART_BG, CHART_FG, mintickPourPrix } from '../academyscript/contexte.js';

export const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** Reglages effectifs : defauts, valeurs a plat ou sous `settings`, bornes et options appliquees. */
export function lireReglages(inputs, params = {}) {
  const sous = params && typeof params.settings === 'object' && params.settings ? params.settings : {};
  const r = {};
  for (const e of inputs) {
    let v = e.default;
    if (sous[e.id] !== undefined) v = sous[e.id];
    if (params && params[e.id] !== undefined) v = params[e.id];
    if (e.type === 'number') {
      v = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
      if (typeof v !== 'number' || !Number.isFinite(v)) v = e.default;
      if (e.entier) v = Math.round(v);
      if (e.min !== undefined && v < e.min) v = e.min;
      if (e.max !== undefined && v > e.max) v = e.max;
    } else if (e.type === 'boolean') {
      v = !(v === false || v === 'false');
    } else if (e.type === 'select') {
      const permis = e.options.map((o) => (typeof o === 'object' ? o.value : o));
      if (!permis.includes(v)) v = e.default;
    } else if (e.type === 'color' || e.type === 'string') {
      if (typeof v !== 'string') v = e.default;
    }
    r[e.id] = v;
  }
  return r;
}

/** Copie profonde de l'etat ; les poignees d'objets suivent la correspondance de `o.cloner()`. */
export function copierEtat(etat) {
  const { objets, correspondance } = etat.o.cloner();
  const vus = new Map(correspondance);
  vus.set(etat.o, objets);
  if (etat.sorties) vus.set(etat.sorties, etat.sorties);
  const copier = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (vus.has(v)) return vus.get(v);
    if (ArrayBuffer.isView(v)) { const t = v.slice(); vus.set(v, t); return t; }
    if (Array.isArray(v)) {
      const t = new Array(v.length);
      vus.set(v, t);
      for (let k = 0; k < v.length; k++) t[k] = copier(v[k]);
      return t;
    }
    const t = {};
    vus.set(v, t);
    for (const k in v) t[k] = copier(v[k]);
    return t;
  };
  return copier(etat);
}

/**
 * [PERF 2026-11-26] Rendu en cours d'executer() : les tableaux de points rendus (tracer,
 * signaux, masque) au rendu precedent du meme etat memorise (`prec`, par rang d'appel) et
 * ceux de ce rendu (`cour`). Un point egal au point de meme rang du rendu precedent (meme
 * temps, meme valeur au sens d'Object.is, meme couleur ou absence de couleur) est repris
 * tel quel : au tick, presque aucun point n'est recree (allocations, ramasse-miettes), et le
 * rejeu du hook compare des references. Les points ne sont jamais modifies apres creation.
 */
let RENDU = null;

const identiques = (a, b) => a.time === b.time && Object.is(a.open, b.open) && Object.is(a.high, b.high)
  && Object.is(a.low, b.low) && Object.is(a.close, b.close) && Object.is(a.volume, b.volume);
const ENTREES_MAX = 4;

/**
 * Cle d'un etat memorise : reglages + premiere bougie. Une cle par reglages seulement
 * faisait se chasser les fenetres qui affichent le meme indicateur sur des marches ou des
 * pas differents (2x2 : chaque tick d'une fenetre trouvait l'etat d'une autre et refaisait
 * tout le calcul). Deux suites de bougies qui commencent par la meme bougie partagent
 * toujours leur etat, verifie barre par barre comme avant.
 */
export const cleDonnees = (cle, data) => {
  const b = data[0];
  if (!b) return cle;
  return `${cle}|${b.time}|${b.open}|${b.high}|${b.low}|${b.close}`;
};

/**
 * Calcul memoise par cle de reglages. `def` :
 *  - creer() : etat initial (`o` : magasin d'objets, `sorties` : series) ;
 *  - series(data) : series de `ta.*` sur toutes les bougies (facultatif) ;
 *  - etape(etat, data, i, derniere, series) : barre i ;
 *  - rendre(etat, data, series) : resultat de calculate().
 */
export function executer(memo, cleReglages, data, def) {
  const n = data.length;
  const cle = cleDonnees(cleReglages, data);
  let m = memo.get(cle);
  if (m) {
    memo.delete(cle);
    let ok = m.closes.length <= n - 1;
    for (let j = 0; ok && j < m.closes.length; j++) ok = identiques(m.closes[j], data[j]);
    if (!ok) m = null;
  }
  if (!m) m = { etat: def.creer(), closes: [], derniere: null, resultat: null };
  memo.set(cle, m);
  while (memo.size > ENTREES_MAX) memo.delete(memo.keys().next().value);

  const fin = data[n - 1];
  if (m.resultat && m.closes.length === n - 1 && m.derniere && identiques(m.derniere, fin)) return m.resultat;

  const series = def.series ? def.series(data) : null;
  for (let i = m.closes.length; i < n - 1; i++) {
    def.etape(m.etat, data, i, false, series);
    m.closes.push({ time: data[i].time, open: data[i].open, high: data[i].high, low: data[i].low, close: data[i].close, volume: data[i].volume });
  }
  const copie = copierEtat(m.etat);
  def.etape(copie, data, n - 1, true, series);
  // [PERF 2026-11-26] Rendu precedent de cet etat, offert a tracer() (points identiques
  // repris tels quels, par rang d'appel ; cf. tracer).
  const rendus = m.rendus || (m.rendus = { prec: [], cour: [] });
  rendus.cour = [];
  RENDU = rendus;
  try { m.resultat = def.rendre(copie, data, series); } finally { RENDU = null; rendus.prec = rendus.cour; }
  m.derniere = { time: fin.time, open: fin.open, high: fin.high, low: fin.low, close: fin.close, volume: fin.volume };
  return m.resultat;
}

/** Etat memorise par `executer` pour ces reglages et ces bougies (lecture seule), ou null. */
export function entreeMemo(memo, cleReglages, data) {
  return data.length ? memo.get(cleDonnees(cleReglages, data)) || null : null;
}

/**
 * Pose dans le memo d'`executer` un etat deja avance sur les `nb` premieres bougies de
 * `data` (barres closes), si aucun n'y est : `executer` reprendra a la barre `nb`. A
 * l'appelant de garantir que `etat` est exactement celui d'un calcul sur ces barres.
 */
export function poserEntree(memo, cleReglages, data, etat, nb) {
  const cle = cleDonnees(cleReglages, data);
  if (memo.has(cle) || !(nb >= 0) || nb > data.length - 1) return false;
  const closes = new Array(nb);
  for (let j = 0; j < nb; j++) { const b = data[j]; closes[j] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }; }
  memo.set(cle, { etat, closes, derniere: null, resultat: null });
  while (memo.size > ENTREES_MAX) memo.delete(memo.keys().next().value);
  return true;
}

/** Les `nb` premieres bougies de `data` sont-elles celles d'un etat memorise (`closes`) ? */
export function memesCloses(closes, data, nb) {
  if (!closes || closes.length < nb || data.length < nb) return false;
  for (let j = 0; j < nb; j++) if (!identiques(closes[j], data[j])) return false;
  return true;
}

/** Contexte du graphique : couleurs du theme, pas minimal, barre confirmee. */
export function contexte(data, ctx = {}) {
  const pas = Number(ctx && ctx.syminfo && ctx.syminfo.mintick);
  const d = data[data.length - 1];
  const bs = ctx && ctx.barstate;
  return {
    fond: (ctx && ctx.chart && ctx.chart.bg_color) || CHART_BG,
    texte: (ctx && ctx.chart && ctx.chart.fg_color) || CHART_FG,
    mintick: pas > 0 ? pas : mintickPourPrix(d ? d.close : null),
    derniereConfirmee: bs && typeof bs.isconfirmed === 'function' ? bs.isconfirmed(data.length - 1) : false,
  };
}

/**
 * plot() -> points du graphique. Pine colore le segment (i-1, i) avec la couleur
 * de la barre i, le graphique avec celle du point i-1 : chaque point porte donc
 * la couleur de la barre suivante. Une couleur na masque le segment, et un point
 * suivi d'une valeur na aussi : le graphique relie sinon les deux bords d'un
 * trou, que Pine laisse vide (plot.style_linebr).
 */
export function tracer(data, valeurs, couleurs = null, decalage = 0) {
  const n = data.length;
  const out = new Array(n);
  const prec = RENDU ? RENDU.prec[RENDU.cour.length] : null;
  const np = prec ? prec.length : 0;
  for (let j = 0; j < n; j++) {
    const s = j - decalage;
    const v = s >= 0 && s < n ? valeurs[s] : null;
    const t = data[j].time, val = typeof v === 'number' && Number.isFinite(v) ? v : null;
    let col;
    if (couleurs) {
      const suivante = s + 1 >= 0 && s + 1 < n ? valeurs[s + 1] : null;
      const trou = !(typeof suivante === 'number' && Number.isFinite(suivante));
      col = (!trou && couleurs[s + 1]) || TRANSPARENT;
    }
    if (j < np) {
      const q = prec[j];
      if (q.time === t && Object.is(q.value, val) && q.color === col) { out[j] = q; continue; }
    }
    const p = { time: t, value: val };
    if (couleurs) p.color = col;
    out[j] = p;
  }
  if (RENDU) RENDU.cour.push(out);
  return out;
}

/** Sortie cachee pour les alertes : 1 quand la condition est vraie, null sinon. */
export function signaux(data, vrai) {
  const out = new Array(data.length);
  const prec = RENDU ? RENDU.prec[RENDU.cour.length] : null;
  for (let i = 0; i < data.length; i++) out[i] = pointRepris(prec, i, data[i].time, vrai[i] ? 1 : null);
  if (RENDU) RENDU.cour.push(out);
  return out;
}

/** Point {time, value} sans couleur, repris du rendu precedent s'il est identique (cf. RENDU). */
function pointRepris(prec, i, t, v) {
  if (prec && i < prec.length) { const q = prec[i]; if (q.time === t && Object.is(q.value, v) && q.color === undefined) return q; }
  return { time: t, value: v };
}

// Canaux d'une couleur, memorises (lecture seule : le tableau rendu est partage). Les couleurs
// constantes des reglages reviennent a chaque barre ; une table bornee evite de les relire.
const CANAUX = new Map();
const CANAUX_MAX = 65536;
/**
 * Plusieurs alertcondition() dans UNE sortie cachee : valeur = masque des conditions vraies
 * (bit k pour la liste k), null si aucune. Une sortie de 20 000 points au lieu d'une par
 * condition. Condition d'alerte associee : `bit(k)`.
 */
export function masque(data, listes) {
  const out = new Array(data.length);
  const prec = RENDU ? RENDU.prec[RENDU.cour.length] : null;
  for (let i = 0; i < data.length; i++) {
    let m = 0;
    for (let k = 0; k < listes.length; k++) if (listes[k][i]) m |= 1 << k;
    out[i] = pointRepris(prec, i, data[i].time, m === 0 ? null : m);
  }
  if (RENDU) RENDU.cour.push(out);
  return out;
}
export const bit = (k) => (pt) => pt.value !== null && pt.value !== undefined && (pt.value & (1 << k)) !== 0;

const canaux = (c) => {
  if (typeof c !== 'string') return null;
  let r = CANAUX.get(c);
  if (r !== undefined) return r;
  r = lireCanaux(c);
  if (CANAUX.size >= CANAUX_MAX) CANAUX.clear();
  CANAUX.set(c, r);
  return r;
};
const lireCanaux = (c) => {
  let m = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), m[4] ? parseInt(m[4], 16) / 255 : 1];
  m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1] : null;
};
// [PERF 2026-11-26] Couleurs rendues memorisees par leurs quatre entiers (canaux arrondis,
// alpha au millieme) : une couleur deja rendue revient en MEME chaine, sans la reconstruire,
// et ses canaux sont connus de canaux() sans la relire par expression reguliere (les
// degrades par barre debordaient la table de 4 096 couleurs et etaient relus sans cesse :
// 15 % du calcul de zscore_stochastique). Chaine identique a l'ancienne construction.
const PALETTE = new Map();
const rgba = (r, g, b, a) => {
  const R = Math.round(r), G = Math.round(g), B = Math.round(b), A = Math.round(a * 1000);
  if (!(R >= 0 && R <= 255 && G >= 0 && G <= 255 && B >= 0 && B <= 255 && A >= 0 && A <= 1000)) return `rgba(${R}, ${G}, ${B}, ${A / 1000})`;
  const k = ((R * 256 + G) * 256 + B) * 1001 + A;
  let c = PALETTE.get(k);
  if (c === undefined) {
    c = `rgba(${R}, ${G}, ${B}, ${A / 1000})`;
    if (PALETTE.size >= 65536) PALETTE.clear();
    PALETTE.set(k, c);
    if (CANAUX.size >= CANAUX_MAX) CANAUX.clear();
    CANAUX.set(c, [R, G, B, A / 1000]);
  }
  return c;
};

/**
 * color.from_gradient(v, bas, haut, c1, c2) : une couleur na vaut la couleur
 * opposee entierement transparente (fondu vers ou depuis le vide).
 */
export function degrade(v, bas, haut, c1, c2) {
  let a = canaux(c1), b = canaux(c2);
  if (!a && !b) return null;
  if (!a) a = [b[0], b[1], b[2], 0];
  if (!b) b = [a[0], a[1], a[2], 0];
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isFinite(bas) || !Number.isFinite(haut)) return null;
  const t = haut === bas ? 0 : Math.min(1, Math.max(0, (v - bas) / (haut - bas)));
  return rgba(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t);
}

/** color.new(c, transp) ; na reste na. */
export function transparence(c, transp) {
  const a = canaux(c);
  return a ? rgba(a[0], a[1], a[2], (100 - Math.min(100, Math.max(0, transp))) / 100) : null;
}

/**
 * fill(plot, plot, haut, bas, couleurHaut, couleurBas) : le degrade vertical
 * n'existe pas sur le graphique, la zone prend la couleur a mi-hauteur.
 */
export const milieu = (c1, c2) => degrade(0.5, 0, 1, c1, c2);

/**
 * Remplissage entre deux series, barre par barre : un polygone par suite de
 * barres ou les deux bornes existent et ou la couleur ne change pas (couleur de
 * la barre de droite de chaque segment, comme Pine). `suite` est l'etat du
 * remplissage (`suiteVide()` au depart) ; une suite close est dessinee une fois,
 * la suite en cours est dessinee a la derniere barre.
 */
export const suiteVide = () => ({ debut: null, fin: null, couleur: null });

export function remplir(o, suite, haut, bas, i, couleur, derniere) {
  const defini = (j) => typeof haut[j] === 'number' && typeof bas[j] === 'number' && Number.isFinite(haut[j]) && Number.isFinite(bas[j]);
  const dessiner = () => {
    const points = [];
    for (let j = suite.debut; j <= suite.fin; j++) points.push({ x: j, y: haut[j] });
    for (let j = suite.fin; j >= suite.debut; j--) points.push({ x: j, y: bas[j] });
    o.polyligne({ points, fermee: true, couleur: null, fond: suite.couleur });
  };
  const segment = i > 0 && couleur && defini(i - 1) && defini(i);
  if (suite.debut !== null && (!segment || couleur !== suite.couleur)) { dessiner(); suite.debut = null; }
  if (segment) {
    if (suite.debut === null) { suite.debut = i - 1; suite.couleur = couleur; }
    suite.fin = i;
  }
  if (derniere && suite.debut !== null) dessiner();
}

/**
 * Sortie a points STABLES gardes d'un calcul a l'autre (pour les indicateurs dont le rendu de toutes les
 * sorties depasse le budget du tick) : `S[cle]` (dans `etat.sorties`, partage entre l'etat et sa copie)
 * garde les points 0 .. stables - 1, construits une fois par `point(j)` ; les suivants sont reconstruits
 * a chaque appel. `stables` = nombre de points qui ne peuvent plus changer : n - 1 pour un point qui ne
 * lit que sa barre, n - 2 pour un point de plot() (sa couleur est celle de la barre suivante). Le tableau
 * rendu est neuf (les points stables sont partages).
 */
export function pointsStables(S, cle, n, stables, point) {
  const c = S[cle] || (S[cle] = []);
  const k = Math.max(0, Math.min(stables, n));
  if (c.length > k) c.length = k;
  for (let j = c.length; j < k; j++) c.push(point(j));
  const out = c.slice();
  for (let j = k; j < n; j++) out.push(point(j));
  return out;
}

/** Point j de `tracer(data, valeurs, couleurs)` (sans decalage). */
export function pointTrace(data, valeurs, couleurs, j) {
  const v = valeurs[j];
  const p = { time: data[j].time, value: typeof v === 'number' && Number.isFinite(v) ? v : null };
  if (couleurs) {
    const suivante = j + 1 < data.length ? valeurs[j + 1] : null;
    const trou = !(typeof suivante === 'number' && Number.isFinite(suivante));
    p.color = (!trou && couleurs[j + 1]) || TRANSPARENT;
  }
  return p;
}
