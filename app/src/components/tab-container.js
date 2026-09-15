/**
 * Customer Tab Container Component
 * Main component for managing tabbed interface for customer data
 */

import { renderProgramDay, renderDaySubnav } from './program-day.js';
import { renderFeedbackEntry } from './feedback-entry.js';
import { renderTrendChart } from './trend-chart.js';

export class TabContainer {
  constructor(containerEl, tabs, data, options = {}) {
    this.containerEl = containerEl;
    this.tabs = tabs; // Array of TabConfig: { id, label, icon?, isEnabled, contentType, order }
    this.data = data; // Object with program, feedback, notes data
    // Default to the first enabled tab (FR-007) — not a hardcoded id, so a client
    // whose Program tab is disabled still lands on a real, selected tab.
    this.activeTabId = (tabs.find((t) => t.isEnabled) || {}).id || null;
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

    // Left/Right arrow navigation between enabled tabs (FR-007), wrapping at the ends.
    header.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const enabledIds = this.tabs.filter((t) => t.isEnabled).map((t) => t.id);
      const currentIndex = enabledIds.indexOf(this.activeTabId);
      if (currentIndex === -1) return;

      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextId = enabledIds[(currentIndex + delta + enabledIds.length) % enabledIds.length];
      this.setActiveTab(nextId);
      this.tabElements[nextId]?.focus();
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
    if (program.weeklySchedule && program.weeklySchedule.length) {
      const subnav = renderDaySubnav(program.weeklySchedule);
      if (subnav) container.appendChild(subnav);

      const scheduleSection = document.createElement('div');
      scheduleSection.className = 'weekly-schedule';
      for (const day of program.weeklySchedule) {
        scheduleSection.appendChild(renderProgramDay(day));
      }
      container.appendChild(scheduleSection);
    }

    if (program.progressionHtml) {
      const progression = document.createElement('div');
      progression.className = 'card program-progression';
      progression.innerHTML = program.progressionHtml;
      container.appendChild(progression);
    }
  }

  renderFeedbackContent(container, feedbackData) {
    container.appendChild(this.renderFeedbackStatStrip(feedbackData.stats));

    if (feedbackData.trend) {
      container.appendChild(renderTrendChart(feedbackData.trend));
    }

    const listTitle = document.createElement('h3');
    listTitle.textContent = 'Session History';
    container.appendChild(listTitle);

    if (feedbackData.entries && feedbackData.entries.length) {
      const list = document.createElement('div');
      list.className = 'feedback-list';
      feedbackData.entries.forEach((entry) => list.appendChild(renderFeedbackEntry(entry)));
      container.appendChild(list);
    } else {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'empty-state';
      emptyMsg.textContent = 'No sessions logged yet. Go to "Add Entry" tab to log your first feedback.';
      container.appendChild(emptyMsg);
    }
  }

  /**
   * Three stat tiles (Completion %, Last session, Average difficulty), each computed
   * only from real logged data — an explicit empty state, never a placeholder value,
   * when there isn't enough data yet (FR-013, contracts/feedback-honesty-and-stats.md).
   */
  renderFeedbackStatStrip(stats) {
    const strip = document.createElement('div');
    strip.className = 'stat-strip';

    const tiles = [
      ['Completion', stats.completionPercent != null ? `${stats.completionPercent}%` : null],
      ['Last session', stats.lastSessionDate || null],
      ['Avg. difficulty', stats.avgDifficultyLabel || null],
    ];

    for (const [label, value] of tiles) {
      const tile = document.createElement('div');
      tile.className = 'stat-tile';
      const valueEl = document.createElement('div');
      valueEl.className = value ? 'stat-tile-value' : 'stat-tile-value stat-tile-empty';
      valueEl.textContent = value || 'Not enough data yet';
      const labelEl = document.createElement('div');
      labelEl.className = 'stat-tile-label';
      labelEl.textContent = label;
      tile.appendChild(valueEl);
      tile.appendChild(labelEl);
      strip.appendChild(tile);
    }

    return strip;
  }

  renderAddEntryContent(container, feedbackData) {

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

  /**
   * Renders the coach's real notes.md content verbatim, or a dashed empty-state card
   * when none exists yet — never fabricated observation/recommendation text
   * (FR-017, FR-018).
   */
  renderNotesContent(container, notes) {
    if (notes.present && notes.html) {
      const body = document.createElement('div');
      body.className = 'notes-body';
      body.innerHTML = notes.html;
      container.appendChild(body);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-state-card';
      empty.textContent = 'No coach notes yet.';
      container.appendChild(empty);
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
      'add-entry': 'Feedback form is not available.',
    };
    return messages[contentType] || 'No data available.';
  }
}
