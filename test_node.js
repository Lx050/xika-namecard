// Node 下验证 core.js 的排版结果（与浏览器用同一份代码）
const fs = require('fs');
const req = m => { const x = require(m); return x.default || x; };
const PDFLib = req('./vendor/pdf-lib.min.js');
const fontkit = req('./vendor/fontkit.umd.min.js');
const Xika = require('./core.js');

(async () => {
  const fontBytes = fs.readFileSync('./fonts/SimHei.ttf');
  const names = ['兰小毅', '王业蕃', '常腾', '欧阳明月', 'John LI', 'William Liu', 'Christopher Robinson', '李'];
  const { bytes, info } = await Xika.buildXikaPdf({ PDFLib, fontkit, fontBytes, names });
  fs.writeFileSync('../_web_test.pdf', bytes);
  for (const i of info) {
    console.log(`${i.name.padEnd(22)} 排布=${i.lines.join(' / ').padEnd(24)} 字号=${i.size}pt`);
  }
  console.log('PDF 已写出: ../_web_test.pdf');
})().catch(e => { console.error('失败:', e); process.exit(1); });
