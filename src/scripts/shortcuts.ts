// C5: Keyboard shortcuts for 21bristoe.com
// Compiled to an external file by Vite — fully CSP-compliant (script-src 'self').

interface Shortcut { label: string; fn: () => void }

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const shortcuts: Record<string, Shortcut> = {
  'g': { label: 'Gallery',       fn: () => { location.href = '/gallery'; } },
  'h': { label: 'Home',          fn: () => { location.href = '/'; } },
  'n': { label: 'Neighborhood',  fn: () => scrollToId('neighborhood') },
  'l': { label: 'Limón',         fn: () => scrollToId('limon') },
  'q': { label: 'Quick links',   fn: () => scrollToId('quicklinks') },
  '?': { label: 'This overlay',  fn: toggleHelp },
};

// Build help overlay (appended to body once)
const overlay = document.createElement('div');
overlay.className = 'shortcut-overlay';
overlay.setAttribute('hidden', '');
overlay.setAttribute('role', 'dialog');
overlay.setAttribute('aria-modal', 'true');
overlay.setAttribute('aria-label', 'Keyboard shortcuts');

const panel = document.createElement('div');
panel.className = 'shortcut-panel';
panel.innerHTML = `
  <h2>Keyboard Shortcuts</h2>
  <div class="shortcut-list">
    ${Object.entries(shortcuts).map(([key, { label }]) => `
      <div class="shortcut-row">
        <kbd>${key}</kbd>
        <span>${label}</span>
      </div>
    `).join('')}
  </div>
  <button class="shortcut-close" type="button">Close</button>
`;
overlay.appendChild(panel);
document.body.appendChild(overlay);

panel.querySelector('.shortcut-close')!.addEventListener('click', closeHelp);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHelp(); });

function openHelp()  { overlay.removeAttribute('hidden'); }
function closeHelp() { overlay.setAttribute('hidden', ''); }
function toggleHelp() { overlay.hasAttribute('hidden') ? openHelp() : closeHelp(); }

document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Ignore when typing in inputs
  if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { closeHelp(); return; }

  const key = e.key === '?' ? '?' : e.key.toLowerCase();
  if (key in shortcuts) {
    e.preventDefault();
    shortcuts[key].fn();
  }
});
