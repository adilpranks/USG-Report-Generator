/* USG Reporter — findings library.
 * Section  = {id, name (UI), lab (report label or null for narrative lines), sex:'F'|'M',
 *             meas:[fields], cl:[clauses], fd:[findings], auto(m,ctx)->[{x,t,i}], impN(ctx)}
 * Clause   = {k, t:(m,ctx)=>string}         — the house-style "normal" sentence(s)
 * Finding  = {id, l, rep (repeatable), x:[clause keys it replaces], fs:[fields],
 *             t:(v,m,ctx)=>report text, i:(v,m,ctx)=>impression (string | array | null)}
 * Field    = {k, l, t:'sel'|'num'|'txt'|'chk'|'multi'|'dims'|'vtab', o:[options], u:unit, d:default}
 */
'use strict';

/* ---------- helpers ---------- */
const has = x => x !== undefined && x !== null && String(x).trim() !== '';
const opt = (val, pre = '', post = '') => has(val) ? pre + val + post : '';
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const dims = d => Array.isArray(d) ? d.filter(has).join(' x ') : (has(d) ? String(d) : '');
const nums = d => Array.isArray(d) ? d.filter(has).map(Number) : [];
const vol = d => { const n = nums(d); return n.length === 3 ? +(0.523 * n[0] * n[1] * n[2]).toFixed(1) : null; };
const maxDim = d => { const n = nums(d); return n.length ? Math.max(...n) : null; };
const list = a => { a = (a || []).filter(Boolean); return a.length < 2 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; };
const lc = s => s ? s.toLowerCase() : s;
const S = { R: 'Right', L: 'Left', B: 'Bilateral' };
const sideAdj = s => ({ Right: 'right', Left: 'left', Bilateral: 'bilateral' }[s] || lc(s || ''));

const F = (k, l, t, o, extra) => Object.assign({ k, l, t }, t === 'num' || t === 'dims' ? { u: o } : { o }, extra || {});
const SIDE = F('side', 'Side', 'sel', ['Right', 'Left', 'Bilateral']);
const SIDE2 = F('side', 'Side', 'sel', ['Right', 'Left']);
const NUM1 = F('n', 'Number', 'sel', ['Single', 'Multiple']);

/* ======================================================================
 *  ABDOMEN
 * ==================================================================== */
const LIVER = {
  id: 'liver', name: 'Liver', lab: 'LIVER',
  meas: [F('span', 'Span', 'num', 'cm')],
  cl: [
    { k: 'span', t: m => opt(m.span, 'Span of ', ' cm.') },
    { k: 'sz', t: () => 'Normal in size, shape and echotexture.' },
    { k: 'focal', t: () => 'No evident focal lesion noted.' },
    { k: 'ihbr', t: () => "IHBR's are not dilated." },
  ],
  fd: [
    { id: 'hepatomegaly', l: 'Hepatomegaly', x: ['span', 'sz'], fs: [],
      t: (v, m, c) => 'Enlarged in size' + opt(m.span, ' (span ', ' cm)') + (c.has('fatty') || c.has('cld') ? '.' : ' with normal shape and echotexture.'),
      i: (v, m, c) => c.has('fatty') ? null : 'Hepatomegaly.' },
    { id: 'fatty', l: 'Fatty liver (grade)', x: ['sz'], fs: [F('g', 'Grade', 'sel', ['I', 'II', 'III']), F('spare', 'Focal fat sparing near GB fossa', 'chk')],
      t: (v, m, c) => {
        const d = { I: 'mildly increased echogenicity with normal visualisation of the diaphragm and intrahepatic vessel walls',
          II: 'moderately increased echogenicity with slightly impaired visualisation of the intrahepatic vessel walls and diaphragm',
          III: 'markedly increased echogenicity with poor visualisation of the intrahepatic vessel walls, diaphragm and posterior segment of right lobe' }[v.g || 'I'];
        return (c.has('hepatomegaly') ? 'Shows ' : 'Normal in size and shows ') + d + '.' + (v.spare ? ' Focal fat sparing is seen adjacent to the gall bladder fossa.' : '');
      },
      i: (v, m, c) => (c.has('hepatomegaly') ? 'Hepatomegaly with grade ' : 'Grade ') + (v.g || 'I') + ' fatty liver.' },
    { id: 'cld', l: 'Chronic liver disease / cirrhosis', x: ['sz'],
      fs: [F('size', 'Size', 'sel', ['Normal', 'Shrunken', 'Enlarged']),
           F('feat', 'Features', 'multi', ['coarse heterogeneous echotexture', 'nodular surface', 'blunted margins', 'caudate lobe hypertrophy', 'widened fissures'])],
      t: v => cap((v.size && v.size !== 'Normal' ? lc(v.size) + ' in size' : 'normal in size') + (v.feat && v.feat.length ? ' with ' + list(v.feat) : ' with coarse echotexture') + '.'),
      i: v => 'Features suggestive of chronic liver parenchymal disease' + (v.feat && v.feat.includes('nodular surface') ? ' / cirrhosis' : '') + '.' },
    { id: 'hepatitis', l: 'Acute hepatitis pattern', x: ['sz'], fs: [F('feat', 'Features', 'multi', ['hepatomegaly', 'diffusely reduced echogenicity', 'prominent periportal echogenicity (starry-sky)', 'periportal oedema', 'GB wall oedema'])],
      t: v => 'Shows ' + list(v.feat && v.feat.length ? v.feat : ['diffusely reduced echogenicity', 'prominent periportal echogenicity']) + '.',
      i: () => 'Sonographic features may represent acute hepatitis – correlate with LFT.' },
    { id: 'congestion', l: 'Hepatic congestion', fs: [F('ivc', 'IVC diameter', 'num', 'mm')],
      t: v => 'Hepatic veins and IVC' + opt(v.ivc, ' (IVC ', ' mm)') + ' are dilated with reduced respiratory variation.',
      i: () => 'Features suggestive of congestive hepatopathy.' },
    { id: 'lesion', l: 'Focal lesion', rep: true, x: ['focal'],
      fs: [F('type', 'Type', 'sel', ['Simple cyst', 'Haemangioma', 'Abscess', 'Hydatid cyst', 'Solid lesion (indeterminate)', 'Multiple lesions (?metastases)', 'Calcified granuloma']),
           F('seg', 'Segment', 'sel', ['', 'I', 'II', 'III', 'IVa', 'IVb', 'V', 'VI', 'VII', 'VIII', 'right lobe', 'left lobe', 'both lobes']),
           F('sz', 'Size', 'dims', 'cm'),
           F('echo', 'Echo (solid lesion)', 'sel', ['hypoechoic', 'hyperechoic', 'isoechoic', 'heterogeneous', 'target / bull\'s-eye']),
           F('vasc', 'Vascularity', 'sel', ['', 'no internal vascularity', 'internal vascularity', 'peripheral vascularity'])],
      t: v => {
        const at = opt(v.seg, v.seg && /lobe/.test(v.seg) ? ' in the ' : ' in segment ');
        const sz = opt(dims(v.sz), ' measuring ', ' cm');
        const vs = opt(v.vasc, ' with ');
        const vo = vol(v.sz);
        switch (v.type) {
          case 'Haemangioma': return 'A well-defined homogeneously hyperechoic lesion' + sz + vs + at + ' – likely haemangioma.';
          case 'Abscess': return 'An ill-defined hypoechoic lesion with internal echoes / debris' + sz + (vo ? ' (volume ~' + vo + ' cc)' : '') + at + ' – likely liver abscess.';
          case 'Hydatid cyst': return 'A cystic lesion with internal septations / daughter cysts' + sz + at + ' – likely hydatid cyst.';
          case 'Solid lesion (indeterminate)': return 'A ' + (v.echo || 'hypoechoic') + ' solid lesion' + sz + vs + at + '.';
          case 'Multiple lesions (?metastases)': return 'Multiple ' + (v.echo || 'hypoechoic') + ' lesions are noted' + (v.seg ? ' in ' + (/lobe/.test(v.seg) ? 'the ' : 'segment ') + v.seg : ' in both lobes') + opt(dims(v.sz), ', largest measuring ', ' cm') + '.';
          case 'Calcified granuloma': return 'A tiny calcific focus with posterior acoustic shadowing' + at + ' – calcified granuloma.';
          default: return 'A well-defined anechoic cyst with imperceptible wall and posterior acoustic enhancement' + sz + at + '.';
        }
      },
      i: v => {
        const at = v.seg ? (/lobe/.test(v.seg) ? ' in ' + v.seg : ' in segment ' + v.seg) : '';
        return {
          'Simple cyst': 'Simple hepatic cyst' + at + '.',
          'Haemangioma': 'Hepatic lesion' + at + ' – likely haemangioma.',
          'Abscess': 'Liver abscess' + at + '.',
          'Hydatid cyst': 'Hepatic cystic lesion' + at + ' – likely hydatid cyst.',
          'Solid lesion (indeterminate)': 'Solid hepatic lesion' + at + ' – further evaluation with triple-phase CT / MRI recommended.',
          'Multiple lesions (?metastases)': 'Multiple hepatic lesions – likely metastases; suggested CECT correlation.',
          'Calcified granuloma': 'Calcified hepatic granuloma.',
        }[v.type || 'Simple cyst'];
      } },
    { id: 'ihbrd', l: 'IHBR dilatation', x: ['ihbr'], fs: [F('deg', 'Degree', 'sel', ['Mild', 'Moderate', 'Gross']), F('lobe', 'Lobe', 'sel', ['both lobes', 'right lobe', 'left lobe'])],
      t: v => lc(v.deg || 'Mild').replace(/^./, c => c.toUpperCase()) + ' dilatation of IHBR\'s is noted in ' + (v.lobe || 'both lobes') + '.',
      i: v => cap(lc(v.deg || 'mild')) + ' intrahepatic biliary radicle dilatation.' },
  ],
};

const PORTA = {
  id: 'porta', name: 'Porta hepatis / CBD', lab: 'PORTA HEPATIS',
  meas: [F('pv', 'Portal vein', 'num', 'mm'), F('cbd', 'CBD', 'num', 'mm')],
  cl: [
    { k: 'pv', t: m => 'Portal vein not dilated' + opt(m.pv, ' (', ' mm)') + '.' },
    { k: 'cbd', t: m => 'CBD not dilated' + opt(m.cbd, ' (', ' mm)') + '.' },
  ],
  fd: [
    { id: 'pht', l: 'Portal hypertension', x: ['pv'], fs: [F('feat', 'Features', 'multi', ['dilated portal vein', 'reduced portal venous velocity', 'hepatofugal flow', 'porto-systemic collaterals', 'recanalised paraumbilical vein', 'splenomegaly', 'ascites'])],
      t: (v, m) => 'Portal vein' + opt(m.pv, ' measures ', ' mm') + (v.feat && v.feat.length ? '. Noted ' + list(v.feat.filter(x => x !== 'dilated portal vein')) : '') + '.',
      i: () => 'Features of portal hypertension.' },
    { id: 'pvt', l: 'Portal vein thrombosis', x: ['pv'], fs: [F('ext', 'Extent', 'sel', ['Partial', 'Complete']), F('kind', 'Nature', 'sel', ['bland', 'with internal vascularity (?tumour thrombus)']), F('seg', 'Segment', 'sel', ['main portal vein', 'right portal vein', 'left portal vein', 'main and branches'])],
      t: v => 'Echogenic thrombus ' + (v.kind && v.kind !== 'bland' ? v.kind + ' ' : '') + 'is noted in the ' + (v.seg || 'main portal vein') + ' causing ' + lc(v.ext || 'Partial') + ' occlusion' + (v.ext === 'Complete' ? ' with no flow on colour Doppler' : '') + '.',
      i: v => cap(lc(v.ext || 'Partial')) + ' portal vein thrombosis' + (v.kind && v.kind !== 'bland' ? ' – ?tumour thrombus' : '') + '.' },
    { id: 'cbddil', l: 'CBD dilated', x: ['cbd'], fs: [F('cause', 'Cause', 'sel', ['No obvious cause seen', 'Distal CBD obscured by bowel gas', 'Post-cholecystectomy'])],
      t: (v, m) => 'CBD is dilated' + opt(m.cbd, ' (', ' mm)') + '. ' + (v.cause || 'No obvious cause seen') + '.',
      i: (v, m) => 'Dilated CBD' + opt(m.cbd, ' (', ' mm)') + (v.cause === 'Post-cholecystectomy' ? ' – may be post-cholecystectomy; correlate with LFT.' : ' – MRCP correlation suggested.') },
    { id: 'cbdstone', l: 'CBD calculus (choledocholithiasis)', x: ['cbd'], fs: [F('sz', 'Calculus size', 'num', 'mm'), F('loc', 'Location', 'sel', ['distal', 'mid', 'proximal'])],
      t: (v, m) => 'CBD is dilated' + opt(m.cbd, ' (', ' mm)') + ' with an echogenic calculus' + opt(v.sz, ' measuring ', ' mm') + ' showing posterior acoustic shadowing in its ' + (v.loc || 'distal') + ' part.',
      i: () => 'Choledocholithiasis with dilated CBD.' },
    { id: 'pneumobilia', l: 'Pneumobilia', fs: [], t: () => 'Echogenic foci with dirty shadowing / reverberation are seen along the biliary tree – pneumobilia.', i: () => 'Pneumobilia.' },
  ],
};

const GB = {
  id: 'gb', name: 'Gall bladder', lab: 'GALL BLADDER',
  meas: [],
  cl: [
    { k: 'dist', t: () => 'Distended.' },
    { k: 'calc', t: () => 'No evident calculus noted.' },
    { k: 'wall', t: () => 'GB wall has normal thickness.' },
    { k: 'peri', t: () => 'No pericholecystic fluid noted.' },
  ],
  fd: [
    { id: 'postchole', l: 'Post-cholecystectomy', x: ['dist', 'calc', 'wall', 'peri'], fs: [], t: () => 'Not visualised – post-cholecystectomy status.', i: () => 'Post-cholecystectomy status.' },
    { id: 'contracted', l: 'Contracted / partially distended', x: ['dist', 'wall'], fs: [F('why', 'Reason', 'sel', ['post-prandial state', 'unknown'])],
      t: v => 'Contracted / partially distended' + (v.why === 'post-prandial state' ? ' (post-prandial state) – limited evaluation.' : ' – limited evaluation.'), i: () => null },
    { id: 'calculus', l: 'Calculus (cholelithiasis)', x: ['calc'],
      fs: [NUM1, F('sz', 'Size (largest)', 'num', 'mm'), F('mob', 'Mobility', 'sel', ['mobile', 'non-mobile']), F('neck', 'Impacted at GB neck', 'chk'), F('wes', 'GB filled with calculi (WES sign)', 'chk')],
      t: v => v.wes ? 'GB lumen is filled with calculi showing wall-echo-shadow (WES) complex.' :
        (v.n === 'Multiple' ? 'Multiple ' + (v.mob || 'mobile') + ' calculi' + opt(v.sz, ', largest measuring ', ' mm,') : 'A ' + (v.mob || 'mobile') + ' calculus' + opt(v.sz, ' measuring ', ' mm')) +
        ' with posterior acoustic shadowing ' + (v.n === 'Multiple' ? 'are' : 'is') + ' noted in the GB lumen' + (v.neck ? ', with one impacted at the GB neck' : '') + '.',
      i: (v, m, c) => c.has('acute') ? null : 'Cholelithiasis' + (v.neck ? ' with calculus impacted at GB neck' : '') + '.' },
    { id: 'sludge', l: 'Sludge', fs: [F('ball', 'Tumefactive sludge ball', 'chk')],
      t: v => v.ball ? 'Non-shadowing mobile echogenic sludge ball is seen in the dependent part of GB.' : 'Echogenic sludge is noted in the dependent part of GB lumen.',
      i: () => 'GB sludge.' },
    { id: 'polyp', l: 'Polyp', rep: true,
      fs: [F('sz', 'Size', 'num', 'mm'), NUM1, F('risk', 'Morphology (SRU 2022)', 'sel', ['Pedunculated ball-on-the-wall / thin stalk (extremely low risk)', 'Sessile / thick stalk / focal wall thickening ≥4 mm (low risk)'])],
      t: v => (v.n === 'Multiple' ? 'Multiple non-shadowing, non-mobile echogenic polyps are noted arising from the GB wall' + opt(v.sz, ', largest measuring ', ' mm') : 'A non-shadowing, non-mobile echogenic polyp' + opt(v.sz, ' measuring ', ' mm') + ' is noted arising from the GB wall') +
        (v.risk && v.risk.startsWith('Sessile') ? ' (sessile / broad-based).' : '.'),
      i: v => {
        const s = +v.sz, low = v.risk && v.risk.startsWith('Sessile');
        let r = '';
        if (has(v.sz)) {
          if (s >= 15) r = 'surgical consultation recommended';
          else if (s >= 10) r = low ? 'US follow-up at 6, 12 and 24 months or surgical consultation' : 'US follow-up at 6, 12 and 24 months';
          else if (low && s >= 7) r = 'US follow-up at 12 months';
          else r = 'no follow-up required';
        }
        return 'GB polyp' + (v.n === 'Multiple' ? 's' : '') + opt(v.sz, ' (', ' mm)') + (r ? ' – ' + r + ' (SRU 2022 consensus).' : '.');
      } },
    { id: 'acute', l: 'Acute cholecystitis', x: ['dist', 'wall', 'peri'],
      fs: [F('wt', 'Wall thickness', 'num', 'mm'), F('feat', 'Features', 'multi', ['sonographic Murphy\'s sign positive', 'pericholecystic fluid', 'wall striation / oedema', 'calculus impacted at neck', 'intraluminal membranes (?gangrenous)', 'wall hyperaemia'])],
      t: v => 'Distended with diffusely thickened' + opt(v.wt, ' (', ' mm)') + ' oedematous wall' + (v.feat && v.feat.length ? ', ' + list(v.feat) : '') + '.',
      i: (v, m, c) => 'Features suggestive of acute ' + (c.has('calculus') ? 'calculous ' : 'acalculous ') + 'cholecystitis' + (v.feat && v.feat.some(f => f.includes('gangren')) ? ' – ?gangrenous' : '') + '.' },
    { id: 'chronic', l: 'Chronic cholecystitis', x: ['dist', 'wall'], fs: [F('wt', 'Wall thickness', 'num', 'mm')],
      t: v => 'Contracted with thickened wall' + opt(v.wt, ' (', ' mm)') + '.', i: (v, m, c) => c.has('calculus') ? 'Chronic calculous cholecystitis.' : 'Features suggestive of chronic cholecystitis.' },
    { id: 'wallthick', l: 'Diffuse wall thickening (non-specific)', x: ['wall'], fs: [F('wt', 'Wall thickness', 'num', 'mm')],
      t: v => 'GB wall is diffusely thickened' + opt(v.wt, ' (', ' mm)') + '.', i: () => 'Diffuse GB wall thickening – non-specific (hepatitis / hypoproteinaemia / ascites / cardiac causes to be correlated).' },
    { id: 'adeno', l: 'Adenomyomatosis', x: ['wall'], fs: [F('type', 'Type', 'sel', ['fundal', 'segmental', 'diffuse'])],
      t: v => (cap(v.type || 'fundal')) + ' GB wall thickening with echogenic intramural foci showing comet-tail artefacts.', i: v => cap(v.type || 'fundal') + ' adenomyomatosis of GB.' },
    { id: 'gbmass', l: 'GB mass (?carcinoma)', x: ['wall'], fs: [F('sz', 'Size', 'dims', 'cm'), F('inf', 'Infiltrating adjacent liver', 'chk')],
      t: v => 'An irregular heterogeneous soft-tissue mass' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted arising from the GB wall' + (v.inf ? ', infiltrating the adjacent liver parenchyma' : '') + '.',
      i: () => 'GB mass – suspicious for carcinoma gall bladder; CECT recommended.' },
    { id: 'porcelain', l: 'Porcelain GB', x: ['wall'], fs: [], t: () => 'GB wall shows curvilinear calcification with posterior acoustic shadowing.', i: () => 'Porcelain gall bladder.' },
  ],
};

const PANCREAS = {
  id: 'pancreas', name: 'Pancreas', lab: 'PANCREAS',
  meas: [],
  cl: [{ k: 'n', t: () => 'Visualized head and body appears normal in size and echotexture.' }],
  fd: [
    { id: 'obscured', l: 'Obscured by bowel gas', x: ['n'], fs: [], t: () => 'Obscured by bowel gas – not well visualised.', i: () => null },
    { id: 'acutepanc', l: 'Acute pancreatitis', x: ['n'], fs: [F('feat', 'Features', 'multi', ['bulky', 'hypoechoic', 'heterogeneous', 'peripancreatic fluid', 'peripancreatic fat stranding'])],
      t: v => 'Pancreas appears ' + list((v.feat && v.feat.length ? v.feat : ['bulky', 'hypoechoic']).filter(x => !x.startsWith('peri'))) + ((v.feat || []).filter(x => x.startsWith('peri')).length ? ' with ' + list(v.feat.filter(x => x.startsWith('peri'))) : '') + '.',
      i: () => 'Sonographic features suggestive of acute pancreatitis – correlate with serum amylase / lipase.' },
    { id: 'chronicpanc', l: 'Chronic pancreatitis', x: ['n'], fs: [F('mpd', 'MPD diameter', 'num', 'mm'), F('feat', 'Features', 'multi', ['atrophic', 'parenchymal calcifications', 'intraductal calculi', 'irregular dilated MPD'])],
      t: v => 'Pancreas shows ' + list(v.feat && v.feat.length ? v.feat : ['parenchymal calcifications']) + opt(v.mpd, '; MPD measures ', ' mm') + '.',
      i: () => 'Features suggestive of chronic calcific pancreatitis.' },
    { id: 'pseudocyst', l: 'Pseudocyst / collection', rep: true, fs: [F('sz', 'Size', 'dims', 'cm'), F('loc', 'Location', 'sel', ['lesser sac', 'head region', 'body region', 'tail region', 'peripancreatic'])],
      t: v => 'A well-defined cystic collection' + opt(dims(v.sz), ' measuring ', ' cm') + (vol(v.sz) ? ' (volume ~' + vol(v.sz) + ' cc)' : '') + ' is noted in the ' + (v.loc || 'lesser sac') + '.',
      i: () => 'Pancreatic / peripancreatic collection – ?pseudocyst.' },
    { id: 'pancmass', l: 'Pancreatic mass', fs: [F('loc', 'Location', 'sel', ['head', 'uncinate process', 'neck', 'body', 'tail']), F('sz', 'Size', 'dims', 'cm'), F('duct', 'Double-duct sign (CBD + MPD dilated)', 'chk')],
      t: v => 'An ill-defined hypoechoic mass' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the pancreatic ' + (v.loc || 'head') + (v.duct ? ', with dilatation of both CBD and MPD' : '') + '.',
      i: v => 'Pancreatic ' + (v.loc || 'head') + ' mass – CECT pancreas protocol recommended.' },
  ],
};

const SPLEEN = {
  id: 'spleen', name: 'Spleen', lab: 'SPLEEN',
  meas: [F('len', 'Length', 'num', 'cm')],
  cl: [
    { k: 'sz', t: m => 'Normal in size' + opt(m.len, ' (', ' cm)') + ', shape and echotexture.' },
    { k: 'focal', t: () => 'No evident focal lesion.' },
  ],
  fd: [
    { id: 'splenomegaly', l: 'Splenomegaly', x: ['sz'], fs: [F('g', 'Grade (auto from length if blank)', 'sel', ['', 'Mild', 'Moderate', 'Massive'])],
      t: (v, m) => 'Enlarged in size' + opt(m.len, ' (', ' cm)') + ' with normal echotexture.',
      i: (v, m) => { const g = v.g || (has(m.len) ? (+m.len > 20 ? 'Massive' : +m.len > 15 ? 'Moderate' : 'Mild') : 'Mild'); return g + ' splenomegaly' + opt(m.len, ' (', ' cm)') + '.'; } },
    { id: 'spllesion', l: 'Focal lesion', rep: true, x: ['focal'],
      fs: [F('type', 'Type', 'sel', ['Simple cyst', 'Calcified granulomas', 'Infarct', 'Abscess', 'Haemangioma', 'Solid lesion (indeterminate)']), F('sz', 'Size', 'dims', 'cm')],
      t: v => ({
        'Simple cyst': 'A well-defined anechoic cyst' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted.',
        'Calcified granulomas': 'Multiple tiny echogenic calcific foci are seen – calcified granulomas.',
        'Infarct': 'A peripheral wedge-shaped hypoechoic area' + opt(dims(v.sz), ' measuring ', ' cm') + ' with no internal vascularity is noted – likely infarct.',
        'Abscess': 'A hypoechoic lesion with internal echoes' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted – likely abscess.',
        'Haemangioma': 'A well-defined hyperechoic lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted – likely haemangioma.',
        'Solid lesion (indeterminate)': 'A solid lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted.',
      })[v.type || 'Simple cyst'],
      i: v => ({ 'Simple cyst': 'Splenic cyst.', 'Calcified granulomas': 'Splenic calcified granulomas.', 'Infarct': 'Splenic infarct.', 'Abscess': 'Splenic abscess.', 'Haemangioma': 'Splenic lesion – likely haemangioma.', 'Solid lesion (indeterminate)': 'Solid splenic lesion – further evaluation with CECT recommended.' })[v.type || 'Simple cyst'] },
    { id: 'splenule', l: 'Splenunculus', fs: [F('sz', 'Size', 'num', 'cm')], t: v => 'A small splenunculus' + opt(v.sz, ' measuring ', ' cm') + ' is noted near the splenic hilum.', i: () => null },
    { id: 'splenectomy', l: 'Post-splenectomy', x: ['sz', 'focal'], fs: [], t: () => 'Not visualised – post-splenectomy status.', i: () => 'Post-splenectomy status.' },
  ],
};

/* ---------- KIDNEY (factory per side) ---------- */
const kidneySide = (sd) => {
  const side = S[sd], sl = lc(side);
  const K = w => ({ key: w, side: sd });
  return {
    id: 'kid' + sd, name: side + ' kidney', lab: side.toUpperCase() + ' KIDNEY', side: sd,
    meas: [F('len', 'Length', 'num', 'cm'), F('wid', 'Width', 'num', 'cm'), F('ct', 'Cortical thickness', 'num', 'mm')],
    cl: [
      { k: 'len', t: m => has(m.len) ? 'Measures ' + m.len + (has(m.wid) ? ' x ' + m.wid : '') + ' cm' + opt(m.ct, ' (cortical thickness ', ' mm)') + '.' : '' },
      { k: 'sz', t: () => 'Normal in size, shape and echotexture.' },
      { k: 'cmd', t: () => 'Corticomedullary differentiation is preserved.' },
      { k: 'hn', t: () => 'No evidence of hydroureteronephrosis or calculi seen.' },
    ],
    fd: [
      { id: 'calc', l: 'Renal calculus', rep: true, x: ['hn'],
        fs: [NUM1, F('sz', 'Size (largest)', 'num', 'mm'), F('loc', 'Location', 'sel', ['lower pole calyx', 'mid pole calyx', 'upper pole calyx', 'renal pelvis', 'PUJ', 'staghorn (pelvis + calyces)'])],
        t: (v, m, c) => (v.n === 'Multiple' ? 'Multiple calculi' + opt(v.sz, ', largest measuring ', ' mm,') + ' are' : 'A calculus' + opt(v.sz, ' measuring ', ' mm') + ' is') + ' noted in the ' + (v.loc || 'lower pole calyx') + '.' +
          (c.first('calc') && !c.hasAny(['hn', 'ureteric', 'pyo']) ? ' No hydroureteronephrosis.' : ''),
        i: v => side + ' renal calculus' + (v.n === 'Multiple' ? 'i' : '') + opt(v.sz, ' (', ' mm' + (v.loc ? ', ' + v.loc : '') + ')') + '.' },
      { id: 'ureteric', l: 'Ureteric calculus', rep: true, x: ['hn'],
        fs: [F('sz', 'Size', 'num', 'mm'), F('loc', 'Location', 'sel', ['VUJ', 'distal ureter', 'mid ureter', 'proximal ureter', 'PUJ']), F('hn', 'Causing', 'sel', ['mild hydroureteronephrosis', 'moderate hydroureteronephrosis', 'severe hydroureteronephrosis', 'mild hydronephrosis', 'no hydronephrosis'])],
        t: v => 'A calculus' + opt(v.sz, ' measuring ', ' mm') + ' is noted at the ' + sl + ' ' + (v.loc || 'VUJ') + ' causing ' + (v.hn || 'mild hydroureteronephrosis') + '.',
        i: v => side + ' ' + (v.loc || 'VUJ') + ' calculus' + opt(v.sz, ' (', ' mm)') + (v.hn && v.hn.startsWith('no') ? '.' : ' causing ' + (v.hn || 'mild hydroureteronephrosis') + '.') },
      { id: 'hn', l: 'Hydronephrosis / HUN', x: ['hn'],
        fs: [F('g', 'Grade', 'sel', ['Mild', 'Moderate', 'Severe']), F('ureter', 'With hydroureter', 'chk'), F('cause', 'Cause / level (optional)', 'txt')],
        t: (v, m, c) => {
          const d = { Mild: 'dilatation of the renal pelvis with mild calyceal dilatation', Moderate: 'dilatation of the pelvicalyceal system with blunting of calyces and preserved cortical thickness', Severe: 'marked dilatation of the pelvicalyceal system with cortical thinning' }[v.g || 'Mild'];
          return cap(d) + (v.ureter ? ', with dilated ureter' : '') + opt(v.cause, ' – ') + '.' + (c.has('calc') || c.has('ureteric') ? '' : ' No calculus seen.');
        },
        i: (v, m, c) => c.has('ureteric') ? null : side + ' ' + lc(v.g || 'Mild') + (v.ureter ? ' hydroureteronephrosis' : ' hydronephrosis') + opt(v.cause, ' – ') + '.' },
      { id: 'pyo', l: 'Pyonephrosis', x: ['hn'], fs: [], t: () => 'Dilated pelvicalyceal system with internal echoes / debris and fluid-debris level.', i: () => side + ' pyonephrosis – urgent urological opinion.' },
      { id: 'rpd', l: 'Renal parenchymal disease (grade)', x: ['sz', 'cmd'], fs: [F('g', 'Grade', 'sel', ['I', 'II', 'III'])],
        t: (v, m) => ({ I: 'Normal in size. Cortical echogenicity is increased (equal to liver) with preserved corticomedullary differentiation.',
          II: 'Normal in size. Cortical echogenicity is increased (more than liver) with preserved corticomedullary differentiation.',
          III: 'Cortical echogenicity is markedly increased (more than liver) with loss of corticomedullary differentiation.' })[v.g || 'I'],
        i: v => ({ key: 'rpd' + (v.g || 'I'), side: sd, f: w => 'Grade ' + (v.g || 'I') + ' renal parenchymal disease – ' + w + '; correlate with RFT.' }) },
      { id: 'contracted', l: 'Small contracted kidney', x: ['sz', 'cmd'], fs: [],
        t: (v, m) => 'Small in size' + opt(m.len, ' (', ' cm)') + ' with increased cortical echogenicity, cortical thinning and poor corticomedullary differentiation.',
        i: () => ({ key: 'contracted', side: sd, f: w => 'Small contracted ' + (w === 'both kidneys' ? 'kidneys' : w) + ' – chronic kidney disease.' }) },
      { id: 'cyst', l: 'Simple cortical cyst', rep: true, fs: [F('sz', 'Size', 'dims', 'cm'), F('loc', 'Location', 'sel', ['upper pole', 'mid pole', 'lower pole']), F('type', 'Type', 'sel', ['cortical', 'exophytic', 'parapelvic'])],
        t: v => 'A well-defined anechoic ' + (v.type || 'cortical') + ' cyst with imperceptible wall' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + (v.loc || 'mid pole') + '.',
        i: () => side + ' renal simple cyst (Bosniak I).' },
      { id: 'cplxcyst', l: 'Complex cyst', fs: [F('sz', 'Size', 'dims', 'cm'), F('feat', 'Features', 'multi', ['thin septations', 'thick / irregular septations', 'calcification', 'internal echoes', 'solid enhancing-looking component', 'internal vascularity'])],
        t: v => 'A complex cystic lesion' + opt(dims(v.sz), ' measuring ', ' cm') + (v.feat && v.feat.length ? ' with ' + list(v.feat) : '') + ' is noted.',
        i: () => side + ' complex renal cyst – CECT / CEMRI recommended for Bosniak categorisation.' },
      { id: 'aml', l: 'Angiomyolipoma', fs: [F('sz', 'Size', 'dims', 'cm'), F('loc', 'Location', 'sel', ['upper pole', 'mid pole', 'lower pole'])],
        t: v => 'A well-defined homogeneously hyperechoic lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + (v.loc || 'mid pole') + ' – likely angiomyolipoma.',
        i: () => side + ' renal hyperechoic lesion – likely angiomyolipoma (CT confirmation of fat advised).' },
      { id: 'mass', l: 'Solid renal mass', fs: [F('sz', 'Size', 'dims', 'cm'), F('loc', 'Location', 'sel', ['upper pole', 'mid pole', 'lower pole']), F('vasc', 'Internal vascularity', 'chk'), F('rv', 'Renal vein / IVC thrombus', 'chk')],
        t: v => 'A heterogeneous solid mass' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + (v.loc || 'mid pole') + (v.vasc ? ' showing internal vascularity' : '') + '.' + (v.rv ? ' Thrombus is noted in the renal vein / IVC.' : ''),
        i: () => side + ' solid renal mass – suspicious for RCC; CECT recommended.' },
      { id: 'pyelo', l: 'Acute pyelonephritis', x: ['sz'], fs: [F('feat', 'Features', 'multi', ['bulky', 'altered echogenicity', 'focal hypoechoic areas', 'reduced perfusion on colour Doppler', 'urothelial thickening', 'perinephric fluid'])],
        t: v => 'Kidney appears ' + list(v.feat && v.feat.length ? v.feat : ['bulky', 'altered echogenicity']) + '.', i: () => side + ' acute pyelonephritis – correlate clinically and with urine analysis.' },
      { id: 'nephrocalc', l: 'Medullary nephrocalcinosis', x: ['cmd'], fs: [], t: () => 'Echogenic medullary pyramids are noted.', i: () => ({ key: 'nephrocalc', side: sd, f: w => 'Medullary nephrocalcinosis – ' + w + '.' }) },
      { id: 'ectopic', l: 'Ectopic kidney', x: ['sz'], fs: [F('loc', 'Location', 'sel', ['pelvic', 'lumbar', 'crossed fused'])], t: v => 'Kidney is not seen in the renal fossa; noted in ' + (v.loc || 'pelvic') + ' location.', i: v => side + ' ' + (v.loc || 'pelvic') + ' ectopic kidney.' },
      { id: 'duplex', l: 'Duplex collecting system', fs: [], t: () => 'Duplex collecting system with separate upper and lower moieties.', i: () => side + ' duplex kidney.' },
      { id: 'extrarenal', l: 'Extrarenal pelvis (variant)', fs: [], t: () => 'Extrarenal pelvis is noted – normal variant.', i: () => null },
      { id: 'hyper', l: 'Compensatory hypertrophy', x: ['sz'], fs: [], t: (v, m) => 'Enlarged in size' + opt(m.len, ' (', ' cm)') + ' with normal echotexture – compensatory hypertrophy.', i: () => null },
      { id: 'absent', l: 'Not visualised / nephrectomy', x: ['len', 'sz', 'cmd', 'hn'], fs: [F('why', 'Reason', 'sel', ['post-nephrectomy status', 'not visualised in renal fossa or ectopic location (?agenesis)'])],
        t: v => 'Not visualised – ' + (v.why || 'post-nephrectomy status') + '.', i: v => side + ' kidney not visualised – ' + (v.why || 'post-nephrectomy status') + '.' },
    ],
  };
};

const BLADDER = {
  id: 'ub', name: 'Urinary bladder', lab: 'Ur. BLADDER',
  meas: [F('pre', 'Prevoid volume', 'num', 'cc'), F('pvr', 'Post-void residual', 'num', 'cc'), F('wt', 'Wall thickness', 'num', 'mm')],
  cl: [
    { k: 'dist', t: () => 'Distended.' },
    { k: 'calc', t: () => 'No evident calculus.' },
    { k: 'wall', t: m => 'UB wall has normal thickness' + opt(m.wt, ' (', ' mm)') + '.' },
    { k: 'vol', t: m => (has(m.pre) ? 'Prevoid volume – ' + m.pre + ' cc. ' : '') + (has(m.pvr) ? 'PVRV – ' + m.pvr + ' cc.' : '') },
  ],
  auto: m => has(m.pvr) && +m.pvr > 100 ? [{ i: 'Significant post-void residual urine (' + m.pvr + ' cc).' }] : [],
  fd: [
    { id: 'partial', l: 'Partially distended / collapsed', x: ['dist', 'wall'], fs: [], t: () => 'Partially distended – wall and lumen not optimally assessed.', i: () => null },
    { id: 'ubcalc', l: 'Vesical calculus', x: ['calc'], fs: [NUM1, F('sz', 'Size (largest)', 'num', 'mm')],
      t: v => (v.n === 'Multiple' ? 'Multiple mobile calculi' + opt(v.sz, ', largest measuring ', ' mm,') + ' are' : 'A mobile calculus' + opt(v.sz, ' measuring ', ' mm') + ' is') + ' noted in the bladder lumen with posterior acoustic shadowing.',
      i: () => 'Vesical calculus.' },
    { id: 'trab', l: 'Wall thickening / trabeculation', x: ['wall'], fs: [F('feat', 'Features', 'multi', ['diffuse wall thickening', 'trabeculation', 'sacculations', 'diverticula'])],
      t: (v, m) => 'UB shows ' + list(v.feat && v.feat.length ? v.feat : ['diffuse wall thickening', 'trabeculation']) + opt(m.wt, ' (wall thickness ', ' mm)') + '.',
      i: () => 'Thick-walled trabeculated urinary bladder – ?chronic bladder outlet obstruction.' },
    { id: 'cystitis', l: 'Cystitis', x: ['wall'], fs: [], t: (v, m) => 'UB wall is diffusely thickened' + opt(m.wt, ' (', ' mm)') + ' with internal echoes in the lumen.', i: () => 'Features suggestive of cystitis – correlate with urine analysis.' },
    { id: 'debris', l: 'Internal echoes / debris', fs: [], t: () => 'Internal echoes / debris are noted in the bladder lumen.', i: () => 'Internal echoes in urinary bladder – correlate with urine analysis.' },
    { id: 'ubmass', l: 'Mass / polypoidal lesion', rep: true, x: ['wall'], fs: [F('sz', 'Size', 'dims', 'cm'), F('loc', 'Wall', 'sel', ['right lateral', 'left lateral', 'posterior', 'anterior', 'dome', 'trigone', 'base']), F('vasc', 'Internal vascularity', 'chk')],
      t: v => 'A polypoidal soft-tissue lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted arising from the ' + (v.loc || 'right lateral') + ' wall' + (v.vasc ? ' showing internal vascularity' : '') + '.',
      i: () => 'Urinary bladder mass – cystoscopic evaluation recommended.' },
    { id: 'divert', l: 'Diverticulum', fs: [F('sz', 'Size', 'dims', 'cm'), F('loc', 'Location', 'sel', ['right lateral', 'left lateral', 'posterior'])],
      t: v => 'A diverticulum' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted arising from the ' + (v.loc || 'right lateral') + ' wall.', i: () => 'Urinary bladder diverticulum.' },
    { id: 'ureterocele', l: 'Ureterocele', fs: [SIDE2], t: v => 'A thin-walled cystic outpouching is seen at the ' + lc(v.side || 'Right') + ' VUJ – ureterocele.', i: v => (v.side || 'Right') + ' ureterocele.' },
    { id: 'foley', l: 'Foley catheter in situ', x: ['dist'], fs: [], t: () => 'Collapsed with Foley catheter bulb in situ.', i: () => null },
  ],
};

const PROSTATE_GRADES = [[25, null], [40, 'I'], [60, 'II'], [80, 'III'], [Infinity, 'IV']]; // ≤25 cc normal
const PROSTATE = {
  id: 'prostate', name: 'Prostate', lab: 'PROSTATE', sex: 'M',
  meas: [F('d', 'Dimensions (cm)', 'dims', 'cm'), F('v', 'Volume (auto if blank)', 'num', 'cc')],
  cl: [{ k: 'vol', t: m => { const v = has(m.v) ? m.v : vol(m.d); return 'Has an approx. volume of ' + (v != null ? v : '__') + ' cc' + (v != null && v > 25 ? '' : '') + '.'; } }],
  auto: m => {
    const v = has(m.v) ? +m.v : vol(m.d);
    if (v == null || v <= 25) return [];
    const g = PROSTATE_GRADES.find(r => v <= r[0])[1];
    return [{ x: ['vol'], t: 'Enlarged in size with an approx. volume of ' + v + ' cc.', i: 'Grade ' + g + ' prostatomegaly (~' + v + ' cc).' }];
  },
  fd: [
    { id: 'ml', l: 'Median lobe protrusion', fs: [F('ipp', 'Intravesical protrusion', 'num', 'mm')], t: v => 'Median lobe is seen protruding into the bladder base' + opt(v.ipp, ' (IPP ', ' mm)') + '.', i: () => 'Median lobe protrusion.' },
    { id: 'pcalc', l: 'Prostatic calcifications', fs: [], t: () => 'Few parenchymal calcifications are noted.', i: () => null },
    { id: 'prostatitis', l: 'Prostatitis pattern', fs: [], t: () => 'Heterogeneous echotexture with increased vascularity.', i: () => 'Features may represent prostatitis – correlate clinically.' },
    { id: 'pzlesion', l: 'Hypoechoic peripheral-zone lesion', fs: [F('sz', 'Size', 'dims', 'cm'), SIDE2], t: v => 'An ill-defined hypoechoic area' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + lc(v.side || 'Right') + ' peripheral zone.', i: () => 'Hypoechoic peripheral zone lesion – correlate with PSA; mpMRI prostate advised.' },
    { id: 'turp', l: 'Post-TURP defect', fs: [], t: () => 'Post-TURP defect is noted.', i: () => 'Post-TURP status.' },
  ],
};

const UTERUS = {
  id: 'uterus', name: 'Uterus', lab: 'UTERUS', sex: 'F',
  meas: [F('d', 'Dimensions', 'dims', 'cm'), F('et', 'Endometrial thickness', 'num', 'mm'), F('pos', 'Position', 'sel', ['', 'anteverted', 'retroverted', 'anteverted anteflexed', 'retroverted retroflexed'])],
  cl: [
    { k: 'sz', t: m => (m.pos ? cap(m.pos) + '. ' : '') + 'Measures ' + (dims(m.d) || '__') + ' cm and appears normal in echotexture.' },
    { k: 'focal', t: () => 'No focal myometrial lesions.' },
    { k: 'et', t: m => 'Endometrial thickness is ' + (has(m.et) ? m.et : '__') + ' mm.' },
  ],
  auto: (m, c) => c.meno === 'Post-menopausal' && has(m.et) && +m.et > 4 && !c.has('thickET')
    ? [{ i: 'Endometrial thickness of ' + m.et + ' mm – thickened for post-menopausal status (>4 mm); endometrial sampling recommended.' }] : [],
  fd: [
    { id: 'bulky', l: 'Bulky uterus', x: ['sz'], fs: [], t: (v, m) => 'Bulky in size' + opt(dims(m.d), ' (', ' cm)') + ' with normal echotexture.', i: (v, m, c) => c.has('adeno') ? null : 'Bulky uterus.' },
    { id: 'fibroid', l: 'Fibroid', rep: true, x: ['focal'],
      fs: [NUM1, F('type', 'Type', 'sel', ['intramural', 'subserosal', 'pedunculated subserosal', 'submucosal', 'intramural with submucosal component', 'intramural with subserosal component', 'cervical', 'broad ligament']),
           F('wall', 'Wall', 'sel', ['anterior', 'posterior', 'fundal', 'right lateral', 'left lateral']), F('sz', 'Size (largest)', 'dims', 'cm'),
           F('figo', 'FIGO type', 'sel', ['', '0', '1', '2', '3', '4', '5', '6', '7', '2-5', '8']), F('echo', 'Echo', 'sel', ['hypoechoic', 'heterogeneous', 'calcified', 'cystic degeneration'])],
      t: v => (v.n === 'Multiple' ? 'Multiple well-defined ' + (v.echo || 'hypoechoic') + ' lesions are noted in the myometrium' + opt(dims(v.sz), ', largest measuring ', ' cm') + ' (' + (v.type || 'intramural') + ', ' + (v.wall || 'anterior') + ' wall)' :
        'A well-defined ' + (v.echo || 'hypoechoic') + ' lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + (v.wall || 'anterior') + ' wall (' + (v.type || 'intramural') + ')') + opt(v.figo, ', FIGO type ') + ' – fibroid.',
      i: v => (v.n === 'Multiple' ? 'Multiple uterine fibroids' : cap(v.type || 'intramural') + ' uterine fibroid') + opt(dims(v.sz), ' (', ' cm)') + opt(v.figo, ', FIGO type ') + '.' },
    { id: 'adeno', l: 'Adenomyosis', x: ['sz'],
      fs: [F('type', 'Type', 'sel', ['diffuse', 'focal (adenomyoma)']), F('feat', 'Features', 'multi', ['globular bulky uterus', 'asymmetric myometrial thickening', 'heterogeneous myometrium', 'myometrial cysts', 'fan-shaped / venetian-blind shadowing', 'ill-defined junctional zone', 'question-mark sign', 'translesional vascularity'])],
      t: (v, m) => 'Measures ' + (dims(m.d) || '__') + ' cm and shows ' + list(v.feat && v.feat.length ? v.feat : ['globular bulky uterus', 'heterogeneous myometrium', 'fan-shaped shadowing']) + '.',
      i: v => 'Features suggestive of ' + (v.type && v.type.startsWith('focal') ? 'focal adenomyosis (adenomyoma)' : 'diffuse adenomyosis') + '.' },
    { id: 'thickET', l: 'Thickened endometrium', x: ['et'], fs: [],
      t: (v, m, c) => 'Endometrium is thickened, measuring ' + (has(m.et) ? m.et : '__') + ' mm.',
      i: (v, m, c) => 'Thickened endometrium' + opt(m.et, ' (', ' mm)') + (c.meno === 'Post-menopausal' ? ' in a post-menopausal patient – endometrial sampling recommended.' : ' – correlate with phase of menstrual cycle / follow-up post menses.') },
    { id: 'polyp', l: 'Endometrial polyp', fs: [F('sz', 'Size', 'dims', 'cm'), F('fv', 'Feeding vessel', 'chk')], t: v => 'A well-defined echogenic lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted within the endometrial cavity' + (v.fv ? ' with a single feeding vessel' : '') + '.', i: () => 'Endometrial polyp.' },
    { id: 'collection', l: 'Endometrial collection', fs: [F('type', 'Type', 'sel', ['fluid (hydrometra)', 'haematometra', 'pyometra'])], t: v => 'Fluid collection with ' + (v.type === 'fluid (hydrometra)' ? 'clear fluid' : 'internal echoes') + ' is noted in the endometrial cavity.', i: v => cap(v.type || 'fluid (hydrometra)').replace('Fluid (hydrometra)', 'Hydrometra') + '.' },
    { id: 'iucd', l: 'IUCD', fs: [F('pos', 'Position', 'sel', ['in situ in endometrial cavity', 'low-lying (in lower uterine segment / cervix)', 'displaced / rotated', 'embedded in myometrium'])],
      t: v => 'IUCD is seen ' + (v.pos || 'in situ in endometrial cavity') + '.', i: v => (v.pos || 'in situ').startsWith('in situ') ? 'IUCD in situ.' : 'Malpositioned IUCD (' + v.pos + ').' },
    { id: 'rpoc', l: 'Retained products', fs: [F('sz', 'Size', 'dims', 'cm'), F('vasc', 'Internal vascularity', 'chk')], t: v => 'Heterogeneous echogenic material' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the endometrial cavity' + (v.vasc ? ' showing internal vascularity' : '') + '.', i: () => 'Retained products of conception.' },
    { id: 'mullerian', l: 'Congenital anomaly', fs: [F('type', 'Type', 'sel', ['arcuate', 'septate', 'bicornuate', 'didelphys', 'unicornuate'])], t: v => 'Features suggestive of ' + (v.type || 'septate') + ' uterus.', i: v => cap(v.type || 'septate') + ' uterus – 3D US / MRI for confirmation.' },
    { id: 'nabothian', l: 'Nabothian cysts', fs: [], t: () => 'Few Nabothian cysts are noted in the cervix.', i: () => null },
    { id: 'atrophic', l: 'Atrophic (post-menopausal)', x: ['sz'], fs: [], t: (v, m) => 'Atrophic' + opt(dims(m.d), ', measuring ', ' cm') + '.', i: () => null },
    { id: 'hyst', l: 'Post-hysterectomy', x: ['sz', 'focal', 'et'], fs: [], t: () => 'Not visualised – post-hysterectomy status. Vault appears normal.', i: () => 'Post-hysterectomy status.' },
  ],
};

/* O-RADS US v2022 (lexicon category only) */
const ORADS_TXT = { 1: 'O-RADS 1 – normal ovary', 2: 'O-RADS 2 – almost certainly benign (<1%)', 3: 'O-RADS 3 – low risk (1–<10%)', 4: 'O-RADS 4 – intermediate risk (10–<50%)', 5: 'O-RADS 5 – high risk (≥50%)' };
const OVARIES = {
  id: 'ovaries', name: 'Ovaries / adnexa', lab: 'OVARIES', sex: 'F',
  meas: [F('rd', 'Right ovary', 'dims', 'cm'), F('ld', 'Left ovary', 'dims', 'cm')],
  cl: [
    { k: 'dims', t: m => 'Right ovary – ' + (dims(m.rd) || '__') + ' cm' + (vol(m.rd) ? ' (vol ' + vol(m.rd) + ' cc)' : '') + '. Left ovary – ' + (dims(m.ld) || '__') + ' cm' + (vol(m.ld) ? ' (vol ' + vol(m.ld) + ' cc)' : '') + '.' },
    { k: 'norm', t: (m, c) => { const s = c.sides(); return !s.R && !s.L ? 'Both ovaries appear normal sono-graphically.' : !s.R ? 'Right ovary appears normal sono-graphically.' : !s.L ? 'Left ovary appears normal sono-graphically.' : ''; } },
    { k: 'adn', t: () => 'No evident adnexal lesion is seen on both sides.' },
  ],
  fd: [
    { id: 'pcom', l: 'Polycystic ovarian morphology', fs: [SIDE, F('fn', 'Follicle count / ovary', 'sel', ['', '≥20', '12–19', '>25'])], d: { side: 'Bilateral' },
      t: v => (v.side === 'Bilateral' || !v.side ? 'Both ovaries show' : cap(v.side) + ' ovary shows') + ' multiple small peripherally arranged follicles' + opt(v.fn, ' (', ' per ovary)') + ' with central echogenic stroma.',
      i: v => (v.side && v.side !== 'Bilateral' ? v.side + ' ' : 'Bilateral ') + 'polycystic ovarian morphology – correlate clinically and hormonally.' },
    { id: 'simple', l: 'Simple / follicular cyst', rep: true, x: [], fs: [SIDE2, F('sz', 'Size', 'dims', 'cm')],
      t: v => 'A thin-walled unilocular anechoic cyst' + opt(dims(v.sz), ' measuring ', ' cm') + ' with no internal vascularity is noted in the ' + lc(v.side || 'Right') + ' ovary.',
      i: (v, m, c) => { const d = maxDim(v.sz); const o = d == null ? '' : d >= 10 ? 3 : (d <= 3 && c.meno !== 'Post-menopausal') ? 1 : 2;
        return (v.side || 'Right') + ' ovarian simple cyst' + opt(dims(v.sz), ' (', ' cm)') + (o ? ' – ' + (o === 1 ? 'likely follicle, ' : '') + ORADS_TXT[o] : '') + '.'; } },
    { id: 'hemorrhagic', l: 'Haemorrhagic cyst', rep: true, fs: [SIDE2, F('sz', 'Size', 'dims', 'cm')],
      t: v => 'A cyst with reticular / lace-like internal echoes and retracting clot' + opt(dims(v.sz), ' measuring ', ' cm') + ', with no internal vascularity, is noted in the ' + lc(v.side || 'Right') + ' ovary.',
      i: (v, m, c) => (v.side || 'Right') + ' ovarian haemorrhagic cyst' + opt(dims(v.sz), ' (', ' cm)') + ' – ' + ORADS_TXT[maxDim(v.sz) >= 10 ? 3 : 2] + (c.meno === 'Post-menopausal' ? '; follow-up advised.' : '; follow-up after 8–12 weeks advised.') },
    { id: 'endometrioma', l: 'Endometrioma', rep: true, fs: [SIDE2, F('sz', 'Size', 'dims', 'cm')],
      t: v => 'A cyst with homogeneous low-level (ground-glass) internal echoes' + opt(dims(v.sz), ' measuring ', ' cm') + ', with no internal vascularity, is noted in the ' + lc(v.side || 'Right') + ' ovary.',
      i: v => (v.side || 'Right') + ' ovarian endometrioma' + opt(dims(v.sz), ' (', ' cm)') + ' – ' + ORADS_TXT[maxDim(v.sz) >= 10 ? 3 : 2] + '.' },
    { id: 'dermoid', l: 'Dermoid', rep: true, fs: [SIDE2, F('sz', 'Size', 'dims', 'cm'), F('feat', 'Features', 'multi', ['hyperechoic component with acoustic shadowing', 'dermoid mesh (hyperechoic lines and dots)', 'floating echogenic spheres', 'fat-fluid level'])],
      t: v => 'A cystic lesion with ' + list(v.feat && v.feat.length ? v.feat : ['hyperechoic component with acoustic shadowing', 'dermoid mesh (hyperechoic lines and dots)']) + opt(dims(v.sz), ', measuring ', ' cm') + ', is noted in the ' + lc(v.side || 'Right') + ' ovary.',
      i: v => (v.side || 'Right') + ' ovarian dermoid' + opt(dims(v.sz), ' (', ' cm)') + ' – ' + ORADS_TXT[maxDim(v.sz) >= 10 ? 3 : 2] + '.' },
    { id: 'complex', l: 'Complex / solid adnexal mass', rep: true, x: ['adn'],
      fs: [SIDE2, F('sz', 'Size', 'dims', 'cm'), F('feat', 'Features', 'multi', ['multilocular', 'smooth septations', 'irregular septations', 'solid component', 'papillary projections', 'irregular outer contour', 'predominantly solid']),
           F('cs', 'Colour score', 'sel', ['', '1 (no flow)', '2 (minimal)', '3 (moderate)', '4 (very strong)']), F('asc', 'Ascites / peritoneal nodules', 'chk'), F('orads', 'O-RADS category', 'sel', ['3', '4', '5'])],
      t: v => 'A ' + (v.feat && v.feat.includes('predominantly solid') ? 'predominantly solid' : 'complex cystic') + ' adnexal lesion' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + lc(v.side || 'Right') + ' adnexa' + (v.feat && v.feat.length ? ' with ' + list(v.feat.filter(f => f !== 'predominantly solid')) : '') + opt(v.cs, '; colour score ') + '.' + (v.asc ? ' Associated ascites / peritoneal nodularity is noted.' : ''),
      i: v => { const o = +(v.orads || 4); return (v.side || 'Right') + ' complex adnexal lesion' + opt(dims(v.sz), ' (', ' cm)') + ' – ' + ORADS_TXT[o] + (o === 3 ? '; gynaecology referral, MRI may be considered.' : o === 4 ? '; gynae-oncology evaluation / MRI (O-RADS MRI) recommended.' : '; gynae-oncologist referral recommended.'); } },
    { id: 'paraovarian', l: 'Paraovarian cyst', fs: [SIDE2, F('sz', 'Size', 'dims', 'cm')], x: ['adn'],
      t: v => 'A simple cyst' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + lc(v.side || 'Right') + ' adnexa separate from the ovary – paraovarian cyst.', i: v => (v.side || 'Right') + ' paraovarian cyst – ' + ORADS_TXT[2] + '.' },
    { id: 'hydrosalpinx', l: 'Hydrosalpinx', fs: [SIDE], x: ['adn'],
      t: v => 'A tubular anechoic structure with incomplete septations / waist sign is noted in the ' + sideAdj(v.side || 'Right') + ' adnexa.', i: v => (v.side || 'Right') + ' hydrosalpinx – ' + ORADS_TXT[2] + '.' },
    { id: 'toa', l: 'Tubo-ovarian abscess', fs: [SIDE2, F('sz', 'Size', 'dims', 'cm')], x: ['adn'],
      t: v => 'A thick-walled complex collection with internal echoes' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + lc(v.side || 'Right') + ' adnexa, with ill-defined ovary.', i: v => (v.side || 'Right') + ' tubo-ovarian abscess.' },
    { id: 'torsion', l: 'Ovarian torsion', fs: [SIDE2, F('feat', 'Features', 'multi', ['enlarged oedematous ovary', 'peripherally displaced follicles', 'whirlpool sign of pedicle', 'absent / reduced flow', 'free fluid'])],
      t: v => cap(lc(v.side || 'Right')) + ' ovary shows ' + list(v.feat && v.feat.length ? v.feat : ['enlarged oedematous ovary', 'peripherally displaced follicles', 'absent / reduced flow']) + '.', i: v => 'Features suggestive of ' + lc(v.side || 'Right') + ' ovarian torsion – urgent gynaecological opinion.' },
    { id: 'corpus', l: 'Corpus luteum / dominant follicle', fs: [SIDE2, F('type', 'Type', 'sel', ['corpus luteum', 'dominant follicle']), F('sz', 'Size', 'num', 'cm')],
      t: v => 'A ' + (v.type || 'corpus luteum') + opt(v.sz, ' measuring ', ' cm') + ' is noted in the ' + lc(v.side || 'Right') + ' ovary' + ((v.type || 'corpus luteum') === 'corpus luteum' ? ' with peripheral vascularity' : '') + ' (physiological).', i: () => null },
    { id: 'notvis', l: 'Ovary not visualised', fs: [SIDE, F('why', 'Reason', 'sel', ['not visualised (?atrophic, post-menopausal)', 'obscured by bowel gas', 'post-oophorectomy status'])],
      t: v => (v.side === 'Bilateral' ? 'Both ovaries are' : cap(lc(v.side || 'Right')) + ' ovary is') + ' ' + (v.why || 'not visualised (?atrophic, post-menopausal)') + '.', i: () => null },
  ],
};
// Ovary findings are side-scoped for the "normal" clause
OVARIES.fd.forEach(f => { if (!('x' in f)) f.x = []; if (!f.x.length) f.at = 'norm'; f.side = true; });

const MISC = {
  id: 'misc', name: 'Free fluid / peritoneum', lab: null,
  meas: [],
  cl: [{ k: 'ff', t: () => 'No free fluid is noted in abdomen or pelvis.' }],
  fd: [
    { id: 'ascites', l: 'Ascites', x: ['ff'], fs: [F('g', 'Amount', 'sel', ['Minimal', 'Mild', 'Moderate', 'Gross']), F('type', 'Nature', 'sel', ['clear', 'with internal echoes', 'with septations'])],
      t: v => cap(lc(v.g || 'Mild')) + ' free fluid' + ((v.type || 'clear') === 'clear' ? '' : ' ' + v.type) + ' is noted in abdomen and pelvis.', i: v => cap(lc(v.g || 'Mild')) + ' ascites' + ((v.type || 'clear') === 'clear' ? '' : ' ' + v.type) + '.' },
    { id: 'podfluid', l: 'Minimal fluid in POD', x: ['ff'], fs: [], t: () => 'Minimal free fluid is noted in the pouch of Douglas (likely physiological).', i: () => null },
    { id: 'collection', l: 'Localised collection', rep: true, fs: [F('loc', 'Location', 'txt'), F('sz', 'Size', 'dims', 'cm')],
      t: v => 'A localised collection with internal echoes' + opt(dims(v.sz), ' measuring ', ' cm') + (vol(v.sz) ? ' (vol ~' + vol(v.sz) + ' cc)' : '') + ' is noted' + opt(v.loc, ' in the ') + '.', i: v => 'Localised collection' + opt(v.loc, ' in the ') + '.' },
    { id: 'pleural', l: 'Pleural effusion', fs: [SIDE, F('g', 'Amount', 'sel', ['Minimal', 'Mild', 'Moderate', 'Gross'])],
      t: v => cap(lc(v.g || 'Minimal')) + ' ' + sideAdj(v.side || 'Right') + ' pleural effusion is noted.', i: v => cap(lc(v.g || 'Minimal')) + ' ' + sideAdj(v.side || 'Right') + ' pleural effusion.' },
  ],
};

const RETRO = {
  id: 'retro', name: 'Para-aortic / nodes / aorta', lab: null,
  meas: [],
  cl: [{ k: 'ln', t: () => 'Para-aortic area is partially obscured. No obvious lymphadenopathy to the extent visualized.' }],
  fd: [
    { id: 'nodes', l: 'Lymphadenopathy', x: ['ln'], fs: [F('loc', 'Location', 'multi', ['para-aortic', 'aortocaval', 'mesenteric', 'peripancreatic', 'porta hepatis', 'iliac', 'inguinal']), F('sz', 'Largest (short axis)', 'num', 'cm'), F('feat', 'Nature', 'sel', ['', 'with preserved fatty hilum (reactive)', 'round, with loss of fatty hilum', 'conglomerate / matted', 'necrotic'])],
      t: v => 'Multiple enlarged ' + list(v.loc && v.loc.length ? v.loc : ['para-aortic']) + ' lymph nodes are noted' + opt(v.sz, ', largest measuring ', ' cm in short axis') + opt(v.feat, ' ') + '.', i: v => cap(list(v.loc && v.loc.length ? v.loc : ['para-aortic'])) + ' lymphadenopathy.' },
    { id: 'mesadenitis', l: 'Mesenteric lymphadenitis', fs: [F('sz', 'Largest', 'num', 'cm')], t: v => 'Multiple mildly enlarged mesenteric lymph nodes are noted in the right iliac fossa' + opt(v.sz, ', largest measuring ', ' cm') + '.', i: () => 'Mesenteric lymphadenitis.' },
    { id: 'aaa', l: 'Aortic aneurysm', fs: [F('d', 'Max diameter', 'num', 'cm'), F('loc', 'Level', 'sel', ['infrarenal', 'suprarenal', 'juxtarenal']), F('th', 'Mural thrombus', 'chk')],
      t: v => 'Fusiform dilatation of the ' + (v.loc || 'infrarenal') + ' abdominal aorta' + opt(v.d, ' measuring ', ' cm in maximum diameter') + (v.th ? ' with eccentric mural thrombus' : '') + ' is noted.', i: v => (v.loc ? cap(v.loc) : 'Infrarenal') + ' abdominal aortic aneurysm' + opt(v.d, ' (', ' cm)') + '.' },
  ],
};

const BOWEL = {
  id: 'bowel', name: 'Bowel / appendix / hernia', lab: null,
  meas: [], cl: [],
  fd: [
    { id: 'appx', l: 'Acute appendicitis', fs: [F('d', 'Appendix diameter', 'num', 'mm'), F('feat', 'Features', 'multi', ['non-compressible', 'appendicolith', 'increased mural vascularity', 'inflamed periappendiceal fat', 'periappendiceal fluid / collection', 'local tenderness'])],
      t: v => 'Appendix is seen in the right iliac fossa, dilated' + opt(v.d, ' (', ' mm)') + (v.feat && v.feat.length ? ', ' + list(v.feat) : ', non-compressible') + '.', i: v => 'Features suggestive of acute appendicitis' + (v.feat && v.feat.includes('periappendiceal fluid / collection') ? ' with periappendiceal collection' : '') + '.' },
    { id: 'appxnorm', l: 'Appendix visualised – normal', fs: [F('d', 'Diameter', 'num', 'mm')], t: v => 'Appendix is visualised and appears normal' + opt(v.d, ' (', ' mm)') + ', compressible.', i: () => null },
    { id: 'bwt', l: 'Bowel wall thickening', rep: true, fs: [F('seg', 'Segment', 'txt'), F('wt', 'Wall thickness', 'num', 'mm')], t: v => 'Circumferential wall thickening' + opt(v.wt, ' (', ' mm)') + ' is noted involving the ' + (v.seg || '___') + '.', i: v => 'Bowel wall thickening' + opt(v.seg, ' involving ') + ' – further evaluation with CECT suggested.' },
    { id: 'intuss', l: 'Intussusception', fs: [F('loc', 'Location', 'txt')], t: v => 'A target / pseudokidney appearance is noted' + opt(v.loc, ' in the ') + ' – intussusception.', i: () => 'Intussusception.' },
    { id: 'obstr', l: 'Dilated bowel loops', fs: [F('d', 'Max calibre', 'num', 'cm'), F('peri', 'Peristalsis', 'sel', ['increased (to-and-fro)', 'reduced'])], t: v => 'Dilated fluid-filled small bowel loops' + opt(v.d, ' (max ', ' cm)') + ' with ' + (v.peri || 'increased (to-and-fro)') + ' peristalsis are noted.', i: () => 'Dilated small bowel loops – ?obstruction; correlate clinically / CT.' },
    { id: 'hernia', l: 'Hernia', rep: true, fs: [F('type', 'Type', 'sel', ['umbilical', 'paraumbilical', 'epigastric', 'incisional', 'right inguinal', 'left inguinal', 'femoral']), F('neck', 'Defect size', 'num', 'cm'), F('cont', 'Contents', 'sel', ['omentum', 'bowel loops', 'omentum and bowel loops', 'fluid']), F('red', 'Reducibility', 'sel', ['reducible', 'non-reducible'])],
      t: v => 'A defect' + opt(v.neck, ' measuring ', ' cm') + ' is noted at the ' + (v.type || 'umbilical') + ' region with herniation of ' + (v.cont || 'omentum') + ', ' + (v.red || 'reducible') + ' on compression.', i: v => cap(v.type || 'umbilical') + ' hernia containing ' + (v.cont || 'omentum') + ' (' + (v.red || 'reducible') + ').' },
  ],
};

/* ======================================================================
 *  THYROID / NECK
 * ==================================================================== */
const TIRADS = {
  comp: [['cystic or almost completely cystic', 0], ['spongiform', 0], ['mixed cystic and solid', 1], ['solid or almost completely solid', 2]],
  echo: [['anechoic', 0], ['hyperechoic or isoechoic', 1], ['hypoechoic', 2], ['very hypoechoic', 3]],
  shape: [['wider-than-tall', 0], ['taller-than-wide', 3]],
  margin: [['smooth', 0], ['ill-defined', 0], ['lobulated or irregular', 2], ['extra-thyroidal extension', 3]],
  foci: [['large comet-tail artefacts', 0], ['macrocalcifications', 1], ['peripheral (rim) calcifications', 2], ['punctate echogenic foci', 3]],
};
const pts = (tab, val) => { const r = TIRADS[tab].find(x => x[0] === val); return r ? r[1] : 0; };
function tirads(v) {
  const p = pts('comp', v.comp) + pts('echo', v.echo) + pts('shape', v.shape) + pts('margin', v.margin) + (v.foci || []).reduce((a, f) => a + pts('foci', f), 0);
  const tr = p <= 1 ? 1 : p === 2 ? 2 : p === 3 ? 3 : p <= 6 ? 4 : 5;
  const d = maxDim(v.sz);
  const th = { 3: [2.5, 1.5], 4: [1.5, 1.0], 5: [1.0, 0.5] }[tr];
  let rec = tr <= 2 ? 'No FNA required' : '';
  if (th) rec = d == null ? 'FNA if ≥' + th[0] + ' cm; follow-up if ≥' + th[1] + ' cm' : d >= th[0] ? 'FNA recommended' : d >= th[1] ? 'Follow-up US recommended' : 'No FNA or follow-up required';
  const name = { 1: 'TR1 (benign)', 2: 'TR2 (not suspicious)', 3: 'TR3 (mildly suspicious)', 4: 'TR4 (moderately suspicious)', 5: 'TR5 (highly suspicious)' }[tr];
  return { p, tr, name, rec };
}
const lobeSec = (id, name, lab) => ({
  id, name, lab, meas: [F('d', 'AP x TR x CC', 'dims', 'cm')],
  cl: [{ k: 'd', t: m => 'Measures ' + (dims(m.d) || '__') + ' cm (AP x TR x CC)' + (vol(m.d) ? ', volume ~' + vol(m.d) + ' ml' : '') + '.' }], fd: [],
});
const THY_R = lobeSec('thyR', 'Right lobe', 'Right lobe');
const THY_L = lobeSec('thyL', 'Left lobe', 'Left lobe');
const THY_I = { id: 'thyI', name: 'Isthmus', lab: 'Isthmus', meas: [F('t', 'Thickness', 'num', 'mm')], cl: [{ k: 't', t: m => 'Measures ' + (has(m.t) ? m.t : '__') + ' mm.' }], fd: [] };
const THYROID = {
  id: 'thy', name: 'Thyroid parenchyma & nodules', lab: null, meas: [],
  cl: [
    { k: 'diff', t: () => 'Both lobes of thyroid and isthmus appear normal in size, shape, echo-texture and vascularity.' },
    { k: 'focal', t: () => 'No evident focal lesion noted within the thyroid gland.' },
  ],
  impN: c => c.hasAny(['nodule', 'mng', 'cyst']) ? null : 'No evident focal lesion in thyroid gland.',
  fd: [
    { id: 'thyroiditis', l: 'Chronic thyroiditis (Hashimoto)', x: ['diff'], fs: [F('feat', 'Features', 'multi', ['diffusely enlarged', 'heterogeneous coarse echotexture', 'diffusely hypoechoic', 'micronodular / pseudonodular pattern', 'echogenic fibrous septae', 'increased vascularity', 'atrophic gland'])],
      t: v => 'Thyroid gland shows ' + list(v.feat && v.feat.length ? v.feat : ['heterogeneous coarse echotexture', 'diffusely hypoechoic', 'echogenic fibrous septae']) + '.', i: () => 'Features suggestive of Chronic thyroiditis.' },
    { id: 'graves', l: 'Graves / diffuse toxic goitre', x: ['diff'], fs: [], t: () => 'Thyroid gland is diffusely enlarged and hypoechoic with markedly increased vascularity ("thyroid inferno").', i: () => 'Diffuse thyroid enlargement with increased vascularity – ?Graves\' disease; correlate with thyroid function.' },
    { id: 'goitre', l: 'Diffuse goitre', x: ['diff'], fs: [], t: () => 'Both lobes and isthmus are diffusely enlarged with homogeneous echotexture.', i: () => 'Diffuse goitre.' },
    { id: 'subacute', l: 'Subacute (de Quervain) thyroiditis', x: ['diff'], fs: [SIDE], t: v => 'Ill-defined geographic hypoechoic areas with reduced vascularity are noted in the ' + (v.side === 'Bilateral' ? 'both lobes' : lc(v.side || 'Right') + ' lobe') + '.', i: () => 'Features may represent subacute (de Quervain) thyroiditis – correlate clinically.' },
    { id: 'nodule', l: 'Nodule (ACR TI-RADS)', rep: true, x: ['focal'],
      fs: [F('lobe', 'Lobe', 'sel', ['right lobe', 'left lobe', 'isthmus']), F('pole', 'Region', 'sel', ['', 'upper pole', 'mid pole', 'lower pole']), F('sz', 'Size', 'dims', 'cm'),
           F('comp', 'Composition', 'sel', TIRADS.comp.map(x => x[0]), { d: 'solid or almost completely solid' }),
           F('echo', 'Echogenicity', 'sel', TIRADS.echo.map(x => x[0]), { d: 'hyperechoic or isoechoic' }),
           F('shape', 'Shape', 'sel', TIRADS.shape.map(x => x[0])),
           F('margin', 'Margin', 'sel', TIRADS.margin.map(x => x[0])),
           F('foci', 'Echogenic foci', 'multi', TIRADS.foci.map(x => x[0])),
           F('halo', 'Halo', 'chk'), F('vasc', 'Vascularity', 'sel', ['', 'peripheral vascularity', 'internal vascularity', 'no vascularity'])],
      t: (v, m, c) => { const r = tirads(v);
        return (c.count('nodule') > 1 ? '\nNodule ' + c.n + ': a ' : 'A ') + (v.comp || 'solid or almost completely solid') + ', ' + (v.echo || 'hyperechoic or isoechoic') + ' nodule' + opt(dims(v.sz), ' measuring ', ' cm') +
          ' is noted in the ' + opt(v.pole, '', ' of the ') + (v.lobe || 'right lobe') + ', ' + (v.shape || 'wider-than-tall') + ' with ' + (v.margin || 'smooth') + ' margins' +
          (v.foci && v.foci.length ? ', showing ' + list(v.foci) : ' and no echogenic foci') + (v.halo ? ', with peripheral halo' : '') + opt(v.vasc, ' and ') + '. ACR TI-RADS: ' + r.p + ' points – ' + r.name + '.'; },
      i: (v, m, c) => { const r = tirads(v);
        return (c.count('nodule') === 1 && !c.has('mng') ? 'Solitary thyroid nodule' : 'Nodule ' + (c.count('nodule') > 1 ? c.n + ' ' : '')) + (c.count('nodule') === 1 && !c.has('mng') ? ' in ' : 'in ') + opt(v.pole, '', ' of ') + (v.lobe || 'right lobe') + opt(dims(v.sz), ' (', ' cm)') + ' – ACR TI-RADS ' + r.name + '; ' + r.rec + '.'; } },
    { id: 'mng', l: 'Multinodular goitre', x: ['diff'], fs: [], t: () => 'Both lobes of thyroid are enlarged with multiple nodules as described.', i: () => 'Multiple nodules in both lobes of thyroid as described above - Multi nodular goitre.' },
    { id: 'cyst', l: 'Colloid cyst', rep: true, x: ['focal'], fs: [F('lobe', 'Lobe', 'sel', ['right lobe', 'left lobe', 'isthmus']), F('sz', 'Size', 'dims', 'cm')],
      t: v => 'A small anechoic cyst with echogenic foci showing comet-tail artefacts' + opt(dims(v.sz), ' measuring ', ' cm') + ' is noted in the ' + (v.lobe || 'right lobe') + ' – colloid cyst (TR1).', i: v => 'Colloid cyst in ' + (v.lobe || 'right lobe') + ' (TI-RADS TR1).' },
    { id: 'postthy', l: 'Post-thyroidectomy', x: ['diff', 'focal'], fs: [F('ext', 'Extent', 'sel', ['total thyroidectomy', 'right hemithyroidectomy', 'left hemithyroidectomy'])],
      t: v => 'Post ' + (v.ext || 'total thyroidectomy') + ' status. ' + ((v.ext || 'total').startsWith('total') ? 'No residual / recurrent thyroid tissue seen in the thyroid bed.' : 'Remaining lobe appears normal.'), i: v => 'Post ' + (v.ext || 'total thyroidectomy') + ' status.' },
  ],
};
const SALIVARY = {
  id: 'sal', name: 'Submandibular glands', lab: null, meas: [],
  cl: [{ k: 'n', t: () => 'Bilateral submandibular glands appear normal sono-graphically.' }],
  fd: [
    { id: 'sialad', l: 'Sialadenitis', x: ['n'], fs: [SIDE], t: v => (v.side === 'Bilateral' ? 'Both submandibular glands appear' : cap(lc(v.side || 'Right')) + ' submandibular gland appears') + ' bulky and hypoechoic with increased vascularity.', i: v => sideAdj(v.side || 'Right').replace(/^./, c => c.toUpperCase()) + ' submandibular sialadenitis.' },
    { id: 'sialolith', l: 'Sialolithiasis', x: ['n'], fs: [SIDE2, F('sz', 'Size', 'num', 'mm'), F('duct', 'Dilated Wharton duct', 'chk')], t: v => 'A calculus' + opt(v.sz, ' measuring ', ' mm') + ' is noted in the ' + lc(v.side || 'Right') + ' submandibular gland / duct' + (v.duct ? ' with dilated Wharton\'s duct' : '') + '.', i: v => (v.side || 'Right') + ' submandibular sialolithiasis.' },
  ],
};
const NECKVESS = { id: 'nv', name: 'Neck vessels', lab: null, meas: [], cl: [{ k: 'n', t: () => 'Major vessels of the neck are within normal limits.' }],
  fd: [{ id: 'ijvt', l: 'IJV thrombosis', x: ['n'], fs: [SIDE2], t: v => 'Echogenic thrombus is noted in the ' + lc(v.side || 'Right') + ' internal jugular vein.', i: v => (v.side || 'Right') + ' IJV thrombosis.' }] };
const NECKLN = {
  id: 'ln', name: 'Cervical lymph nodes', lab: null, meas: [],
  cl: [{ k: 'n', t: () => 'No evidence of any cervical lymphadenopathy noted bilaterally' }],
  impN: () => 'No significant cervical lymphadenopathy.',
  fd: [
    { id: 'reactive', l: 'Reactive nodes', x: ['n'], fs: [SIDE, F('lvl', 'Levels', 'txt'), F('sz', 'Largest (short axis)', 'num', 'cm')],
      t: v => 'Few ' + sideAdj(v.side || 'Bilateral') + ' level ' + (v.lvl || 'II') + ' cervical lymph nodes are noted with preserved fatty hilum' + opt(v.sz, ', largest measuring ', ' cm in short axis') + '.', i: () => 'Few reactive-appearing cervical lymph nodes.' },
    { id: 'suspnode', l: 'Suspicious nodes', rep: true, x: ['n'], fs: [SIDE, F('lvl', 'Level', 'txt'), F('sz', 'Size', 'dims', 'cm'), F('feat', 'Features', 'multi', ['round shape', 'loss of fatty hilum', 'microcalcifications', 'cystic change', 'necrosis', 'peripheral / chaotic vascularity', 'matting'])],
      t: v => 'Enlarged ' + sideAdj(v.side || 'Right') + ' level ' + (v.lvl || 'II') + ' lymph node' + opt(dims(v.sz), ' measuring ', ' cm') + (v.feat && v.feat.length ? ' with ' + list(v.feat) : '') + ' is noted.', i: v => 'Suspicious ' + sideAdj(v.side || 'Right') + ' level ' + (v.lvl || 'II') + ' cervical lymphadenopathy – FNAC advised.' },
  ],
};

/* ======================================================================
 *  CAROTID / VERTEBRAL DOPPLER
 * ==================================================================== */
const VESSELS = ['CCA', 'Vertebral', 'ICA', 'ECA'];
// SRU 2003 consensus (Grant et al., Radiology 2003) — ICA stenosis by PSV (primary) with EDV / ratio as supporting parameters
function sruGrade(psv, edv, ratio, plaque) {
  if (!has(psv)) return null;
  psv = +psv;
  if (psv > 230) return { g: '≥70% (short of near-occlusion)', sig: true };
  if (psv >= 125) return { g: '50–69%', sig: true };
  return plaque ? { g: '<50%', sig: false } : { g: 'normal (no stenosis)', sig: false };
}
const CAR_IMT = {
  id: 'imt', name: 'Intima-media thickness', lab: null,
  meas: [F('r', 'Right CCA IMT', 'num', 'mm'), F('l', 'Left CCA IMT', 'num', 'mm')],
  cl: [
    { k: 'imt', t: m => { const r = has(m.r) && +m.r > 0.9, l = has(m.l) && +m.l > 0.9;
      return 'B Mode gray scale examinations showed the carotid vessels to have ' + (r && l ? 'increased intimal thickness bilaterally.' : r ? 'increased intimal thickness on the right side and normal intimal thickness on the left side.' : l ? 'increased intimal thickness on the left side and normal intimal thickness on the right side.' : 'normal intimal thickness bilaterally.'); } },
    { k: 'val', t: m => '\nCCA IMT : Right - ' + (has(m.r) ? m.r + ' mm' : '__') + '   Left - ' + (has(m.l) ? m.l + ' mm' : '__') },
  ],
  auto: m => { const r = has(m.r) && +m.r > 0.9, l = has(m.l) && +m.l > 0.9;
    return r && l ? [{ i: 'Bilateral raised CCA IMT suggestive of atherosclerotic changes on both sides.' }] : r || l ? [{ i: (r ? 'Right' : 'Left') + ' raised CCA IMT suggestive of atherosclerotic changes.' }] : []; },
  fd: [],
};
const CAR_LUMEN = {
  id: 'lumen', name: 'Plaques / lumen', lab: null, meas: [],
  cl: [
    { k: 'fill', t: (m, c) => c.hasAny(['plaque', 'thrombus', 'dissection']) ? 'Color Doppler shows normal filling up of the lumen of vessels except as described below.' : 'Color Doppler shows normal filling up of the lumen of vessels.' },
  ],
  fd: [
    { id: 'plaque', l: 'Plaque', rep: true,
      fs: [SIDE2, F('loc', 'Location', 'sel', ['carotid bulb', 'proximal ICA', 'CCA', 'ECA origin', 'bulb extending into ICA']), F('comp', 'Echogenicity', 'sel', ['calcified', 'echogenic (fibrous)', 'mixed / heterogeneous', 'hypoechoic (soft)']),
           F('surf', 'Surface', 'sel', ['smooth', 'irregular', 'ulcerated']), F('th', 'Thickness', 'num', 'mm'), F('len', 'Length', 'num', 'mm'), F('pct', 'Diameter narrowing', 'num', '%')],
      t: v => 'A ' + (v.comp || 'calcified') + ' plaque with ' + (v.surf || 'smooth') + ' surface' + (has(v.th) || has(v.len) ? ' measuring ' + [opt(v.th, '', ' mm (thickness)'), opt(v.len, '', ' mm (length)')].filter(Boolean).join(' x ') : '') + ' is noted in the ' + lc(v.side || 'Right') + ' ' + (v.loc || 'carotid bulb') + opt(v.pct, ', causing ~', '% luminal narrowing') + '.',
      i: v => cap(v.comp || 'calcified') + ' plaque in ' + lc(v.side || 'Right') + ' ' + (v.loc || 'carotid bulb') + ((v.surf || 'smooth') !== 'smooth' ? ' with ' + v.surf + ' surface' : '') + '.' },
    { id: 'thrombus', l: 'Intraluminal thrombus', fs: [SIDE2, F('v', 'Vessel', 'sel', ['CCA', 'ICA', 'ECA'])], t: v => 'Intraluminal echogenic thrombus is noted in the ' + lc(v.side || 'Right') + ' ' + (v.v || 'ICA') + '.', i: v => (v.side || 'Right') + ' ' + (v.v || 'ICA') + ' thrombus.' },
    { id: 'dissection', l: 'Dissection', fs: [SIDE2, F('v', 'Vessel', 'sel', ['CCA', 'ICA', 'vertebral'])], t: v => 'An intimal flap with true and false lumen is noted in the ' + lc(v.side || 'Right') + ' ' + (v.v || 'ICA') + '.', i: v => (v.side || 'Right') + ' ' + (v.v || 'ICA') + ' dissection – CTA / MRA recommended.' },
  ],
};
const CAR_DOP = {
  id: 'dop', name: 'Spectral Doppler (PSV / EDV)', lab: null,
  meas: [F('vt', 'Velocities (cm/s)', 'vtab')],
  cl: [
    { k: 'nost', t: () => 'No evidence of thrombus or flow limiting stenosis seen.' },
    { k: 'spec', t: () => 'On duplex Doppler ultrasonography, normal arterial spectral pattern was seen in the bilateral common carotid, bilateral external carotid arteries and the bilateral internal carotid arteries with normal peak systolic velocities.' },
  ],
  auto: (m, c) => {
    const out = [], sig = [];
    for (const sd of ['R', 'L']) {
      if (c.all.hasSide('occl', sd) || c.all.hasSide('nearoccl', sd)) continue;
      const psv = m['vt_' + sd + '_ICA_ps'], edv = m['vt_' + sd + '_ICA_ed'], cca = m['vt_' + sd + '_CCA_ps'];
      const ratio = has(psv) && has(cca) && +cca > 0 ? +(psv / cca).toFixed(1) : null;
      const g = sruGrade(psv, edv, ratio, c.all.hasSide('plaque', sd));
      if (!g || g.g.startsWith('normal')) continue;
      const side = S[sd];
      out.push({ t: 'The ' + lc(side) + ' ICA shows PSV of ' + psv + ' cm/s' + opt(edv, ', EDV ', ' cm/s') + (ratio ? ', ICA/CCA PSV ratio ' + ratio : '') + (g.sig ? ' with post-stenotic spectral broadening' : '') + ' – consistent with ' + g.g + ' stenosis (SRU consensus criteria).',
        i: side + ' ICA ' + g.g + ' stenosis.', sig: g.sig });
      if (g.sig) sig.push(sd);
    }
    if (sig.length) out.forEach(o => { o.x = ['nost', 'spec']; });
    if (sig.length && sig.length < 2) out.push({ x: ['spec'], t: 'Normal arterial spectral pattern is seen in the remaining vessels.' });
    return out;
  },
  impN: c => c.hasAny(['occl', 'nearoccl', 'ccaSten']) || c.autoSig ? null : 'No evident flow limiting stenosis involving major neck arteries.',
  fd: [
    { id: 'nearoccl', l: 'ICA near-occlusion (string sign)', x: ['nost', 'spec'], side: true, fs: [SIDE2], t: v => 'The ' + lc(v.side || 'Right') + ' ICA shows a markedly narrowed lumen with trickle flow (string sign) – near-occlusion.', i: v => (v.side || 'Right') + ' ICA near-occlusion.' },
    { id: 'occl', l: 'ICA occlusion', x: ['nost', 'spec'], side: true, fs: [SIDE2], t: v => 'No colour or spectral flow is seen in the ' + lc(v.side || 'Right') + ' ICA, which is filled with echogenic material; the ipsilateral CCA shows a high-resistance waveform.', i: v => (v.side || 'Right') + ' ICA total occlusion.' },
    { id: 'ccaSten', l: 'CCA / ECA stenosis', x: ['nost', 'spec'], fs: [SIDE2, F('v', 'Vessel', 'sel', ['CCA', 'ECA']), F('psv', 'PSV', 'num', 'cm/s'), F('pct', 'Estimated narrowing', 'num', '%')],
      t: v => 'The ' + lc(v.side || 'Right') + ' ' + (v.v || 'CCA') + ' shows focal narrowing' + opt(v.pct, ' (~', '%)') + ' with elevated PSV' + opt(v.psv, ' of ', ' cm/s') + ' and post-stenotic turbulence.', i: v => (v.side || 'Right') + ' ' + (v.v || 'CCA') + ' stenosis' + opt(v.pct, ' (~', '%)') + '.' },
  ],
};
const CAR_VERT = {
  id: 'vert', name: 'Vertebral arteries', lab: null, meas: [],
  cl: [{ k: 'n', t: (m, c) => { const s = c.sides(); return !s.R && !s.L ? 'Bilateral vertebral arteries show normal cranial flow.' : !s.R ? 'Right vertebral artery shows normal cranial flow.' : !s.L ? 'Left vertebral artery shows normal cranial flow.' : ''; } }],
  impN: c => { const s = c.sides(); return !s.R && !s.L ? 'Both vertebral arteries show cranial flow.' : !s.R ? 'Right vertebral artery shows cranial flow.' : !s.L ? 'Left vertebral artery shows cranial flow.' : null; },
  fd: [
    { id: 'steal', at: 'n', l: 'Reversed / to-and-fro flow (subclavian steal)', side: true, x: [], fs: [SIDE2, F('type', 'Pattern', 'sel', ['complete reversal (caudal flow)', 'partial (bidirectional / to-and-fro) flow', 'systolic deceleration (pre-steal)'])],
      t: v => 'The ' + lc(v.side || 'Left') + ' vertebral artery shows ' + (v.type || 'complete reversal (caudal flow)') + '.', i: v => (v.side || 'Left') + ' vertebral artery ' + (v.type || 'complete reversal (caudal flow)') + ' – suggestive of ' + lc(v.side || 'Left') + ' subclavian steal; evaluate subclavian artery.' },
    { id: 'vabsent', at: 'n', l: 'No flow / not visualised', side: true, x: [], fs: [SIDE2], t: v => 'No flow is demonstrated in the ' + lc(v.side || 'Right') + ' vertebral artery.', i: v => (v.side || 'Right') + ' vertebral artery – no flow (?occlusion); CTA / MRA suggested.' },
    { id: 'vhypo', at: 'n', l: 'Hypoplastic', side: true, x: [], fs: [SIDE2, F('d', 'Diameter', 'num', 'mm')], t: v => 'The ' + lc(v.side || 'Right') + ' vertebral artery is hypoplastic' + opt(v.d, ' (', ' mm)') + ' with cranial flow.', i: v => 'Hypoplastic ' + lc(v.side || 'Right') + ' vertebral artery with cranial flow.' },
    { id: 'vhr', at: 'n', l: 'High-resistance flow', side: true, x: [], fs: [SIDE2], t: v => 'The ' + lc(v.side || 'Right') + ' vertebral artery shows cranial flow with high-resistance waveform (?distal stenosis).', i: v => (v.side || 'Right') + ' vertebral high-resistance flow – ?distal stenosis.' },
  ],
};

/* ======================================================================
 *  TEMPLATES
 * ==================================================================== */
const SECTIONS = {};
[LIVER, PORTA, GB, PANCREAS, SPLEEN, kidneySide('R'), kidneySide('L'), BLADDER, UTERUS, OVARIES, PROSTATE, MISC, RETRO, BOWEL,
 THY_R, THY_L, THY_I, THYROID, SALIVARY, NECKVESS, NECKLN, CAR_IMT, CAR_LUMEN, CAR_DOP, CAR_VERT].forEach(s => { SECTIONS[s.id] = s; });

const TEMPLATES = [
  { id: 'abd', title: 'Abdomen & Pelvis', heading: 'USG ABDOMEN AND PELVIS', icon: '◐',
    secs: ['liver', 'porta', 'gb', 'pancreas', 'spleen', 'kidR', 'kidL', 'ub', 'uterus', 'ovaries', 'prostate', 'misc', 'retro', 'bowel'],
    normalImp: 'No sonologically significant abnormality detected at present study.' },
  { id: 'kub', title: 'KUB', heading: 'USG KUB', icon: '◑',
    secs: ['kidR', 'kidL', 'ub', 'uterus', 'ovaries', 'prostate'],
    normalImp: 'No sonologically significant abnormality detected at present study.' },
  { id: 'pelvis', title: 'Pelvis', heading: 'USG PELVIS', icon: '◒',
    secs: ['ub', 'uterus', 'ovaries', 'prostate', 'misc'],
    normalImp: 'No sonologically significant abnormality detected at present study.' },
  { id: 'thyroid', title: 'Thyroid / Neck', heading: 'USG THYROID / NECK', icon: '◓',
    secs: ['thyR', 'thyL', 'thyI', 'thy', 'sal', 'nv', 'ln'], normalImp: '' },
  { id: 'carotid', title: 'Carotid–Vertebral Doppler', heading: 'ULTRASOUND CAROTID VERTEBRAL DOPPLER', icon: '≋',
    secs: ['imt', 'lumen', 'dop', 'vert'], normalImp: '' },
];

const DEFAULT_MACHINES = ['GE Logic S7', 'Mindray Resona I9'];

if (typeof module !== 'undefined') module.exports = { SECTIONS, TEMPLATES, tirads, sruGrade, vol, VESSELS };
