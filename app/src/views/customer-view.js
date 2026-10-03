import { createCustomerAccess, getCustomer, resetCustomerPassword, setCustomerArchived } from '../api-client.js';
import { TabContainer } from '../components/tab-container.js';
import { renderClientHero } from '../components/client-hero.js';
import { renderAttachmentsCard } from '../components/attachments-card.js';
import { showToast } from '../components/toast.js';
import { icon } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { renderSidebar, invalidateSidebar } from '../components/sidebar.js';

/**
 * Feedback-tab stat strip (FR-013): completion %, last session date, and average
 * difficulty — computed only from real logged data (data-model.md → Feedback Stats).
 * Each value is null when there isn't enough data, so the tab can render an honest
 * empty state instead of a fabricated number.
 */
function buildFeedbackStats(feedback) {
  if (!feedback || !feedback.entries || feedback.entries.length === 0) {
    return { completionPercent: null, lastSessionDate: null, avgDifficultyLabel: null };
  }

  const trend = feedback.trend || { completionRate: null, points: [] };
  const completionPercent = trend.completionRate == null ? null : Math.round(trend.completionRate * 100);
  const lastSessionDate = feedback.entries[feedback.entries.length - 1]?.date || null;

  const scores = (trend.points || []).map((p) => p.difficultyScore).filter((s) => s != null);
  const avgDifficultyLabel = scores.length
    ? t(`difficulty.${Math.min(4, Math.max(1, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)))}`)
    : null;

  return { completionPercent, lastSessionDate, avgDifficultyLabel };
}

/**
 * Prepare tab configuration based on available data
 */
function buildTabConfig(data, { isCustomer = false } = {}) {
  const tabs = [
    {
      id: 'program',
      label: t('tabs.program'),
      // Always enabled: a client with no program yet gets a "Create week 1" prompt.
      isEnabled: true,
      contentType: 'program',
      order: 0,
    },
    {
      id: 'nutrition',
      label: t('tabs.nutrition'),
      isEnabled: true, // Always enabled; shows empty state if no nutrition plan
      contentType: 'nutrition',
      order: 1,
    },
    {
      id: 'feedback',
      // Always enabled — a client with zero entries still sees the Feedback tab,
      // showing an honest empty state rather than being hidden (US3 edge cases).
      label: t('tabs.feedback'),
      isEnabled: true,
      contentType: 'feedback',
      order: 2,
    },
    {
      id: 'progress',
      label: t('tabs.progress'),
      isEnabled: true, // Always enabled; shows the measurements form when there is no data yet
      contentType: 'progress',
      order: 3,
    },
    {
      id: 'notes',
      // Always enabled — a client with no notes.md still sees the Notes tab,
      // showing a dashed empty state rather than being hidden (FR-018).
      label: t('tabs.notes'),
      isEnabled: true,
      contentType: 'notes',
      order: 5,
    },
  ];
  // Seguimiento and Notas are the coach's: a customer's bar simply doesn't have them.
  return isCustomer ? tabs.filter((tab) => tab.id !== 'feedback' && tab.id !== 'notes') : tabs;
}

/**
 * Prepare tab data from customer data
 */
function buildTabData(customerData) {
  const program =
    customerData.program && customerData.program.present
      ? { ...customerData.program, weeks: customerData.programWeeks || [] }
      : null;

  const rawFeedback = customerData.feedback || { entries: [], trend: null };
  // Map API field names (date, felt, completed, difficulty, notes) to display model.
  // Always an object (never null) — the Feedback tab is always enabled and renders its
  // own honest empty states when entries is empty (FR-013, US3 edge cases).
  const feedbackData = {
    entries: (rawFeedback.entries || []).map((entry) => ({
      date: entry.date || 'N/A',
      exercise: entry.label || 'General', // Use label as exercise/session identifier
      howCustomerFelt: entry.felt || 'N/A', // API field is 'felt', not 'howFelt'
      completed: entry.completed || false,
      notes: entry.notes || '',
      overallImpression: entry.difficulty || 'N/A', // API field is 'difficulty', not 'impression'
    })),
    stats: buildFeedbackStats(rawFeedback),
    trend: rawFeedback.trend,
  };

  // Always an object (never null) — the Notes tab is always enabled; renders notes.html
  // directly when present, a dashed empty state otherwise (FR-017, FR-018). No synthetic
  // "observations"/"recommendations" content is ever fabricated here.
  const notes = {
    present: !!(customerData.notes && customerData.notes.present),
    html: (customerData.notes && customerData.notes.html) || null,
  };

  // Nutrition plan data: markdown content that will be rendered to HTML by marked library.
  // Always an object (never null) — Nutrition tab is always enabled; renders content when
  // present, empty state message otherwise.
  const nutrition = customerData.nutrition || { present: false, content: '', isEmpty: true };

  return {
    program,
    feedback: feedbackData,
    notes,
    nutrition,
    progress: customerData.measurements || { columns: [], rows: [] },
      };
}

// The coach gets full entries; a customer gets only completed days (same date/label/completed
// shape), which is all the Program tab's done marks read.
function feedbackEntriesOf(customerData) {
  return customerData.feedback?.entries || customerData.feedback?.completedDays || [];
}

// Coach-only: give this client sign-in access with a default password, or reset it.
function renderAccessPanel(slug, access, onChanged) {
  const section = document.createElement('section');
  section.className = 'card access-panel';
  const h2 = document.createElement('h2');
  h2.textContent = t('access.title');
  section.appendChild(h2);

  const message = document.createElement('p');
  message.className = 'field-error';
  message.setAttribute('role', 'alert');

  const hasAccess = !!access?.hasAccess;
  const status = document.createElement('p');
  status.className = 'form-intro';
  if (hasAccess) {
    status.textContent = `${access.email || ''} · ${access.mustChangePassword ? t('access.pending') : t('access.active')}`;
  } else {
    status.textContent = t('access.none');
  }
  section.appendChild(status);

  const form = document.createElement('form');
  form.className = 'feedback-form access-form';
  form.noValidate = true;
  const fieldRow = (labelText, input, name) => {
    const wrap = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = labelText;
    label.htmlFor = `access-${name}`;
    input.id = `access-${name}`;
    const error = document.createElement('p');
    error.className = 'field-error';
    error.setAttribute('aria-live', 'polite');
    wrap.append(label, input, error);
    return { wrap, input, error };
  };

  const rows = [];
  if (!hasAccess) {
    const email = document.createElement('input');
    Object.assign(email, { type: 'email', name: 'email', autocomplete: 'off', spellcheck: false });
    rows.push({ key: 'email', ...fieldRow(t('access.email'), email, 'email') });
  }
  const password = document.createElement('input');
  Object.assign(password, { type: 'text', name: 'defaultPassword', autocomplete: 'off', spellcheck: false });
  rows.push({ key: 'defaultPassword', ...fieldRow(t('access.defaultPassword'), password, 'password') });
  const hint = document.createElement('p');
  hint.className = 'form-intro';
  hint.textContent = `${t('access.defaultPasswordHint')} ${t('password.rules')}`;
  rows[rows.length - 1].wrap.appendChild(hint);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = hasAccess ? t('access.reset') : t('access.create');
  form.append(...rows.map((r) => r.wrap), message, submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.textContent = '';
    for (const r of rows) r.error.textContent = '';
    const values = Object.fromEntries(rows.map((r) => [r.key, r.input.value.trim()]));
    if (hasAccess ? false : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      rows[0].error.textContent = t('login.invalidEmail');
      return;
    }
    if (!(values.defaultPassword.length >= 8 && /\p{L}/u.test(values.defaultPassword) && /\d/.test(values.defaultPassword))) {
      rows[rows.length - 1].error.textContent = t('password.tooWeak');
      return;
    }
    submit.disabled = true;
    submit.textContent = hasAccess ? t('access.resetting') : t('access.creating');
    try {
      if (hasAccess) await resetCustomerPassword(slug, { defaultPassword: values.defaultPassword });
      else await createCustomerAccess(slug, values);
      showToast(hasAccess ? t('access.resetDone') : t('access.created'), 5000);
      await onChanged();
    } catch (err) {
      const fields = err.fields || {};
      for (const r of rows) if (fields[r.key]) r.error.textContent = fields[r.key];
      if (!Object.keys(fields).length) message.textContent = err.message;
      submit.disabled = false;
      submit.textContent = hasAccess ? t('access.reset') : t('access.create');
    }
  });

  section.appendChild(form);
  return section;
}

function renderCustomerSkeleton(container) {
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = `
    <div class="loading-skeleton" aria-hidden="true">
      <div class="skeleton-block skeleton-hero"></div>
      <div class="skeleton-block skeleton-tabs"></div>
      <div class="skeleton-block skeleton-panel"></div>
    </div>
  `;
}

export async function renderCustomer(container, slug, { role = 'coach' } = {}) {
  const isCustomer = role === 'customer';
  renderCustomerSkeleton(container);

  let data;
  try {
    data = await getCustomer(slug);
  } catch (err) {
    container.removeAttribute('aria-busy');
    container.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'page-header';
    const back = document.createElement('a');
    back.className = 'back-link';
    back.href = '#/';
    back.append(icon('caret-left'), t('common.allClients'));
    if (!isCustomer) header.appendChild(back);
    container.appendChild(header);
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || t('customer.loadFailed');
    container.appendChild(banner);
    return;
  }

  container.removeAttribute('aria-busy');
  container.innerHTML = '';
  // The page re-renders after an archive/restore so the hero, banner and sidebar agree.
  const onToggleArchived = async (archived) => {
    try {
      await setCustomerArchived(slug, archived);
      invalidateSidebar();
      showToast(archived ? t('archive.done') : t('archive.restored'));
      await renderCustomer(container, slug);
      await renderSidebar(document.getElementById('sidebar'), slug);
    } catch (err) {
      showToast(err.message || t('archive.failed'), 4000, 'error');
    }
  };
  container.appendChild(renderClientHero(data, { onToggleArchived: isCustomer ? null : onToggleArchived, isCustomer }));
  if (!isCustomer) container.appendChild(renderAccessPanel(slug, data.access, () => renderCustomer(container, slug, { role })));

  // Nutrition, Feedback, Log Session and Notes are always enabled, so there is
  // always at least one tab to show.
  const tabsContainer = document.createElement('div');
  container.appendChild(tabsContainer);
  let tabs = null;

  // The new check-in changes this client's status in the sidebar.
  const refreshSidebar = () => {
    invalidateSidebar();
    renderSidebar(document.getElementById('sidebar'), slug);
  };

  const mountTabs = (customerData) => {
    tabsContainer.innerHTML = '';
    tabs = new TabContainer(tabsContainer, buildTabConfig(customerData, { isCustomer }), buildTabData(customerData), {
      readOnly: isCustomer,
      slug,
      feedbackEntries: feedbackEntriesOf(customerData),
      onSessionLogged,
      onContentSaved,
      onMeasurementAdded,
    });
  };

  // A saved program week / notes / nutrition plan: reload, come back to the same tab.
  const onContentSaved = async (tabId) => {
    try {
      mountTabs(await getCustomer(slug));
      tabs.setActiveTab(tabId);
      showToast(t('common.saved'));
      refreshSidebar();
    } catch (err) {
      showToast(err.message || t('common.refreshFailed'), 3000, 'error');
    }
  };

  const onMeasurementAdded = async () => {
    try {
      mountTabs(await getCustomer(slug));
      tabs.setActiveTab('progress');
      showToast(t('toast.measurementsSaved'));
    } catch (err) {
      showToast(err.message || t('common.refreshFailed'), 3000, 'error');
    }
  };

  // "Mark done" on a Program day (specs/012 FR-007): confirm, then refresh the
  // Feedback panel and the sidebar in place. The coach stays on the Program tab.
  const onSessionLogged = async () => {
    showToast(t('toast.sessionLogged'));
    try {
      const updatedData = await getCustomer(slug);
      tabs.data.feedback = buildTabData(updatedData).feedback;
      tabs.setFeedbackEntries(feedbackEntriesOf(updatedData));
      tabs.rerenderPanel('feedback');
      refreshSidebar();
    } catch (err) {
      console.error('Failed to refresh after marking a day done:', err);
    }
  };

  mountTabs(data);

  container.appendChild(renderAttachmentsCard(slug, data.attachments ?? null, { readOnly: isCustomer }));
}
