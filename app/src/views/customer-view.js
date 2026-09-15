import { getCustomer } from '../api-client.js';
import { renderTrendChart } from '../components/trend-chart.js';
import { renderFeedbackEntry } from '../components/feedback-entry.js';
import { renderFeedbackForm } from './feedback-form-view.js';
import { TabContainer } from '../components/tab-container.js';

// Make renderFeedbackForm available globally for TabContainer
window.renderFeedbackForm = renderFeedbackForm;

function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      id: 'feedback',
      label: 'Feedback',
      isEnabled: data.feedback && data.feedback.entries && data.feedback.entries.length > 0,
      contentType: 'feedback',
      order: 1,
    },
    {
      id: 'add-entry',
      label: 'Add Entry',
      isEnabled: true, // Always enabled for adding feedback
      contentType: 'add-entry',
      order: 2,
    },
    {
      id: 'history',
      label: 'History',
      isEnabled: data.feedback && data.feedback.entries && data.feedback.entries.length > 0,
      contentType: 'history',
      order: 3,
    },
    {
      id: 'notes',
      label: 'Notes',
      isEnabled: data.notes && data.notes.present,
      contentType: 'notes',
      order: 4,
    },
  ];
}

/**
 * Prepare tab data from customer data
 */
function buildTabData(customerData) {
  const program = customerData.program && customerData.program.present ? customerData.program : null;

  // Build feedback data from entries
  // Map API field names (date, felt, completed, difficulty, notes) to display model
  const feedbackData = customerData.feedback && customerData.feedback.entries
    ? {
        entries: customerData.feedback.entries.map((entry) => ({
          date: entry.date || 'N/A',
          exercise: entry.label || 'General', // Use label as exercise/session identifier
          howCustomerFelt: entry.felt || 'N/A', // API field is 'felt', not 'howFelt'
          completed: entry.completed || false,
          notes: entry.notes || '',
          overallImpression: entry.difficulty || 'N/A', // API field is 'difficulty', not 'impression'
        })),
      }
    : null;

  // Build history data by aggregating feedback
  const historyData = feedbackData
    ? {
        sessionsCompleted: feedbackData.entries.filter((e) => e.completed).length,
        sessionsProgrammed: feedbackData.entries.length,
        completionRate:
          feedbackData.entries.length > 0
            ? feedbackData.entries.filter((e) => e.completed).length / feedbackData.entries.length
            : 0,
        avgDifficulty:
          feedbackData.entries.length > 0
            ? feedbackData.entries.reduce(
                (acc, e) => {
                  if (e.overallImpression === 'Hard') acc.hard++;
                  else if (e.overallImpression === 'Moderate') acc.moderate++;
                  else if (e.overallImpression === 'Easy') acc.easy++;
                  return acc;
                },
                { easy: 0, moderate: 0, hard: 0 }
              ) &&
              (() => {
                const counts = feedbackData.entries.reduce(
                  (acc, e) => {
                    if (e.overallImpression === 'Hard') acc.hard++;
                    else if (e.overallImpression === 'Moderate') acc.moderate++;
                    else if (e.overallImpression === 'Easy') acc.easy++;
                    return acc;
                  },
                  { easy: 0, moderate: 0, hard: 0 }
                );
                if (counts.hard > counts.moderate && counts.hard > counts.easy) return 'Hard';
                if (counts.easy > counts.moderate && counts.easy > counts.hard) return 'Easy';
                return 'Moderate';
              })()
            : 'N/A',
        highlights: ['Program is progressing well', 'Consistent session completion'],
      }
    : null;

  const notes = customerData.notes && customerData.notes.present
    ? {
        observations: [{ date: 'Latest', observation: 'Customer showing good progress' }],
        recommendations: [
          { date: 'Latest', recommendation: 'Continue with current program', rationale: 'Based on recent performance' },
        ],
      }
    : null;

  return {
    program,
    feedback: feedbackData,
    history: historyData,
    notes,
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

export async function renderCustomer(container, slug) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = '<a class="back-link" href="#/">&larr; All customers</a>';
  container.appendChild(header);

  let data;
  try {
    data = await getCustomer(slug);
  } catch (err) {
    const banner = document.createElement('div');
    banner.className = 'error-banner';
    banner.textContent = err.message || 'Failed to load this customer.';
    container.appendChild(banner);
    return;
  }

  const title = document.createElement('h1');
  title.textContent = data.displayName;
  container.appendChild(title);

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

    // Callback when new feedback is added - refreshes the feedback data
    const onFeedbackAdded = async (newEntry) => {
      // Reload customer data to get updated feedback
      try {
        const updatedData = await getCustomer(slug);
        const updatedTabConfig = buildTabConfig(updatedData);
        const updatedTabData = buildTabData(updatedData);

        // Replace the tab container with updated data
        tabsContainer.innerHTML = '';
        new TabContainer(tabsContainer, updatedTabConfig, updatedTabData, {
          slug,
          feedbackTemplate: data.feedback?.template,
          onFeedbackAdded,
        });
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
