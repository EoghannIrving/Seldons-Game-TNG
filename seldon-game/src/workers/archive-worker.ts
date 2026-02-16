import { NarrativeGenerator } from '../core/narrative';
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

function buildNarrativeHtml(state: GalaxyState, currentPhase: number): string {
  let html = '';
  html += `<h3 style="color: var(--text-main); border-bottom: 1px solid var(--text-dim); padding-bottom: 10px; font-family: 'Space Mono', monospace;">The History of the Galaxy</h3>`;

  let hasEntries = false;
  for (let p = currentPhase; p >= 0; p--) {
    const narrative = NarrativeGenerator.generatePhaseNarrative(state, p);
    const isSignificant = !narrative.includes('passed without major incident') || p % 50 === 0 || p === 0;

    if (isSignificant) {
      hasEntries = true;
      html += `
        <div style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid var(--text-dim);">
          <span style="color: var(--accent); font-weight: bold; font-size: 1.1em; font-family: 'Space Mono', monospace; display: block; margin-bottom: 5px;">Phase ${p}</span>
          <p style="margin: 0;">${narrative}</p>
        </div>
      `;
    }
  }

  if (!hasEntries) {
    html += `<p>No significant history recorded yet.</p>`;
  }

  return html;
}

function serializeExportJson(exportData: unknown, pretty: boolean): string {
  return JSON.stringify(exportData, null, pretty ? 2 : 0);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

self.onmessage = (event: MessageEvent<ArchiveWorkerRequest>) => {
  const request = event.data;

  try {
    let result = '';
    if (request.type === 'build-narrative-html') {
      result = buildNarrativeHtml(request.payload.state, request.payload.currentPhase);
    } else if (request.type === 'serialize-export-json') {
      result = serializeExportJson(request.payload.exportData, request.payload.pretty);
    } else {
      throw new Error('Unsupported archive worker request');
    }

    const response: ArchiveWorkerResponse = {
      requestId: request.requestId,
      ok: true,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ArchiveWorkerResponse = {
      requestId: request.requestId,
      ok: false,
      error: toErrorMessage(error),
    };
    self.postMessage(response);
  }
};

export {};
