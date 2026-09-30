import { getCustomer, setCustomerArchived } from '../api-client.js';
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
function buildTabConfig(data) {
  return [
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
      id: 'add-entry',
      label: t('tabs.add-entry'),
      isEnabled: true, // Always enabled for adding feedback
      contentType: 'add-entry',
      order: 4,
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
    'add-entry': {}, // Placeholder for form tab (form rendered via global renderFeedbackForm function)
  };
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

export async function renderCustomer(container, slug) {
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
    header.appendChild(back);
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
  container.appendChild(renderClientHero(data, { onToggleArchived }));

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
    tabs = new TabContainer(tabsContainer, buildTabConfig(customerData), buildTabData(customerData), {
      slug,
      feedbackTemplate: data.feedback?.template,
      feedbackEntries: customerData.feedback?.entries || [],
      onFeedbackAdded,
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

  // Callback when new feedback is added - refreshes the feedback data, confirms the
  // save, and hands the coach off to the Feedback tab (FR-016).
  const onFeedbackAdded = async () => {
    try {
      mountTabs(await getCustomer(slug));
      tabs.setActiveTab('feedback');
      showToast(t('toast.feedbackSaved'));
      refreshSidebar();
    } catch (err) {
      console.error('Failed to refresh feedback:', err);
    }
  };

  // "Mark done" on a Program day (specs/012 FR-007): confirm, then refresh the
  // Feedback panel and the sidebar in place. The coach stays on the Program tab.
  const onSessionLogged = async () => {
    showToast(t('toast.sessionLogged'));
    try {
      const updatedData = await getCustomer(slug);
      tabs.data.feedback = buildTabData(updatedData).feedback;
      tabs.setFeedbackEntries(updatedData.feedback?.entries || []);
      tabs.rerenderPanel('feedback');
      refreshSidebar();
    } catch (err) {
      console.error('Failed to refresh after marking a day done:', err);
    }
  };

  mountTabs(data);

  container.appendChild(renderAttachmentsCard(slug, data.attachments ?? null));
}
