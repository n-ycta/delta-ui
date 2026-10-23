import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nodeCpu } from '../src/core/lib/nodes';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('every host page declares a device-width viewport', () => {
  assert.match(read('index.html'), /name="viewport" content="width=device-width/);
  assert.match(read('workbench.html'), /name="viewport" content="width=device-width/);
});

test('phone breakpoints exist for both the shell (900px) and the dock (760px)', () => {
  assert.match(read('src/styles/components.css'), /@media \(max-width: 900px\)[^{]*\{[^]*?\.sidebar \{[^}]*translateX\(-100%\)/);
  assert.match(read('src/shell/shell.css'), /@media \(max-width: 760px\)[^{]*\{[^]*?\.dx-root[^{]*\{[^}]*"stage" "dock"/);
});

test('the keyboard-shortcut hint is not shown on narrow or touch screens', () => {
  const css = read('src/styles/components.css');
  assert.match(css, /@media \(max-width: 900px\)[^{]*\{[^]*?\.search-trigger \.kbd/);
  assert.match(css, /@media \(pointer: coarse\)\s*\{\s*\.search-trigger \.kbd \{ display: none; \}/);
});

test('horizontal overflow cannot widen the page', () => {
  assert.match(read('src/styles/base.css'), /html, body \{ overflow-x: hidden/);
});

test('cpu is null (shown as a dash) when the host reports no CPU telemetry', () => {
  assert.equal(nodeCpu({ cpu: 0, telemetryUnavailable: ['cpu'] } as any), null);
  assert.equal(nodeCpu({ cpu: 12 } as any), 12);
});
