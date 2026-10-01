// 对照实验：字体来源（子集/完整）× pdf-lib subset 开关，看哪种能正常渲染
const fs = require('fs');
const req = m => { const x = require(m); return x.default || x; };
const PDFLib = req('./vendor/pdf-lib.min.js');
const fontkit = req('./vendor/fontkit.umd.min.js');

async function gen(fontPath, subset, out) {
  const pdf = await PDFLib.PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const f = await pdf.embedFont(fs.readFileSync(fontPath), { subset });
  const p = pdf.addPage([595.2756, 841.8898]);
  p.drawText('兰小毅', { x: 60, y: 600, size: 120, font: f });
  fs.writeFileSync(out, await pdf.save());
  console.log('written', out, fs.statSync(out).size, 'bytes');
}

(async () => {
  await gen('./fonts/SimHei.ttf', true, '../_s_subset_true.pdf');
  await gen('./fonts/SimHei.ttf', false, '../_s_subset_false.pdf');
  await gen('C:/Windows/Fonts/simhei.ttf', true, '../_s_full_subset.pdf');
  await gen('C:/Windows/Fonts/simhei.ttf', false, '../_s_full_nosubset.pdf');
})().catch(e => { console.error(e); process.exit(1); });
