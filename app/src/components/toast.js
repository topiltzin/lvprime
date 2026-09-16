// Transient save-confirmation toast (FR-016). Dependency-free — a single role="status"
// element appended to <body> and auto-removed, per research.md §9.
// variant 'error' (contracts/pdf-export-download.md FR-009) reuses the same component
// with a danger-colored treatment instead of a separate error-banner element.
export function showToast(message, durationMs = 2000, variant = 'default') {
  const toast = document.createElement('div');
  toast.className = variant === 'error' ? 'toast toast-error' : 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 200);
  }, durationMs);
}
