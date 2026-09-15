// Transient save-confirmation toast (FR-016). Dependency-free — a single role="status"
// element appended to <body> and auto-removed, per research.md §9.
export function showToast(message, durationMs = 2000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 200);
  }, durationMs);
}
