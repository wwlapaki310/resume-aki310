#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const args        = process.argv.slice(2);
const profileArg  = args.find(a => a.startsWith('--profile='));
const withPdf     = args.includes('--pdf');
const profileName = profileArg ? profileArg.split('=')[1] : 'general';

const base        = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/base.json'), 'utf8'));
const profilePath = path.join(__dirname, `data/profiles/${profileName}.json`);
if (!fs.existsSync(profilePath)) { console.error(`Profile not found: ${profilePath}`); process.exit(1); }
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key]))
      result[key] = deepMerge(target[key] || {}, source[key]);
    else if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}
const data = deepMerge(base, profile);

function boldify(text) {
  if (!text) return '';
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
}
function formatDate(d) {
  if (!d) return 'Present';
  const [y, m] = d.split('-');
  if (!m) return y;
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y}`;
}

if (profile.meta?.highlight_tags) {
  const allowed = new Set(profile.meta.highlight_tags);
  const flt = hl => !hl.tags || hl.tags.length === 0 || hl.tags.some(t => allowed.has(t));
  data.work = data.work.map(job => ({
    ...job,
    groups:     (job.groups||[]).map(g => ({...g, highlights:(g.highlights||[]).filter(flt)})).filter(g=>g.highlights.length),
    highlights: (job.highlights||[]).filter(flt)
  }));
}

data.basics.github_handle = data.basics.github.replace('https://github.com/','');
data.skills = data.skills.map(s => ({...s, keywords_joined: s.keywords.join(', ')}));
data.work = data.work.map(job => ({
  ...job,
  startDate_fmt: formatDate(job.startDate),
  endDate_fmt:   job.endDate ? formatDate(job.endDate) : 'Present',
  groups: (job.groups||[]).map(g => ({
    ...g,
    highlights: (g.highlights||[]).map(h => ({...h, text_bold: boldify(h.text), text_ja_bold: boldify(h.text_ja||h.text)}))
  })),
  highlights: (job.highlights||[]).map(h => ({...h, text_bold: boldify(h.text), text_ja_bold: boldify(h.text_ja||h.text)}))
}));

const key   = data.meta?.summary_key || 'general';
const rawEN = (data.summaries||{})[key];
const rawJA = (data.summaries||{})[key+'_ja'] || rawEN;

if (Array.isArray(rawEN)) {
  data._summaryIsArray  = true;
  data._summaryItems    = rawEN.map(boldify);
  data._summaryItems_ja = (Array.isArray(rawJA) ? rawJA : [rawJA]).map(boldify);
} else {
  data._summaryIsArray = false;
  data._summaryText    = boldify(rawEN||'');
  data._summaryText_ja = boldify(rawJA||'');
}
data._density     = data.meta?.density || 'normal';
data._profileName = profileName;

Handlebars.registerHelper('ifIn', function(arr, item, opts) {
  return (Array.isArray(arr) && arr.includes(item)) ? opts.fn(this) : opts.inverse(this);
});
Handlebars.registerHelper('eq', (a,b) => a===b);

const src    = fs.readFileSync(path.join(__dirname,'template/resume.hbs'),'utf8');
const html   = Handlebars.compile(src)(data);
const outDir = path.join(__dirname,'dist');
fs.mkdirSync(outDir,{recursive:true});
const htmlOut = path.join(outDir, `resume-${profileName}.html`);
fs.writeFileSync(htmlOut, html);
console.log(`HTML -> ${htmlOut}`);

if (withPdf) {
  (async()=>{
    const puppeteer = require('puppeteer');
    const browser   = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
    const page      = await browser.newPage();
    await page.goto(`file://${htmlOut}`,{waitUntil:'networkidle0'});
    const pdfOut = path.join(outDir, `resume-${profileName}.pdf`);
    await page.pdf({path:pdfOut, format:'A4', margin:{top:'5mm',bottom:'5mm',left:'8mm',right:'8mm'}, printBackground:false});
    await browser.close();
    console.log(`PDF  -> ${pdfOut}`);
  })();
}
