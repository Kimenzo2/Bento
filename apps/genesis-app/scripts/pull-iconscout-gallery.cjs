const fs = require('fs');
const https = require('https');
const CI = '19480773138592',
  CS = 'HPy7qWpoCg8LQ5E9q0bsklTAK3EMYV7d';
const OUT = 'C:/Users/admin/Downloads/Genesis/public/iconscout';
const CATS = [
  {
    name: 'wand-magic',
    query: 'magic wand',
    purpose: 'AI generation, creative actions',
    lucide: 'Wand2',
  },
  {
    name: 'sparkle-star',
    query: 'sparkle shine star',
    purpose: 'Highlights, featured items',
    lucide: 'Star',
  },
  {
    name: 'book-open',
    query: 'open book story',
    purpose: 'Library, stories, reading',
    lucide: 'BookOpen',
  },
  {
    name: 'rocket-launch',
    query: 'rocket launch',
    purpose: 'Quickstart cards, achievements',
    lucide: 'Rocket',
  },
  {
    name: 'crown-premium',
    query: 'crown premium',
    purpose: 'Pro tier, quality badges',
    lucide: 'Crown',
  },
  {
    name: 'pen-write',
    query: 'pen writing feather',
    purpose: 'Authoring, editing, create',
    lucide: 'PenTool',
  },
  {
    name: 'lightning-bolt',
    query: 'lightning bolt zap',
    purpose: 'Quick actions, new badges',
    lucide: 'Zap',
  },
  {
    name: 'check-success',
    query: 'checkmark circle done',
    purpose: 'Success, completion',
    lucide: 'Check',
  },
  {
    name: 'publish-send',
    query: 'send share upload',
    purpose: 'Publish, share buttons',
    lucide: 'Send',
  },
  {
    name: 'library-books',
    query: 'library shelf archive',
    purpose: 'My Library header',
    lucide: 'Library',
  },
  {
    name: 'building-brand',
    query: 'building office brand',
    purpose: 'Brand Story quickstart',
    lucide: 'Building2',
  },
  {
    name: 'award-trophy',
    query: 'award trophy medal',
    purpose: 'Achievements, success moments',
    lucide: 'Award',
  },
  {
    name: 'art-palette',
    query: 'paint palette art',
    purpose: 'Art styles, Visual Studio',
    lucide: 'Palette',
  },
  {
    name: 'notification',
    query: 'bell notification',
    purpose: 'Notification center',
    lucide: 'Bell',
  },
  {
    name: 'story-chapter',
    query: 'scroll manuscript book',
    purpose: 'Story types, chapters',
    lucide: 'FileText',
  },
];

function get(url) {
  return new Promise((res, rej) => {
    https
      .get(
        url,
        { headers: { 'Client-ID': CI, 'Client-Secret': CS, 'User-Agent': 'genesis/1' } },
        (r) => {
          const c = [];
          r.on('data', (d) => c.push(d));
          r.on('end', () => res({ s: r.statusCode, b: Buffer.concat(c).toString() }));
        }
      )
      .on('error', rej);
  });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const all = [];
  let total = 0;
  for (const cat of CATS) {
    process.stdout.write('[' + cat.name + '] ... ');
    try {
      const r = await get(
        'https://api.iconscout.com/v3/search?query=' +
          encodeURIComponent(cat.query) +
          '&product_type=icon&per_page=60&formats[]=svg&sort=relevant'
      );
      if (r.s !== 200) throw new Error('HTTP ' + r.s);
      const items = JSON.parse(r.b).response.items.data || [];
      console.log(items.length + ' icons');
      total += items.length;
      all.push({ ...cat, items });
    } catch (e) {
      console.log('ERR:' + e.message);
      all.push({ ...cat, items: [] });
    }
    await sleep(300);
  }
  const sections = all
    .map((cat) => {
      const cards = cat.items
        .map((item, i) => {
          const thumb =
            (item.urls && (item.urls.png_256 || item.urls.png_128 || item.urls.png_64)) || '';
          const price = item.price === 0 ? 'FREE' : item.price ? '$' + item.price : '?';
          const free = item.price === 0;
          return (
            '<div class="card ' +
            (free ? 'free' : 'paid') +
            '" onclick="pick(\'' +
            item.name.replace(/'/g, '') +
            "','" +
            item.uuid +
            '\')">' +
            '<div class="n">' +
            (i + 1) +
            '</div>' +
            (thumb ? '<img src="' + thumb + '" loading="lazy">' : "<div class='ni'>?</div>") +
            '<div class="nm">' +
            item.name.slice(0, 26) +
            '</div>' +
            '<div class="pr ' +
            (free ? 'f' : 'p') +
            '">' +
            price +
            '</div></div>'
          );
        })
        .join('');
      return (
        "<section><div class='ch'><b>" +
        cat.name +
        '</b> &nbsp; <code>' +
        cat.lucide +
        '</code> &nbsp; <span>' +
        cat.purpose +
        '</span> &nbsp; <em>' +
        cat.items.length +
        " icons</em></div><div class='grid'>" +
        cards +
        '</div></section>'
      );
    })
    .join('\n');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Genesis Icon Gallery - ${total} Icons</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0c0c0f;color:#ddd}header{padding:28px 36px 20px;background:#111;border-bottom:1px solid #222}h1{font-size:24px;color:#fff;margin-bottom:6px}.sub{color:#666;font-size:12px}#sb{position:sticky;top:0;z-index:100;background:#111;border-bottom:1px solid #1a1a1a;padding:10px 36px;display:flex;gap:10px;align-items:center}#sb input{background:#1a1a22;border:1px solid #2a2a2a;color:#fff;border-radius:6px;padding:6px 11px;font-size:13px;width:260px;outline:none}#sb input:focus{border-color:#7c3aed}main{padding:36px}section{margin-bottom:52px}.ch{background:#141418;border:1px solid #222;border-left:3px solid #7c3aed;border-radius:6px;padding:11px 16px;margin-bottom:14px;font-size:13px;color:#aaa}.ch b{color:#fff;font-size:15px}.ch code{background:#1e1e2e;color:#a78bfa;padding:1px 6px;border-radius:3px}.ch em{color:#7c3aed;font-style:normal}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:9px}.card{background:#16161c;border:1px solid #222;border-radius:8px;padding:10px 7px 8px;text-align:center;cursor:pointer;position:relative;transition:.15s}.card:hover{border-color:#7c3aed;background:#1a1a26;transform:translateY(-2px)}.card.free{border-color:#1a3325}.n{position:absolute;top:4px;left:6px;font-size:9px;color:#444;font-weight:700}.card img,.ni{width:54px;height:54px;object-fit:contain;margin:4px auto 7px;display:block;border-radius:4px}.ni{background:#1e1e2e;display:flex;align-items:center;justify-content:center;color:#555;font-size:18px}.nm{font-size:10px;color:#bbb;line-height:1.3;word-break:break-word;min-height:26px}.pr{font-size:9px;font-weight:700;margin-top:4px;padding:1px 5px;border-radius:3px;display:inline-block}.pr.f{background:#14532d;color:#4ade80}.pr.p{background:#431407;color:#fb923c}.hidden{display:none}.toast{position:fixed;bottom:24px;right:24px;background:#7c3aed;color:#fff;padding:9px 14px;border-radius:7px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:999;max-width:340px}.toast.on{opacity:1}</style></head><body><header><h1>Genesis Icon Gallery</h1><p class="sub">${total} icons across 15 categories — IconScout Special Scout — Click to copy icon name</p></header><div id="sb"><input id="f" type="text" placeholder="Filter by name..." oninput="filter(this.value)"><span id="cnt" style="color:#555;font-size:12px">${total} shown</span></div><main>${sections}</main><div class="toast" id="t"></div><script>function pick(n,u){navigator.clipboard.writeText(n).catch(()=>{});const t=document.getElementById("t");t.textContent="Copied: "+n+" | UUID: "+u;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),3000)}function filter(q){q=q.toLowerCase();let v=0;document.querySelectorAll(".card").forEach(c=>{const show=!q||c.querySelector(".nm").textContent.toLowerCase().includes(q);c.classList.toggle("hidden",!show);if(show)v++});document.getElementById("cnt").textContent=v+" shown";document.querySelectorAll("section").forEach(s=>{s.style.display=[...s.querySelectorAll(".card")].some(c=>!c.classList.contains("hidden"))?"":"none"})}</script></body></html>`;
  fs.writeFileSync(OUT + '/gallery.html', html, 'utf8');
  console.log('\nDone! ' + total + ' icons. Open public/iconscout/gallery.html');
}
main().catch(console.error);
