import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createOpenCodeConnections, SAVED_KEY } from '../features/opencode-connection';
const directories: string[] = [];
const codec = { encryptString: (value: string) => `enc:${Buffer.from(value).toString('base64')}`,
  decryptString: (value: string) => Buffer.from(value.slice(4), 'base64').toString() };
const input = { provider: 'opencode-go', apiFormat: 'openai', apiUrl: 'https://opencode.ai/inference/go/openai/v1/chat/completions', apiKey: SAVED_KEY };
function fixture(models: any[] = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-connection-test-')); directories.push(directory);
  return { directory, store: createOpenCodeConnections(directory, codec, () => models) };
}
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
describe('saved OpenCode connections', () => {
  it('survives recreation without returning the key to the settings renderer', () => {
    const { store, directory } = fixture();
    store.save({ provider: 'opencode-go', apiKey: 'private-test-key' });
    expect(fs.readFileSync(path.join(directory, 'opencode-connections.json'), 'utf8')).not.toContain('private-test-key');
    const reopened = createOpenCodeConnections(directory, codec, () => []);
    expect(reopened.status()).toEqual({ success: true, saved: { 'opencode-go': true, opencode: false, google: false } });
    expect(reopened.resolve(input).apiKey).toBe('private-test-key');
  });
  it('refuses to send a saved key to another URL, plan, or custom authorization header', () => {
    const { store } = fixture(); store.save({ provider: 'opencode-go', apiKey: 'private-test-key' });
    expect(() => store.resolve({ ...input, apiUrl: 'https://example.com/' })).toThrow('only be used');
    expect(() => store.resolve({ ...input, provider: 'openai' })).toThrow('Choose OpenCode');
    expect(() => store.resolve({ ...input, customHeaders: { Authorization: 'other' } })).toThrow('only be used');
    expect(() => store.resolve({ ...input, provider: 'opencode', apiUrl: 'https://opencode.ai/inference/openai/v1/chat/completions' })).toThrow('No API key saved');
  });
  it('reuses an encrypted model key saved by the previous version', () => {
    const { store } = fixture([{ provider: 'opencode-go', apiKey: codec.encryptString('legacy-test-key'), encrypted: true }]);
    expect(store.status().saved['opencode-go']).toBe(true);
    expect(store.resolve(input).apiKey).toBe('legacy-test-key');
  });
  it('stores a Google AI Studio key separately and pins it to the Gemini endpoint', () => {
    const { store } = fixture();
    const googleInput = { provider: 'google', apiFormat: 'google', apiUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: SAVED_KEY };
    store.save({ provider: 'google', apiKey: 'google-test-key' });
    expect(store.status().saved.google).toBe(true);
    expect(store.status().saved['opencode-go']).toBe(false);
    expect(store.resolve(googleInput).apiKey).toBe('google-test-key');
    expect(() => store.resolve({ ...googleInput, apiFormat: 'openai' })).toThrow('only be used');
    expect(() => store.resolve({ ...googleInput, apiUrl: 'https://example.com/v1beta' })).toThrow('only be used');
    expect(() => store.resolve({ ...input })).toThrow('No API key saved');
  });
  it('rejects empty and placeholder credentials and permits replacement', () => {
    const { store } = fixture();
    for (const apiKey of ['', ' ', 'none', SAVED_KEY, 'bad\nkey']) expect(() => store.save({ provider: 'opencode-go', apiKey })).toThrow();
    store.save({ provider: 'opencode-go', apiKey: 'first' }); store.save({ provider: 'opencode-go', apiKey: 'second' });
    expect(store.resolve(input).apiKey).toBe('second');
  });
});
