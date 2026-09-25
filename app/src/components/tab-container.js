/**
 * Customer Tab Container Component
 * Main component for managing tabbed interface for customer data
 */

import { marked } from 'marked';
import { renderProgramDay, renderDaySubnav, trackActiveDay } from './program-day.js';
import { renderWeekSubnav } from './week-subnav.js';
import { getProgramWeek, quickCompleteSession } from '../api-client.js';
import { findDoneEntry, sessionLabel, todayIso } from '../lib/day-completion.js';
import { renderFeedbackEntry } from './feedback-entry.js';
import { renderFeedbackForm } from '../views/feedback-form-view.js';
import { renderTrendChart } from './trend-chart.js';
import { showToast } from './toast.js';
import { setSafeHtml } from '../lib/safe-html.js';
import { icon } from '../lib/icons.js';
import { formatDate } from '../lib/format.js';
import { formatRelativeCheckIn } from '../lib/status.js';

// The PDF modules pull in jsPDF (most of the bundle), so they load on first click.
function createPdfButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pdf-download-button';
  button.appendChild(icon('download'));
  const label = document.createElement('span');
  label.textContent = 'Download PDF';
  button.appendChild(label);
  return button;
}

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
    // Program tab week; set to the customer's current week in renderProgramContent.
    this.activeWeek = null;

    // Options for feedback form integration
    this.slug = options.slug; // Customer slug for feedback API calls
    this.feedbackTemplate = options.feedbackTemplate; // Feedback template for form rendering
    this.onFeedbackAdded = options.onFeedbackAdded; // Callback when new feedback is added
    // "Mark done" on Program days (specs/012): raw API feedback entries decide which
    // cards show as done; onSessionLogged refreshes stats without leaving the tab.
    this.feedbackEntries = options.feedbackEntries || [];
    this.onSessionLogged = options.onSessionLogged;
    this.onAddDetails = (entry) => this.openLogSession({ date: entry.date, label: entry.label });

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
      case 'nutrition':
        this.renderNutritionContent(container, data);
        break;
      case 'feedback':
        this.renderFeedbackContent(container, data);
        break;
      case 'notes':
        this.renderNotesContent(container, data);
        break;
      case 'add-entry':
        this.renderAddEntryContent(container);
        break;
    }

    return container;
  }

  // Each week is its own routine (specs/010 contracts/week-tab-navigation-v2.md). `program`
  // is the current week's detail; other weeks are fetched on first view and cached for
  // this page visit.
  renderProgramContent(container, program) {
    const weeks = program.weeks && program.weeks.length
      ? program.weeks
      : [{ weekNumber: program.weekNumber ?? 1, isCurrent: true, isLocked: false }];
    this.activeWeek = program.weekNumber ?? weeks[weeks.length - 1].weekNumber;
    const weekCache = new Map([[this.activeWeek, program]]);

    const weekBody = document.createElement('div');
    weekBody.className = 'program-week-body';

    const showWeek = async (weekNumber) => {
      this.activeWeek = weekNumber;
      let detail = weekCache.get(weekNumber);
      if (!detail) {
        weekBody.classList.add('loading');
        weekBody.setAttribute('aria-busy', 'true');
        try {
          detail = await getProgramWeek(this.slug, weekNumber);
          weekCache.set(weekNumber, detail);
        } catch (err) {
          showToast(`Could not load week ${weekNumber}. Please try again.`, 3000, 'error');
          return;
        } finally {
          weekBody.classList.remove('loading');
          weekBody.removeAttribute('aria-busy');
        }
      }
      // A slower fetch must not overwrite a week the user has since switched to.
      if (this.activeWeek === weekNumber) this.renderProgramWeek(weekBody, detail);
    };

    // Week selector and PDF export share one toolbar above the schedule.
    const toolbar = document.createElement('div');
    toolbar.className = 'program-toolbar';
    toolbar.appendChild(renderWeekSubnav(weeks, this.activeWeek, showWeek));

    // Acts on whichever week is showing at click time, not the one at render time.
    const pdfButton = createPdfButton();
    pdfButton.addEventListener('click', async () => {
      const detail = weekCache.get(this.activeWeek);
      if (!detail) return;
      try {
        const { downloadProgramWeekPdf } = await import('./program-pdf.js');
        downloadProgramWeekPdf(detail, this.slug);
      } catch (err) {
        showToast('Could not generate the PDF. Please try again.', 3000, 'error');
      }
    });
    toolbar.appendChild(pdfButton);

    container.appendChild(toolbar);
    container.appendChild(weekBody);
    this.renderProgramWeek(weekBody, program);
  }

  renderProgramWeek(weekBody, detail) {
    this.stopDayTracking?.();
    weekBody.innerHTML = '';

    if (detail.isLocked) {
      const status = document.createElement('div');
      status.className = 'program-week-status';
      status.textContent = `Week ${detail.weekNumber} · past week, read-only`;
      weekBody.appendChild(status);
    }

    if (detail.weeklySchedule && detail.weeklySchedule.length) {
      const subnav = renderDaySubnav(detail.weeklySchedule);
      if (subnav) weekBody.appendChild(subnav);

      const scheduleSection = document.createElement('div');
      scheduleSection.className = 'weekly-schedule';
      const cards = detail.weeklySchedule.map((day, i) => renderProgramDay(day, i, {
        editable: !detail.isLocked,
        doneEntry: findDoneEntry(this.feedbackEntries, sessionLabel(day)),
        onMarkDone: (d) => this.markDayDone(d),
        onAddDetails: (entry) => this.onAddDetails(entry),
      }));
      cards.forEach((card) => scheduleSection.appendChild(card));
      weekBody.appendChild(scheduleSection);
      this.stopDayTracking = trackActiveDay(subnav, cards);
    } else {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No schedule for this week.';
      weekBody.appendChild(empty);
    }

    if (detail.progressionHtml) {
      const progression = document.createElement('div');
      progression.className = 'card program-progression prose';
      setSafeHtml(progression, detail.progressionHtml);
      weekBody.appendChild(progression);
    }
  }

  /** Logs a completed session for a Program day; resolves with the saved entry. */
  async markDayDone(day) {
    const { entry } = await quickCompleteSession(this.slug, { date: todayIso(), label: sessionLabel(day) });
    this.feedbackEntries = [...this.feedbackEntries, entry];
    try {
      await this.onSessionLogged?.(entry);
    } catch (err) {
      // The save itself succeeded; stats catch up on the next load.
      console.error('Failed to refresh after marking a day done:', err);
    }
    return entry;
  }

  /** Entries used for the done state on later week renders. */
  setFeedbackEntries(entries) {
    this.feedbackEntries = entries || [];
  }

  /** Rebuilds one panel from this.data without changing the active tab. */
  rerenderPanel(tabId) {
    const tab = this.tabs.find((t) => t.id === tabId);
    const panel = this.panelElements[tabId];
    if (!tab || !panel) return;
    panel.replaceChildren(this.renderTabContent(tab));
  }

  /** "Add details": open Log Session prefilled with that session's date and label. */
  openLogSession({ date, label }) {
    this.feedbackFormEl?.prefill?.({ date, label });
    this.setActiveTab('add-entry');
    this.feedbackFormEl?.focusFirstField?.();
  }

  renderFeedbackContent(container, feedbackData) {
    container.appendChild(this.renderFeedbackStatStrip(feedbackData.stats));

    if (feedbackData.trend) {
      const chartCard = document.createElement('section');
      chartCard.className = 'card trend-card';
      const chartTitle = document.createElement('h3');
      chartTitle.textContent = 'Session trend';
      chartCard.appendChild(chartTitle);
      chartCard.appendChild(renderTrendChart(feedbackData.trend));
      container.appendChild(chartCard);
    }

    const listTitle = document.createElement('h3');
    listTitle.className = 'section-title';
    listTitle.textContent = 'Session history';
    container.appendChild(listTitle);

    if (feedbackData.entries && feedbackData.entries.length) {
      const list = document.createElement('div');
      list.className = 'feedback-list';
      // Newest first: the latest session is what the reader came to see.
      [...feedbackData.entries].reverse().forEach((entry) => list.appendChild(renderFeedbackEntry(entry)));
      container.appendChild(list);
    } else {
      const emptyWrap = document.createElement('div');
      emptyWrap.className = 'empty-state-card empty-state-with-cta';
      emptyWrap.appendChild(icon('note-pencil', 'empty-state-icon'));

      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No sessions logged yet. Log a session to start tracking feedback.';
      emptyWrap.appendChild(emptyMsg);

      if (this.tabElements['add-entry']) {
        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'empty-state-cta';
        cta.textContent = 'Log Session';
        cta.addEventListener('click', () => this.setActiveTab('add-entry'));
        emptyWrap.appendChild(cta);
      }

      container.appendChild(emptyWrap);
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

    const lastSession = stats.lastSessionDate;
    const tiles = [
      ['check-circle', 'Completion', stats.completionPercent != null ? `${stats.completionPercent}%` : null, null],
      ['calendar-check', 'Last session', lastSession ? formatDate(lastSession) : null,
        lastSession ? formatRelativeCheckIn(lastSession) : null],
      ['chart-bar', 'Avg. difficulty', stats.avgDifficultyLabel || null, null],
    ];

    for (const [iconName, label, value, detail] of tiles) {
      const tile = document.createElement('div');
      tile.className = 'stat-tile';
      tile.appendChild(icon(iconName, 'stat-tile-icon'));
      const labelEl = document.createElement('div');
      labelEl.className = 'stat-tile-label';
      labelEl.textContent = label;
      const valueEl = document.createElement('div');
      valueEl.className = value ? 'stat-tile-value' : 'stat-tile-value stat-tile-empty';
      valueEl.textContent = value || 'Not enough data yet';
      tile.append(labelEl, valueEl);
      if (detail) {
        const detailEl = document.createElement('div');
        detailEl.className = 'stat-tile-detail';
        detailEl.textContent = detail;
        tile.appendChild(detailEl);
      }
      strip.appendChild(tile);
    }

    return strip;
  }

  renderAddEntryContent(container) {
    if (this.slug && this.feedbackTemplate && this.onFeedbackAdded) {
      this.feedbackFormEl = renderFeedbackForm(this.slug, this.feedbackTemplate, this.onFeedbackAdded);
      container.appendChild(this.feedbackFormEl);
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
      body.className = 'card notes-body prose';
      setSafeHtml(body, notes.html);
      container.appendChild(body);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-state-card';
      empty.textContent = 'No coach notes yet.';
      container.appendChild(empty);
    }
  }

  renderNutritionContent(container, nutrition) {
    if (nutrition && nutrition.present && nutrition.content && !nutrition.isEmpty) {
      const body = document.createElement('div');
      body.className = 'card nutrition-body prose';
      // Convert markdown to HTML using marked library
      const htmlContent = marked(nutrition.content);
      setSafeHtml(body, htmlContent);
      container.appendChild(body);

      // Add PDF download button
      const pdfButton = createPdfButton();
      pdfButton.addEventListener('click', async () => {
        try {
          const { downloadNutritionPdf } = await import('./nutrition-pdf.js');
          // Extract customer name from slug or use default
          const customerName = this.slug ? this.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Nutrition Plan';
          downloadNutritionPdf(customerName, nutrition.content);
        } catch (err) {
          showToast('Could not generate the PDF. Please try again.', 3000, 'error');
        }
      });
      container.appendChild(pdfButton);
    } else {
      const empty = document.createElement('div');
      empty.className = 'empty-state-card';
      empty.textContent = 'No nutrition plan available yet. Once your nutrition plan is created, it will appear here.';
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
      nutrition: 'No nutrition plan available yet.',
      'add-entry': 'Feedback form is not available.',
    };
    return messages[contentType] || 'No data available.';
  }
}
