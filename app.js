(() => {
  'use strict';

  const STORAGE_KEY = 'team-task-board-v4';
  const TIME_ZONE = 'America/New_York';
  const PEOPLE = [
    { id: 'yash-john', name: 'Yash John', initials: 'YJ' },
    { id: 'valentino-colombo', name: 'Valentino Colombo', initials: 'VC' },
    { id: 'viktor-zaderei', name: 'Viktor Zaderei', initials: 'VZ' }
  ];

  const STATUS_LABELS = {
    todo: 'To Do',
    progress: 'In Progress',
    done: 'Completed'
  };

  const NOTE_LABELS = {
    update: 'Update',
    clarification: 'Clarification',
    decision: 'Decision',
    blocker: 'Blocker',
    comment: 'Comment'
  };

  const state = {
    tasks: loadTasks(),
    filters: {
      search: '',
      assignee: 'all',
      dateField: 'activity',
      datePreset: 'all',
      fromDate: '',
      toDate: ''
    },
    activeTaskId: null,
    draggedTaskId: null,
    activeTab: 'details'
  };

  const el = {
    peopleList: document.querySelector('#peopleList'),
    addTaskButton: document.querySelector('#addTaskButton'),
    searchFilter: document.querySelector('#searchFilter'),
    assigneeFilter: document.querySelector('#assigneeFilter'),
    dateFieldFilter: document.querySelector('#dateFieldFilter'),
    datePresetFilter: document.querySelector('#datePresetFilter'),
    fromDateFilter: document.querySelector('#fromDateFilter'),
    toDateFilter: document.querySelector('#toDateFilter'),
    fromDateWrap: document.querySelector('#fromDateWrap'),
    toDateWrap: document.querySelector('#toDateWrap'),
    clearFiltersButton: document.querySelector('#clearFiltersButton'),
    summaryRow: document.querySelector('#summaryRow'),
    taskLists: {
      todo: document.querySelector('#todoList'),
      progress: document.querySelector('#progressList'),
      done: document.querySelector('#doneList')
    },
    counts: {
      todo: document.querySelector('#todoCount'),
      progress: document.querySelector('#progressCount'),
      done: document.querySelector('#doneCount')
    },
    modalBackdrop: document.querySelector('#taskModalBackdrop'),
    modalTitle: document.querySelector('#taskModalTitle'),
    modalEyebrow: document.querySelector('#taskModalEyebrow'),
    modalTabs: document.querySelector('#modalTabs'),
    tabButtons: [...document.querySelectorAll('.tab-button')],
    tabPanels: [...document.querySelectorAll('.tab-panel')],
    taskForm: document.querySelector('#taskForm'),
    taskId: document.querySelector('#taskId'),
    taskTitle: document.querySelector('#taskTitle'),
    taskAssignee: document.querySelector('#taskAssignee'),
    taskStatus: document.querySelector('#taskStatus'),
    taskDueDate: document.querySelector('#taskDueDate'),
    taskPriority: document.querySelector('#taskPriority'),
    taskDescription: document.querySelector('#taskDescription'),
    taskTimestampGrid: document.querySelector('#taskTimestampGrid'),
    createdTimestamp: document.querySelector('#createdTimestamp'),
    updatedTimestamp: document.querySelector('#updatedTimestamp'),
    completedTimestamp: document.querySelector('#completedTimestamp'),
    closeTaskModalButton: document.querySelector('#closeTaskModalButton'),
    cancelTaskButton: document.querySelector('#cancelTaskButton'),
    deleteTaskButton: document.querySelector('#deleteTaskButton'),
    saveTaskButton: document.querySelector('#saveTaskButton'),
    commentType: document.querySelector('#commentType'),
    commentAuthor: document.querySelector('#commentAuthor'),
    commentText: document.querySelector('#commentText'),
    addCommentButton: document.querySelector('#addCommentButton'),
    commentList: document.querySelector('#commentList'),
    activityTimeline: document.querySelector('#activityTimeline'),
    commentTabCount: document.querySelector('#commentTabCount'),
    activityTabCount: document.querySelector('#activityTabCount'),
    toast: document.querySelector('#toast')
  };

  initialize();

  function initialize() {
    renderPeople();
    populatePersonSelects();
    bindEvents();
    renderBoard();
  }

  function bindEvents() {
    el.addTaskButton.addEventListener('click', () => openTaskModal());
    el.closeTaskModalButton.addEventListener('click', closeTaskModal);
    el.cancelTaskButton.addEventListener('click', closeTaskModal);
    el.modalBackdrop.addEventListener('click', (event) => {
      if (event.target === el.modalBackdrop) closeTaskModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !el.modalBackdrop.classList.contains('is-hidden')) closeTaskModal();
    });

    el.taskForm.addEventListener('submit', saveTask);
    el.deleteTaskButton.addEventListener('click', deleteActiveTask);
    el.addCommentButton.addEventListener('click', addComment);

    el.tabButtons.forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));

    el.searchFilter.addEventListener('input', (event) => {
      state.filters.search = event.target.value.trim().toLowerCase();
      renderBoard();
    });
    el.assigneeFilter.addEventListener('change', (event) => {
      state.filters.assignee = event.target.value;
      renderBoard();
    });
    el.dateFieldFilter.addEventListener('change', (event) => {
      state.filters.dateField = event.target.value;
      renderBoard();
    });
    el.datePresetFilter.addEventListener('change', (event) => {
      state.filters.datePreset = event.target.value;
      toggleCustomDates();
      renderBoard();
    });
    el.fromDateFilter.addEventListener('change', (event) => {
      state.filters.fromDate = event.target.value;
      renderBoard();
    });
    el.toDateFilter.addEventListener('change', (event) => {
      state.filters.toDate = event.target.value;
      renderBoard();
    });
    el.clearFiltersButton.addEventListener('click', clearFilters);

    Object.values(el.taskLists).forEach((list) => {
      list.addEventListener('dragover', handleDragOver);
      list.addEventListener('dragleave', () => list.classList.remove('is-drag-over'));
      list.addEventListener('drop', handleDrop);
    });
  }

  function renderPeople() {
    el.peopleList.innerHTML = PEOPLE.map((person) => `
      <div class="person-chip">
        <span class="avatar">${escapeHtml(person.initials)}</span>
        <span>${escapeHtml(person.name)}</span>
      </div>
    `).join('');
  }

  function populatePersonSelects() {
    const options = PEOPLE.map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join('');
    el.taskAssignee.innerHTML = `<option value="" disabled>Select a person</option>${options}`;
    el.commentAuthor.innerHTML = options;
    el.assigneeFilter.innerHTML = `<option value="all">All people</option>${options}`;
    el.commentAuthor.value = 'viktor-zaderei';
  }

  function renderBoard() {
    const visibleTasks = state.tasks.filter(matchesFilters);

    ['todo', 'progress', 'done'].forEach((status) => {
      const tasks = visibleTasks
        .filter((task) => task.status === status)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      el.counts[status].textContent = String(tasks.length);
      el.taskLists[status].innerHTML = tasks.length
        ? tasks.map(renderTaskCard).join('')
        : `<div class="empty-state">No tasks match this view.</div>`;
    });

    bindCardEvents();
    renderSummary(visibleTasks);
  }

  function renderTaskCard(task) {
    const person = getPerson(task.assigneeId);
    const timeLabel = task.status === 'done' && task.completedAt ? 'Completed' : 'Last changed';
    const timeValue = task.status === 'done' && task.completedAt ? task.completedAt : task.updatedAt;
    const notesCount = task.comments.length;
    const priorityBadge = task.priority === 'normal' ? '' : `<span class="meta-badge priority-${task.priority}">${capitalize(task.priority)}</span>`;
    const dueBadge = task.dueDate
      ? `<span class="meta-badge ${isOverdue(task) ? 'due-overdue' : ''}">Due ${formatShortDate(task.dueDate)}</span>`
      : '';
    const description = task.description
      ? `<p class="card-description">${escapeHtml(task.description)}</p>`
      : '';

    return `
      <article class="task-card" draggable="true" data-task-id="${task.id}">
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHtml(task.title)}</h3>
            <div class="card-meta">
              ${priorityBadge}
              ${dueBadge}
              <span class="meta-badge">${notesCount} note${notesCount === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button class="card-menu" data-action="open" type="button" aria-label="Open full task details">•••</button>
        </div>
        ${description}
        <div class="card-footer">
          <div>
            <div class="card-person">
              <span class="avatar">${escapeHtml(person.initials)}</span>
              <span class="card-person-name">${escapeHtml(person.name)}</span>
            </div>
            <div class="card-time">
              Added <strong>${formatDateTime(task.createdAt)}</strong>
              ${timeValue !== task.createdAt ? `${timeLabel} <strong>${formatDateTime(timeValue)}</strong>` : ''}
            </div>
          </div>
          <select class="quick-status" data-action="status" aria-label="Change task status">
            ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${value === task.status ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
      </article>
    `;
  }

  function bindCardEvents() {
    document.querySelectorAll('.task-card').forEach((card) => {
      const taskId = card.dataset.taskId;
      card.querySelector('[data-action="open"]').addEventListener('click', () => openTaskModal(taskId));
      card.querySelector('[data-action="status"]').addEventListener('change', (event) => {
        event.stopPropagation();
        changeTaskStatus(taskId, event.target.value, 'Quick status change');
      });
      card.addEventListener('dragstart', () => {
        state.draggedTaskId = taskId;
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        state.draggedTaskId = null;
        card.classList.remove('is-dragging');
        Object.values(el.taskLists).forEach((list) => list.classList.remove('is-drag-over'));
      });
    });
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('is-drag-over');
  }

  function handleDrop(event) {
    event.preventDefault();
    const list = event.currentTarget;
    list.classList.remove('is-drag-over');
    if (!state.draggedTaskId) return;
    changeTaskStatus(state.draggedTaskId, list.dataset.status, 'Moved on board');
  }

  function openTaskModal(taskId = null) {
    state.activeTaskId = taskId;
    state.activeTab = 'details';
    const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;

    el.taskForm.reset();
    el.commentText.value = '';
    el.commentType.value = 'update';
    el.commentAuthor.value = 'viktor-zaderei';

    if (task) {
      el.modalEyebrow.textContent = 'TASK DETAILS';
      el.modalTitle.textContent = task.title;
      el.taskId.value = task.id;
      el.taskTitle.value = task.title;
      el.taskAssignee.value = task.assigneeId;
      el.taskStatus.value = task.status;
      el.taskDueDate.value = task.dueDate || '';
      el.taskPriority.value = task.priority || 'normal';
      el.taskDescription.value = task.description || '';
      el.createdTimestamp.textContent = formatDateTime(task.createdAt);
      el.updatedTimestamp.textContent = formatDateTime(task.updatedAt);
      el.completedTimestamp.textContent = task.completedAt ? formatDateTime(task.completedAt) : 'Not completed';
      el.taskTimestampGrid.classList.remove('is-hidden');
      el.modalTabs.classList.remove('is-hidden');
      el.deleteTaskButton.classList.remove('is-hidden');
      renderComments(task);
      renderActivity(task);
      updateTabCounts(task);
    } else {
      el.modalEyebrow.textContent = 'NEW TASK';
      el.modalTitle.textContent = 'Add task';
      el.taskId.value = '';
      el.taskStatus.value = 'todo';
      el.taskPriority.value = 'normal';
      el.taskAssignee.value = 'viktor-zaderei';
      el.taskTimestampGrid.classList.add('is-hidden');
      el.modalTabs.classList.add('is-hidden');
      el.deleteTaskButton.classList.add('is-hidden');
      el.commentList.innerHTML = '';
      el.activityTimeline.innerHTML = '';
    }

    switchTab('details');
    el.modalBackdrop.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    setTimeout(() => el.taskTitle.focus(), 0);
  }

  function closeTaskModal() {
    el.modalBackdrop.classList.add('is-hidden');
    document.body.classList.remove('modal-open');
    state.activeTaskId = null;
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    el.tabButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tabName));
    el.tabPanels.forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.panel !== tabName));
  }

  function saveTask(event) {
    event.preventDefault();
    const title = el.taskTitle.value.trim();
    const assigneeId = el.taskAssignee.value;
    if (!title || !assigneeId) return;

    const now = new Date().toISOString();
    const values = {
      title,
      assigneeId,
      status: el.taskStatus.value,
      dueDate: el.taskDueDate.value,
      priority: el.taskPriority.value,
      description: el.taskDescription.value.trim()
    };

    if (!state.activeTaskId) {
      const task = normalizeTask({
        id: createId('task'),
        ...values,
        createdAt: now,
        updatedAt: now,
        completedAt: values.status === 'done' ? now : null,
        comments: [],
        history: [{
          id: createId('event'),
          type: 'created',
          title: 'Task added to To Do list',
          detail: values.status === 'todo' ? `Assigned to ${getPerson(assigneeId).name}` : `Created and set to ${STATUS_LABELS[values.status]}`,
          at: now
        }]
      });
      if (values.status !== 'todo') {
        task.history.push({
          id: createId('event'),
          type: 'status',
          title: `Status changed: To Do → ${STATUS_LABELS[values.status]}`,
          detail: 'Status selected when the task was created.',
          at: now
        });
      }
      state.tasks.push(task);
      persist();
      showToast('Task added with an automatic timestamp.');
    } else {
      const task = state.tasks.find((item) => item.id === state.activeTaskId);
      if (!task) return;
      const changes = describeChanges(task, values);
      const oldStatus = task.status;
      Object.assign(task, values);
      task.updatedAt = now;

      if (oldStatus !== values.status) {
        applyStatusTimestamp(task, oldStatus, values.status, now);
        task.history.push({
          id: createId('event'),
          type: 'status',
          title: `Status changed: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[values.status]}`,
          detail: values.status === 'done' ? 'Task marked as completed.' : 'Task moved to a different workflow stage.',
          at: now
        });
      }

      if (changes.length) {
        task.history.push({
          id: createId('event'),
          type: 'updated',
          title: 'Task details changed',
          detail: changes.join('\n'),
          at: now
        });
      } else if (oldStatus === values.status) {
        task.history.push({
          id: createId('event'),
          type: 'updated',
          title: 'Task saved',
          detail: 'The task was saved without a field change.',
          at: now
        });
      }
      persist();
      showToast('Task changes and timestamp saved.');
    }

    closeTaskModal();
    renderBoard();
  }

  function changeTaskStatus(taskId, newStatus, source) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task || task.status === newStatus) return;
    const now = new Date().toISOString();
    const oldStatus = task.status;
    task.status = newStatus;
    task.updatedAt = now;
    applyStatusTimestamp(task, oldStatus, newStatus, now);
    task.history.push({
      id: createId('event'),
      type: 'status',
      title: `Status changed: ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`,
      detail: source,
      at: now
    });
    persist();
    renderBoard();
    showToast(newStatus === 'done' ? 'Task completed and timestamped.' : `Task moved to ${STATUS_LABELS[newStatus]}.`);
  }

  function applyStatusTimestamp(task, oldStatus, newStatus, now) {
    if (newStatus === 'done') {
      task.completedAt = now;
      task.completionHistory = Array.isArray(task.completionHistory) ? task.completionHistory : [];
      task.completionHistory.push(now);
    } else if (oldStatus === 'done') {
      task.completedAt = null;
    }
  }

  function addComment() {
    const task = state.tasks.find((item) => item.id === state.activeTaskId);
    const text = el.commentText.value.trim();
    if (!task || !text) {
      if (!text) showToast('Enter a note before adding it.');
      return;
    }
    const now = new Date().toISOString();
    const authorId = el.commentAuthor.value;
    const type = el.commentType.value;
    task.comments.push({
      id: createId('comment'),
      text,
      type,
      authorId,
      createdAt: now
    });
    task.updatedAt = now;
    task.history.push({
      id: createId('event'),
      type: 'comment',
      title: `${NOTE_LABELS[type]} added`,
      detail: `${getPerson(authorId).name}: ${truncate(text, 160)}`,
      at: now
    });
    persist();
    el.commentText.value = '';
    renderComments(task);
    renderActivity(task);
    updateTabCounts(task);
    updateModalTimestamps(task);
    renderBoard();
    showToast('Timestamped note added.');
  }

  function renderComments(task) {
    const comments = [...task.comments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    el.commentList.innerHTML = comments.length ? comments.map((comment) => {
      const author = getPerson(comment.authorId);
      return `
        <article class="comment-item">
          <div class="comment-header">
            <div class="comment-author">
              <span class="avatar">${escapeHtml(author.initials)}</span>
              <span>${escapeHtml(author.name)}</span>
              <span class="note-type note-${comment.type}">${escapeHtml(NOTE_LABELS[comment.type] || 'Comment')}</span>
            </div>
            <time class="comment-time" datetime="${comment.createdAt}">${formatDateTime(comment.createdAt)}</time>
          </div>
          <p class="comment-body">${escapeHtml(comment.text)}</p>
        </article>
      `;
    }).join('') : '<div class="empty-state">No notes yet. Each new note will show its type, author, and exact timestamp.</div>';
  }

  function renderActivity(task) {
    const history = [...task.history].sort((a, b) => new Date(b.at) - new Date(a.at));
    el.activityTimeline.innerHTML = history.length ? history.map((event) => `
      <article class="timeline-item">
        <span class="timeline-dot" aria-hidden="true"></span>
        <h3 class="timeline-title">${escapeHtml(event.title)}</h3>
        ${event.detail ? `<p class="timeline-detail">${escapeHtml(event.detail)}</p>` : ''}
        <time class="timeline-time" datetime="${event.at}">${formatDateTime(event.at)}</time>
      </article>
    `).join('') : '<div class="empty-state">No activity recorded.</div>';
  }

  function updateTabCounts(task) {
    el.commentTabCount.textContent = String(task.comments.length);
    el.activityTabCount.textContent = String(task.history.length);
  }

  function updateModalTimestamps(task) {
    el.updatedTimestamp.textContent = formatDateTime(task.updatedAt);
    el.completedTimestamp.textContent = task.completedAt ? formatDateTime(task.completedAt) : 'Not completed';
  }

  function deleteActiveTask() {
    const task = state.tasks.find((item) => item.id === state.activeTaskId);
    if (!task) return;
    const confirmed = window.confirm(`Delete “${task.title}”? This cannot be undone.`);
    if (!confirmed) return;
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    persist();
    closeTaskModal();
    renderBoard();
    showToast('Task deleted.');
  }

  function matchesFilters(task) {
    const text = [
      task.title,
      task.description,
      getPerson(task.assigneeId).name,
      ...task.comments.map((comment) => `${NOTE_LABELS[comment.type] || ''} ${comment.text} ${getPerson(comment.authorId).name}`)
    ].join(' ').toLowerCase();

    if (state.filters.search && !text.includes(state.filters.search)) return false;
    if (state.filters.assignee !== 'all' && task.assigneeId !== state.filters.assignee) return false;
    return matchesDateFilter(task);
  }

  function matchesDateFilter(task) {
    const { dateField, datePreset, fromDate, toDate } = state.filters;
    if (datePreset === 'all') return true;

    const candidates = dateField === 'activity'
      ? [task.createdAt, task.updatedAt, task.completedAt, ...task.history.map((event) => event.at), ...task.comments.map((comment) => comment.createdAt)].filter(Boolean)
      : [task[dateField]].filter(Boolean);

    if (!candidates.length) return false;

    let start;
    let end;
    const today = getEasternDateString(new Date());

    if (datePreset === 'today') {
      start = today;
      end = today;
    } else if (datePreset === '7' || datePreset === '30') {
      const days = Number(datePreset);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (days - 1));
      start = getEasternDateString(startDate);
      end = today;
    } else {
      start = fromDate || '0000-01-01';
      end = toDate || '9999-12-31';
    }

    return candidates.some((value) => {
      const dateString = getEasternDateString(new Date(value));
      return dateString >= start && dateString <= end;
    });
  }

  function toggleCustomDates() {
    const custom = state.filters.datePreset === 'custom';
    el.fromDateWrap.classList.toggle('is-hidden', !custom);
    el.toDateWrap.classList.toggle('is-hidden', !custom);
  }

  function clearFilters() {
    state.filters = { search: '', assignee: 'all', dateField: 'activity', datePreset: 'all', fromDate: '', toDate: '' };
    el.searchFilter.value = '';
    el.assigneeFilter.value = 'all';
    el.dateFieldFilter.value = 'activity';
    el.datePresetFilter.value = 'all';
    el.fromDateFilter.value = '';
    el.toDateFilter.value = '';
    toggleCustomDates();
    renderBoard();
  }

  function renderSummary(visibleTasks) {
    const total = visibleTasks.length;
    const completed = visibleTasks.filter((task) => task.status === 'done').length;
    const overdue = visibleTasks.filter(isOverdue).length;
    const noteCount = visibleTasks.reduce((sum, task) => sum + task.comments.length, 0);
    el.summaryRow.innerHTML = [
      `${total} visible task${total === 1 ? '' : 's'}`,
      `${completed} completed`,
      `${overdue} overdue`,
      `${noteCount} timestamped note${noteCount === 1 ? '' : 's'}`
    ].map((text) => `<span class="summary-chip">${text}</span>`).join('');
  }

  function describeChanges(task, values) {
    const changes = [];
    if (task.title !== values.title) changes.push(`Name: “${task.title}” → “${values.title}”`);
    if (task.assigneeId !== values.assigneeId) changes.push(`Assignee: ${getPerson(task.assigneeId).name} → ${getPerson(values.assigneeId).name}`);
    if ((task.dueDate || '') !== values.dueDate) changes.push(`Due date: ${task.dueDate ? formatShortDate(task.dueDate) : 'None'} → ${values.dueDate ? formatShortDate(values.dueDate) : 'None'}`);
    if ((task.priority || 'normal') !== values.priority) changes.push(`Priority: ${capitalize(task.priority || 'normal')} → ${capitalize(values.priority)}`);
    if ((task.description || '') !== values.description) changes.push('Description / main note updated');
    return changes;
  }

  function normalizeTask(input) {
    const now = new Date().toISOString();
    const createdAt = input.createdAt || now;
    const comments = Array.isArray(input.comments) ? input.comments.map((comment) => ({
      id: comment.id || createId('comment'),
      text: String(comment.text || ''),
      type: NOTE_LABELS[comment.type] ? comment.type : 'comment',
      authorId: getPerson(comment.authorId || comment.author || input.assigneeId).id,
      createdAt: comment.createdAt || comment.timestamp || createdAt
    })) : [];

    const history = Array.isArray(input.history) && input.history.length ? input.history.map((event) => ({
      id: event.id || createId('event'),
      type: event.type || 'updated',
      title: event.title || 'Task updated',
      detail: event.detail || '',
      at: event.at || event.timestamp || createdAt
    })) : [{
      id: createId('event'),
      type: 'created',
      title: 'Task added to To Do list',
      detail: `Assigned to ${getPerson(input.assigneeId).name}`,
      at: createdAt
    }];

    return {
      id: input.id || createId('task'),
      title: String(input.title || 'Untitled task'),
      description: String(input.description || ''),
      assigneeId: getPerson(input.assigneeId).id,
      status: STATUS_LABELS[input.status] ? input.status : 'todo',
      dueDate: input.dueDate || '',
      priority: ['normal', 'high', 'urgent'].includes(input.priority) ? input.priority : 'normal',
      createdAt,
      updatedAt: input.updatedAt || createdAt,
      completedAt: input.completedAt || null,
      completionHistory: Array.isArray(input.completionHistory) ? input.completionHistory : (input.completedAt ? [input.completedAt] : []),
      comments,
      history
    };
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const tasks = raw ? JSON.parse(raw) : [];
      return Array.isArray(tasks) ? tasks.map(normalizeTask) : [];
    } catch (error) {
      console.error('Unable to load saved tasks:', error);
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (error) {
      console.warn('Task changes are available for this session but could not be saved in browser storage:', error);
    }
  }

  function getPerson(personId) {
    return PEOPLE.find((person) => person.id === personId) || PEOPLE[2];
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);
  }

  function formatShortDate(value) {
    if (!value) return '—';
    const date = value.includes('T') ? new Date(value) : new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  function getEasternDateString(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function isOverdue(task) {
    if (!task.dueDate || task.status === 'done') return false;
    return task.dueDate < getEasternDateString(new Date());
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function truncate(text, maxLength) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function capitalize(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.remove('is-hidden');
    toastTimer = setTimeout(() => el.toast.classList.add('is-hidden'), 2500);
  }
})();
