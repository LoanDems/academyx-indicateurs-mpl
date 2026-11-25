// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Kalman Volume Filter [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/lCceGyMY-Kalman-Volume-Filter-ChartPrime/
// Adaptation : les remplissages en degrade vertical prennent la couleur a mi-hauteur ; barcolor() passe par la sortie cachee
// des bougies ; ta.stdev(VZO, 200) lit les valeurs passees a l'appel (le rapport avant normalisation), comme les ta.* de
// la plateforme. Une division par un volume moyen nul rend na. Calcul barre par barre.
import { creerObjets } from '../academyscript/objets.js';
import * as A from './pasAPas.js';
import { lireReglages, executer, contexte, transparence, degrade, milieu, remplir, suiteVide, pointsStables, pointTrace } from './commun.js';

const SOURCES = [
  { label: 'Clôture', value: 'close' }, { label: 'Ouverture', value: 'open' }, { label: 'Plus haut', value: 'high' },
  { label: 'Plus bas', value: 'low' }, { label: 'HL2', value: 'hl2' }, { label: 'HLC3', value: 'hlc3' }, { label: 'OHLC4', value: 'ohlc4' },
];
const P = 'Paramètres', S = 'Style';
const INPUTS = [
  { id: 'longueurVolume', name: 'Longueur du volume', type: 'number', entier: true, default: 70, min: 1, max: 500, step: 1, group: P,
    description: 'Moyennes de Hull du volume signé (selon la source comparée à celle d’il y a deux barres) et du volume total.' },
  { id: 'stabilisation', name: 'Coefficient de stabilisation', type: 'number', default: 0.06, min: 0.01, max: 0.1, step: 0.001, group: P,
    description: 'Gain du filtre de Kalman : plus il est bas, moins il y a de bruit et plus les signaux sont longs.' },
  { id: 'longueurSignal', name: 'Longueur de la ligne de signal', type: 'number', entier: true, default: 10, min: 1, max: 15, step: 1, group: P },
  { id: 'zone', name: 'Seuil de surachat / survente', type: 'number', default: 0.6, min: 0, max: 2, step: 0.1, group: P },
  { id: 'source', name: 'Source', type: 'select', default: 'close', options: SOURCES, group: P },
  { id: 'couleurHausse', name: 'Hausse', type: 'color', default: '#00BCD4', group: S },
  { id: 'couleurBaisse', name: 'Baisse', type: 'color', default: '#F23645', group: S },
];
const nul = (v) => v === null || v === undefined || Number.isNaN(v);
const gt = (a, b) => !nul(a) && !nul(b) && a > b, lt = (a, b) => !nul(a) && !nul(b) && a < b;
const choix = {
  close: (b) => b.close, open: (b) => b.open, high: (b) => b.high, low: (b) => b.low,
  hl2: (b) => (b.high + b.low) / 2, hlc3: (b) => (b.high + b.low + b.close) / 3, ohlc4: (b) => (b.open + b.high + b.low + b.close) / 4,
};
const fini = (v) => (Number.isFinite(v) ? v : null);

function creer(p) {
  const S = { src: [], km: [], sig: [], vol: [], cVol: [], cK: [], cS: [], deux: [], z: [], moinsDeux: [], moinsZ: [] };
  const L = p.longueurVolume;
  return {
    o: creerObjets({ maxPolylignes: 500 }), sorties: S, f1: suiteVide(), f2: suiteVide(), f3: suiteVide(), km1: null,
    m: { hd: A.hma(S, L), ht: A.hma(S, L), et: A.sma(S, 200, { stdev: true }), sg: A.sma(S, p.longueurSignal), ev: A.sma(S, 200, { stdev: true }),
      xh: A.croisement(1), xb: A.croisement(-1) },
  };
}

function etape(p, e, d, i, derniere, env) {
  const S = e.sorties, M = e.m, o = e.o, b = d[i], src = choix[p.source](b);
  S.src[i] = src;
  const s2 = i >= 2 ? S.src[i - 2] : null;
  const dir = !nul(s2) && src > s2 ? b.volume : -b.volume;
  const hd = A.pas(S, M.hd, i, dir), ht = A.pas(S, M.ht, i, b.volume);
  const rap = nul(hd) || nul(ht) ? null : fini(hd / ht);
  A.pas(S, M.et, i, rap);
  const et = M.et.et;
  const vzo = nul(rap) || nul(et) ? null : fini((rap - 0) / et);
  // Kalman : M_n = k * A_n + (1 - k) * nz(M_n[1]).
  const k = p.stabilisation, km = nul(vzo) ? null : k * vzo + (1 - k) * (nul(e.km1) ? 0 : e.km1);
  e.km1 = km;
  const sig = A.pas(S, M.sg, i, km);
  S.km[i] = km; S.sig[i] = sig;
  A.pas(S, M.ev, i, b.volume);
  const ev = M.ev.et;
  let v = nul(ev) ? null : fini(((b.volume - 0) / ev) / 10);
  if (gt(v, 0.8)) v = 0;
  S.vol[i] = v;
  const H = p.couleurHausse, B = p.couleurBaisse, Z = p.zone;
  S.cVol[i] = degrade(v, 0.1, 0.45, env.texte, H);
  const dessus = gt(km, sig);
  S.cK[i] = dessus ? H : B;
  S.cS[i] = dessus ? transparence(H, 60) : transparence(B, 60);
  S.deux[i] = 2; S.z[i] = Z; S.moinsDeux[i] = -2; S.moinsZ[i] = -Z;
  remplir(o, e.f1, S.deux, S.z, i, milieu(null, transparence(B, 70)), derniere);
  remplir(o, e.f2, S.moinsZ, S.moinsDeux, i, milieu(transparence(H, 70), null), derniere);
  remplir(o, e.f3, S.km, S.sig, i, milieu(dessus ? H : B, dessus ? null : '#880e4f00'), derniere);
  const xh = A.pas(S, M.xh, i, km, sig), xb = A.pas(S, M.xb, i, km, sig);
  if (i >= 1) {
    if (xh && gt(km, -Z) && lt(km, Z)) o.plotchar(i - 1, { position: 'absolute', y: km, caractere: '⦿', couleur: H, taille: 'tiny' });
    if (xb && gt(km, -Z) && lt(km, Z)) o.plotchar(i - 1, { position: 'absolute', y: km, caractere: '⦿', couleur: B, taille: 'tiny' });
    if (xh && lt(km, -Z)) o.plotchar(i - 1, { position: 'absolute', y: km, caractere: '⬙', couleur: transparence(H, 10), taille: 'small' });
    if (xb && gt(km, Z)) o.plotchar(i - 1, { position: 'absolute', y: km, caractere: '◈', couleur: transparence(B, 10), taille: 'small' });
  }
}

function rendre(p, e, d) {
  const S = e.sorties, n = d.length;
  const ligne = (cle, vals, cols) => pointsStables(S, `_p${cle}`, n, n - 2, (j) => pointTrace(d, vals, cols, j));
  const cH = transparence(p.couleurBaisse, 90), cB = transparence(p.couleurHausse, 90);
  return {
    kalman: ligne('k', S.km, S.cK),
    signal: ligne('s', S.sig, S.cS),
    volumeHaut: pointsStables(S, '_vh', n, n - 1, (j) => ({ time: d[j].time, value: S.vol[j], color: transparence(S.cVol[j], 85) })),
    volumeBas: pointsStables(S, '_vb', n, n - 1, (j) => ({ time: d[j].time, value: nul(S.vol[j]) ? null : S.vol[j] * -1, color: transparence(S.cVol[j], 85) })),
    haut: pointsStables(S, '_h', n, n, (j) => ({ time: d[j].time, value: 2, color: cH })),
    bas: pointsStables(S, '_b', n, n, (j) => ({ time: d[j].time, value: -2, color: cB })),
    zero: pointsStables(S, '_z', n, n, (j) => ({ time: d[j].time, value: 0 })),
    bougies: pointsStables(S, '_c', n, n - 1, (j) => ({ time: d[j].time, value: S.cVol[j] ? 1 : null, color: S.cVol[j] })),
    objets: e.o.resultat(),
  };
}

export default class FiltreKalmanVolumeIndicator {
  static metadata = {
    id: 'filtre_kalman_volume',
    name: 'Filtre de Kalman du volume',
    shortName: 'KVF',
    description: 'filtre_kalman_volume',
    version: '1.0.0',
    overlay: false,
    type: 'volume',
    category: 'Volume',
    source: 'builtin',
    tags: ['volume', 'kalman', 'oscillateur', 'vzo', 'surachat'],
    inputs: INPUTS,
    outputs: [
      { id: 'kalman', name: 'Filtre de Kalman', type: 'line', color: '#00BCD4', lineWidth: 1 },
      { id: 'signal', name: 'Ligne de signal', type: 'line', color: 'rgba(0, 188, 212, 0.4)', lineWidth: 1 },
      { id: 'volumeHaut', name: 'Volume', type: 'histogram', color: 'rgba(0, 188, 212, 0.15)' },
      { id: 'volumeBas', name: 'Volume (miroir)', type: 'histogram', color: 'rgba(0, 188, 212, 0.15)' },
      { id: 'haut', name: 'Niveau 2', type: 'line', color: 'rgba(242, 54, 69, 0.1)', lineWidth: 1 },
      { id: 'bas', name: 'Niveau -2', type: 'line', color: 'rgba(0, 188, 212, 0.1)', lineWidth: 1 },
      { id: 'zero', name: 'Zéro', type: 'line', color: 'rgba(120, 123, 134, 0.384)', lineWidth: 1 },
      { id: 'bougies', name: 'Couleur des bougies', type: 'line', hidden: true },
    ],
    barColors: [
      { when: 'custom', source: 'bougies', condition: (pt) => pt.value === 1, color: '#00BCD4', couleurDuPoint: true },
    ],
    barColorMode: 'full',
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return { kalman: [] };
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(FiltreKalmanVolumeIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer: () => creer(p),
      etape: (e, d, i, derniere) => etape(p, e, d, i, derniere, env),
      rendre: (e, d) => rendre(p, e, d),
    });
  }
}
