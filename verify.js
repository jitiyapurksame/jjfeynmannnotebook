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
  a.click('Items'); await wait(15);
  for (const t of ['Shapes', 'Nautical', 'Vehicles', 'Animals', 'Space', 'RPG', 'Engineer', 'Science', 'Food']) { a.click(t); await wait(15); a.d.querySelector('.tgrid .tray').click(); }
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

  // Oct 2026 (2): ship name, home order, copy / save text
  a.click('Promenade'); await wait(30);
  const kids = [...a.d.querySelector('.wrap').children];
  const iBig = kids.findIndex(e => e.classList.contains('big')), iHud = kids.findIndex(e => e.classList.contains('hud')), iSh = kids.findIndex(e => e.classList.contains('shelves'));
  ok(iBig > -1 && iBig < iHud && iHud < iSh, 'home: big buttons first, rank then shelves at the bottom');
  ok(a.d.querySelector('svg.banner-art') && !a.d.querySelector('.cap') && a.d.querySelector('.shipemo').textContent === '🚢', 'home shows liner art and one default ship emoji');
  ok(a.d.getElementById('shipname').textContent === "J.J.'s Ship Log", 'default ship name');
  a.click('Rename ship'); await wait(20); await a.dialog('S.S. Wombat');
  ok(a.d.getElementById('shipname').textContent === 'S.S. Wombat' && a.d.title === 'S.S. Wombat', 'ship can be renamed');
  a.click('Rename ship'); await wait(20); await a.dialog('');
  ok(a.d.getElementById('shipname').textContent === "J.J.'s Ship Log", 'empty name falls back to default');
  a.click('Rename ship'); await wait(20); a.click('Emoji 🐙'); await wait(10); await a.dialog('S.S. Wombat');
  ok(a.d.querySelector('.shipemo').textContent === '🐙' && a.d.getElementById('shipname').textContent === 'S.S. Wombat', 'ship emoji can be changed with the name');
  a.click('Rename ship'); await wait(20); ok([...a.d.querySelectorAll('.emo.on')].map(b => b.textContent).join() === '🐙', 'dialog highlights current emoji'); await a.dialog(null, 'Cancel');
  ok(a.d.querySelector('.shipemo').textContent === '🐙', 'cancel keeps emoji');
  let copied = null; Object.defineProperty(a.dom.window.navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
  a.click('Quick Notes'); await wait(30); a.fire(a.d.querySelector('textarea'), 'hello team');
  a.click('Copy'); await wait(30); ok(copied === 'hello team', 'Quick Note text copied to clipboard');
  a.click('Save .txt'); await wait(20); ok(/Saved as a text file/.test(a.d.body.textContent), 'Save .txt works');
  a.click('Pin it'); await wait(120); a.d.querySelector('.card:not(.prev)').click(); await wait(30);
  a.fire(a.d.querySelector('input.dline'), 'Greeting'); copied = null; a.click('Copy'); await wait(30);
  ok(copied && copied.startsWith('Greeting') && copied.includes('hello team'), 'Edit note: copy includes title and text');
  const bk = await (async () => { a.click('Notice Board'); await wait(20); return null; })();

  // Oct 2026 (3): mushroom figures, items search, scenes locked / unlocked
  const cnt = () => a.d.querySelectorAll('.stage svg [data-id]').length;
  a.click('Promenade'); await wait(30); a.click('Drawing Table'); await wait(40);
  a.click('Characters'); await wait(10); const c0 = cnt();
  a.click('Mushroom Boy'); await wait(20);
  ok(cnt() === c0 + 7 && a.d.querySelector('.stage svg').innerHTML.includes('F6E7B4'), 'Mushroom Boy adds a figure with a mushroom hat');
  a.click('Mushroom Girl'); await wait(20); ok(cnt() === c0 + 16, 'Mushroom Girl adds a figure with hair and hat');
  a.click('Items'); await wait(10);
  ok(!!a.d.querySelector('input.srch') && a.d.querySelectorAll('.kws .chip').length > 12, 'Items section has a search box, suggestions and categories');
  a.click('All'); await wait(10);
  ok(a.d.querySelector('.tgrid') && a.d.querySelectorAll('.tgrid .tray').length > 60, 'Items grid lists all pre-made items in a scroll area');
  const search = async t => { a.fire(a.d.querySelector('input.srch'), t); await wait(10); };
  await search('eiffel'); ok(a.d.querySelectorAll('.tgrid .tray').length === 1, 'search finds one item');
  let n0 = cnt(); a.click('Eiffel Tower (France)'); await wait(10); ok(cnt() === n0 + 1, 'searched item can be added');
  await search('tree'); ok(a.d.querySelectorAll('.tgrid .tray').length >= 3, 'search tree finds emoji trees');
  n0 = cnt(); a.click('tree plant'); await wait(10); ok(cnt() === n0 + 1 && a.d.querySelector('.stage svg').innerHTML.includes('🌳'), 'emoji piece renders as text');
  await search('france'); ok(a.d.querySelectorAll('.tgrid .tray').length === 1, 'search by country works');
  await search('zzzz'); ok(/Nothing found/.test(a.d.querySelector('.tgrid').textContent), 'empty search shows a friendly message');
  a.click('mushroom'); await wait(10); ok(a.d.querySelector('input.srch').value === 'mushroom' && a.d.querySelectorAll('.tgrid .tray').length >= 3, 'tapping a suggestion searches');
  a.click('Platformer'); await wait(10); ok(a.d.querySelector('input.srch').value === '' && a.d.querySelectorAll('.tgrid .tray').length === 12, 'category chip shows its items');
  // scenes: locked until enough notes / drawings are made (fresh app, empty storage)
  const f = boot(); await wait(600);
  const chipTxt = n => [...f.d.querySelectorAll('.chip')].map(c => c.textContent).find(t => t.includes(n));
  const toTable = async () => { try { f.click('Promenade'); } catch (e) {} await wait(30); f.click('Drawing Table'); await wait(40); f.click('Scenes'); await wait(10); };
  const pin = async i => { try { f.click('Promenade'); } catch (e) {} await wait(30); f.click('Quick Notes'); await wait(30); f.fire(f.d.querySelector('textarea'), 'note ' + i); f.click('Pin it'); await wait(120); };
  f.click('Drawing Table'); await wait(40); f.click('Scenes'); await wait(10);
  ok(/🔒 Garden · 0\/3/.test(chipTxt('Garden')) && /🔒 City · 0\/6/.test(chipTxt('City')) && /🔒 Countryside · 0\/10/.test(chipTxt('Countryside')), 'new scenes start locked with progress');
  f.click('Garden'); await wait(10);
  ok(!f.d.querySelector('.stage svg').innerHTML.includes('#3E8E41') && /make 3 more notes or drawings/.test(f.d.body.textContent), 'locked scene cannot be used and explains how to unlock');
  for (let i = 0; i < 3; i++) await pin(i);
  ok(/New scene unlocked: Garden/.test(f.d.body.textContent), 'third note unlocks the Garden');
  await toTable();
  ok(!/🔒/.test(chipTxt('Garden')) && /🔒 City · 3\/6/.test(chipTxt('City')), 'Garden open, City still locked at 3/6');
  f.click('Garden'); await wait(10); ok(f.d.querySelector('.stage svg').innerHTML.includes('#6CBF4B'), 'Garden scene paper applies when unlocked');
  for (let i = 3; i < 10; i++) await pin(i);
  await toTable(); ok(!/🔒/.test(chipTxt('City')) && !/🔒/.test(chipTxt('Countryside')), 'all three scenes open after 10 notes / drawings');
  f.click('City'); await wait(10); ok(f.d.querySelector('.stage svg').innerHTML.includes('#4A5560'), 'City scene paper applies');
  f.click('Countryside'); await wait(10); ok(f.d.querySelector('.stage svg').innerHTML.includes('#C0392B'), 'Countryside scene paper applies');

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
