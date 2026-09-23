import { getCustomer } from '../api-client.js';
import { renderFeedbackForm } from './feedback-form-view.js';
import { TabContainer } from '../components/tab-container.js';
import { renderClientHero } from '../components/client-hero.js';
import { showToast } from '../components/toast.js';

// Make renderFeedbackForm available globally for TabContainer
window.renderFeedbackForm = renderFeedbackForm;

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DIFFICULTY_LABELS = { 1: 'Easy', 2: 'Moderate', 3: 'Hard', 4: 'Brutal' };

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
    ? DIFFICULTY_LABELS[Math.min(4, Math.max(1, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)))]
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
      label: 'Program',
      isEnabled: data.program && data.program.present,
      contentType: 'program',
      order: 0,
    },
    {
      id: 'nutrition',
      label: 'Nutrition Plan',
      isEnabled: true, // Always enabled; shows empty state if no nutrition plan
      contentType: 'nutrition',
      order: 1,
    },
    {
      id: 'feedback',
      // Always enabled — a client with zero entries still sees the Feedback tab,
      // showing an honest empty state rather than being hidden (US3 edge cases).
      label: 'Feedback',
      isEnabled: true,
      contentType: 'feedback',
      order: 2,
    },
    {
      id: 'add-entry',
      label: 'Log Session',
      isEnabled: true, // Always enabled for adding feedback
      contentType: 'add-entry',
      order: 3,
    },
    {
      id: 'notes',
      // Always enabled — a client with no notes.md still sees the Notes tab,
      // showing a dashed empty state rather than being hidden (FR-018).
      label: 'Notes',
      isEnabled: true,
      contentType: 'notes',
      order: 4,
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
    'add-entry': {}, // Placeholder for form tab (form rendered via global renderFeedbackForm function)
  };
}

function renderAttachments(container, attachments) {
  if (!attachments.length) return;
  const section = document.createElement('section');
  section.className = 'card attachments';
  const h2 = document.createElement('h2');
  h2.textContent = 'Attachments';
  section.appendChild(h2);
  const ul = document.createElement('ul');
  for (const a of attachments) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/customer-files/${a.relativePath}`;
    link.textContent = a.relativePath;
    li.appendChild(link);
    li.appendChild(document.createTextNode(` (${formatBytes(a.sizeBytes)})`));
    ul.appendChild(li);
  }
  section.appendChild(ul);
  container.appendChild(section);
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
    header.innerHTML = '<a class="back-link" href="#/">&larr; All clients</a>';
    container.appendChild(header);
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || 'Failed to load this customer.';
    container.appendChild(banner);
    return;
  }

  container.removeAttribute('aria-busy');
  container.innerHTML = '';
  container.appendChild(renderClientHero(data));

  // Build tab configuration and data
  const tabConfig = buildTabConfig(data);
  const tabData = buildTabData(data);

  // Create tab container with at least one tab enabled
  const enabledTabs = tabConfig.filter((t) => t.isEnabled);
  if (enabledTabs.length === 0) {
    const noData = document.createElement('p');
    noData.className = 'empty-state';
    noData.textContent = 'No data available for this customer.';
    container.appendChild(noData);
  } else {
    const tabsContainer = document.createElement('div');
    container.appendChild(tabsContainer);

    // Callback when new feedback is added - refreshes the feedback data, confirms the
    // save, and hands the coach off to the Feedback tab (FR-016).
    const onFeedbackAdded = async (newEntry) => {
      // Reload customer data to get updated feedback
      try {
        const updatedData = await getCustomer(slug);
        const updatedTabConfig = buildTabConfig(updatedData);
        const updatedTabData = buildTabData(updatedData);

        // Replace the tab container with updated data
        tabsContainer.innerHTML = '';
        const refreshed = new TabContainer(tabsContainer, updatedTabConfig, updatedTabData, {
          slug,
          feedbackTemplate: data.feedback?.template,
          onFeedbackAdded,
        });
        refreshed.setActiveTab('feedback');
        showToast('Saved · view in Feedback');
      } catch (err) {
        console.error('Failed to refresh feedback:', err);
      }
    };

    // Create tab container with feedback form support
    new TabContainer(tabsContainer, tabConfig, tabData, {
      slug,
      feedbackTemplate: data.feedback?.template,
      onFeedbackAdded,
    });
  }

  renderAttachments(container, data.attachments);
}
