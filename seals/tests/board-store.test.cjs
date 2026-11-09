/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner loads TypeScript sources through a local CommonJS transpilation hook. */
// Run with: node --test tests/board-store.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const original = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
 if (request.startsWith('@/')) request = path.join(root, request.slice(2)) + '.ts';
 return original.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
let storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const { createBoardStore, migrateV1 } = require('../store/useBoardStore.ts');
const custom = { id: 'custom-legacy', label: 'Salamat po', categoryId: 'needs', iconName: 'please', isCustom: true };
test('v1 migration preserves null slots, custom words, and home coordinates', () => {
 const data = migrateV1({ dictionary: { needs: [null, custom] }, homeGrid: [{ slotIndex: 7, tile: custom }, { slotIndex: 0, tile: null }] });
 assert.equal(data.tiles[custom.id].kind, 'word');
 assert.equal(data.boards.home.pages[0].cells['1:3'].tileId, custom.id);
 assert.equal(data.boards.home.pages[0].cells['0:0'], undefined);
 assert.equal(data.boards.needs.pages[0].cells['0:0'], undefined);
 assert.equal(data.boards.needs.pages[0].cells['0:1'].tileId, custom.id);
});
test('storage imports v1 and persists v2 independently', async () => {
 storage = new Map([['wikahon-board-v1', JSON.stringify({ version: 1, state: { dictionary: { needs: [custom] }, homeGrid: [{ slotIndex: 7, tile: custom }] } })]]);
 const store = createBoardStore(); await store.persist.rehydrate();
 assert.equal(store.getState().boards.home.pages[0].cells['1:3'].tileId, custom.id);
 store.getState().setGridConfig({ rows: 6, cols: 6 });
 assert.equal(JSON.parse(storage.get('wikahon-board-v2')).version, 2);
 assert.ok(storage.has('wikahon-board-v1'));
 storage.clear();
});
test('resize round trip preserves coordinates and per-board overrides', () => {
 const store = createBoardStore(), api = store.getState();
 const before = structuredClone(api.boards.home.pages);
 api.setGridConfig({ rows: 2, cols: 2 }); api.setGridConfig({ rows: 9, cols: 16 });
 assert.deepEqual(store.getState().boards.home.pages, before);
 api.setGridConfig({ rows: 3, cols: 3 }, 'needs');
 assert.deepEqual(store.getState().boards.needs.gridOverride, { rows: 3, cols: 3 });
 assert.deepEqual(store.getState().gridConfig, { rows: 9, cols: 16 });
});
test('reflow preserves every placement including hidden flags across pages', () => {
 const store = createBoardStore(), api = store.getState();
 api.setSlotHidden('home', 0, '4:3', true); api.setGridConfig({ rows: 2, cols: 2 }); api.reflowOutOfBoundsTiles('home');
 const pages = store.getState().boards.home.pages;
 const placements = pages.flatMap(p => Object.values(p.cells));
 assert.equal(placements.length, 20);
 assert.ok(placements.some(p => p.tileId === 'f-5' && p.hidden));
 assert.ok(pages.every(p => Object.keys(p.cells).every(k => { const [r,c] = k.split(':').map(Number); return r < 2 && c < 2; })));
});
test('catalog lifecycle supports words, pagination, folder placement and cleanup', () => {
 const store = createBoardStore(), api = store.getState();
 api.setGridConfig({ rows: 1, cols: 1 });
 const id = api.createCatalog({ name: 'Pagkain', colorKey: 'teal', iconName: null, placeFolderOnHome: true });
 api.upsertTile({ ...custom, categoryId: id, kind: 'word' });
 api.addWordsToCatalog(id, ['n-1', custom.id]);
 assert.equal(store.getState().boards[id].pages.length, 2);
 api.updateCatalog(id, { name: 'Food', colorKey: 'orange' });
 assert.equal(store.getState().boards[id].name, 'Food');
 assert.equal(store.getState().tiles[`folder-${id}`].label, 'Food');
 api.deleteCatalog(id);
 assert.equal(store.getState().boards[id], undefined);
 assert.equal(store.getState().tiles[`folder-${id}`], undefined);
 assert.ok(store.getState().tiles[custom.id]);
 assert.ok(!store.getState().catalogOrder.includes(id));
 api.deleteCatalog('needs'); assert.ok(store.getState().boards.needs);
});
test('swap moves hidden placements without shifting other cells; remove clears only target', () => {
 const store = createBoardStore(), api = store.getState();
 api.setSlotHidden('home', 0, '0:0', true);
 api.swapSlots('home', 0, '0:0', '0:1');
 assert.deepEqual(store.getState().boards.home.pages[0].cells['0:1'], { tileId: 'n-1', hidden: true });
 assert.equal(store.getState().boards.home.pages[0].cells['0:0'].tileId, 'a-1');
 api.assignSlot('home', 0, '0:0', null);
 assert.equal(store.getState().boards.home.pages[0].cells['0:0'], undefined);
 assert.equal(store.getState().boards.home.pages[0].cells['0:2'].tileId, 'p-1');
});
test('sentence instances survive catalog actions and support removal, backspace and clear', () => {
 const store = createBoardStore(), api = store.getState(), tile = api.tiles['n-1'];
 api.appendSentenceTile(tile); api.appendSentenceTile(tile); api.appendSentenceTile(api.tiles['p-1']);
 const tokens = store.getState().sentence;
 assert.notEqual(tokens[0].instanceId, tokens[1].instanceId);
 api.createCatalog({ name: 'School', colorKey: 'blue', iconName: null });
 assert.equal(store.getState().sentence.length, 3);
 api.removeSentenceTokenAt(1); assert.deepEqual(store.getState().sentence.map(t => t.tileId), ['n-1','p-1']);
 api.popSentenceToken(); assert.equal(store.getState().sentence.length, 1);
 api.clearSentence(); assert.equal(store.getState().sentence.length, 0);
});

