// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Spiral Levels [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/LWkLPa6f-Spiral-Levels-ChartPrime/
// Adaptation : couleurs reglables (fixes dans le script). last_bar_index (limite des 1 000 dernieres barres, abscisse des etiquettes) est la
// derniere bougie du calcul, comme au chargement sur TradingView : le script est rejoue a chaque nouvelle bougie ; une
// ligne supprimee n'a plus de prix (line.get_price rend na) et n'est donc jamais franchie.
import { creerObjets } from '../academyscript/objets.js';
import { atr as taAtr, pivothigh, pivotlow } from '../academyscript/ta.js';
import { lireReglages, executer, contexte, transparence, degrade } from './commun.js';

const PI = 'Pivots', FI = 'Filtres', SP = 'Spirales';
const INPUTS = [
  { id: 'gauche', name: 'Barres à gauche', type: 'number', entier: true, default: 4, min: 1, max: 100, step: 1, group: PI },
  { id: 'droite', name: 'Barres à droite', type: 'number', entier: true, default: 4, min: 1, max: 100, step: 1, group: PI },
  { id: 'seuilVolume', name: 'Filtre du volume (écarts-types)', type: 'number', default: 0.4, min: 0, max: 10, step: 0.01, group: FI,
    description: 'Une spirale n’est dessinée que si le volume signé de la bougie de confirmation dépasse ce multiple de son écart-type (sur les 200 derniers pivots).' },
  { id: 'filtreExtremes', name: 'Filtre des extrêmes (barres)', type: 'number', entier: true, default: 20, min: 1, max: 500, step: 1, group: FI,
    description: 'Le sommet (ou creux) doit être le plus haut (ou plus bas) de ce nombre de barres.' },
  { id: 'nombre', name: 'Spirales affichées', type: 'number', entier: true, default: 10, min: 1, max: 50, step: 1, group: SP, legende: false },
  { id: 'tours', name: 'Points de la spirale', type: 'number', entier: true, default: 11, min: 1, max: 50, step: 1, group: SP,
    description: 'Nombre de pas d’un tiers de demi-tour (π / 3) de la spirale.' },
  { id: 'echelleX', name: 'Échelle horizontale', type: 'number', default: 1, min: 0.1, max: 20, step: 0.1, group: SP, legende: false },
  { id: 'echelleY', name: 'Échelle verticale (x ATR 200)', type: 'number', default: 0.15, min: 0.01, max: 5, step: 0.01, group: SP, legende: false },
  { id: 'inverser', name: 'Inverser le sens des spirales', type: 'boolean', default: false, group: SP },
  { id: 'couleurHausse', name: 'Volume acheteur (creux)', type: 'color', default: '#15e27f', group: 'Style' },
  { id: 'couleurBaisse', name: 'Volume vendeur (sommets)', type: 'color', default: '#c519e4', group: 'Style' },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);

function series(p, d) {
  const n = d.length, R = p.droite, H = p.filtreExtremes;
  const ph = pivothigh(d, p.gauche, R), pl = pivotlow(d, p.gauche, R), atr = taAtr(d, 200);
  const fH = new Array(n).fill(false), fL = new Array(n).fill(false);
  for (let i = R + H - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let k = 0; k < H; k++) { const b = d[i - R - k]; if (b.high > hh) hh = b.high; if (b.low < ll) ll = b.low; }
    fH[i] = hh === d[i - R].high; fL[i] = ll === d[i - R].low;
  }
  return { haut: ph.map((v, i) => !nul(v) && fH[i]), bas: pl.map((v, i) => !nul(v) && fL[i]), atr };
}

/** ta.stdev(vol, 200) d'un appel : historique des seules barres ou l'appel s'execute. */
function ecartType(z, v) {
  z.v.push(v); z.s += v;
  if (z.v.length > 200) z.s -= z.v[z.v.length - 1 - 200];
  if (z.v.length < 200) return null;
  const m = z.s / 200, k0 = z.v.length - 1;
  let q = 0;
  for (let k = 0; k < 200; k++) { const e = z.v[k0 - k] - m; q += e * e; }
  const r = Math.sqrt(q / 200);
  return Number.isFinite(r) ? r : null;
}

function spirale(p, e, d, i, last, s, site, sens, env) {
  const o = e.o, b = d[i], R = p.droite, src = (d[i - R].high + d[i - R].low) / 2;
  const vol = Math.round((b.close > b.open ? b.volume : -b.volume) * 100) / 100;
  const et = ecartType(e.et[site], vol);
  const nv = et === null ? null : vol / et;
  const ys = nul(s.atr[i]) ? null : p.echelleY * s.atr[i];
  if (!nul(nv) && (nv > p.seuilVolume || nv < -p.seuilVolume)) {
    const pts = [], pas = Math.PI / 3;
    let angle = 0, dernier = null;
    for (let k = 0; k <= p.tours; k++) {
      const y = ys === null ? null : angle * (sens ? ys : -ys) * Math.sin(angle) + src;
      pts.push({ x: Math.round(angle * p.echelleX * Math.cos(angle)) + i - R, y });
      dernier = y; angle += pas;
    }
    const c = nv > 0 ? degrade(nv, 0, 1, null, p.couleurHausse) : degrade(nv, -1, 0, p.couleurBaisse, null);
    const poly = o.polyligne({ points: pts, courbe: true, fermee: false, couleur: c, epaisseur: 2 });
    const etq = o.etiquette({ x: last, y: dernier, style: 'label_left', texte: String(vol), taille: 'small', couleur: transparence(c, 50), couleurTexte: env.texte });
    e.etiquettes.push(etq);
    e.etiquettes.push(o.etiquette({ x: i - R, y: src, style: 'circle', texte: '', taille: 'tiny', couleur: transparence(c, 20), couleurTexte: '#000000' }));
    const fin = pts[pts.length - 1];
    const li = o.ligne({ x1: fin.x, y1: fin.y, x2: i, y2: dernier, epaisseur: 2, couleur: c });
    e.toutes.push(li);
    e.polys.push(poly); e.lignes.push(li); e.etqs.push(etq);
  }
  if (e.polys.length > p.nombre) o.supprimer(e.polys.shift());
  // array.shift(line.all) : la plus ancienne ligne encore en vie.
  while (e.toutes.length && e.toutes[0].__supprime) e.toutes.shift();
  if (e.toutes.length > p.nombre) o.supprimer(e.toutes.shift());
}

function etape(p, e, d, i, last, s, env) {
  const o = e.o, b = d[i], permis = last - i < 1000, R = p.droite;
  if (s.haut[i]) spirale(p, e, d, i, last, s, 0, p.inverser, env);
  if (s.bas[i]) spirale(p, e, d, i, last, s, 1, !p.inverser, env);
  if (permis) {
    const q = e.lignes.length;
    for (let k = 0; k < q; k++) {
      if (k >= e.lignes.length) continue;
      const l = e.lignes[k], et = e.etqs[k];
      const niveau = l.__supprime || l.x2 === l.x1 ? null : l.y1 + (i - l.x1) * (l.y2 - l.y1) / (l.x2 - l.x1);
      const c1 = i > 0 ? d[i - 1].close : null;
      const franchi = !nul(niveau) && !nul(c1) && Math.sign(c1 - niveau) !== Math.sign(b.close - niveau);
      if (franchi) { l.style = 'dotted'; e.lignes.splice(k, 1); e.etqs.splice(k, 1); }
      else { if (!l.__supprime) l.x2 = i; if (!et.__supprime) et.x = i; }
    }
    if (s.haut[i] && i >= R) o.plotchar(i - R, { position: 'abovebar', caractere: '◆', couleur: p.couleurBaisse, taille: 'small' });
    if (s.bas[i] && i >= R) o.plotchar(i - R, { position: 'belowbar', caractere: '◆', couleur: p.couleurHausse, taille: 'small' });
  }
  // array.shift(label.all) au-dela de deux etiquettes par spirale.
  while (e.etiquettes.length && e.etiquettes[0].__supprime) e.etiquettes.shift();
  if (e.etiquettes.length > p.nombre * 2) o.supprimer(e.etiquettes.shift());
}

export default class SpiralesNiveauxIndicator {
  static metadata = {
    id: 'spirales_niveaux',
    name: 'Spirales et niveaux des pivots',
    shortName: 'SPI',
    description: 'spirales_niveaux',
    version: '1.0.0',
    overlay: true,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['pivots', 'niveaux', 'volume', 'spirale', 'support'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    const env = contexte(data, ctx);
    const last = data.length - 1;
    return executer(SpiralesNiveauxIndicator._memo, JSON.stringify([p, last, env.texte]), data, {
      creer: () => ({
        o: creerObjets({ maxPolylignes: 100, maxLignes: 100, maxEtiquettes: 50 }),
        et: [{ v: [], s: 0 }, { v: [], s: 0 }], polys: [], lignes: [], etqs: [], toutes: [], etiquettes: [],
      }),
      series: (d) => series(p, d),
      etape: (e, d, i, derniere, s) => etape(p, e, d, i, last, s, env),
      rendre: (e) => ({ objets: e.o.resultat() }),
    });
  }
}
