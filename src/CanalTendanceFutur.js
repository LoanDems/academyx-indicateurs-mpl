// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Future Trend Channel [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/facvguC8-Future-Trend-Channel-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { sma, atr as taAtr } from '../academyscript/ta.js';
import { formaterMotif } from '../academyscript/str.js';
import { lireReglages, executer, contexte, transparence } from './commun.js';

const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueur', name: 'Longueur de la tendance', type: 'number', entier: true, default: 100, min: 1, max: 1000, step: 1, group: P,
    description: 'Moyenne simple des clôtures ; la tendance change quand la clôture sort de la moyenne ± le plus haut ATR (200) des 100 dernières barres.' },
  { id: 'largeur', name: 'Largeur du canal', type: 'number', default: 3, min: 0, max: 50, step: 0.1, group: P },
  { id: 'horizon', name: 'Barres du prix futur', type: 'number', entier: true, default: 50, min: 0, max: 500, step: 1, group: P,
    description: 'Le prix futur est lu sur le prolongement du milieu du canal, ce nombre de barres plus loin.' },
  { id: 'couleurHausse', name: 'Canal haussier', type: 'color', default: '#16d897', group: S },
  { id: 'couleurBaisse', name: 'Canal baissier', type: 'color', default: '#da853f', group: S },
];
const BLEU = '#2962FF';

/** ta.sma(x, 20) appele dans un `if` : la moyenne ne voit que les barres ou l'appel a lieu (na sautes). */
function moyenneAppel(m, x, n = 20) {
  if (x !== null) {
    m.vus.push(x); m.somme += x;
    if (m.vus.length > n) m.somme -= m.vus.shift();
    if (m.vus.length >= n) m.valeur = m.somme / n;
  }
  return m.valeur;
}
const nouvelleMoyenne = () => ({ vus: [], somme: 0, valeur: null });

function series(p, d) {
  const n = d.length;
  const a = taAtr(d, 200);
  const atr = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    // ta.highest(ta.atr(200), 100) : maximum des valeurs definies de la fenetre
    if (i < 99) continue;
    let m = null;
    for (let k = i - 99; k <= i; k++) if (a[k] !== null && (m === null || a[k] > m)) m = a[k];
    atr[i] = m;
  }
  const moy = sma(d.map((b) => b.close), p.longueur);
  return { atr, moy };
}

function creer() {
  return {
    o: creerObjets({ maxLignes: 500, maxEtiquettes: 500 }),
    trend: null, trendPrec: null, haut: null, bas: null, closePrec: null,
    mid1: null, top1: null, low1: null, mid2: null, top2: null, low2: null,
    labelUp: null, labelDn: null, labelM: null,
    couleur1: null, couleur2: null, remplis: [null, null], paires: [null, null],
    m1: nouvelleMoyenne(), t1: nouvelleMoyenne(), l1: nouvelleMoyenne(), m2: nouvelleMoyenne(), t2: nouvelleMoyenne(), l2: nouvelleMoyenne(),
  };
}

const xy2 = (l, x, y) => { if (l) { l.x2 = x; l.y2 = y; } };
const ext = (l, e) => { if (l) l.extend = e; };
const val = (l, k) => (l ? l[k] : null);

function etape(p, e, d, i, derniere, s, env) {
  const o = e.o, b = d[i];
  // trend(length)
  const hautB = s.moy[i] === null || s.atr[i] === null ? null : s.moy[i] + s.atr[i];
  const basB = s.moy[i] === null || s.atr[i] === null ? null : s.moy[i] - s.atr[i];
  const up = hautB !== null && e.haut !== null && e.closePrec !== null && b.close > hautB && e.closePrec <= e.haut;
  const dn = basB !== null && e.bas !== null && e.closePrec !== null && b.close < basB && e.closePrec >= e.bas;
  if (up) e.trend = true;
  if (dn) e.trend = false;
  e.haut = hautB; e.bas = basB; e.closePrec = b.close;
  const trend = e.trend, t1 = e.trendPrec;
  const versHausse = trend === true && t1 === false, versBaisse = trend === false && t1 === true;

  // draw_channel(trend)
  const src = (b.high + b.low) / 2;
  const lowSrc = s.atr[i] === null ? null : src - s.atr[i] * p.largeur, highSrc = s.atr[i] === null ? null : src + s.atr[i] * p.largeur;
  const ligne = (x1, y1, x2, y2) => o.ligne({ x1, y1, x2, y2, couleur: BLEU, style: 'solid' });
  if (versHausse) {
    e.labelUp = o.etiquette({ x: i, y: lowSrc, texte: '', style: 'diamond', couleur: BLEU });
    e.mid1 = ligne(i, src, i, src); e.top1 = ligne(i, highSrc, i, highSrc); e.low1 = ligne(i, lowSrc, i, lowSrc);
    xy2(e.mid2, i, src); xy2(e.top2, i, highSrc); xy2(e.low2, i, lowSrc);
  }
  if (versBaisse) {
    e.labelDn = o.etiquette({ x: i, y: highSrc, texte: '', style: 'diamond', couleur: BLEU });
    e.mid2 = ligne(i, src, i + 2, src); e.top2 = ligne(i, highSrc, i, highSrc); e.low2 = ligne(i, lowSrc, i, lowSrc);
    xy2(e.mid1, i, src); xy2(e.top1, i, highSrc); xy2(e.low1, i, lowSrc);
  }
  const futur = (m) => {
    const x1 = val(m, 'x1'), x2 = val(m, 'x2'), y1 = val(m, 'y1'), y2 = val(m, 'y2');
    const pente = x1 === null || x2 === null || y1 === null || y2 === null || x2 === x1 ? null : (y2 - y1) / (x2 - x1);
    const fp = pente === null ? null : y1 + pente * (i + p.horizon - x1);
    const style = y1 !== null && y2 !== null && y1 > y2 ? 'label_lower_left' : 'label_upper_left';
    return o.etiquette({ x: i + p.horizon, y: fp, texte: fp === null ? 'NaN' : formaterMotif(fp, "'Prix futur : \n '#.#"), couleur: transparence(env.texte, 80), couleurTexte: env.texte, style });
  };
  if (trend === true) {
    o.supprimer(e.labelM);
    ext(e.mid2, 'none'); ext(e.top2, 'none'); ext(e.low2, 'none');
    ext(e.mid1, 'right'); ext(e.top1, 'right'); ext(e.low1, 'right');
    xy2(e.mid1, i, moyenneAppel(e.m1, src)); xy2(e.top1, i, moyenneAppel(e.t1, highSrc)); xy2(e.low1, i, moyenneAppel(e.l1, lowSrc));
    e.labelM = futur(e.mid1);
  }
  if (trend === false) {
    o.supprimer(e.labelM);
    ext(e.mid1, 'none'); ext(e.top1, 'none'); ext(e.low1, 'none');
    ext(e.mid2, 'right'); ext(e.top2, 'right'); ext(e.low2, 'right');
    xy2(e.mid2, i, moyenneAppel(e.m2, src)); xy2(e.top2, i, moyenneAppel(e.t2, highSrc)); xy2(e.low2, i, moyenneAppel(e.l2, lowSrc));
    e.labelM = futur(e.mid2);
  }
  colorer(p, e, 0, e.mid1, e.top1, e.low1, p.couleurHausse, e.labelUp, env);
  colorer(p, e, 1, e.mid2, e.top2, e.low2, p.couleurBaisse, e.labelDn, env);
  // remove_lines(trend)
  if (versHausse) { e.mid2 = null; e.top2 = null; e.low2 = null; }
  if (versBaisse) { e.mid1 = null; e.top1 = null; e.low1 = null; }
  e.trendPrec = trend;
}

/** color_lines(line_m, line_t, line_l, color, label) : `var color_lines` propre a chaque site d'appel. */
function colorer(p, e, k, m, t, l, couleur, etiq, env) {
  const cle = k === 0 ? 'couleur1' : 'couleur2';
  if (e[cle] === null) e[cle] = couleur;
  const y1 = val(m, 'y1'), y2 = val(m, 'y2');
  const hausse = String(couleur).toLowerCase() === String(p.couleurHausse).toLowerCase();
  const pose = (c, style) => { for (const x of [m, t, l]) if (x) { x.couleur = c; x.style = style; } };
  if (y1 !== null && y2 !== null && (hausse ? y1 <= y2 : y1 >= y2)) {
    e[cle] = couleur; pose(couleur, 'solid');
    if (etiq) etiq.couleur = couleur;
  }
  if (y1 !== null && y2 !== null && (hausse ? y1 >= y2 : y1 <= y2)) {
    e[cle] = env.texte; pose(env.texte, 'dashed');
    if (etiq) etiq.couleur = transparence(env.texte, 100);
  }
  if (etiq) etiq.taille = 'tiny';
  // linefill.new(line_l, line_t, ...) a chaque barre : un seul remplissage par paire, le dernier
  if (l && t) {
    if (e.paires[k] === l) e.o.supprimer(e.remplis[k]);
    e.paires[k] = l;
    e.remplis[k] = e.o.remplissage(l, t, { couleur: transparence(e[cle], 90) });
  }
}

export default class CanalTendanceFuturIndicator {
  static metadata = {
    id: 'canal_tendance_futur',
    name: 'Canal de tendance prolongé',
    shortName: 'CANAL-FUT',
    description: 'canal_tendance_futur',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['canal', 'tendance', 'prolongement', 'atr', 'prix futur'],
    inputs: INPUTS,
    outputs: [],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { objets: creerObjets().resultat() };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(CanalTendanceFuturIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => series(p, d),
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, derniere, s, env),
      rendre: (etat) => ({ objets: etat.o.resultat() }),
    });
  }
}
