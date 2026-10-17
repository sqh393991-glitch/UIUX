import {
  REQUEST_OPTIONS, createInitialState, reduceCoordination,
  currentStep, incomingIsPaused, isActiveCoverage, availabilityCopy,
} from './coordination-state.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const button = (label, action, variant = 'gold', extra = '') =>
  `<button type="button" class="btn btn-${variant}" data-tip-action="${action}" ${extra}>${label}</button>`;

const PHASE_COPY = {
  request: { badge: 'Needs help', alex: 'Needs help · Bar', mark: '!', queue: '1 open request', item: 'Cover the bar · 5 min', title: 'Waiting for a teammate.', detail: 'Your request is visible to the on-shift team.', explanation: 'Alex stays at the bar until someone arrives.' },
  dismissed: { badge: 'Request dismissed', alex: 'Needs help · Bar', mark: '!', queue: 'Request hidden for you', item: 'Alex’s request is still open', title: 'Waiting for a teammate.', detail: 'Your request is still open to the team.', explanation: 'Dismissing a request does not close it for everyone else.' },
  accepted: { badge: 'Request accepted', alex: 'Allyson is on the way · Bar', mark: '✓', queue: '1 accepted request', item: 'Allyson is on the way', title: 'Allyson is coming.', detail: 'Stay at the bar until Allyson arrives.', explanation: 'Both teammates can see who accepted the request.' },
  covering: { badge: 'Covering the bar', alex: 'Restocking · Allyson covering', mark: '↔', queue: '1 active task', item: 'You’re covering the bar', title: 'Allyson is at the bar.', detail: 'You can restock. Your handoff note has been shared.', explanation: 'Coverage begins when Allyson arrives, not when she accepts.' },
  handback: { badge: 'Waiting for Alex', alex: 'Returning to the bar', mark: '…', queue: '1 active task', item: 'Waiting for Alex to return', title: 'Ready to take over?', detail: 'Allyson is waiting to hand the bar back to you.', explanation: 'Alex confirms the handback before this task closes.' },
  complete: { badge: 'Coverage complete', alex: 'Back at bar · Request closed', mark: '✓', queue: 'No open requests', item: 'Bar cover · Complete', title: 'You’re back at the bar.', detail: 'The request is closed. Allyson can return to her work.', explanation: 'Both teammates know the cover is finished.' },
};

/** Functional local walkthrough. No camera, microphone, or external service is used. */
export function initCoordination(root = document) {
  const $ = selector => root.querySelector(selector);
  const $$ = selector => Array.from(root.querySelectorAll(selector));
  const lifetime = new AbortController();
  const listenerOptions = { signal: lifetime.signal };
  let state = createInitialState();
  let messageView = null;
  let handoffQuestionOpen = false;

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

  function helperContent(view) {
    if (incomingIsPaused(state)) {
      return `<span class="status-chip">${state.availability === 'break' ? 'On break' : 'Busy with a task'}</span><h3>New requests<br>are paused.</h3><p>When you’re ready, set your status to Available.</p>${button('Available to help', 'available', 'glass')}`;
    }
    const badge = `<span class="status-chip">${PHASE_COPY[state.phase].badge}</span>`;
    const messageAction = `<button type="button" class="btn btn-glass" data-tip-action="message" data-tip-view="${view}">Message Alex</button>`;
    switch (state.phase) {
      case 'request':
        return `${badge}<div class="card-person"><span class="avatar">AL</span><div><strong>Alex · Bar station</strong><small>6 m · Just now</small></div></div><h3>Cover drinks for<br>5 minutes?</h3><p>I need to restock. Can someone take over?</p><div class="task-meta">Only your on-shift team</div><div class="card-actions">${button('Accept', 'accept')}${button('Dismiss', 'dismiss', 'glass')}</div>`;
      case 'dismissed':
        return `${badge}<h3>You skipped<br>this request.</h3><p>Alex’s request is still open to other teammates.</p><div class="card-actions">${button('Undo', 'undo', 'glass')}</div>`;
      case 'accepted':
        return `${badge}<h3>Alex knows<br>you’re coming.</h3><div class="mini-message"><span>Alex · Just now</span>Thanks, Allyson. I’ll wait until you get here.</div><p class="pan-flow-note">Coverage starts when you arrive.</p><div class="card-actions">${button('I’m at the bar', 'arrive')}${messageAction}</div>${messageMarkup(view)}`;
      case 'covering':
        return `${badge}<h3>You’re covering<br>the bar.</h3><div class="mini-message"><span>Alex’s note</span>Two drinks for table 12. Clean glasses are below the counter.</div><div class="task-meta">Alex is restocking · 5-minute cover</div><button type="button" class="pan-text-button" data-tip-action="ack-incoming" ${state.incomingNoteSeen ? 'disabled' : ''}>${state.incomingNoteSeen ? 'Note read' : 'Got it'}</button><div class="card-actions">${button('Finish coverage', 'finish')}${messageAction}</div>${messageMarkup(view)}`;
      case 'handback': {
        const confirmation = view === 'wide'
          ? `<section class="pan-other-person"><strong>Alex’s view</strong><p>Back at the bar and ready to take over?</p>${button('I’m back', 'confirm-return')}</section>`
          : '<p class="pan-flow-note">Alex confirms in the panel beside this view.</p>';
        return `${badge}<h3>Ready to hand<br>the bar back.</h3><p>Alex has been asked to return. Keep covering until Alex takes over.</p>${confirmation}<div class="card-actions">${button('Keep covering', 'keep-covering', 'glass')}${messageAction}</div>${messageMarkup(view)}`;
      }
      case 'complete':
        return `${badge}<h3>Alex is back<br>at the bar.</h3><div class="mini-message"><span>Alex · Just now</span>Thanks, Allyson. I’ve got it from here.</div><p>This request is closed.</p>${button('Replay', 'reset', 'glass')}`;
    }
  }

  function renderIncoming() {
    const phase = PHASE_COPY[state.phase];
    const wide = $('#wide-request');
    if (wide) {
      wide.classList.add('pan-flow-card');
      wide.dataset.flowState = state.phase;
      wide.innerHTML = `<div class="pan-flow-content">${progress()}${helperContent('wide')}</div>`;
    }
    const demo = $('#demo-card');
    if (demo) demo.innerHTML = `<article class="glass task-card" data-flow-state="${state.phase}">${helperContent('demo')}</article>`;
    setText('#wide-status', incomingIsPaused(state) ? 'Requests paused' : phase.badge);
    setText('#wide-alex-status', phase.alex);
    setText('#wide-team-mark', phase.mark);
    setText('#scene-state', phase.queue);
    setText('#scene-state-detail', phase.item);
    setText('#state-explanation', incomingIsPaused(state) ? 'Your status controls when new requests appear.' : phase.explanation);
    const requester = $('#requester-card');
    if (requester) requester.innerHTML = `<span class="status-chip">${state.phase === 'handback' ? 'Return to the bar' : phase.badge}</span><h3>${phase.title}</h3><p>${phase.detail}</p>${state.phase === 'handback' ? button('I’m back', 'confirm-return', 'ink') : ''}`;
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
    setText('#wide-worker-status', ownStatus);
  }

  function renderAvailability() {
    $$('[data-availability]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.availability === state.availability)));
    setText('#availability-feedback', availabilityCopy(state));
  }

  function renderOutgoing() {
    show('#request-form', state.editorVisible);
    show('#sent-request', !state.editorVisible && Boolean(state.outgoing));
    const values = state.outgoing || state.draft;
    setText('#request-summary', `${values.help} · ${values.where} · ${values.duration}`);
    for (const [key, selector] of Object.entries({ help: '#help-task', where: '#help-location', duration: '#help-duration' })) {
      const select = $(selector);
      if (select && select.value !== state.draft[key]) select.value = state.draft[key];
    }
    setText('#outgoing-feedback', state.outgoingNotice);
    const queue = $('#outgoing-request');
    if (queue) {
      queue.hidden = !state.outgoing;
      queue.innerHTML = state.outgoing
        ? `<strong>Allyson · Your request</strong><span>${escapeHTML(state.outgoing.help)} · ${escapeHTML(state.outgoing.where)} · ${escapeHTML(state.outgoing.duration)}</span><small>Waiting for a teammate</small>` : '';
    }
  }

  function renderHandoff() {
    const message = state.question ? `Question sent to Jamie: “${state.question}”` : state.handoffSeen ? 'Seen by Allyson · Just now' : '';
    setText('#wide-note-state', state.handoffSeen ? 'Seen by Allyson · Just now' : '');
    for (const selector of ['#wide-note', '#handoff-ack']) {
      const el = $(selector);
      if (el) { el.textContent = state.handoffSeen ? 'Seen' : 'Got it'; el.disabled = state.handoffSeen; }
    }
    const feedback = $('#handoff-feedback');
    if (!feedback) return;
    if (handoffQuestionOpen) feedback.innerHTML = '<form data-tip-handoff><label for="tip-handoff-question">Ask Jamie</label><input id="tip-handoff-question" name="question" required maxlength="160" placeholder="What do you need to know?"><button type="submit" class="btn btn-gold">Send question</button></form>';
    else feedback.textContent = message;
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
  const form = $('#request-form');
  if (form && !$('#outgoing-feedback')) {
    const note = form.ownerDocument.createElement('p');
    note.id = 'outgoing-feedback'; note.className = 'request-feedback'; note.setAttribute('role', 'status');
    form.insertAdjacentElement('afterend', note);
  }

  root.addEventListener('click', event => {
    const el = event.target.closest('button');
    if (!el || el.disabled) return;
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
      'reset-demo': 'reset', 'edit-request': 'edit-outgoing', 'cancel-request': 'cancel-outgoing',
      'wide-note': 'ack-handoff', 'handoff-ack': 'ack-handoff', 'handoff-ask': 'ask-handoff',
    };
    const action = el.dataset.tipAction || idActions[el.id];
    const simpleActions = {
      accept: 'ACCEPT', dismiss: 'DISMISS', undo: 'UNDO_DISMISS', arrive: 'ARRIVE', finish: 'FINISH',
      'confirm-return': 'CONFIRM_RETURN', 'keep-covering': 'KEEP_COVERING', reset: 'RESET',
      'ack-incoming': 'ACK_INCOMING_NOTE', 'ack-handoff': 'ACK_HANDOFF',
      'edit-outgoing': 'EDIT_REQUEST', 'cancel-outgoing': 'CANCEL_REQUEST',
    };
    if (simpleActions[action]) {
      const view = el.closest('#wide-request') ? 'wide' : 'demo';
      dispatch({ type: simpleActions[action] });
      if (['edit-outgoing', 'cancel-outgoing'].includes(action)) focus('#help-task');
      else if (['accept', 'dismiss', 'undo', 'arrive', 'finish', 'confirm-return', 'reset', 'keep-covering'].includes(action)) {
        const next = $(view === 'wide' ? '#wide-request [data-tip-action]' : '#demo-card [data-tip-action]');
        focusElement(next);
      }
    } else if (action === 'available') dispatch({ type: 'SET_AVAILABILITY', availability: 'available' });
    else if (action === 'message') { messageView = el.dataset.tipView; renderIncoming(); focus(`#tip-message-${messageView}`); }
    else if (action === 'close-message') { messageView = null; renderIncoming(); }
    else if (action === 'send-message') el.closest('form')?.requestSubmit();
    else if (action === 'ask-handoff') { handoffQuestionOpen = !handoffQuestionOpen; renderHandoff(); focus('#tip-handoff-question'); }
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
    } else if (target.matches('[data-tip-handoff]')) {
      event.preventDefault();
      const question = target.elements.question.value;
      if (!question.trim()) { target.elements.question.value = ''; target.reportValidity(); return; }
      handoffQuestionOpen = false;
      dispatch({ type: 'ASK_HANDOFF', question });
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
    }
  }, listenerOptions);

  render();
  return { getState: () => structuredClone(state), dispatch, dispose: () => lifetime.abort() };
}
