/**
 * Customer Tab Container Component
 * Main component for managing tabbed interface for customer data
 */

export class TabContainer {
  constructor(containerEl, tabs, data, options = {}) {
    this.containerEl = containerEl;
    this.tabs = tabs; // Array of TabConfig: { id, label, icon?, isEnabled, contentType, order }
    this.data = data; // Object with program, feedback, history, notes data
    this.activeTabId = 'program'; // Default tab (session-scoped, resets on mount)
    this.tabElements = {};
    this.panelElements = {};

    // Options for feedback form integration
    this.slug = options.slug; // Customer slug for feedback API calls
    this.feedbackTemplate = options.feedbackTemplate; // Feedback template for form rendering
    this.onFeedbackAdded = options.onFeedbackAdded; // Callback when new feedback is added

    this.render();
    this.attachEventListeners();
  }

  render() {
    // Clear container
    this.containerEl.innerHTML = '';

    // Create header with tab buttons
    const header = this.createTabHeader();
    this.containerEl.appendChild(header);

    // Create content panels container
    const panelsContainer = document.createElement('div');
    panelsContainer.className = 'tab-panels-container';

    // Create tab panels for enabled tabs
    this.tabs.forEach((tab) => {
      if (tab.isEnabled) {
        const panel = this.createTabPanel(tab);
        panelsContainer.appendChild(panel);
      }
    });

    this.containerEl.appendChild(panelsContainer);

    // Set initial active tab
    this.setActiveTab(this.activeTabId);
  }

  createTabHeader() {
    const header = document.createElement('div');
    header.className = 'tab-header';
    header.setAttribute('role', 'tablist');

    this.tabs.forEach((tab) => {
      if (tab.isEnabled) {
        const button = document.createElement('button');
        button.className = 'tab-button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        button.setAttribute('aria-controls', `tab-panel-${tab.id}`);
        button.dataset.tabId = tab.id;
        button.textContent = tab.label;

        this.tabElements[tab.id] = button;
        header.appendChild(button);
      }
    });

    return header;
  }

  createTabPanel(tab) {
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.id = `tab-panel-${tab.id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;

    // Render content based on contentType
    const contentEl = this.renderTabContent(tab);
    panel.appendChild(contentEl);

    this.panelElements[tab.id] = panel;
    return panel;
  }

  renderTabContent(tab) {
    const container = document.createElement('div');
    container.className = `tab-content tab-content-${tab.contentType}`;

    const data = this.data[tab.contentType];

    if (!data || (Array.isArray(data) && data.length === 0)) {
      // Empty state
      const emptyMsg = this.getEmptyStateMessage(tab.contentType);
      const emptyEl = document.createElement('p');
      emptyEl.className = 'empty-state';
      emptyEl.textContent = emptyMsg;
      container.appendChild(emptyEl);
      return container;
    }

    // Render content based on content type (delegated to specific renderers)
    switch (tab.contentType) {
      case 'program':
        this.renderProgramContent(container, data);
        break;
      case 'feedback':
        this.renderFeedbackContent(container, data);
        break;
      case 'history':
        this.renderHistoryContent(container, data);
        break;
      case 'notes':
        this.renderNotesContent(container, data);
        break;
      case 'add-entry':
        this.renderAddEntryContent(container, data);
        break;
    }

    return container;
  }

  renderProgramContent(container, program) {
    const meta = document.createElement('p');
    meta.className = 'summary-line';
    meta.textContent = [
      program.goal ? `Goal: ${program.goal}` : null,
      program.fitnessLevel ? `Level: ${program.fitnessLevel}` : null,
      program.sessionDuration ? `Duration: ${program.sessionDuration}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    container.appendChild(meta);

    if (program.weeklySchedule && program.weeklySchedule.length) {
      const scheduleSection = document.createElement('div');
      scheduleSection.className = 'weekly-schedule';
      for (const day of program.weeklySchedule) {
        const block = document.createElement('div');
        block.className = 'day-block';
        const h3 = document.createElement('h3');
        h3.textContent = day.focus ? `${day.day} — ${day.focus}` : day.day;
        block.appendChild(h3);
        const body = document.createElement('div');
        body.innerHTML = day.html || '';
        block.appendChild(body);
        scheduleSection.appendChild(block);
      }
      container.appendChild(scheduleSection);
    }

    if (program.progressionHtml) {
      const progression = document.createElement('div');
      progression.innerHTML = program.progressionHtml;
      container.appendChild(progression);
    }
  }

  renderFeedbackContent(container, feedbackData) {
    // Title for feedback list
    const listTitle = document.createElement('h3');
    listTitle.textContent = 'Session History';
    container.appendChild(listTitle);

    // Render previous feedback entries
    if (feedbackData.entries && feedbackData.entries.length) {
      const list = document.createElement('div');
      list.className = 'feedback-list';

      feedbackData.entries.forEach((entry) => {
        const entryEl = document.createElement('div');
        entryEl.className = 'feedback-entry';
        entryEl.innerHTML = `
          <div class="feedback-meta">
            <strong>${entry.date || 'N/A'}</strong> — ${entry.exercise || 'General'}
          </div>
          <div class="feedback-body">
            <p><strong>How felt:</strong> ${entry.howCustomerFelt || 'N/A'}</p>
            <p><strong>Completed:</strong> ${entry.completed ? 'Yes' : 'No'}</p>
            <p><strong>Overall impression:</strong> ${entry.overallImpression || 'N/A'}</p>
            <p><strong>Notes:</strong> ${entry.notes || 'N/A'}</p>
          </div>
        `;
        list.appendChild(entryEl);
      });
      container.appendChild(list);
    } else {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-state';
      emptyMsg.textContent = 'No sessions logged yet. Go to "Add Entry" tab to log your first feedback.';
      container.appendChild(emptyMsg);
    }
  }

  renderAddEntryContent(container, feedbackData) {
    // Title for form
    const formTitle = document.createElement('h3');
    formTitle.textContent = 'Log New Session';
    container.appendChild(formTitle);

    // Add feedback form if available
    if (this.slug && this.feedbackTemplate && this.onFeedbackAdded) {
      // Use global renderFeedbackForm if available
      if (window.renderFeedbackForm) {
        const formEl = window.renderFeedbackForm(this.slug, this.feedbackTemplate, this.onFeedbackAdded);
        container.appendChild(formEl);
      } else {
        const msg = document.createElement('p');
        msg.className = 'empty-state';
        msg.textContent = 'Feedback form is not available. Please refresh the page.';
        container.appendChild(msg);
      }
    } else {
      const msg = document.createElement('p');
      msg.className = 'empty-state';
      msg.textContent = 'Feedback form configuration is missing.';
      container.appendChild(msg);
    }
  }

  renderHistoryContent(container, historyData) {
    const summaryEl = document.createElement('div');
    summaryEl.className = 'history-summary';
    summaryEl.innerHTML = `
      <div class="history-stat">
        <span class="label">Sessions Completed:</span>
        <span class="value">${historyData.sessionsCompleted || 0}</span>
      </div>
      <div class="history-stat">
        <span class="label">Sessions Programmed:</span>
        <span class="value">${historyData.sessionsProgrammed || 0}</span>
      </div>
      <div class="history-stat">
        <span class="label">Completion Rate:</span>
        <span class="value">${((historyData.completionRate || 0) * 100).toFixed(0)}%</span>
      </div>
      <div class="history-stat">
        <span class="label">Average Difficulty:</span>
        <span class="value">${historyData.avgDifficulty || 'N/A'}</span>
      </div>
    `;
    container.appendChild(summaryEl);

    if (historyData.highlights && historyData.highlights.length) {
      const highlightsEl = document.createElement('div');
      highlightsEl.className = 'history-highlights';
      const h3 = document.createElement('h3');
      h3.textContent = 'Highlights';
      highlightsEl.appendChild(h3);
      const ul = document.createElement('ul');
      historyData.highlights.forEach((highlight) => {
        const li = document.createElement('li');
        li.textContent = highlight;
        ul.appendChild(li);
      });
      highlightsEl.appendChild(ul);
      container.appendChild(highlightsEl);
    }
  }

  renderNotesContent(container, notes) {
    if (notes.observations && notes.observations.length) {
      const obsSection = document.createElement('div');
      obsSection.className = 'notes-observations';
      const h3 = document.createElement('h3');
      h3.textContent = 'Observations';
      obsSection.appendChild(h3);
      const list = document.createElement('ul');
      notes.observations.forEach((obs) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${obs.date || 'N/A'}:</strong> ${obs.observation || ''}`;
        list.appendChild(li);
      });
      obsSection.appendChild(list);
      container.appendChild(obsSection);
    }

    if (notes.recommendations && notes.recommendations.length) {
      const recSection = document.createElement('div');
      recSection.className = 'notes-recommendations';
      const h3 = document.createElement('h3');
      h3.textContent = 'Recommendations';
      recSection.appendChild(h3);
      const list = document.createElement('ul');
      notes.recommendations.forEach((rec) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${rec.date || 'N/A'}:</strong> ${rec.recommendation || ''}`;
        if (rec.rationale) {
          const rationale = document.createElement('p');
          rationale.className = 'rationale';
          rationale.textContent = `Rationale: ${rec.rationale}`;
          li.appendChild(rationale);
        }
        list.appendChild(li);
      });
      recSection.appendChild(list);
      container.appendChild(recSection);
    }
  }

  attachEventListeners() {
    Object.values(this.tabElements).forEach((button) => {
      button.addEventListener('click', (e) => {
        const tabId = e.target.dataset.tabId;
        this.setActiveTab(tabId);
      });
    });
  }

  setActiveTab(tabId) {
    // Update active tab ID
    this.activeTabId = tabId;

    // Update button states
    Object.entries(this.tabElements).forEach(([id, button]) => {
      const isActive = id === tabId;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update panel visibility and reset scroll
    Object.entries(this.panelElements).forEach(([id, panel]) => {
      const isActive = id === tabId;
      panel.hidden = !isActive;
      if (isActive) {
        panel.scrollTop = 0; // Reset scroll position to top
      }
    });
  }

  getEmptyStateMessage(contentType) {
    const messages = {
      program: 'Program not yet created.',
      feedback: 'No feedback recorded yet. Customer sessions will be logged here after each workout.',
      history: 'Workout history will appear here after the first session is completed.',
      notes: 'Coach observations will appear here after analyzing customer progress.',
      'add-entry': 'Feedback form is not available.',
    };
    return messages[contentType] || 'No data available.';
  }
}
