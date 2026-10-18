export const REQUEST_OPTIONS = Object.freeze({
  help: ['Cover my station', 'Run food or drinks', 'Restock supplies', 'Help with cleanup'],
  where: ['Bar station', 'Dining area', 'Service counter', 'Prep area'],
  duration: ['5 minutes', '10 minutes', '15 minutes', '30 minutes'],
});

export const PHASES = Object.freeze(['request', 'dismissed', 'accepted', 'covering', 'handback', 'complete']);
export const ACTIVE_PHASES = Object.freeze(['accepted', 'covering', 'handback']);

export function createInitialState() {
  return {
    phase: 'request',
    availability: 'available',
    handoffSeen: false,
    handoffEditing: false,
    handoffSent: false,
    handoffDraft: { title: 'Prep is done.', body: 'Please refill the cups before service starts.' },
    incomingNoteSeen: false,
    messages: [],
    question: '',
    outgoing: null,
    editorVisible: true,
    outgoingNotice: '',
    outgoingCancelled: false,
    draft: { help: REQUEST_OPTIONS.help[0], where: REQUEST_OPTIONS.where[0], duration: REQUEST_OPTIONS.duration[0] },
  };
}

export function isActiveCoverage(state) {
  return ACTIVE_PHASES.includes(state.phase);
}

export function incomingIsPaused(state) {
  return state.availability !== 'available' && ['request', 'dismissed'].includes(state.phase);
}

export function currentStep(state) {
  return ({ request: 0, dismissed: 0, accepted: 1, covering: 2, handback: 2, complete: 3 })[state.phase];
}

function validDraft(draft) {
  return draft && Object.keys(REQUEST_OPTIONS).every(key => REQUEST_OPTIONS[key].includes(draft[key]));
}

/** Both views observe this same state. An outgoing request is a separate task. */
export function reduceCoordination(state, action) {
  switch (action.type) {
    case 'ACCEPT':
      return state.phase === 'request' && !incomingIsPaused(state) ? { ...state, phase: 'accepted' } : state;
    case 'DISMISS':
      return state.phase === 'request' && !incomingIsPaused(state) ? { ...state, phase: 'dismissed' } : state;
    case 'UNDO_DISMISS':
      return state.phase === 'dismissed' ? { ...state, phase: 'request' } : state;
    case 'ARRIVE':
      return state.phase === 'accepted' ? { ...state, phase: 'covering' } : state;
    case 'FINISH':
      return state.phase === 'covering' ? { ...state, phase: 'handback' } : state;
    case 'KEEP_COVERING':
      return state.phase === 'handback' ? { ...state, phase: 'covering' } : state;
    case 'CONFIRM_RETURN':
      return state.phase === 'handback' ? { ...state, phase: 'complete' } : state;
    case 'RESET':
      return { ...state, phase: 'request', incomingNoteSeen: false, messages: [] };
    case 'PREVIEW_STEP': {
      const phase = ['request', 'accepted', 'covering', 'complete'][action.step];
      return phase ? { ...state, phase, incomingNoteSeen: false, messages: [] } : state;
    }
    case 'SET_AVAILABILITY':
      return ['available', 'busy', 'break'].includes(action.availability)
        ? { ...state, availability: action.availability } : state;
    case 'ACK_INCOMING_NOTE':
      return state.phase === 'covering' ? { ...state, incomingNoteSeen: true } : state;
    case 'ACK_HANDOFF':
      return { ...state, handoffSeen: true };
    case 'EDIT_HANDOFF':
      return { ...state, handoffEditing: true };
    case 'CANCEL_HANDOFF_EDIT':
      return { ...state, handoffEditing: false };
    case 'SAVE_HANDOFF_DRAFT': {
      const title = String(action.title || '').trim().slice(0, 80);
      const body = String(action.body || '').trim().slice(0, 240);
      return title && body ? {
        ...state, handoffDraft: { title, body }, handoffEditing: false, handoffSent: false,
      } : state;
    }
    case 'SEND_HANDOFF':
      return state.handoffEditing ? state : { ...state, handoffSent: true };
    case 'SEND_MESSAGE': {
      const message = String(action.message || '').trim().slice(0, 160);
      return message && isActiveCoverage(state) ? { ...state, messages: [...state.messages, message] } : state;
    }
    case 'ASK_HANDOFF': {
      const question = String(action.question || '').trim().slice(0, 160);
      return question ? { ...state, question } : state;
    }
    case 'UPDATE_DRAFT':
      return validDraft(action.draft) ? { ...state, draft: { ...action.draft } } : state;
    case 'SEND_REQUEST': {
      const draft = action.draft || state.draft;
      if (!validDraft(draft)) return state;
      return {
        ...state,
        draft: { ...draft },
        outgoing: { ...draft, author: 'Allyson', status: 'open' },
        editorVisible: false,
        outgoingNotice: 'Request sent.',
        outgoingCancelled: false,
      };
    }
    case 'EDIT_REQUEST':
      return state.outgoing ? { ...state, editorVisible: true, outgoingNotice: '' } : state;
    case 'CANCEL_REQUEST':
      return state.outgoing ? {
        ...state,
        outgoing: null,
        editorVisible: true,
        outgoingNotice: 'Request cancelled.',
        outgoingCancelled: true,
      } : state;
    case 'NEW_REQUEST':
      return {
        ...state, outgoing: null, editorVisible: true, outgoingCancelled: false, outgoingNotice: '',
        draft: { help: REQUEST_OPTIONS.help[0], where: REQUEST_OPTIONS.where[0], duration: REQUEST_OPTIONS.duration[0] },
      };
    default:
      return state;
  }
}

export function availabilityCopy(state) {
  const copy = {
    available: 'You’ll receive new requests.',
    busy: 'New requests are paused while you finish your task.',
    break: 'New requests are paused while you take a break.',
  }[state.availability];
  return copy + (isActiveCoverage(state) && state.availability !== 'available'
    ? ' Your bar cover stays active until Alex takes over.' : '');
}
