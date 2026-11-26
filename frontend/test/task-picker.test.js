import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';

test('the actual library picker mounts with selected materials instead of crashing the homework page', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    plugins: [react()],
    server: {middlewareMode: true, watch: null, hmr: false},
    appType: 'custom',
    logLevel: 'error',
  });
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = {activeElement: null};
  globalThis.window = {location: {hash: '#/homework/new', hostname: 'localhost'}, addEventListener() {}, removeEventListener() {}};
  try {
    const {TaskPicker} = await server.ssrLoadModule('/src/pages/tutor/Library.jsx');
    for (const selected of [[], [7, 12]]) {
      const markup = renderToStaticMarkup(React.createElement(TaskPicker, {selected, onClose() {}, onPick() {}}));
      assert.match(markup, /role="dialog"/);
      assert.match(markup, /Задачи и упражнения/);
      assert.match(markup, selected.length ? /Готово \(2\)/ : /Готово/);
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    await server.close();
  }
});
