/* eslint-disable @typescript-eslint/no-require-imports -- Tests use the Node runner and transpile the service without a browser framework. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { TTSService } = require('../services/tts/ttsService.ts');
function browser(online) {
 const spoken = []; let canceled = 0;
 Object.defineProperty(global, 'navigator', { configurable: true, value: { onLine: online } });
 global.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
 global.window = { speechSynthesis: { cancel: () => canceled++, getVoices: () => [{ lang: 'tl-PH', name: 'Filipino' }], speak: u => { spoken.push(u); queueMicrotask(() => u.onend()); } } };
 return { spoken, canceled: () => canceled };
}
test('offline speech uses Filipino voice, spoken text and normalized volume without cloud requests', async () => {
 const env = browser(false); let cloud = 0;
 const service = new TTSService(async () => { cloud++; throw new Error('offline'); });
 await service.speak('Salamat po', 3);
 assert.equal(cloud, 0); assert.equal(env.spoken[0].text, 'Salamat po');
 assert.equal(env.spoken[0].lang, 'fil-PH'); assert.equal(env.spoken[0].voice.lang, 'tl-PH'); assert.equal(env.spoken[0].volume, 1);
});
test('cloud rejection falls back to local speech', async () => {
 const env = browser(true);
 await new TTSService(async () => { throw new Error('network failed'); }).speak('Kain tayo', 0.4);
 assert.equal(env.spoken[0].text, 'Kain tayo'); assert.equal(env.spoken[0].volume, 0.4);
});
test('stop prevents a late cloud response from playing', async () => {
 const env = browser(true); let complete, played = 0;
 const service = new TTSService(() => new Promise(resolve => { complete = resolve; }));
 const pending = service.speak('Kain', 1); service.stop();
 complete({ play: async () => { played++; }, pause() {} }); await pending;
 assert.equal(played, 0); assert.equal(env.spoken.length, 0);
});
test('missing device speech reports a recoverable error', async () => {
 browser(false); global.window = {};
 await assert.rejects(new TTSService().speak('Tulong', 1), /unavailable/);
});
