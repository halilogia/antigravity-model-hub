/* eslint-disable @typescript-eslint/no-namespace */
/** Included directly in the sandbox preload by scripts/build-opencode-preload.mjs. */
namespace OpenCodePicker {
  interface Choice { id: string; displayName?: string; contextWindow?: number; maxOutputTokens?: number; supportsVision?: boolean; supportsThinking?: boolean }
  interface Result { success: boolean; error?: string; models?: Choice[] }
  interface Api {
    getConnectionStatus(): Promise<Result & { saved?: Record<string, boolean> }>;
    saveConnection(input: { provider: string; apiKey: string }): Promise<Result>;
    discoverModels(input: any): Promise<Result>;
    getCustomModels(): Promise<any[]>;
    saveCustomModel(input: any): Promise<Result>;
  }
  export function mount(parent: HTMLElement, api: Api, onSaved: () => Promise<void>): void {
    const box = document.createElement('div');
    box.id = 'oc-model-picker';
    box.style.cssText = 'width:100%;min-width:0;text-align:left';
    const styles = document.createElement('style');
    styles.textContent = `
      #oc-model-picker .oc-choice{display:flex;flex-direction:row;align-items:flex-start;justify-content:flex-start;gap:10px;width:100%;padding:9px 10px;margin:0;border:1px solid #303036;border-radius:6px;cursor:pointer;text-align:left}
      #oc-model-picker .oc-choice:has(input:checked){border-color:#8073bd;background:#24212e}
      #agy-custom-models-section #oc-model-picker .oc-choice input[type=checkbox]{width:16px;height:16px;min-width:16px;flex:0 0 16px;padding:0;margin:3px 0 0;accent-color:#a78bfa}
      #oc-model-picker .oc-choice-text{display:flex;flex-direction:column;gap:2px;min-width:0;overflow-wrap:anywhere;text-align:left}
      #oc-model-picker .oc-choice-id{font-size:12px;color:#a1a1aa}
      #oc-model-picker select{font:inherit;width:100%;padding:8px 10px;border:1px solid #414149;border-radius:6px;background:#25252a;color:#fafafa}
    `;
    box.append(styles);
    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
      const node = document.createElement(tag);
      node.textContent = text;
      return node;
    };
    const field = (title: string, input: HTMLElement) => {
      const label = make('label'); label.className = 'agy-field';
      label.append(make('span', title), input); box.append(label);
    };
    interface Plan { id: string; label: string; apiUrl: string; apiFormat: string; keyHint: string; suffix: string }
    // One list drives the dropdown, the key hint, the discovery request and the saved entry.
    const plans: Plan[] = [
      { id: 'opencode-go', label: 'OpenCode Go', apiUrl: 'https://opencode.ai/inference/go/openai/v1/chat/completions', apiFormat: 'openai', keyHint: 'OpenCode Console API key', suffix: 'OpenCode Go' },
      { id: 'opencode', label: 'OpenCode Console (Zen)', apiUrl: 'https://opencode.ai/inference/openai/v1/chat/completions', apiFormat: 'openai', keyHint: 'OpenCode Console API key', suffix: 'OpenCode' },
      { id: 'google', label: 'Google AI Studio (Gemini)', apiUrl: 'https://generativelanguage.googleapis.com/v1beta', apiFormat: 'google', keyHint: 'Google AI Studio API key', suffix: 'Google AI Studio' },
    ];
    const plan = make('select'); plan.id = 'oc-plan';
    for (const entry of plans) {
      const option = make('option', entry.label); option.value = entry.id; plan.append(option);
    }
    const chosen = () => plans.find(entry => entry.id === plan.value) || plans[0];
    field('API provider', plan);
    const key = make('input'); key.id = 'oc-api-key'; key.type = 'password'; key.autocomplete = 'off';
    key.placeholder = chosen().keyHint; field('API key', key);
    const saveKey = make('button', 'Save API key'); saveKey.type = 'button'; saveKey.className = 'agy-btn'; saveKey.id = 'oc-save-key'; box.append(saveKey);
    const keyStatus = make('p', 'Checking saved connection…'); keyStatus.className = 'agy-muted'; box.append(keyStatus);
    const fetchButton = make('button', 'Fetch models'); fetchButton.type = 'button';
    fetchButton.id = 'oc-fetch-models';
    fetchButton.className = 'agy-btn agy-primary'; box.append(fetchButton);
    const search = make('input'); search.type = 'search'; search.placeholder = 'Search models';
    field('Search models', search);
    const list = make('div'); list.style.cssText = 'max-height:280px;overflow:auto;display:grid;gap:8px;margin:12px 0'; box.append(list);
    const saveButton = make('button', 'Add selected models'); saveButton.type = 'button';
    saveButton.className = 'agy-btn'; saveButton.disabled = true; box.append(saveButton);
    const status = make('p', 'Enter your API key to load models. Checked models are added only when you click Add selected models; built-in models stay unchanged.');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); box.append(status);
    parent.append(box);
    let choices: Choice[] = [], selected = new Set<string>(), version = 0, busy = false;
    let fetched: { provider: string; apiKey: string; apiUrl: string; apiFormat: string; suffix: string } | undefined;
    let savedKeys: Record<string, boolean> = {};
    const keyLabel = () => {
      key.placeholder = savedKeys[plan.value] ? 'Saved key — leave blank to reuse, or enter a replacement' : chosen().keyHint;
      keyStatus.textContent = savedKeys[plan.value] ? 'API key saved for this provider.' : 'No API key saved for this provider.';
    };
    void api.getConnectionStatus().then(result => {
      if (!box.isConnected) return;
      if (!result.success) { keyStatus.textContent = result.error || 'Could not check saved connection.'; return; }
      savedKeys = result.saved || {}; keyLabel();
    }).catch(() => { keyStatus.textContent = 'Could not check saved connection.'; });
    const connection = () => ({ provider: plan.value, apiKey: key.value.trim() || (savedKeys[plan.value] ? '__opencode_saved_key__' : ''),
      apiUrl: chosen().apiUrl, apiFormat: chosen().apiFormat, suffix: chosen().suffix });
    const message = (text: string, error = false) => { status.textContent = text; status.className = error ? 'agy-status agy-error' : 'agy-status'; };
    const check = (result: Result) => { if (!result?.success) throw new Error(result?.error || 'Provider request failed.'); return result; };
    const render = () => {
      list.replaceChildren();
      const query = search.value.trim().toLowerCase();
      const visible = choices.filter(model => `${model.id} ${model.displayName || ''}`.toLowerCase().includes(query));
      for (const model of visible) {
        const label = make('label'); label.className = 'oc-choice';
        const checkbox = make('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(model.id); checkbox.disabled = busy;
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(model.id); else selected.delete(model.id);
          saveButton.disabled = busy || !selected.size;
          saveButton.textContent = selected.size ? `Add selected models (${selected.size})` : 'Add selected models';
        });
        const caption = make('span'); caption.className = 'oc-choice-text';
        caption.append(make('span', model.displayName || model.id));
        if (model.displayName && model.displayName !== model.id) {
          const id = make('span', model.id); id.className = 'oc-choice-id'; caption.append(id);
        }
        label.append(checkbox, caption); list.append(label);
      }
      if (choices.length && !visible.length) list.append(make('p', 'No matching models.'));
      saveButton.disabled = busy || !selected.size;
      saveButton.textContent = selected.size ? `Add selected models (${selected.size})` : 'Add selected models';
    };
    const lock = (value: boolean) => { busy = value; plan.disabled = key.disabled = fetchButton.disabled = saveKey.disabled = value; render(); };
    const invalidate = () => {
      version++; choices = []; selected.clear(); fetched = undefined; render();
      message('Connection changed. Fetch the catalog again.');
    };
    plan.addEventListener('change', () => { key.value = ''; keyLabel(); invalidate(); }); key.addEventListener('input', invalidate);
    saveKey.addEventListener('click', async () => {
      if (busy) return;
      if (!key.value.trim()) { message(savedKeys[plan.value] ? 'The API key is already saved.' : 'Enter your API key for the selected provider.', !savedKeys[plan.value]); return; }
      lock(true);
      try {
        check(await api.saveConnection({ provider: plan.value, apiKey: key.value.trim() }));
        savedKeys[plan.value] = true; key.value = ''; keyLabel(); invalidate();
        message('API key saved. You can close settings and reuse it later.');
      } catch (error) { message(error instanceof Error ? error.message : 'Could not save API key.', true); }
      finally { if (box.isConnected) lock(false); }
    });
    search.addEventListener('input', render);
    fetchButton.addEventListener('click', async () => {
      if (busy) return;
      const input = connection();
      if (!input.apiKey) { message('Enter your API key for the selected provider.', true); key.focus(); return; }
      const attempt = ++version; choices = []; selected.clear(); fetched = undefined; lock(true);
      message('Loading OpenCode models…');
      try {
        if (input.apiKey !== '__opencode_saved_key__') {
          check(await api.saveConnection({ provider: input.provider, apiKey: input.apiKey }));
          savedKeys[input.provider] = true; key.value = ''; keyLabel(); input.apiKey = '__opencode_saved_key__';
        }
        const result = check(await api.discoverModels({ provider: input.provider, apiKey: input.apiKey, apiUrl: input.apiUrl, apiFormat: input.apiFormat }));
        if (!box.isConnected || attempt !== version) return;
        const unique = new Map<string, Choice>();
        for (const model of result.models || []) if (typeof model.id === 'string' && model.id.trim()) unique.set(model.id, model);
        choices = [...unique.values()]; fetched = input;
        message(choices.length ? `${choices.length} models loaded. Check models, then click Add selected models to add them to the chat picker. No built-in model is replaced.` : `${chosen().label} returned no models for this provider.`);
      } catch (error) { if (box.isConnected && attempt === version) message(error instanceof Error ? error.message : 'Could not load models.', true); }
      finally { if (box.isConnected && attempt === version) lock(false); }
    });
    saveButton.addEventListener('click', async () => {
      if (busy || !selected.size || !fetched) return;
      const input = fetched, attempt = version; lock(true); let saved = 0;
      try {
        const existing = await api.getCustomModels();
        if (!box.isConnected || attempt !== version) return;
        for (const choice of choices.filter(model => selected.has(model.id))) {
          const prior = existing.find(model => model.provider === input.provider && model.externalModelName === choice.id && model.apiUrl === input.apiUrl);
          const name = prior?.name || `models/${input.provider}/${encodeURIComponent(choice.id)}`;
          if (!prior && existing.some(model => model.name === name)) throw new Error(`A different model already uses ${choice.id}. Rename that entry first.`);
          const model = { ...prior, ...input, name, externalModelName: choice.id,
            displayName: `${choice.displayName || choice.id} (${input.suffix})`,
            apiFormat: input.apiFormat, enabled: true, ...(prior ? { originalName: prior.name } : {}) };
          for (const field of ['contextWindow', 'maxOutputTokens', 'supportsVision', 'supportsThinking'] as const)
            if (choice[field] !== undefined) model[field] = choice[field];
          if (model.contextWindow && model.maxOutputTokens >= model.contextWindow) model.maxOutputTokens = model.contextWindow - 1;
          check(await api.saveCustomModel(model)); saved++; selected.delete(choice.id);
        }
        await onSaved(); key.value = ''; fetched = undefined; choices = []; selected.clear();
        message(`Added ${saved} models. Select one from the chat model picker. The API key is stored encrypted; generation has not been tested.`);
      } catch (error) {
        message(`${saved ? `${saved} models saved before the error. ` : ''}${error instanceof Error ? error.message : 'Could not save models.'}`, true);
        if (saved) await onSaved().catch(() => {});
      } finally { if (box.isConnected) lock(false); }
    });
  }
}
