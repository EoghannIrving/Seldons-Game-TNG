
export type NotificationType = 'info' | 'success' | 'warning' | 'danger';

/**
 * Displays a toast notification on the screen.
 *
 * @param text The message to display.
 * @param type The type of notification, which affects its color and icon.
 * @param onClick An optional callback to execute when the notification is clicked.
 */
export function showNotification(
  text: string,
  type: NotificationType = 'info',
  onClick?: () => void
) {
  const notificationArea = document.getElementById('notificationArea');
  if (!notificationArea) return;

  const el = document.createElement('div');
  el.className = `notification-toast ${type}`;

  // Add icon based on type
  let icon = 'ℹ️';
  if (type === 'success') icon = '👑';
  if (type === 'warning') icon = '⚠️';
  if (type === 'danger') icon = '🔥';

  el.innerHTML = `<span class="notification-icon">${icon}</span> <span>${text}</span>`;

  if (onClick) {
    el.classList.add('clickable');
    el.title = 'Click for details';
    
    // Add "view" hint
    const hint = document.createElement('span');
    hint.textContent = ' 🔍';
    hint.classList.add('notification-hint');
    el.appendChild(hint);

    el.onclick = () => {
      onClick();
      // Remove notification immediately on click
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }

  notificationArea.appendChild(el);

  // Remove after 5 seconds
  setTimeout(() => {
    el.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 500);
  }, 5000);
}
