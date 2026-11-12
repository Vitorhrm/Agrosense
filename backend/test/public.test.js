import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {runInNewContext} from 'node:vm';

test('trocar de estação durante uma consulta mostra somente o resumo da nova estação', async () => {
  const elements = new Map();
  function getElementById(id) {
    if (!elements.has(id)) {
      const element = {
        value: id === 'period' ? '1' : '',
        listeners: {},
        addEventListener(type, listener) { this.listeners[type] = listener; },
        replaceChildren() { this.value = ''; },
        append(option) { this.value ||= option.value; },
        getBoundingClientRect() { return {width: 0}; },
      };
      elements.set(id, element);
    }
    return elements.get(id);
  }

  const oldHistory = Promise.withResolvers();
  const newHistory = Promise.withResolvers();
  const historyResponse = text => ({ok: true, json: async () => ({readings: [], summary: {text}})});
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  runInNewContext(source, {
    document: {getElementById, querySelectorAll: () => [], createElement: () => ({})},
    fetch: async path => {
      if (path === '/api/stations') {
        return {ok: true, json: async () => ({stations: [{node: 'station1'}, {node: 'station2'}]})};
      }
      if (path === '/api/readings?node=station1&hours=1') return oldHistory.promise;
      assert.equal(path, '/api/readings?node=station2&hours=1');
      return newHistory.promise;
    },
    ResizeObserver: class { observe() {} },
    setInterval() {},
  });
  await setImmediate();

  const station = getElementById('station');
  station.value = 'station2';
  station.listeners.change({currentTarget: station});
  oldHistory.resolve(historyResponse('Resumo da estação anterior'));
  await setImmediate();
  assert.notEqual(getElementById('summary').textContent, 'Resumo da estação anterior');

  newHistory.resolve(historyResponse('Resumo da estação selecionada'));
  await setImmediate();
  assert.equal(station.value, 'station2');
  assert.equal(getElementById('summary').textContent, 'Resumo da estação selecionada');
});
