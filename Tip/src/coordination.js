import {
  REQUEST_OPTIONS, createInitialState, reduceCoordination,
  currentStep, incomingIsPaused, isActiveCoverage, availabilityCopy,
} from './coordination-state.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const button = (label, action, variant = 'gold', extra = '') =>
  `<button type="button" class="btn btn-${variant}" data-tip-action="${action}" ${extra}>${label}</button>`;

// Copy from the approved native Figma request variants (October 4).
const PHASE_COPY = {
  request: { badge: 'NEEDS HELP', alex: 'Needs help · Bar', mark: '!', queue: '1 open request', item: 'Cover the bar · 5 min', rightBadge: 'REQUEST OPEN', title: 'Waiting for a teammate.', detail: 'Your request is visible to the on-shift team.', explanation: 'You can stay at the bar until someone arrives.' },
  dismissed: { badge: 'REQUEST DISMISSED', alex: 'Needs help · Bar', mark: '!', queue: 'No open requests', item: 'Alex’s request · Hidden for you', rightBadge: 'REQUEST OPEN', title: 'Waiting for a teammate.', detail: 'Your request is visible to the on-shift team.', explanation: 'You can stay at the bar until someone arrives.' },
  accepted: { badge: 'REQUEST ACCEPTED', alex: 'Allyson is on the way · Bar', mark: '✓', queue: '1 accepted request', item: 'Allyson is on the way', rightBadge: 'HELP ON THE WAY', title: 'Allyson is coming.', detail: 'Stay at the bar until Allyson arrives.', explanation: 'Your request is now assigned to Allyson.' },
  covering: { badge: 'COVERING THE BAR', alex: 'Restocking · Allyson covering', mark: '↔', queue: '1 active task', item: 'You’re covering the bar', rightBadge: 'BAR COVERED', title: 'Allyson is at the bar.', detail: 'You can restock. Your handoff note has been shared.', explanation: 'Allyson will ask you to take over when ready.' },
  handback: { badge: 'WAITING FOR ALEX', alex: 'Returning to the bar', mark: '…', queue: '1 active task', item: 'Waiting for Alex to return', rightBadge: 'RETURN TO THE BAR', title: 'Ready to take over?', detail: 'Allyson is waiting to hand the bar back to you.', explanation: 'Confirm when you are back at the bar.' },
  complete: { badge: 'COVERAGE COMPLETE', alex: 'Back at bar · Request closed', mark: '✓', queue: 'No open requests', item: 'Bar cover · Complete', rightBadge: 'COMPLETE', title: 'You’re back at the bar.', detail: 'The request is closed. Allyson can return to her work.', explanation: 'Both teammates can see that the cover is finished.' },
};
const person = '<div class="card-person"><span class="avatar">AL</span><div><strong>Alex · Bar station</strong><small>6 m · Just now</small></div></div>';

/** Native Figma states implemented as a local browser walkthrough. */
export function initCoordination(root = document) {
  const $ = selector => root.querySelector(selector);
  const $$ = selector => Array.from(root.querySelectorAll(selector));
  const lifetime = new AbortController();
  const listenerOptions = { signal: lifetime.signal };
  let state = createInitialState();
  let messageView = null;
  let heroInteracted = false;

  const setText = (selector, value) => { const el = $(selector); if (el) el.textContent = value; };
  const show = (selector, visible) => { const el = $(selector); if (el) el.hidden = !visible; };
  function focusElement(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    const scrollbox = el.closest('.pan-request, .task-card');
    if (!scrollbox || scrollbox.scrollHeight <= scrollbox.clientHeight) return;
    const box = scrollbox.getBoundingClientRect(), field = el.getBoundingClientRect();
    if (field.bottom > box.bottom - 16) scrollbox.scrollTop += field.bottom - box.bottom + 16;
    else if (field.top < box.top + 16) scrollbox.scrollTop -= box.top + 16 - field.top;
  }
  const focus = selector => focusElement($(selector));

  function progress() {
    const step = currentStep(state);
    return '<ol class="pan-flow-progress" aria-label="Task progress">' +
      ['Request', 'Accept', 'Coordinate', 'Complete'].map((name, index) =>
        `<li class="${index < step ? 'is-done' : ''}"${index === step ? ' aria-current="step"' : ''}><span aria-hidden="true">${index < step ? '✓' : index + 1}</span>${name}</li>`
      ).join('') + '</ol>';
  }

  function messageMarkup(view) {
    const last = state.messages.at(-1);
    const receipt = last ? `<div class="mini-message"><span>You · Sent</span>${escapeHTML(last)}</div>` : '';
    if (messageView !== view) return receipt;
    return `${receipt}<form class="pan-message-form" data-tip-message="${view}"><label for="tip-message-${view}">Message Alex</label><input id="tip-message-${view}" name="message" required maxlength="160" autocomplete="off" placeholder="Type a short message"><div class="pan-message-actions">${button('Send', 'send-message', 'gold', 'data-submit-message="true"')}${button('Cancel', 'close-message', 'glass')}</div></form>`;
  }

  function pausedContent() {
    return `<h3>${state.availability === 'break' ? 'On break' : 'Busy with a task'}</h3><p>New requests are paused.</p>${button('Available to help', 'available', 'glass')}`;
  }

  function demoContent() {
    if (incomingIsPaused(state)) return pausedContent();
    const content = {
      request: `<h3>Cover drinks for<br>5 minutes?</h3><p>I need to restock. Can someone take over?</p><div class="task-meta">Only your on-shift team</div><div class="card-actions">${button('Accept', 'accept')}${button('Dismiss', 'dismiss', 'glass')}</div>`,
      dismissed: `<h3>You skipped<br>this request.</h3><p>Alex’s request is still open to other teammates.</p><div class="task-meta">Changed your mind? You can undo this.</div><div class="card-actions">${button('Undo', 'undo')}</div>`,
      accepted: `<h3>Alex knows<br>you’re coming.</h3><p>Alex will stay at the bar until you arrive.</p><div class="task-meta">Coverage starts when you get there.</div><div class="card-actions">${button('I’m at the bar', 'arrive')}</div>`,
      covering: `<h3>You’re covering<br>the bar.</h3><p>Alex’s note: Two drinks for table 12. Clean glasses are below the counter.</p><div class="task-meta">Alex is restocking · 5-minute cover</div><div class="card-actions">${button('Finish coverage', 'finish')}</div>`,
      handback: `<h3>Ready to hand<br>the bar back.</h3><p>Alex has been asked to return. Keep covering until Alex takes over.</p><div class="task-meta">Alex confirms in the panel beside this view.</div><div class="card-actions">${button('Keep covering', 'keep-covering')}</div>`,
      complete: `<h3>Alex is back<br>at the bar.</h3><p>Alex: “Thanks, Allyson. I’ve got it from here.”</p><div class="task-meta">This request is closed.</div><div class="card-actions">${button('Replay', 'reset')}</div>`,
    };
    return person + content[state.phase];
  }

  function panoramaContent() {
    if (incomingIsPaused(state)) return progress() + pausedContent();
    const messageAction = '<button type="button" class="btn btn-glass" data-tip-action="message" data-tip-view="wide">Message Alex</button>';
    const content = {
      request: `<h3>Can you cover drinks<br>for 5 minutes?</h3><p>I’m heading to the stockroom.<br>Can someone take over?</p><div class="card-actions">${button('Accept', 'accept')}${button('Dismiss', 'dismiss', 'glass')}</div>`,
      dismissed: `<h3>You skipped<br>this request.</h3><p>Alex’s request is still open to other teammates.</p><div class="card-actions">${button('Undo', 'undo', 'glass')}</div>`,
      accepted: `<h3>Alex knows<br>you’re coming.</h3><p>Alex has been notified and will stay at the bar until you arrive.</p><div class="mini-message"><span>ALEX · JUST NOW</span>Thanks, Allyson. I’ll wait until you get here.</div><div class="card-actions">${button('I’m at the bar', 'arrive')}${messageAction}</div><p class="pan-flow-note">Coverage starts when you arrive.</p>`,
      covering: `<h3>You’ve got<br>the next 5 minutes.</h3><p class="pan-flow-note">Coverage started on arrival. Alex is restocking.</p><div class="mini-message"><span>HANDOFF FROM ALEX · JUST NOW</span>Two drinks are waiting for table 12. Clean glasses are below the counter.<button type="button" class="btn btn-glass" data-tip-action="ack-incoming" ${state.incomingNoteSeen ? 'disabled' : ''}>${state.incomingNoteSeen ? 'Note read' : 'Got it'}</button></div><div class="card-actions">${button('Finish coverage', 'finish')}${messageAction}</div><p class="pan-flow-note">Alex confirms the handback before this task closes.</p>`,
      handback: `<h3>Waiting for Alex<br>to take over.</h3><p>Alex has been asked to return. Your coverage stays open until they confirm.</p><section class="pan-other-person"><strong>Alex’s view · demo</strong><p>Back at the bar and ready to take over?</p>${button('I’m back', 'confirm-return')}</section>${messageAction}`,
      complete: `<h3>Back in sync.</h3><div class="mini-message"><span>ALEX · JUST NOW</span>Back at the bar. Thanks for the hand.</div><p>Alex confirmed they’ve taken over. Your coverage is complete and the request is closed.</p>${button('Replay this moment', 'reset')}`,
    };
    return progress() + person + content[state.phase] + (isActiveCoverage(state) ? messageMarkup('wide') : '');
  }

  function renderHero() {
    if (!heroInteracted) return;
    const content = {
      request: ['Can someone cover drinks for 5 minutes?', 'Cover my station · Just now', button('Accept', 'accept') + button('Dismiss', 'dismiss', 'glass')],
      dismissed: ['You skipped this request.', 'Alex’s request is still open to other teammates.', button('Undo', 'undo', 'glass')],
      accepted: ['Alex knows you’re coming.', 'Alex will stay at the bar until you arrive.', button('I’m at the bar', 'arrive')],
      covering: ['You’re covering the bar.', 'Alex is restocking · 5-minute cover', button('Finish coverage', 'finish')],
      handback: ['Ready to hand the bar back.', 'Alex confirms in the panel beside this view.', '<a class="btn btn-gold" href="#workflow">Alex’s view</a>'],
      complete: ['Alex is back at the bar.', 'This request is closed.', button('Replay', 'reset', 'glass')],
    }[state.phase];
    setText('#hero-request-status', state.phase === 'request' ? '●  NEEDS HELP' : PHASE_COPY[state.phase].badge);
    setText('#hero-request-title', content[0]);
    setText('#hero-request-detail', content[1]);
    const actions = $('#hero-request-actions');
    if (actions) actions.innerHTML = content[2];
  }

  function renderIncoming() {
    const phase = PHASE_COPY[state.phase];
    const paused = incomingIsPaused(state);
    const badge = paused ? (state.availability === 'break' ? 'ON BREAK' : 'BUSY WITH A TASK') : phase.badge;
    const wide = $('#wide-request');
    if (wide) {
      wide.classList.add('pan-flow-card');
      wide.dataset.flowState = state.phase;
      wide.innerHTML = `<div class="pan-flow-content">${panoramaContent()}</div>`;
    }
    const demo = $('#demo-card');
    if (demo) demo.innerHTML = `<span class="status-chip">${badge}</span><article class="glass task-card" data-flow-state="${state.phase}">${demoContent()}</article>`;
    setText('#wide-status', state.phase === 'handback' ? 'HANDBACK REQUESTED' : badge);
    setText('#wide-alex-status', phase.alex);
    setText('#wide-team-mark', phase.mark);
    setText('#scene-state', phase.queue);
    setText('#scene-state-detail', phase.item);
    setText('#state-explanation', phase.explanation);
    const requester = $('#requester-card');
    if (requester) requester.innerHTML = `<span class="status-chip">${phase.rightBadge}</span><h3>${phase.title}</h3><p>${phase.detail}</p>`;
    const reset = $('#reset-demo');
    if (reset) {
      reset.textContent = state.phase === 'handback' ? 'I’m back' : 'Restart demo';
      reset.dataset.tipAction = state.phase === 'handback' ? 'confirm-return' : 'reset';
    }
    $$('[data-step]').forEach((el, index) => {
      const selected = Number(el.dataset.step ?? index) === currentStep(state);
      el.setAttribute('aria-selected', String(selected));
      el.tabIndex = selected ? 0 : -1;
    });
    $('#shift-panel')?.setAttribute('aria-labelledby', `step-${currentStep(state)}`);
    const ownStatus = isActiveCoverage(state)
      ? ({ accepted: 'You · On the way to the bar', covering: 'You · Covering the bar', handback: 'You · Waiting for Alex' })[state.phase]
      : ({ available: 'You · Available', busy: 'You · Busy with a task', break: 'You · On break' })[state.availability];
    setText('.pan-team .hud-person small', ownStatus);
    setText('#wide-user-status', ownStatus);
    renderHero();
  }

  function renderAvailability() {
    $$('[data-availability]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.availability === state.availability)));
    setText('#availability-feedback', availabilityCopy(state));
  }

  function renderOutgoing() {
    const cancelled = state.outgoingCancelled;
    const resultVisible = cancelled || (!state.editorVisible && Boolean(state.outgoing));
    show('#request-form', !resultVisible);
    show('#sent-request', resultVisible);
    const values = state.outgoing || state.draft;
    let summary = $('#request-summary');
    if (summary?.tagName === 'P') {
      const fields = summary.ownerDocument.createElement('div');
      fields.id = 'request-summary';
      summary.replaceWith(fields);
      summary = fields;
    }
    if (summary) {
      const field = (label, value) => `<label>${label}<select disabled aria-label="${label}" style="background-image:none;cursor:default;opacity:1"><option>${escapeHTML(value)}</option></select></label>`;
      summary.style.display = 'flex';
      summary.style.flexDirection = 'column';
      summary.style.gap = '22px';
      summary.innerHTML = field('Help with', values.help) + '<div class="form-row">' + field('Where', values.where) + field('For how long', values.duration) + '</div>';
    }
    setText('#request-result-title', cancelled ? 'Request cancelled.' : 'Request sent.');
    setText('#request-result-note', cancelled ? 'No longer visible to your team.' : 'Waiting for a teammate.');
    setText('#request-result-status', cancelled ? 'ALLYSON · CLOSED' : 'ALLYSON · REQUEST OPEN');
    $('#request-result-status')?.setAttribute('class', 'eyebrow');
    setText('#edit-request', 'Edit request');
    show('#edit-request', !cancelled);
    show('#cancel-request', !cancelled);
    const result = $('#sent-request');
    if (result && !$('#new-request')) {
      result.insertAdjacentHTML('beforeend', '<button id="new-request" type="button" class="btn btn-ink" hidden>New request</button>');
    }
    show('#new-request', cancelled);
    if (result) {
      const note = $('#request-result-note');
      if (note) result.appendChild(note);
    }
    for (const [key, selector] of Object.entries({ help: '#help-task', where: '#help-location', duration: '#help-duration' })) {
      const select = $(selector);
      if (select && select.value !== state.draft[key]) select.value = state.draft[key];
      setText(`#request-result-${key}`, values[key]);
    }
    setText('#outgoing-feedback', '');
    const queue = $('#outgoing-request');
    if (queue) {
      queue.hidden = !state.outgoing;
      queue.innerHTML = state.outgoing
        ? `<strong>Allyson · Your request</strong><span>${escapeHTML(state.outgoing.help)} · ${escapeHTML(state.outgoing.where)} · ${escapeHTML(state.outgoing.duration)}</span><small>Waiting for a teammate.</small>` : '';
    }
  }

  function renderHandoff() {
    // Alex's panorama note and Allyson's outgoing note are separate records.
    setText('#wide-note-state', state.handoffSeen ? 'Seen by Allyson · Just now' : '');
    const ack = $('#wide-note');
    if (ack) { ack.textContent = state.handoffSeen ? 'Seen' : 'Got it'; ack.disabled = state.handoffSeen; }
    setText('#handoff-title', state.handoffDraft.title);
    setText('#handoff-body', state.handoffDraft.body);
    const send = $('#handoff-send');
    if (send) { send.textContent = state.handoffSent ? 'Sent' : 'Send note'; send.disabled = state.handoffSent || state.handoffEditing; }
    const edit = $('#handoff-edit');
    if (edit) edit.disabled = state.handoffEditing;
    const feedback = $('#handoff-feedback');
    if (!feedback) return;
    if (state.handoffEditing) {
      feedback.innerHTML = `<form data-tip-handoff-edit><label for="tip-handoff-title">Title</label><input id="tip-handoff-title" name="title" required maxlength="80" value="${escapeHTML(state.handoffDraft.title)}"><label for="tip-handoff-body">Note</label><textarea id="tip-handoff-body" name="body" required maxlength="240" rows="3">${escapeHTML(state.handoffDraft.body)}</textarea><div class="card-actions"><button type="submit" class="btn btn-gold">Save note</button>${button('Cancel', 'cancel-handoff-edit', 'glass')}</div></form>`;
    } else feedback.textContent = state.handoffSent ? 'Sent to Jamie.' : '';
  }

  function render() {
    renderIncoming();
    renderAvailability();
    renderOutgoing();
    renderHandoff();
  }

  function dispatch(action) {
    const next = reduceCoordination(state, action);
    if (next === state) return;
    state = next;
    if (action.type !== 'SEND_MESSAGE') messageView = null;
    render();
  }

  function draftFromForm() {
    return {
      help: $('#help-task')?.value || state.draft.help,
      where: $('#help-location')?.value || state.draft.where,
      duration: $('#help-duration')?.value || state.draft.duration,
    };
  }

  for (const [key, selector] of Object.entries({ help: '#help-task', where: '#help-location', duration: '#help-duration' })) {
    const select = $(selector);
    if (select) select.innerHTML = REQUEST_OPTIONS[key].map(value => `<option>${value}</option>`).join('');
  }

  root.addEventListener('click', event => {
    const el = event.target.closest('button');
    if (!el || el.disabled) return;
    if (el.closest('#hero-request')) heroInteracted = true;
    if (el.dataset.step !== undefined) {
      dispatch({ type: 'PREVIEW_STEP', step: Number(el.dataset.step) });
      focus(`[data-step="${currentStep(state)}"]`);
      return;
    }
    if (el.dataset.availability) {
      dispatch({ type: 'SET_AVAILABILITY', availability: el.dataset.availability });
      return;
    }
    const idActions = {
      'reset-demo': 'reset', 'edit-request': 'edit-outgoing', 'cancel-request': 'cancel-outgoing', 'new-request': 'new-outgoing',
      'wide-note': 'ack-handoff', 'handoff-send': 'send-handoff', 'handoff-edit': 'edit-handoff',
    };
    const action = el.dataset.tipAction || idActions[el.id];
    const simpleActions = {
      accept: 'ACCEPT', dismiss: 'DISMISS', undo: 'UNDO_DISMISS', arrive: 'ARRIVE', finish: 'FINISH',
      'confirm-return': 'CONFIRM_RETURN', 'keep-covering': 'KEEP_COVERING', reset: 'RESET',
      'ack-incoming': 'ACK_INCOMING_NOTE', 'ack-handoff': 'ACK_HANDOFF',
      'edit-outgoing': 'EDIT_REQUEST', 'cancel-outgoing': 'CANCEL_REQUEST', 'new-outgoing': 'NEW_REQUEST',
      'send-handoff': 'SEND_HANDOFF', 'edit-handoff': 'EDIT_HANDOFF', 'cancel-handoff-edit': 'CANCEL_HANDOFF_EDIT',
    };
    if (simpleActions[action]) {
      const view = el.closest('#wide-request') ? 'wide' : el.closest('#hero-request') ? 'hero' : 'demo';
      dispatch({ type: simpleActions[action] });
      if (['edit-outgoing', 'new-outgoing'].includes(action)) focus('#help-task');
      else if (action === 'cancel-outgoing') focus('#new-request');
      else if (action === 'edit-handoff') focus('#tip-handoff-title');
      else if (action === 'cancel-handoff-edit') focus('#handoff-edit');
      else if (['accept', 'dismiss', 'undo', 'arrive', 'finish', 'confirm-return', 'reset', 'keep-covering'].includes(action)) {
        focusElement($(view === 'wide' ? '#wide-request [data-tip-action]' : view === 'hero' ? '#hero-request-actions a, #hero-request-actions button' : '#demo-card [data-tip-action]'));
      }
    } else if (action === 'available') dispatch({ type: 'SET_AVAILABILITY', availability: 'available' });
    else if (action === 'message') { messageView = el.dataset.tipView; renderIncoming(); focus(`#tip-message-${messageView}`); }
    else if (action === 'close-message') { messageView = null; renderIncoming(); }
    else if (action === 'send-message') el.closest('form')?.requestSubmit();
  }, listenerOptions);

  root.addEventListener('submit', event => {
    const target = event.target;
    if (target.id === 'request-form') {
      event.preventDefault();
      dispatch({ type: 'SEND_REQUEST', draft: draftFromForm() });
      focus('#edit-request');
    } else if (target.matches('[data-tip-message]')) {
      event.preventDefault();
      const message = target.elements.message.value;
      if (!message.trim()) { target.elements.message.value = ''; target.reportValidity(); return; }
      messageView = null;
      dispatch({ type: 'SEND_MESSAGE', message });
    } else if (target.matches('[data-tip-handoff-edit]')) {
      event.preventDefault();
      const title = target.elements.title.value, body = target.elements.body.value;
      if (!title.trim() || !body.trim()) return;
      dispatch({ type: 'SAVE_HANDOFF_DRAFT', title, body });
      focus('#handoff-send');
    }
  }, listenerOptions);

  root.addEventListener('change', event => {
    if (['help-task', 'help-location', 'help-duration'].includes(event.target.id)) {
      state = reduceCoordination(state, { type: 'UPDATE_DRAFT', draft: draftFromForm() });
    }
  }, listenerOptions);

  root.addEventListener('keydown', event => {
    if (event.target.matches('[data-step]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const n = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (currentStep(state) + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
      dispatch({ type: 'PREVIEW_STEP', step: n }); focus(`[data-step="${n}"]`);
    } else if (event.key === 'Escape' && messageView) {
      const previousView = messageView;
      messageView = null; renderIncoming(); focus(`[data-tip-view="${previousView}"]`);
    } else if (event.key === 'Escape' && state.handoffEditing) {
      dispatch({ type: 'CANCEL_HANDOFF_EDIT' }); focus('#handoff-edit');
    }
  }, listenerOptions);

  render();
  return { getState: () => structuredClone(state), dispatch, dispose: () => lifetime.abort() };
}
