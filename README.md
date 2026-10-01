# 席卡生成器（纯前端版）

输入姓名 → 在浏览器里直接生成 A4 对折席卡 PDF，一页一人，可直接打印。
**全部计算在浏览器本地完成**（pdf-lib + 本地字体），没有后端、不上传任何数据，因此可以直接托管在 **Cloudflare Pages** 上。

## 特性

- 字号按**字体真实度量**自适应：中文 2 字/3 字、4 字以上、英文名（`John LI`）、超长英文名（`Christopher Robinson` 自动折两行）都通用，**无需手工微调**
- 版式与原 PPT 模板一致：上半名字**倒置**、下半正立，沿 A4 **水平中线**对折后两面都是正立的同一个名字
- 三种内置字体：黑体（默认）、华文新魏、华文中宋（已做子集化，2–3.6 MB，按需加载并缓存）
- 支持批量：一行一个名字，一次生成多页 PDF，可预览 / 直接打印 / 下载

## 目录结构

```
xika-web/
├─ index.html            界面（输入、字体选择、预览、打印）
├─ core.js               排版核心（字号自适应 + 对折几何），浏览器与 Node 共用
├─ vendor/
│  ├─ pdf-lib.min.js     PDF 生成库（UMD，离线内置）
│  └─ fontkit.umd.min.js 字体解析（pdf-lib 解析 TTF 必需）
├─ fonts/
│  ├─ SimHei.ttf         黑体（子集：ASCII + GB2312 全字集 + 常用标点）
│  ├─ STXinwei.ttf       华文新魏
│  └─ STZhongson.ttf     华文中宋
├─ _headers              Cloudflare Pages 缓存策略（字体 1 年 immutable）
├─ test_node.js          本地自测：Node 下跑同一份 core.js 生成 PDF
└─ test_subset.js        字体子集/嵌入方式的对照实验脚本
```

## 本地预览

必须用 HTTP 打开（`file://` 下浏览器会拦截字体 fetch）：

```bash
cd xika-web
python -m http.server 8080
# 打开 http://127.0.0.1:8080
```

自测（Node 直接跑核心逻辑并生成一份 PDF）：

```bash
node test_node.js        # 输出各姓名的折行方式与字号，写出 ../_web_test.pdf
```

## 部署到 Cloudflare Pages（走 GitHub）

### 1. 推到 GitHub

```bash
cd xika-web
git init
git add .
git commit -m "feat: 席卡生成器（纯前端 PDF）"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 字体子集 2–3.6 MB、vendor 约 1.2 MB，都在 GitHub 单文件限制（100 MB）内，**不需要 Git LFS**。

### 2. 在 Cloudflare 连接仓库

1. 登录 <https://dash.cloudflare.com> → 左侧 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 授权 GitHub，选中上一步的仓库
3. 构建设置（这是纯静态站，**不需要构建**）：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`/`（index.html 在仓库根目录）
4. **Save and Deploy**，一两分钟后拿到 `https://<项目名>.pages.dev`

以后每次 `git push` 到 `main` 都会自动重新部署。

### 3. （可选）绑定自己的域名

Pages 项目 → **Custom domains** → **Set up a custom domain** → 输入域名（该域名需已托管在同一个 Cloudflare 账号下），按提示加 CNAME 即可，证书自动签发。

### 备选：不用 GitHub，直接命令行发布

```bash
cd xika-web
npx wrangler pages deploy . --project-name=xika
```

## 为什么不做成 Python 后端？

Cloudflare Pages 只能托管静态资源 + JS（Workers 运行时里装不了 reportlab 和系统字体）。
所以这里把 PDF 生成搬到浏览器完成 —— 好处是零服务器成本、无冷启动、名字等隐私数据不出浏览器。

## 实现要点（改代码时注意）

- **字体不能再做二次子集化**：字体已经用 `pyftsubset` 裁过，`embedFont(bytes, { subset: false })` 必须是 `false`。
  若改成 `true` 会触发二次子集化，字形整体丢失，PDF 打开是**空白**（文本可选中但看不见）。
- 字号算法：`size = min(166, (版心宽 / 单pt字宽) * 0.98)`，另加高度约束；单行算出来 `< 74pt` 且名字含空格时折两行。
- 对折几何：下半文字块顶边距中线 16.5 mm；上半绕块中心旋转 180°，旋转后块底距中线 13.3 mm。
- 换字体/加字体：把 TTF 放进 `fonts/`，在 `index.html` 的 `FONTS` 里加一项；字体建议先子集化（见下）。

## 字体子集化（新增字体时）

```bash
python -m fontTools.subset C:/Windows/Fonts/simhei.ttf \
  --text-file=chars.txt --output-file=fonts/SimHei.ttf \
  --layout-features= --no-hinting --desubroutinize --drop-tables+=DSIG
```

`chars.txt` 里放需要保留的字符（本项目用的是：ASCII + GB2312 全字集 + 常用中文标点 + 实际名单用字）。

## 打印与折叠

A4、缩放 100%（不要“适应页面”）、单面打印；打完沿页面水平中线对折立起来即可。
