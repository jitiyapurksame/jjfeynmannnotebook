// Smoke tests for J.J.'s Ship Log v2 (index.html). Run: npm install && npm run verify
// Uses jsdom + fake-indexeddb. It does NOT test touch/pen input on a real device.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const fi = require('fake-indexeddb');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failed++; };

function boot() {
  // alert/confirm/prompt are deleted on purpose: the app must never use them.
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/',
    beforeParse(w) { w.indexedDB = new fi.IDBFactory(); w.scrollTo = () => {}; w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.Blob = w.Blob || Blob;
      w.Image = class { set src(v) { setTimeout(() => this.onload && this.onload(), 0); } };
      w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
      w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new w.Blob(['x'], { type: 'image/png' })); };
      w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {}; delete w.alert; delete w.confirm; delete w.prompt;
      w.addEventListener('error', e => { console.log('FAIL page error: ' + e.message); failed++; }); } });
  const d = dom.window.document;
  return {
    dom, d,
    click(t, nth = 0) { const b = [...d.querySelectorAll('button')].filter(x => x.textContent.includes(t) || x.getAttribute('aria-label') === t)[nth]; if (!b) throw new Error('no button: ' + t); b.click(); },
    fire(el, v) { el.value = v; el.dispatchEvent(new dom.window.Event('input')); },
    async dialog(v, label) { const sh = [...d.querySelectorAll('.sheet')].pop(); const i = sh.querySelector('input'); if (i && v != null) i.value = v;
      (label ? [...sh.querySelectorAll('.opt')].find(b => b.textContent.includes(label)) : sh.querySelector('.opt')).click(); await wait(150); },
    hud() { return (d.querySelector('.hud') || {}).textContent || ''; },
    text() { return d.getElementById('app').textContent.replace(/\s+/g, ' '); },
  };
}

(async () => {
  const a = boot(); await wait(600);
  ok(a.hud().includes('Cabin boy'), 'home loads with rank HUD');

  // Quick note: pin, score, rename, edit, delete
  a.click('Quick Notes'); await wait(30); a.fire(a.d.querySelector('textarea'), 'idea');
  a.click('Paper colour 3'); a.click('Pin colour 2');
  ok(a.d.querySelector('.card.prev').className.includes('c2'), 'note colour preview updates');
  a.click('Pin it'); await wait(150);
  const N = () => a.d.querySelector('.card:not(.prev)');
  ok(N().querySelector('p').textContent === 'idea', 'note pinned');
  ok(N().className.includes('c2') && N().getAttribute('style').toLowerCase().includes('#2e86de'), 'note keeps chosen paper and pin colour');
  a.click('Promenade'); await wait(30); ok(a.hud().includes('2 mi'), 'note earns 2 miles');
  a.click('Quick Notes'); await wait(30); N().click(); await wait(30);
  a.fire(a.d.querySelector('textarea'), 'edited'); a.click('Paper colour 6'); a.click('Pin colour 8'); a.click('Save changes'); await wait(120);
  ok(a.d.querySelector('.card p').textContent === 'edited', 'note edited');
  ok(a.d.querySelector('.card').className.includes('c5') && a.d.querySelector('.card').getAttribute('style').toLowerCase().includes('#ffffff'), 'note and pin colours can be changed when editing');
  a.d.querySelector('.card').click(); await wait(20); a.click('Rename'); await wait(20); await a.dialog('Shopping');
  ok(a.d.querySelector('.card b') && a.d.querySelector('.card b').textContent === 'Shopping', 'note renamed');
  a.click('Stow 1'); await wait(20); a.click('New cabin'); await wait(20); await a.dialog('Ideas');
  ok([...a.d.querySelectorAll('.chip')].some(c => c.textContent === 'Ideas'), 'new cabin created and note stowed');

  // Captain's Log: full page scoring
  a.click('Promenade'); await wait(30); a.click("Captain's Log"); await wait(30);
  [...a.d.querySelectorAll('textarea.ruled')].forEach(b => a.fire(b, 'x')); a.click('Close the log'); await wait(150);
  a.click('Promenade'); await wait(30);
  ok(a.hud().includes('137 mi') && a.hud().includes('3'), 'full log earns 135 miles (+2 note) and 3 stars');

  // Shop: buy Sailor suit (20 coal)
  a.click("Purser's Shop"); await wait(30);
  const sailor = [...a.d.querySelectorAll('.prod')].find(p => p.textContent.includes('Sailor suit')); sailor.querySelector('button').click(); await wait(100);
  ok(a.d.querySelector('.wrap p').textContent.includes('39 coal'), 'shop purchase deducts coal (59 -> 39)');

  // Drawing table: captain, paper, stow
  a.click('Promenade'); await wait(30); a.click('Drawing Table'); await wait(30);
  a.click('Blocky Captain'); await wait(20); ok(a.d.querySelectorAll('.stage [data-id]').length === 7, 'Blocky Captain adds 7 parts');
  a.click('Blocky Captainess'); await wait(20); ok(a.d.querySelectorAll('.stage [data-id]').length === 16, 'Captainess adds 9 parts');
  for (const t of ['Shapes', 'Nautical', 'Vehicles', 'Animals', 'Space', 'RPG', 'Engineer', 'Science', 'Food']) { a.click(t); await wait(15); a.d.querySelector('.tray').click(); }
  ok(a.d.querySelectorAll('.stage [data-id]').length === 25, 'every item tab adds a piece');
  const tfm = () => [...a.d.querySelectorAll('.stage [data-id]')].map(g => g.getAttribute('transform'));
  a.click('Face right'); await wait(10);
  ok(tfm().some(t => t.includes('rotate(90)')), 'Face right turns the selected piece 90 degrees');
  ok(a.d.querySelector('[aria-label="Face right"]').className.includes('on'), 'active direction is highlighted');
  a.click('Face down-left'); await wait(10); ok(tfm().some(t => t.includes('rotate(225)')), 'diagonal direction works (225)');
  a.click('Face up'); await wait(10); ok(tfm().some(t => t.includes('rotate(0)') && t.includes('scale(1.2 1.2)')), 'Face up returns to upright');
  a.click('Flip left-right'); await wait(10); ok(tfm().some(t => t.includes('scale(-1.2 1.2)')), 'Flip left-right mirrors the piece');
  a.click('Flip up-down'); await wait(10); ok(tfm().some(t => t.includes('scale(-1.2 -1.2)')), 'Flip up-down mirrors vertically');
  a.click('Flip left-right'); a.click('Flip up-down'); await wait(10); ok(!tfm().some(t => t.includes('-1.2')), 'flipping twice restores the piece');
  a.click('Undo'); await wait(10); ok(tfm().some(t => t.includes('scale(1.2 -1.2)')), 'flips can be undone');
  a.click('Save picture'); await wait(100);
  ok([...a.d.querySelectorAll('.sheet')].some(x => x.textContent.includes('Picture ready') && x.textContent.includes('press and hold')), 'Save picture shows the save-to-Photos instructions');
  ok([...a.d.querySelectorAll('.sheet img')].length === 1, 'Save picture sheet previews the picture');
  a.click('Close'); await wait(10); ok(a.d.querySelectorAll('.sheet').length === 0, 'picture sheet closes');
  a.click('Stow it'); await wait(150); a.click('Promenade'); await wait(30);
  ok(a.hud().includes('145 mi') && a.hud().includes('49 coal'), 'new drawing earns 8 miles and 10 coal');

  // Lifeboat round trip into a second, empty instance
  a.click('Lifeboat'); await wait(30); a.click('Make Lifeboat code'); await wait(500);
  const code = [...a.d.querySelectorAll('textarea.code')].slice(0, -1).map(t => t.value).join('\n');
  ok(code.startsWith('LIFEBOAT|'), 'Lifeboat code generated');
  const b = boot(); await wait(600);
  b.click('Lifeboat'); await wait(30); b.fire([...b.d.querySelectorAll('textarea.code')].pop(), code); b.click('Restore from code'); await wait(400);
  b.click('Promenade'); await wait(30);
  ok(b.hud().includes('145 mi') && b.hud().includes('49 coal'), 'restore brings back miles, coal and spending');
  b.click("Purser's Shop"); await wait(30); ok(b.d.querySelectorAll('.own').length === 1, 'restore keeps purchased items');
  b.click('Promenade'); await wait(30); b.click('Chart Room'); await wait(30); ok(b.d.querySelectorAll('.card img').length === 1, 'restored drawing shows');

  // Delete + shelf rename/delete
  a.click('Promenade'); await wait(30); a.click('Chart Room'); await wait(30); a.d.querySelector('.card').click(); await wait(20); a.click('Open / edit'); await wait(40);
  a.click('Delete'); await wait(20); await a.dialog(null, 'Throw overboard'); ok(a.text().includes('Nothing here yet'), 'drawing deleted');
  a.click('Promenade'); await wait(30); a.click('Note Cabins'); await wait(30);
  [...a.d.querySelectorAll('.chip')].find(c => c.textContent === 'Ideas').click(); await wait(20);
  a.click('Rename cabin'); await wait(20); await a.dialog('Big ideas'); ok([...a.d.querySelectorAll('.chip')].some(c => c.textContent === 'Big ideas'), 'shelf renamed');
  a.click('Delete cabin'); await wait(20); await a.dialog(null, 'Delete cabin');
  ok(![...a.d.querySelectorAll('.chip')].some(c => c.textContent === 'Big ideas'), 'shelf deleted (items return to Cargo Hold)');

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
