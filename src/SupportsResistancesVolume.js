// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
// Portage JavaScript (AcademyX) de « Support and Resistance (High Volume Boxes) [ChartPrime] » © ChartPrime — https://www.tradingview.com/script/Uz2AJ0i4-Support-and-Resistance-High-Volume-Boxes-ChartPrime/
import { creerObjets } from '../academyscript/objets.js';
import { pivothigh, pivotlow, atr } from '../academyscript/ta.js';
import { tostring } from '../academyscript/str.js';
import { lireReglages, executer, contexte, degrade, transparence, signaux } from './commun.js';

const VERT = '#4CAF50', ROUGE = '#F23645';

const INPUTS = [
  { id: 'periode', name: 'Barres de part et d’autre du sommet', type: 'number', entier: true, default: 20, min: 1, max: 200, step: 1, group: 'Paramètres',
    description: 'Un sommet (creux) de clôture doit dominer autant de barres à gauche et à droite ; la zone est posée à sa confirmation.' },
  { id: 'filtreVolume', name: 'Filtre de volume (barres)', type: 'number', entier: true, default: 2, min: 1, max: 100, step: 1, group: 'Paramètres',
    description: 'Le volume signé de la barre doit dépasser le plus haut (plus bas) des volumes signés de ces dernières barres divisés par 2,5. Plus la valeur est grande, moins il y a de zones.' },
  { id: 'largeur', name: 'Hauteur des zones (× ATR 200)', type: 'number', default: 1, min: 0, max: 1000, step: 0.1, group: 'Paramètres' },
  { id: 'couleurSupport', name: 'Support', type: 'color', default: VERT, group: 'Style' },
  { id: 'couleurResistance', name: 'Résistance', type: 'color', default: ROUGE, group: 'Style' },
  { id: 'couleurTenueResistance', name: 'Résistance qui tient', type: 'color', default: '#e92929', group: 'Style' },
  { id: 'couleurTenueSupport', name: 'Support qui tient', type: 'color', default: '#20ca26', group: 'Style' },
  { id: 'couleurCassureSupport', name: 'Étiquette de support cassé', type: 'color', default: '#7e1e1e', group: 'Style' },
  { id: 'couleurCassureResistance', name: 'Étiquette de résistance cassée', type: 'color', default: '#2b6d2d', group: 'Style' },
];

function creer() {
  return {
    o: creerObjets({ maxBoites: 50 }),
    sorties: { vol: [], cassureSupport: [], cassureResistance: [], tenueSupport: [], tenueResistance: [] },
    achat: true,
    sup: null, sup1: null, res: null, res1: null,
    boiteSup: null, boiteRes: null, fondSup: null, fondRes: null,
    resDevientSup: null, supDevientRes: null,
    prec: null,
  };
}

const extremeFenetre = (v, i, n, haut) => {
  let m = null;
  for (let k = Math.max(0, i - n + 1); k <= i; k++) if (m === null || (haut ? v[k] > m : v[k] < m)) m = v[k];
  return i - n + 1 < 0 ? null : m;
};
const croiseHausse = (a, b, a1, b1) => a !== null && b !== null && a1 !== null && b1 !== null && a > b && a1 <= b1;
const croiseBaisse = (a, b, a1, b1) => a !== null && b !== null && a1 !== null && b1 !== null && a < b && a1 >= b1;

function etape(p, e, data, i, s, env) {
  const b = data[i];
  const S = e.sorties;
  if (b.close > b.open) e.achat = true;
  else if (b.close < b.open) e.achat = false;
  const vol = e.achat ? b.volume : -b.volume;
  S.vol[i] = vol;
  const volHaut = i - p.filtreVolume + 1 >= 0 ? extremeFenetre(S.vol, i, p.filtreVolume, true) / 2.5 : null;
  const volBas = i - p.filtreVolume + 1 >= 0 ? extremeFenetre(S.vol, i, p.filtreVolume, false) / 2.5 : null;
  const hauteur = s.atr[i] === null ? null : s.atr[i] * p.largeur;
  const texte = `Vol : ${tostring(Math.round(vol * 100) / 100, '#.##########')}`;

  if (s.pl[i] !== null && volHaut !== null && vol > volHaut) {
    e.sup = s.pl[i];
    e.sup1 = hauteur === null ? null : e.sup - hauteur;
    e.fondSup = degrade(vol, 0, extremeFenetre(S.vol, i, 25, true), null, transparence(p.couleurSupport, 30));
    e.boiteSup = e.o.boite({
      gauche: i - p.periode, haut: e.sup, droite: i, bas: e.sup1, couleurBordure: p.couleurSupport, epaisseurBordure: 1,
      fond: e.fondSup, texte, couleurTexte: env.texte, tailleTexte: 'small',
    });
  }
  if (s.ph[i] !== null && volBas !== null && vol < volBas) {
    e.res = s.ph[i];
    e.res1 = hauteur === null ? null : e.res + hauteur;
    e.fondRes = degrade(vol, extremeFenetre(S.vol, i, 25, false), 0, transparence(p.couleurResistance, 30), null);
    e.boiteRes = e.o.boite({
      gauche: i - p.periode, haut: e.res, droite: i, bas: e.res1, couleurBordure: p.couleurResistance, epaisseurBordure: 1,
      fond: e.fondRes, texte, couleurTexte: env.texte, tailleTexte: 'small',
    });
  }
  if (e.boiteSup) e.boiteSup.droite = i + 1;
  if (e.boiteRes) e.boiteRes.droite = i + 1;

  const q = e.prec;
  const cassureRes = q !== null && croiseHausse(b.low, e.res1, q.low, q.res1);
  const tenueRes = q !== null && croiseBaisse(b.high, e.res, q.high, q.res);
  const tenueSup = q !== null && croiseHausse(b.low, e.sup, q.low, q.sup);
  const cassureSup = q !== null && croiseBaisse(b.high, e.sup1, q.high, q.sup1);

  const habiller = (boite, fond, bordure, style) => { if (boite) { boite.fond = fond; boite.couleurBordure = bordure; boite.styleBordure = style; } };
  if (cassureSup) habiller(e.boiteSup, transparence(p.couleurResistance, 80), p.couleurResistance, 'dashed');
  if (tenueSup) habiller(e.boiteSup, e.fondSup, p.couleurSupport, 'solid');
  if (cassureRes) habiller(e.boiteRes, transparence(p.couleurSupport, 80), p.couleurSupport, 'dashed');
  if (tenueRes) habiller(e.boiteRes, e.fondRes, p.couleurResistance, 'solid');

  const resEtaitSup = e.resDevientSup === true, supEtaitRes = e.supDevientRes === true;
  if (cassureRes) e.resDevientSup = true; else if (tenueRes) e.resDevientSup = false;
  if (cassureSup) e.supDevientRes = true; else if (tenueSup) e.supDevientRes = false;

  const losange = (x, dessus, couleur) => e.o.plotchar(x, { position: dessus ? 'abovebar' : 'belowbar', caractere: '◆', couleur, taille: 'tiny' });
  if (tenueRes) losange(i - 1, true, p.couleurTenueResistance);
  if (tenueSup) losange(i - 1, false, p.couleurTenueSupport);
  if (cassureRes && resEtaitSup) losange(i - 1, false, p.couleurTenueSupport);
  if (cassureSup && supEtaitRes) losange(i - 1, true, p.couleurTenueResistance);
  if (cassureSup && !supEtaitRes && q !== null && q.sup !== null) {
    e.o.etiquette({ x: i - 1, y: q.sup, texte: 'Support cassé', style: 'label_down', couleur: p.couleurCassureSupport, couleurTexte: env.texte, taille: 'small' });
  }
  if (cassureRes && !resEtaitSup && q !== null && q.res !== null) {
    e.o.etiquette({ x: i - 1, y: q.res, texte: 'Résistance cassée', style: 'label_up', couleur: p.couleurCassureResistance, couleurTexte: env.texte, taille: 'small' });
  }
  S.cassureSupport[i] = cassureSup;
  S.cassureResistance[i] = cassureRes;
  S.tenueSupport[i] = tenueSup;
  S.tenueResistance[i] = tenueRes;
  e.prec = { low: b.low, high: b.high, sup: e.sup, sup1: e.sup1, res: e.res, res1: e.res1 };
}

const alerte = (id, title, source) => ({ id, title, message: title, when: 'custom', source, condition: (pt) => pt.value === 1 });

export default class SupportsResistancesVolumeIndicator {
  static metadata = {
    id: 'sr_fort_volume',
    name: 'Supports et résistances à fort volume',
    shortName: 'SR-VOL',
    description: 'sr_fort_volume',
    version: '1.0.0',
    overlay: true,
    type: 'trend',
    category: 'Trend',
    source: 'builtin',
    tags: ['support', 'resistance', 'volume', 'zone', 'cassure', 'retest'],
    inputs: INPUTS,
    outputs: [
      { id: 'cassureSupport', name: 'Support cassé', type: 'line', hidden: true },
      { id: 'cassureResistance', name: 'Résistance cassée', type: 'line', hidden: true },
      { id: 'tenueSupport', name: 'Support qui tient', type: 'line', hidden: true },
      { id: 'tenueResistance', name: 'Résistance qui tient', type: 'line', hidden: true },
    ],
    alertConditions: [
      alerte('support_casse', 'Support cassé', 'cassureSupport'),
      alerte('resistance_cassee', 'Résistance cassée', 'cassureResistance'),
      alerte('support_tient', 'Support qui tient', 'tenueSupport'),
      alerte('resistance_tient', 'Résistance qui tient', 'tenueResistance'),
    ],
  };

  static _memo = new Map();

  constructor(params = {}) {
    this.params = lireReglages(INPUTS, params);
  }

  calculate(data, ctx = {}) {
    if (!Array.isArray(data) || data.length === 0) return {};
    const p = this.params;
    const env = contexte(data, ctx);
    return executer(SupportsResistancesVolumeIndicator._memo, JSON.stringify([p, env.texte]), data, {
      creer,
      series: (d) => {
        const c = d.map((x) => x.close);
        return { ph: pivothigh(c, p.periode, p.periode), pl: pivotlow(c, p.periode, p.periode), atr: atr(d, 200) };
      },
      etape: (etat, d, i, derniere, s) => etape(p, etat, d, i, s, env),
      rendre: (etat, d) => {
        const S = etat.sorties;
        return {
          cassureSupport: signaux(d, S.cassureSupport), cassureResistance: signaux(d, S.cassureResistance),
          tenueSupport: signaux(d, S.tenueSupport), tenueResistance: signaux(d, S.tenueResistance),
          objets: etat.o.resultat(),
        };
      },
    });
  }
}
