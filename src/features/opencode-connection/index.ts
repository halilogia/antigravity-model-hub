// Modified from vahapogut/antigravity-add-model@e77954b — see NOTICE.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeJsonAtomic, type SecretCodec } from '../../modelStore';

export const SAVED_KEY = '__opencode_saved_key__';
/**
 * Every plan pins one endpoint and one wire format. A saved key is only ever
 * re-attached to that exact pair, so a tampered model entry cannot redirect it.
 */
const PLANS = {
  'opencode-go': { apiUrl: 'https://opencode.ai/inference/go/openai/v1/chat/completions', apiFormat: 'openai' },
  opencode: { apiUrl: 'https://opencode.ai/inference/openai/v1/chat/completions', apiFormat: 'openai' },
  google: { apiUrl: 'https://generativelanguage.googleapis.com/v1beta', apiFormat: 'google' },
} as const;
type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];
const providers = PLAN_IDS;
export function createOpenCodeConnections(directory: string, codec: SecretCodec, readModels: () => any[]) {
  const filename = path.join(directory, 'opencode-connections.json');
  const providerId = (value: unknown): PlanId => {
    if (!providers.includes(value as PlanId)) throw new Error('Choose OpenCode Go, OpenCode Console or Google AI Studio.');
    return value as PlanId;
  };
  const read = (): Record<string, string> => {
    try { return JSON.parse(fs.readFileSync(filename, 'utf8')).keys || {}; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw new Error('Could not read saved OpenCode connections.'); }
  };
  const secret = (provider: string) => {
    const encrypted = read()[provider];
    if (encrypted) {
      const key = codec.decryptString(encrypted);
      if (!key) throw new Error('Saved OpenCode key could not be decrypted. Enter it again.');
      return key;
    }
    // Reuse keys from models saved before standalone connection storage existed.
    const model = readModels().find(model => model.provider === provider && model.apiKey && model.apiKey !== 'none');
    if (model) return model.encrypted ? codec.decryptString(model.apiKey) : model.apiKey;
    throw new Error('No API key saved for this OpenCode plan.');
  };
  return {
    status: () => {
      const keys = read();
      const models = readModels();
      return { success: true, saved: Object.fromEntries(providers.map(provider => [provider,
        !!keys[provider] || models.some(model => model.provider === provider && !!model.apiKey && model.apiKey !== 'none')])) };
    },
    save: (input: { provider: string; apiKey: string }) => {
      const provider = providerId(input?.provider), apiKey = input?.apiKey?.trim();
      if (!apiKey || apiKey === SAVED_KEY || apiKey === 'none' || apiKey.length > 8192 || /[\r\n]/.test(apiKey)) throw new Error('Enter a valid API key for this plan.');
      const keys = read(); keys[provider] = codec.encryptString(apiKey);
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      writeJsonAtomic(filename, { version: 1, keys });
      return { success: true };
    },
    resolve: (input: any) => {
      if (input?.apiKey !== SAVED_KEY) return input;
      const provider = providerId(input.provider);
      const plan = PLANS[provider];
      if (input.apiUrl !== plan.apiUrl || input.apiFormat !== plan.apiFormat || input.customHeaders)
        throw new Error('Saved API keys can only be used with the endpoint and format of their own plan.');
      return { ...input, apiKey: secret(provider) };
    },
  };
}
