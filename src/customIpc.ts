/** Addon-owned channels only; vendor desktop APIs are left intact. */
import { app, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as cryptoStore from './cryptoStore';
import { createModelManager } from './modelManagement';
import { createModelActions } from './modelActions';
import { createOpenCodeConnections } from './features/opencode-connection';

export function registerCustomModelHandlers(): void {
  const manager = createModelManager(path.join(app.getPath('home'), '.gemini', 'antigravity', 'opencode-model-bridge'), cryptoStore, (url) =>
    shell.openExternal(url),
  );
  const handle = (channel: string, action: (...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return await action(...args);
      } catch (error) {
        if (channel === 'storage:get-custom-models' || channel === 'storage:export-custom-models') throw error;
        const status = (error as { status?: number }).status;
        return { success: false, error: (error as Error).message, ...(status ? { status } : {}) };
      }
    });
  };
  const connections = createOpenCodeConnections(path.dirname(manager.store.filename), cryptoStore, () => manager.store.read());
  handle('opencode:connection-status', connections.status);
  handle('opencode:save-connection', connections.save);
  for (const [channel, action] of Object.entries(createModelActions(manager))) {
    if (channel === 'storage:discover-models' || channel === 'storage:save-custom-model') {
      handle(channel, (input) => action(connections.resolve(input)));
    } else handle(channel, action);
  }
}
