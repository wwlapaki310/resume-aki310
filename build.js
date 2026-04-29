#!/usr/bin/env node
/**
 * Resume Builder
 *
 * Usage:
 *   node build.js                          # 'general' profile, HTML only
 *   node build.js --profile=google         # Google profile, HTML only
 *   node build.js --profile=general --pdf  # HTML + PDF (needs: npm install --include=dev)
 *
 * npm scripts (see package.json):
 *   npm run build          # general + google, HTML only
 *   npm run build:pdf      # general + google, HTML + PDF
 */

const fs   = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// ─── Args ─────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const profileArg  = args.find(a => a.startsWith('--profile='));
const withPdf     = args.includes('--pdf');
const profileName = profileArg ? profileArg.split('=')[1] : 'general';

// ─── Load data ─────────────────────────────────────────────────────────────
const base        = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/base.json'), 'utf8'));
const profilePath = path.join(__dirname, `data/profiles/${profileName}.json`);
if (!fs.existsSync(profilePath)) {
  console.error(`❌  Profile not found: data/profiles/${profileName}.json`);
  process.exit(1);
}
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

// ─── Deep merge (profile wins over base) ──────────────────────────────────
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}
const data = deepMerge(base, profile);

// ─── Utilities ─────────────────────────────────────────────────────────────
function boldify(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,     '<em>$1</em>');
}
function formatDate(dateStr) {
  if (!dateStr) return 'Present';
  const [year, month] = dateStr.split('-');
  if (!month) return year;
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${m[parseInt(month, 10) - 1]} ${year}`;
}

// ─── Filter highlights by tags ─────────────────────────────────────────────
if (profile.meta?.highlight_tags) {
  const allowed  = new Set(profile.meta.highlight_tags);
  const filterHl = hl => !hl.tags || hl.tags.length === 0 || hl.tags.some(t => allowed.has(t));
  data.work = data.work.map(job => ({
    ...job,
    groups:     (job.groups || []).map(g => ({ ...g, highlights: (g.highlights || []).filter(filterHl) }))
                                  .filter(g => g.highlights.length > 0),
    highlights: (job.highlights || []).filter(filterHl)
  }));
}

// ─── Pre-compute template fields ───────────────────────────────────────────
data.basics.github_handle = data.basics.github.replace('https://github.com/', '');
data.skills = data.skills.map(s => ({ ...s, keywords_joined: s.keywords.join(', ') }));
data.work   = data.work.map(job => ({
  ...job,
  startDate_fmt: formatDate(job.startDate),
  endDate_fmt:   job.endDate ? formatDate(job.endDate) : 'Present',
  groups:     (job.groups || []).map(g => ({
    ...g,
    highlights: (g.highlights || []).map(h => ({ ...h, text_bold: boldify(h.text) }))
  })),
  highlights: (job.highlights || []).map(h => ({ ...h, text_bold: boldify(h.text) }))
}));

const summaryKey = data.meta?.summary_key || 'general';
const rawSummary = (data.summaries || {})[summaryKey];
if (Array.isArray(rawSummary)) {
  data._summaryIsArray = true;
  data._summaryItems   = rawSummary.map(boldify);
} else {
  data._summaryIsArray = false;
  data._summaryText    = boldify(rawSummary || '');
}
data._density     = data.meta?.density || 'normal';
data._profileName = profileName;

// ─── Handlebars helpers ────────────────────────────────────────────────────
Handlebars.registerHelper('ifIn', function (arr, item, options) {
  return (Array.isArray(arr) && arr.includes(item)) ? options.fn(this) : options.inverse(this);
});
Handlebars.registerHelper('eq', (a, b) => a === b);

// ─── Render ────────────────────────────────────────────────────────────────
const src     = fs.readFileSync(path.join(__dirname, 'template/resume.hbs'), 'utf8');
const html    = Handlebars.compile(src)(data);
const outDir  = path.join(__dirname, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const htmlOut = path.join(outDir, `resume-${profileName}.html`);
fs.writeFileSync(htmlOut, html);
console.log(`✅  HTML → ${htmlOut}`);

// ─── Optional PDF via Puppeteer ───────────────────────────────────────────
if (withPdf) {
  (async () => {
    const puppeteer = require('puppeteer');
    const browser   = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page      = await browser.newPage();
    await page.goto(`file://${htmlOut}`, { waitUntil: 'networkidle0' });
    const pdfOut = path.join(outDir, `resume-${profileName}.pdf`);
    await page.pdf({
      path:            pdfOut,
      format:          'A4',
      margin:          { top: '5mm', bottom: '5mm', left: '8mm', right: '8mm' },
      printBackground: false,
    });
    await browser.close();
    console.log(`✅  PDF  → ${pdfOut}`);
  })();
}
