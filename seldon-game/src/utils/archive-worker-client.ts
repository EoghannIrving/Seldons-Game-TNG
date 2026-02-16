import { GalaxyState } from '../core/types';

type ArchiveWorkerRequest =
  | {
      requestId: string;
      type: 'build-narrative-html';
      payload: { state: GalaxyState; currentPhase: number };
    }
  | {
      requestId: string;
      type: 'serialize-export-json';
      payload: { exportData: unknown; pretty: boolean };
    };

type ArchiveWorkerResponse =
  | {
      requestId: string;
      ok: true;
      result: string;
    }
  | {
      requestId: string;
      ok: false;
      error: string;
    };

interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}

function newRequestId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

export class ArchiveWorkerClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();

  constructor() {
    if (typeof Worker === 'undefined') return;

    try {
      this.worker = new Worker(new URL('../workers/archive-worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent<ArchiveWorkerResponse>) => {
        const response = event.data;
        const pending = this.pending.get(response.requestId);
        if (!pending) return;
        this.pending.delete(response.requestId);

        if (response.ok) {
          pending.resolve(response.result);
          return;
        }

        pending.reject(new Error(response.error));
      };

      this.worker.onerror = (event) => {
        const error = new Error(`Archive worker error: ${event.message}`);
        for (const req of this.pending.values()) {
          req.reject(error);
        }
        this.pending.clear();
      };
    } catch (error) {
      console.warn('Failed to initialize archive worker. Falling back to main thread.', error);
      this.worker = null;
    }
  }

  isAvailable(): boolean {
    return this.worker !== null;
  }

  async buildNarrativeHtml(state: GalaxyState, currentPhase: number): Promise<string> {
    return this.request({
      requestId: newRequestId(),
      type: 'build-narrative-html',
      payload: { state, currentPhase },
    });
  }

  async serializeExportJson(exportData: unknown, pretty: boolean = true): Promise<string> {
    return this.request({
      requestId: newRequestId(),
      type: 'serialize-export-json',
      payload: { exportData, pretty },
    });
  }

  terminate(): void {
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private request(message: ArchiveWorkerRequest): Promise<string> {
    if (!this.worker) {
      return Promise.reject(new Error('Archive worker unavailable'));
    }

    return new Promise<string>((resolve, reject) => {
      this.pending.set(message.requestId, { resolve, reject });
      this.worker!.postMessage(message);
    });
  }
}

