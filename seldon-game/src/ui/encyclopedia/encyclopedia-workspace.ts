export function getOrCreateEncyclopediaWorkspace(
  gameContainer: HTMLDivElement | null,
  doc: Document = document
): HTMLDivElement | null {
  if (!gameContainer) return null;
  let workspace = gameContainer.querySelector('#encyclopediaWorkspace') as HTMLDivElement | null;
  if (!workspace) {
    workspace = doc.createElement('div');
    workspace.id = 'encyclopediaWorkspace';
    gameContainer.appendChild(workspace);
  }
  return workspace;
}

export function renderEncyclopediaLoadingStateUI(args: {
  contextualNav: HTMLElement | null;
  workspace: HTMLDivElement | null;
}): void {
  const { contextualNav, workspace } = args;
  if (!contextualNav) return;
  contextualNav.innerHTML = `
    <div class="panel">
      <h3>ENCYCLOPEDIA CONTROLS</h3>
      <div class="encyclopedia-content">
        <p>Preparing filters...</p>
      </div>
    </div>
  `;

  if (workspace) {
    workspace.innerHTML = `
      <div class="encyclopedia-workspace-loading">
        <h2>Encyclopedia Workspace</h2>
        <p>Loading archive...</p>
      </div>
    `;
  }
}
