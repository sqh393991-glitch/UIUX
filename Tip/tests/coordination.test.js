import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, reduceCoordination, incomingIsPaused, isActiveCoverage, currentStep, availabilityCopy } from '../src/coordination-state.js';

const run = (actions, initial = createInitialState()) => actions.reduce(reduceCoordination, initial);

test('coverage closes only when the requester confirms taking the station back', () => {
  const accepted = run([{ type: 'ACCEPT' }]);
  assert.equal(accepted.phase, 'accepted');
  assert.equal(reduceCoordination(accepted, { type: 'FINISH' }), accepted);
  const covering = reduceCoordination(accepted, { type: 'ARRIVE' });
  assert.equal(covering.phase, 'covering');
  const handback = reduceCoordination(covering, { type: 'FINISH' });
  assert.equal(handback.phase, 'handback');
  assert.equal(currentStep(handback), 2);
  assert.equal(isActiveCoverage(handback), true);
  assert.equal(reduceCoordination(handback, { type: 'CONFIRM_RETURN' }).phase, 'complete');
});

test('dismiss is reversible and cannot accidentally accept or finish a task', () => {
  const dismissed = run([{ type: 'DISMISS' }]);
  assert.equal(dismissed.phase, 'dismissed');
  assert.equal(reduceCoordination(dismissed, { type: 'ACCEPT' }), dismissed);
  assert.equal(reduceCoordination(dismissed, { type: 'ARRIVE' }), dismissed);
  const restored = reduceCoordination(dismissed, { type: 'UNDO_DISMISS' });
  assert.equal(reduceCoordination(restored, { type: 'ACCEPT' }).phase, 'accepted');
});

test('busy and break pause new requests without abandoning coverage already accepted', () => {
  for (const availability of ['busy', 'break']) {
    const paused = run([{ type: 'SET_AVAILABILITY', availability }]);
    assert.equal(incomingIsPaused(paused), true);
    assert.equal(reduceCoordination(paused, { type: 'ACCEPT' }), paused);
    const ongoing = run([{ type: 'ACCEPT' }, { type: 'SET_AVAILABILITY', availability }]);
    assert.equal(incomingIsPaused(ongoing), false);
    assert.equal(ongoing.phase, 'accepted');
    assert.match(availabilityCopy(ongoing), /stays active/);
    assert.equal(reduceCoordination(ongoing, { type: 'ARRIVE' }).phase, 'covering');
  }
});

test('changing availability cannot silently close handback or reactivate complete task', () => {
  const handback = run([{ type: 'ACCEPT' }, { type: 'ARRIVE' }, { type: 'FINISH' }, { type: 'SET_AVAILABILITY', availability: 'break' }]);
  assert.equal(handback.phase, 'handback');
  const complete = reduceCoordination(handback, { type: 'CONFIRM_RETURN' });
  assert.equal(isActiveCoverage(complete), false);
  assert.equal(reduceCoordination(complete, { type: 'SET_AVAILABILITY', availability: 'available' }).phase, 'complete');
});

test('outgoing request preserves selections, editing, and cancellation separately from Alex request', () => {
  const draft = { help: 'Restock supplies', where: 'Prep area', duration: '15 minutes' };
  const sent = run([{ type: 'ACCEPT' }, { type: 'SEND_REQUEST', draft }]);
  assert.equal(sent.phase, 'accepted');
  assert.deepEqual(sent.draft, draft);
  assert.equal(sent.outgoing.author, 'Allyson');
  assert.equal(sent.editorVisible, false);
  const editing = reduceCoordination(sent, { type: 'EDIT_REQUEST' });
  assert.equal(editing.outgoing.status, 'open');
  assert.equal(editing.editorVisible, true);
  assert.deepEqual(editing.draft, draft);
  const updatedDraft = { ...draft, duration: '30 minutes' };
  const updated = reduceCoordination(editing, { type: 'SEND_REQUEST', draft: updatedDraft });
  assert.equal(updated.outgoing.duration, '30 minutes');
  const cancelled = reduceCoordination(updated, { type: 'CANCEL_REQUEST' });
  assert.equal(cancelled.outgoing, null);
  assert.equal(cancelled.editorVisible, true);
  assert.equal(cancelled.phase, 'accepted');
  assert.match(cancelled.outgoingNotice, /cancelled/);
});

test('tab previews synchronize canonical stage and restart leaves outgoing request alone', () => {
  let state = run([{ type: 'SEND_REQUEST' }]);
  for (const [step, phase] of ['request', 'accepted', 'covering', 'complete'].entries()) {
    state = reduceCoordination(state, { type: 'PREVIEW_STEP', step });
    assert.equal(state.phase, phase);
    assert.equal(currentStep(state), step);
  }
  assert.equal(reduceCoordination(state, { type: 'PREVIEW_STEP', step: 20 }), state);
  assert.deepEqual(reduceCoordination(state, { type: 'RESET' }).outgoing, state.outgoing);
});

test('handoff acknowledgement does not accept a task and empty messages are rejected', () => {
  const state = run([{ type: 'ACK_HANDOFF' }]);
  assert.equal(state.handoffSeen, true);
  assert.equal(state.phase, 'request');
  assert.equal(reduceCoordination(state, { type: 'SEND_MESSAGE', message: 'Hi' }), state);
  const active = reduceCoordination(state, { type: 'ACCEPT' });
  assert.equal(reduceCoordination(active, { type: 'SEND_MESSAGE', message: '  ' }), active);
  assert.deepEqual(reduceCoordination(active, { type: 'SEND_MESSAGE', message: ' On my way. ' }).messages, ['On my way.']);
});

test('invalid requests and unrecognized availability do not mutate state', () => {
  const state = createInitialState();
  assert.equal(reduceCoordination(state, { type: 'SEND_REQUEST', draft: { help: 'anything' } }), state);
  assert.equal(reduceCoordination(state, { type: 'SET_AVAILABILITY', availability: 'offline' }), state);
});

test('unsaved request edits do not change the request the team already sees', () => {
  const sent = run([{ type: 'SEND_REQUEST' }, { type: 'EDIT_REQUEST' }]);
  const draft = { ...sent.draft, help: 'Help with cleanup', where: 'Service counter' };
  const editing = reduceCoordination(sent, { type: 'UPDATE_DRAFT', draft });
  assert.equal(editing.outgoing.help, 'Cover my station');
  assert.equal(editing.draft.help, 'Help with cleanup');
  assert.equal(sent.draft.help, 'Cover my station');
  const saved = reduceCoordination(editing, { type: 'SEND_REQUEST' });
  assert.equal(saved.outgoing.help, 'Help with cleanup');
  assert.equal(saved.outgoing.where, 'Service counter');
});
