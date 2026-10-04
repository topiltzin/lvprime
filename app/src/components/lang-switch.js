import { LANGS, getLang, setLang, t } from '../lib/i18n.js';

// ES / EN segmented switch in the header. Shown on the sign-in page too; choosing a
// language saves it for this browser and reloads (src/lib/i18n.js).
export function renderLangSwitch(el) {
  el.replaceChildren();
  const group = document.createElement('div');
  group.className = 'lang-switch';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('lang.groupLabel'));
  for (const lang of LANGS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lang-option';
    button.lang = lang;
    button.textContent = lang.toUpperCase();
    button.title = t(`lang.${lang}`);
    button.setAttribute('aria-label', t(`lang.${lang}`));
    button.setAttribute('aria-pressed', String(lang === getLang()));
    button.addEventListener('click', () => setLang(lang));
    group.appendChild(button);
  }
  el.appendChild(group);
}

/** The static shell in index.html: page language, title and header labels. */
export function translateShell() {
  document.documentElement.lang = getLang();
  document.title = t('app.title');
  document.querySelector('.app-header .logo')?.setAttribute('aria-label', t('app.logoLabel'));
  const subtitle = document.querySelector('.logo-subtitle');
  if (subtitle) subtitle.textContent = t('app.subtitle');
  const chip = document.querySelector('#header-account .header-chip');
  if (chip) chip.textContent = t('app.workspace');
  document.getElementById('sidebar')?.setAttribute('aria-label', t('app.sidebarLabel'));
  const legal = document.getElementById('site-footer-nav');
  if (legal) {
    legal.setAttribute('aria-label', t('app.legalLabel'));
    const [privacy, terms, support] = legal.querySelectorAll('a');
    privacy.textContent = t('app.privacy');
    terms.textContent = t('app.terms');
    support.textContent = t('app.support');
  }
}
