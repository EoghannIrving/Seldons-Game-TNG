// Track which modals have been initialized to avoid duplicate listeners
const initializedModals = new Set<string>();

/**
 * Initialize modal close functionality
 * Sets up event listeners once per modal
 */
function initializeModal(modal: HTMLElement) {
  const modalId = modal.id;

  // Skip if already initialized
  if (initializedModals.has(modalId)) {
    return;
  }

  const close = () => {
    modal.classList.remove('show');
  };

  // Find all buttons within the modal
  const allButtons = modal.querySelectorAll('button');

  // Look for close/cancel buttons
  const closeButtons: HTMLButtonElement[] = [];
  allButtons.forEach((btn) => {
    const btnId = btn.id.toLowerCase();
    const btnText = btn.textContent?.toLowerCase() || '';
    const btnClass = btn.className.toLowerCase();

    // Match buttons that are cancel/close buttons
    if (
      btnId.includes('cancel') ||
      btnId.includes('close') ||
      btnText.includes('cancel') ||
      btnText.includes('close') ||
      btnClass.includes('close') ||
      btnClass.includes('cancel')
    ) {
      closeButtons.push(btn);
    }
  });

  // Attach click listeners to close buttons
  closeButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    }, { capture: false });
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      close();
    }
  });

  // Mark as initialized
  initializedModals.add(modalId);
}

/**
 * Finds and displays a modal dialog defined in the HTML.
 *
 * @param modalId The ID of the modal element to display.
 */
export function showModal(modalId: string) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error(`Modal with id #${modalId} not found.`);
    return;
  }

  // Initialize modal listeners on first use
  initializeModal(modal);

  // Show the modal
  modal.classList.add('show');
}
