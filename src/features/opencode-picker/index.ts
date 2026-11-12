/** Included directly in the sandbox preload by scripts/build-opencode-preload.mjs. */
namespace OpenCodePicker {
  interface Choice { id: string; displayName?: string; contextWindow?: number; maxOutputTokens?: number; supportsVision?: boolean; supportsThinking?: boolean }
  interface Result { success: boolean; error?: string; models?: Choice[] }
  interface Api {
    discoverModels(input: any): Promise<Result>;
    getCustomModels(): Promise<any[]>;
    saveCustomModel(input: any): Promise<Result>;
  }
  export function mount(parent: HTMLElement, api: Api, onSaved: () => Promise<void>): void {
    const box = document.createElement('div');
    box.id = 'oc-model-picker';
    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => {
      const node = document.createElement(tag);
      node.textContent = text;
      return node;
    };
    const field = (title: string, input: HTMLElement) => {
      const label = make('label'); label.className = 'agy-field';
      label.append(make('span', title), input); box.append(label);
    };
    const plan = make('select'); plan.id = 'oc-plan';
    for (const [id, title] of [['opencode-go', 'OpenCode Go'], ['opencode', 'OpenCode Console (Zen)']]) {
      const option = make('option', title); option.value = id; plan.append(option);
    }
    field('OpenCode plan', plan);
    const key = make('input'); key.id = 'oc-api-key'; key.type = 'password'; key.autocomplete = 'off';
    key.placeholder = 'OpenCode Console API key'; field('API key', key);
    const fetchButton = make('button', 'Fetch OpenCode models'); fetchButton.type = 'button';
    fetchButton.className = 'agy-btn agy-primary'; box.append(fetchButton);
    const search = make('input'); search.type = 'search'; search.placeholder = 'Search models';
    field('Search OpenCode models', search);
    const list = make('div'); list.style.cssText = 'max-height:280px;overflow:auto;display:grid;gap:8px;margin:12px 0'; box.append(list);
    const saveButton = make('button', 'Add selected models'); saveButton.type = 'button';
    saveButton.className = 'agy-btn'; saveButton.disabled = true; box.append(saveButton);
    const status = make('p', 'Enter your API key to load the live model catalog.');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); box.append(status);
    parent.append(box);
    let choices: Choice[] = [], selected = new Set<string>(), version = 0, busy = false;
    let fetched: { provider: string; apiKey: string; apiUrl: string } | undefined;
    const connection = () => ({ provider: plan.value, apiKey: key.value.trim(),
      apiUrl: `https://opencode.ai/inference/${plan.value === 'opencode-go' ? 'go/' : ''}openai/v1/chat/completions` });
    const message = (text: string, error = false) => { status.textContent = text; status.className = error ? 'agy-status agy-error' : 'agy-status'; };
    const check = (result: Result) => { if (!result?.success) throw new Error(result?.error || 'OpenCode request failed.'); return result; };
    const render = () => {
      list.replaceChildren();
      const query = search.value.trim().toLowerCase();
      const visible = choices.filter(model => `${model.id} ${model.displayName || ''}`.toLowerCase().includes(query));
      for (const model of visible) {
        const label = make('label'); label.style.cssText = 'display:flex;align-items:center;gap:8px';
        const checkbox = make('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(model.id); checkbox.disabled = busy;
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) selected.add(model.id); else selected.delete(model.id);
          saveButton.disabled = busy || !selected.size;
          saveButton.textContent = selected.size ? `Add selected models (${selected.size})` : 'Add selected models';
        });
        label.append(checkbox, make('span', model.displayName && model.displayName !== model.id ? `${model.displayName} · ${model.id}` : model.id)); list.append(label);
      }
      if (choices.length && !visible.length) list.append(make('p', 'No matching models.'));
      saveButton.disabled = busy || !selected.size;
      saveButton.textContent = selected.size ? `Add selected models (${selected.size})` : 'Add selected models';
    };
    const lock = (value: boolean) => { busy = value; plan.disabled = key.disabled = fetchButton.disabled = value; render(); };
    const invalidate = () => {
      version++; choices = []; selected.clear(); fetched = undefined; render();
      message('Connection changed. Fetch the catalog again.');
    };
    plan.addEventListener('change', invalidate); key.addEventListener('input', invalidate);
    search.addEventListener('input', render);
    fetchButton.addEventListener('click', async () => {
      if (busy) return;
      const input = connection();
      if (!input.apiKey) { message('Enter your OpenCode API key.', true); key.focus(); return; }
      const attempt = ++version; choices = []; selected.clear(); fetched = undefined; lock(true);
      message('Loading OpenCode models…');
      try {
        const result = check(await api.discoverModels({ ...input, apiFormat: 'openai' }));
        if (!box.isConnected || attempt !== version) return;
        const unique = new Map<string, Choice>();
        for (const model of result.models || []) if (typeof model.id === 'string' && model.id.trim()) unique.set(model.id, model);
        choices = [...unique.values()]; fetched = input;
        message(choices.length ? `${choices.length} models loaded. Select the models to add. Generation has not been tested.` : 'OpenCode returned no models for this plan.');
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
            displayName: `${choice.displayName || choice.id} (${input.provider === 'opencode-go' ? 'OpenCode Go' : 'OpenCode'})`,
            apiFormat: 'openai', enabled: true, ...(prior ? { originalName: prior.name } : {}) };
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
