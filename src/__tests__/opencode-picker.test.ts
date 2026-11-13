import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('src/features/opencode-picker/index.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture() {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only' });
  const api = {
    getConnectionStatus: vi.fn().mockResolvedValue({ success: true, saved: {} }),
    saveConnection: vi.fn().mockResolvedValue({ success: true }),
    discoverModels: vi.fn().mockResolvedValue({ success: true, models: [{ id: 'deepseek', displayName: 'DeepSeek' }, { id: 'qwen', displayName: 'Qwen' }] }),
    getCustomModels: vi.fn().mockResolvedValue([]),
    saveCustomModel: vi.fn().mockResolvedValue({ success: true }),
  };
  const onSaved = vi.fn().mockResolvedValue(undefined);
  dom.window.eval(source + '\nwindow.OpenCodePicker = OpenCodePicker;');
  (dom.window as any).OpenCodePicker.mount(dom.window.document.querySelector('main'), api, onSaved);
  const find = (selector: string) => dom.window.document.querySelector(selector) as HTMLInputElement;
  const click = async (selector: string) => { find(selector === 'button' ? '#oc-fetch-models' : selector).click(); await settle(); };
  const input = (selector: string, value: string, event = 'input') => {
    find(selector).value = value; find(selector).dispatchEvent(new dom.window.Event(event));
  };
  const load = async () => { input('#oc-api-key', 'test-key'); await click('button'); };
  return { dom, api, onSaved, find, click, input, load };
}
describe('OpenCode Settings picker', () => {
  it('saves a connection without selecting a model and reuses its key after clearing the input', async () => {
    const f = fixture(); f.input('#oc-api-key', 'standalone-key');
    await f.click('#oc-save-key');
    expect(f.api.saveConnection).toHaveBeenCalledWith({ provider: 'opencode-go', apiKey: 'standalone-key' });
    expect(f.api.discoverModels).not.toHaveBeenCalled();
    expect(f.find('#oc-api-key').value).toBe('');
    await f.click('button');
    expect(f.api.discoverModels.mock.calls[0][0].apiKey).toBe('__opencode_saved_key__');
  });
  it('requires a key and never issues generation requests', async () => {
    const f = fixture(); await f.click('button');
    expect(f.api.discoverModels).not.toHaveBeenCalled();
    expect(f.find('[role=status]').textContent).toContain('Enter your API key for the selected provider');
    await f.load();
    expect(f.api.saveConnection).toHaveBeenCalledWith({ provider: 'opencode-go', apiKey: 'test-key' });
    expect(f.api.discoverModels).toHaveBeenCalledWith({ provider: 'opencode-go', apiKey: '__opencode_saved_key__', apiFormat: 'openai', apiUrl: 'https://opencode.ai/inference/go/openai/v1/chat/completions' });
    expect(f.api.saveCustomModel).not.toHaveBeenCalled();
  });
  it('preserves selections while filtering and saves exact IDs only after clicking Add', async () => {
    const f = fixture(); await f.load(); await f.click('input[type=checkbox]');
    f.input('input[type=search]', 'qwen'); await f.click('input[type=checkbox]');
    await f.click('button:last-of-type');
    expect(f.api.saveCustomModel).toHaveBeenCalledTimes(2);
    expect(f.api.saveCustomModel.mock.calls.map(call => call[0].externalModelName)).toEqual(['deepseek', 'qwen']);
    expect(f.api.saveCustomModel.mock.calls[0][0]).toMatchObject({ apiKey: '__opencode_saved_key__', enabled: true, apiFormat: 'openai' });
    expect(f.find('#oc-api-key').value).toBe('');
    expect(f.onSaved).toHaveBeenCalledOnce();
  });
  it('invalidates the old catalog on plan/key changes and uses the Console endpoint', async () => {
    const f = fixture(); await f.load(); await f.click('input[type=checkbox]');
    f.input('#oc-plan', 'opencode', 'change');
    expect(f.find('button:last-of-type').disabled).toBe(true);
    f.input('#oc-api-key', 'test-console-key');
    await f.click('button');
    expect(f.api.discoverModels.mock.calls.at(-1)?.[0].apiUrl).toBe('https://opencode.ai/inference/openai/v1/chat/completions');
    f.input('#oc-api-key', 'replacement');
    expect(f.find('input[type=checkbox]')).toBeNull();
  });
  it('loads Google AI Studio models through the Gemini endpoint and saves the google wire format', async () => {
    const f = fixture();
    f.input('#oc-plan', 'google', 'change');
    f.input('#oc-api-key', 'google-test-key');
    await f.click('#oc-fetch-models');
    expect(f.api.discoverModels.mock.calls.at(-1)?.[0]).toMatchObject({
      provider: 'google',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiFormat: 'google',
    });
    await f.click('input[type=checkbox]');
    await f.click('button:last-of-type');
    expect(f.api.saveCustomModel.mock.calls[0][0]).toMatchObject({
      provider: 'google',
      apiFormat: 'google',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      name: 'models/google/deepseek',
      displayName: 'DeepSeek (Google AI Studio)',
    });
  });
  it('shows authentication failures without retaining stale model choices', async () => {
    const f = fixture(); await f.load();
    f.api.discoverModels.mockResolvedValueOnce({ success: false, error: 'Authentication rejected (HTTP 401)' } as any);
    await f.click('button');
    expect(f.find('[role=status]').textContent).toContain('HTTP 401');
    expect(f.find('input[type=checkbox]')).toBeNull();
    expect(f.find('button').disabled).toBe(false);
  });
  it('updates an existing model rather than creating a duplicate', async () => {
    const f = fixture();
    f.api.getCustomModels.mockResolvedValue([{ name: 'models/existing', provider: 'opencode-go', externalModelName: 'deepseek', apiUrl: 'https://opencode.ai/inference/go/openai/v1/chat/completions', temperature: 0.3 }] as any);
    await f.load(); await f.click('input[type=checkbox]'); await f.click('button:last-of-type');
    expect(f.api.saveCustomModel.mock.calls[0][0]).toMatchObject({ name: 'models/existing', originalName: 'models/existing', temperature: 0.3 });
  });
  it('does not apply a response after its settings section was removed', async () => {
    const f = fixture(); let resolve: (value: any) => void = () => {};
    f.api.discoverModels.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await f.load(); f.find('#oc-model-picker').remove();
    resolve({ success: true, models: [{ id: 'late' }] }); await settle();
    expect(f.api.saveCustomModel).not.toHaveBeenCalled();
    expect(f.find('input[type=checkbox]')).toBeNull();
  });
});
