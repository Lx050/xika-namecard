/* 席卡生成器核心：A4 对折席卡，一页一人。
 * 同一份代码在浏览器（window.PDFLib / window.fontkit）和 Node（require）下都能跑。
 * 字号按字体真实度量自适应：中文 2/3 字、英文名通用，超长英文名自动折两行。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XikaCore = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  const A4 = { w: 595.2756, h: 841.8898 };   // pt
  const MM = 72 / 25.4;

  const CFG = {
    maxPt: 166,          // 与模板一致的字号上限
    minPt: 30,
    sideMm: 12.7,        // 左右边距
    gapUpMm: 13.3,       // 上半名字块“底边”到折线的距离
    gapDownMm: 16.5,     // 下半名字块“顶边”到折线的距离
    bottomMm: 10,        // 半页底部安全留白
    lineGap: 0.12,       // 行距（相对字高）
    wrapBelowPt: 74,     // 单行算出的字号低于此值且含空格 → 折两行
    safety: 0.98,        // 宽度安全系数
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function normalize(names) {
    const out = [];
    for (const raw of String(names || '').split(/\r?\n/)) {
      const n = raw.split(/\s+/).filter(Boolean).join(' ');
      if (n) out.push(n);
    }
    return out;
  }

  /* ---- 度量与排版计算 ---- */
  function metrics(fontkit, fontBytes) {
    const fk = fontkit.create(fontBytes);
    const upm = fk.unitsPerEm || 1000;
    return { upm, asc: (fk.ascent || 0.88 * upm) / upm, desc: Math.abs(fk.descent || 0.12 * upm) / upm };
  }

  function fitByWidth(font, text, cfg) {
    const avail = A4.w - 2 * cfg.sideMm * MM;
    const w100 = font.widthOfTextAtSize(text, 100);
    if (!(w100 > 0)) return cfg.maxPt;
    return clamp(avail / (w100 / 100) * cfg.safety, cfg.minPt, cfg.maxPt);
  }

  function fitByHeight(m, nLines, cfg) {
    const availH = A4.h / 2 - cfg.gapDownMm * MM - cfg.bottomMm * MM;
    const perLine = availH / nLines / (1 + cfg.lineGap);
    return clamp(perLine / (m.asc + m.desc), cfg.minPt, cfg.maxPt);
  }

  function buildLines(font, m, name, cfg) {
    const one = Math.min(fitByWidth(font, name, cfg), fitByHeight(m, 1, cfg));
    const parts = name.split(' ').filter(Boolean);
    if (one >= cfg.wrapBelowPt || parts.length < 2) return { lines: [name], size: one };

    const lines = parts.length === 2
      ? parts
      : (() => { const c = Math.ceil(parts.length / 2); return [parts.slice(0, c).join(' '), parts.slice(c).join(' ')]; })();
    const two = Math.min(Math.min(...lines.map(l => fitByWidth(font, l, cfg))), fitByHeight(m, 2, cfg));
    return two > one ? { lines, size: two } : { lines: [name], size: one };
  }

  /* ---- 生成 PDF ---- */
  async function buildXikaPdf(opts) {
    const { PDFLib, fontkit, fontBytes, names } = opts;
    const cfg = Object.assign({}, CFG, opts.cfg || {});
    const list = Array.isArray(names) ? names : normalize(names);
    if (!list.length) throw new Error('请至少输入一个姓名');

    const pdfDoc = await PDFLib.PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    // 注意：字体已经用 pyftsubset 裁过，这里必须 subset:false。
    // 若再用 pdf-lib 的 subset:true 做二次子集化，字形会整体丢失 → PDF 里文字渲染成全空白。
    const font = await pdfDoc.embedFont(fontBytes, { subset: opts.subset === true });
    const m = metrics(fontkit, fontBytes);

    const mid = A4.h / 2;
    const info = [];

    for (const name of list) {
      const { lines, size } = buildLines(font, m, name, cfg);
      const page = pdfDoc.addPage([A4.w, A4.h]);
      const asc = m.asc * size, desc = m.desc * size;
      const lineH = (asc + desc) * (1 + cfg.lineGap);

      // 下半：正立，块顶距折线 gapDown
      const topDown = mid - cfg.gapDownMm * MM;
      let y = topDown - asc;
      for (const ln of lines) {
        const w = font.widthOfTextAtSize(ln, size);
        page.drawText(ln, { x: (A4.w - w) / 2, y, size, font, color: PDFLib.rgb(0, 0, 0) });
        y -= lineH;
      }

      // 上半：整体倒置（绕块中心 C 旋转 180°），旋转后块底距折线 gapUp
      const yTop = topDown - asc;                       // 正常排布下的第一行基线（用于算对称）
      const cy = mid + (cfg.gapUpMm - cfg.gapDownMm) * MM / 2;
      lines.forEach((ln, i) => {
        const w = font.widthOfTextAtSize(ln, size);
        const xi = (A4.w - w) / 2;                      // 正常排布下的 x
        const yi = yTop - i * lineH;                    // 正常排布下的 baseline
        page.drawText(ln, {
          x: A4.w - xi, y: 2 * cy - yi, size, font,
          color: PDFLib.rgb(0, 0, 0),
          rotate: PDFLib.degrees(180),
        });
      });

      info.push({ name, lines, size: Math.round(size * 10) / 10 });
    }

    const bytes = await pdfDoc.save();
    return { bytes, info };
  }

  return { buildXikaPdf, normalize, CFG, A4 };
}));
