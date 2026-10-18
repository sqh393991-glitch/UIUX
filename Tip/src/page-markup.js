// Original Tip Sites composition and copy. The glasses viewport is the only
// replacement visual; the rest follows the editable Figma Desktop frame.
const asset = name => `./assets/figma/${name}`;
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({expand:'<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',rotate:'<path d="M5 7c2-4 12-4 14 0s-2 6-7 6M5 7l4-1M5 7l1-4M19 17c-2 4-12 4-14 0s2-6 7-6M19 17l-4 1m4-1-1 4"/>'})[name]}</svg>`;
const person = (initials, name, detail) => `<div class="card-person"><span class="avatar">${initials}</span><div><strong>${name}</strong><small>${detail}</small></div></div>`;

// Initial HTML matches the first state rendered by coordination.js. It keeps the
// approved page visible before its optional browser interactions are initialized.
const initialProgress = '<ol class="pan-flow-progress" aria-label="Task progress">' +
  ['Request', 'Accept', 'Coordinate', 'Complete'].map((name, index) =>
    `<li class=""${index === 0 ? ' aria-current="step"' : ''}><span aria-hidden="true">${index + 1}</span>${name}</li>`
  ).join('') + '</ol>';
const initialRequestPerson = person('AL', 'Alex · Bar station', '6 m · Just now');
const initialWideRequest = `<div class="pan-flow-content">${initialProgress}${initialRequestPerson}<h3>Can you cover drinks<br>for 5 minutes?</h3><p>I’m heading to the stockroom.<br>Can someone take over?</p><div class="card-actions"><button type="button" class="btn btn-gold" data-tip-action="accept">Accept</button><button type="button" class="btn btn-glass" data-tip-action="dismiss">Dismiss</button></div></div>`;
const initialDemoRequest = `<span class="status-chip">NEEDS HELP</span><article class="glass task-card" data-flow-state="request">${initialRequestPerson}<h3>Cover drinks for<br>5 minutes?</h3><p>I need to restock. Can someone take over?</p><div class="task-meta">Only your on-shift team</div><div class="card-actions"><button type="button" class="btn btn-gold" data-tip-action="accept">Accept</button><button type="button" class="btn btn-glass" data-tip-action="dismiss">Dismiss</button></div></article>`;
const initialRequester = '<span class="status-chip">REQUEST OPEN</span><h3>Waiting for a teammate.</h3><p>Your request is visible to the on-shift team.</p>';

export const pageMarkup = `
<main id="home">
  <section class="hero" aria-label="TIP AR glasses for restaurant teams">
    <img class="hero-photo" src="${asset('imgSceneOriginalPhoto.png')}" alt="A restaurant during a shift">
    <div class="hero-shade"></div>
    <span class="community-label">COMMUNITY</span>
    <header class="nav glass-light">
      <a class="brand" href="#home" aria-label="TIP home"><img src="${asset('imgWhiteLogoTint1.png')}" alt="tip"></a>
      <nav aria-label="Main navigation"><a href="#demo">The shared view</a><a href="#handoff">Between shifts</a><a href="#product">The glasses</a><a href="#contact">Contact</a></nav>
      <a class="btn btn-glass nav-demo" href="#demo">View demo</a>
      <button class="menu-toggle" aria-label="Open navigation" aria-expanded="false">Menu</button>
    </header>
    <div class="hero-copy">
      <p class="eyebrow">FOR RESTAURANT TEAMS</p>
      <h1>See where your<br>team needs you.</h1>
      <p class="hero-intro">See who needs a hand and respond<br>without reaching for your phone.</p>
      <a class="btn btn-glass" href="#workflow">See how it works</a>
      <a class="hero-glasses glass-light" href="#product"><img src="./models/tip-glasses-hero.webp" alt="TIP 01 AR glasses"><span><small>TIP 01</small>AR glasses for<br>restaurant teams.</span></a>
    </div>
    <div class="hero-request-anchor">
      <span class="status-chip gold" id="hero-request-status">● &nbsp;NEEDS HELP</span>
      <article class="glass hero-request" id="hero-request">
        ${person('AL','Alex','Bar station · 6 m')}
        <h3 id="hero-request-title">Can someone cover drinks for 5 minutes?</h3>
        <p id="hero-request-detail">Cover my station &nbsp; · &nbsp; Just now</p>
        <div class="card-actions" id="hero-request-actions"><button class="btn btn-gold" data-tip-action="accept">Accept</button><button class="btn btn-glass" data-tip-action="dismiss">Dismiss</button></div>
      </article>
    </div>
    <div class="hero-marker hero-jamie glass"><strong>Jamie</strong><small>Available to help</small></div>
    <div class="hero-marker hero-prep glass"><strong>Prep station</strong><small>Alex left a note</small></div>
    <span class="hero-view">ALLYSON’S VIEW · 17:24</span>
    <button class="btn btn-glass hero-pause" id="hero-pause" aria-pressed="false">Pause movement</button>
  </section>

  <section class="experience" id="experience">
    <div class="section-heading section panorama-heading"><div><p class="eyebrow">ON SHIFT</p><h2>See who needs help.</h2></div><p>A wider view of the same shift.<br>Look around, find a request, and lend a hand.</p></div>
    <div id="demo">
      <div class="panorama" id="panorama" tabindex="0" role="region" aria-label="Restaurant scene. Drag to look left or right. Arrow keys move; Home recenters.">
        <div class="pan-world" id="pan-world">
          <img class="pan-photo" src="${asset('imgSceneOriginalPhoto1.png')}" alt="A wide view of a restaurant work area" draggable="false">
          <div class="pan-vignette"></div>
          <article class="pan-team glass">
            <div class="hud-title">ON-SHIFT TEAM <span>03</span></div>
            <div class="hud-person"><span class="avatar">AK</span><div><strong>Allyson</strong><small id="wide-user-status">You · Available</small></div></div>
            <div class="hud-person"><span class="avatar">JA</span><div><strong>Jamie</strong><small>Available to help</small></div></div>
            <div class="hud-person"><span class="avatar">AL</span><div><strong>Alex</strong><small id="wide-alex-status">Needs help · Bar</small></div><span id="wide-team-mark" hidden></span></div>
            <p class="team-note">Availability is set by each teammate.</p>
            <div class="team-outgoing" id="outgoing-request" hidden></div>
          </article>
          <div class="pan-request-anchor"><div class="status-chip gold" id="wide-status">NEEDS HELP</div><article class="pan-request glass pan-flow-card" id="wide-request" data-flow-state="request" aria-live="polite">${initialWideRequest}</article></div>
          <article class="pan-handoff glass"><p class="eyebrow">SHIFT HANDOFF</p>${person('AL','From Alex','Prep station · 3:20 PM')}<p>Clean trays are on the lower shelf.</p><button class="btn btn-glass" id="wide-note">Got it</button><span class="note-state" id="wide-note-state" role="status"></span></article>
        </div>
        <div class="pan-top"><div class="pan-identity glass"><img src="${asset('imgWhiteLogoTint.png')}" alt="tip"><span>ALLYSON’S VIEW<small>17:24</small></span></div><div class="pan-tools"><button class="round-button btn-glass" id="pan-center" aria-label="Recenter restaurant view">${icon('reset')}</button><button class="round-button btn-glass" id="pan-fullscreen" aria-label="Enter full screen">${icon('expand')}</button></div></div>
        <div class="pan-bottom"><span class="pan-instruction">CHOOSE A VIEW</span><div class="pan-controls glass" role="group" aria-label="Look around"><button data-pan-target="team" aria-pressed="false">Team</button><button data-pan-target="request" aria-pressed="true">Help request</button><button data-pan-target="handoff" aria-pressed="false">Handoff</button></div></div>
      </div>
    </div>
  </section>

  <section class="section how-it-works" id="how-it-works">
    <div class="section-heading"><div><p class="eyebrow">HOW IT WORKS</p><h2>Know how to help.</h2></div><p>See who needs help, what they need, and where to go without checking your phone.</p></div>
    <div class="principles"><article><p>01 / WHO</p><h3>Who needs help?</h3><p>See the coworker who sent the request.</p></article><article><p>02 / WHAT</p><h3>One clear ask.</h3><p>Read the task and how long they need help.</p></article><article><p>03 / WHERE</p><h3>Where to go.</h3><p>A marker shows which station needs help.</p></article></div>
  </section>

  <section class="section workflow" id="workflow">
    <div class="section-heading"><div><p class="eyebrow">01 / TEAM REQUESTS</p><h2>Help a teammate.</h2></div><p>You’re Allyson. Alex needs five minutes away from the bar to restock. See both sides of the request.</p></div>
    <div class="step-tabs" role="tablist" aria-label="Coordination steps">${['Request','Accept','Coordinate','Complete'].map((s,i)=>`<button id="step-${i}" role="tab" aria-controls="shift-panel" aria-selected="${i===0}" data-step="${i}"><span>0${i+1}</span>${s}</button>`).join('')}</div>
    <div class="coordination-layout" id="shift-panel" role="tabpanel" aria-labelledby="step-0">
      <div class="lens-scene"><img class="scene-photo" src="${asset('imgSceneOriginalPhoto.png')}" alt="Alex’s bar station" loading="lazy"><div class="scene-gradient"></div><div class="scene-top"><img src="${asset('imgWhiteLogoTint.png')}" alt="tip"><span>ALLYSON’S VIEW</span></div><div class="request-queue glass"><span id="scene-state">1 open request</span><div class="queue-person"><span class="avatar">AL</span><div><strong>Alex</strong><small id="scene-state-detail">Cover the bar · 5 min</small></div></div></div><span class="spatial-tag glass"><span>Alex</span><strong>Bar station · 6 m</strong></span><div id="demo-card" class="demo-card" aria-live="polite">${initialDemoRequest}</div><span class="scene-bottom">AR INTERFACE</span></div>
      <aside class="other-view"><div class="view-caption">${person('AL','Alex’s view','The teammate who asked')}</div><div class="requester-card" id="requester-card" aria-live="polite">${initialRequester}</div><p class="state-explanation" id="state-explanation">You can stay at the bar until someone arrives.</p><button class="btn btn-pale" id="reset-demo">Restart demo</button></aside>
    </div>
  </section>

  <section class="section ask-section" id="ask">
    <div class="split-section"><div class="section-copy"><p class="eyebrow">02 / ASK YOUR TEAM</p><h2>A simple ask.</h2><p>Choose the task, the station, and how long you need. Send it to your on-shift team.</p><p class="voice-instruction">◉ &nbsp; Say “TIP, ask my team.”<br>&nbsp;&nbsp;&nbsp;&nbsp; Confirm with a tap on the temple.</p><p class="small">Try sending a request with this form.</p></div>
      <div class="composer"><form id="request-form"><p class="eyebrow">ASK YOUR TEAM</p><h3>What do you need?</h3><label>Help with<select id="help-task"><option>Cover my station</option><option>Run food or drinks</option><option>Restock supplies</option><option>Help with cleanup</option></select></label><div class="form-row"><label>Where<select id="help-location"><option>Bar station</option><option>Dining area</option><option>Service counter</option><option>Prep area</option></select></label><label>For how long<select id="help-duration"><option>5 minutes</option><option>10 minutes</option><option>15 minutes</option><option>30 minutes</option></select></label></div><button class="btn btn-ink full" type="submit">Send request</button><p class="small form-caption">For your on-shift team.</p></form><div id="sent-request" hidden aria-live="polite"><span class="status-chip" id="request-result-status">ASK YOUR TEAM</span><h3 id="request-result-title">Request sent.</h3><p id="request-summary"></p><p id="request-result-note">Your request is visible to the on-shift team.</p><div class="card-actions"><button class="btn btn-line" id="edit-request">Edit</button><button class="btn btn-line" id="cancel-request">Cancel request</button></div></div></div>
    </div>
  </section>

  <section class="section handoff-section" id="handoff">
    <div class="section-heading"><div><p class="eyebrow">03 / SHIFT HANDOFF</p><h2>Leave a note<br>for the next shift.</h2></div><p>Before you leave, tell the next person what’s done and what still needs attention.</p></div>
    <div class="handoff-scene"><img class="scene-photo" src="${asset('imgSceneOriginalPhoto.png')}" alt="The prep station at a shift change" loading="lazy"><div class="handoff-shade"></div><article class="shift-schedule glass"><p class="eyebrow">SHIFT CHANGE</p><h3>Prep station</h3>${person('AK','Allyson (you)','Until 6:00 PM')}${person('JA','Jamie','From 6:00 PM')}</article><article class="handoff-note glass"><p class="eyebrow">HANDOFF TO JAMIE</p>${person('AK','Allyson (you)','5:50 PM · Prep station')}<h3 id="handoff-title">Prep is done.</h3><p id="handoff-body">Please refill the cups before service starts.</p><div class="card-actions"><button class="btn btn-gold" id="handoff-send">Send note</button><button class="btn btn-glass" id="handoff-edit">Edit note</button></div><div id="handoff-feedback" role="status"></div></article></div>
  </section>

  <section class="section availability-section" id="availability"><div class="split-section"><div class="availability-panel">${person('AK','Allyson','Front counter')}<div class="availability-options" role="group" aria-label="Allyson’s availability"><button data-availability="available" aria-pressed="true"><img src="${asset('imgIconAvailableLucide.svg')}" alt="">Available to help</button><button data-availability="busy" aria-pressed="false"><img src="${asset('imgIconBusyLucide.svg')}" alt="">Busy with a task</button><button data-availability="break" aria-pressed="false"><img src="${asset('imgIconBreakLucide.svg')}" alt="">On break</button></div><p class="small" id="availability-feedback" role="status">You’ll receive new requests.</p></div><div class="section-copy"><p class="eyebrow">04 / YOUR STATUS</p><h2>Set your<br>availability.</h2><p>Let your team know when you can help.</p><hr><p class="small-status">New requests pause while you’re busy or on break.</p></div></div></section>

  <section class="section product-section" id="product"><div class="section-heading"><div><p class="eyebrow">05 / PRODUCT</p><h2>AR glasses</h2></div><p>See who needs help and respond without taking out your phone.</p></div><div class="product-layout"><div class="product-model-column"><div class="product-viewer" id="product-viewer" data-model-open="false" aria-label="Interactive 3D TIP glasses"><img class="model-poster" id="model-poster" src="./models/tip-glasses-hero.webp" alt="TIP 01 AR glasses"><div id="glasses-canvas" class="glasses-canvas" tabindex="0" role="img" aria-label="TIP glasses 3D model. Drag to rotate. Arrow keys rotate; Home resets."><div class="model-loader" id="model-loader" hidden><span></span></div></div><div class="model-top" data-model-controls hidden><button class="round-button" id="model-expand" aria-label="Expand 3D glasses">${icon('expand')}</button></div><div class="model-bottom" data-model-controls hidden><span>${icon('rotate')} Drag to rotate</span><div class="model-presets" role="group" aria-label="Glasses viewing angle"><button data-angle="three-quarter" aria-pressed="true">3/4</button><button data-angle="front" aria-pressed="false">Front</button><button data-angle="side" aria-pressed="false">Side</button><button id="model-reset" aria-label="Reset model view">${icon('reset')}</button></div></div></div><button class="btn btn-pale" id="model-open">Explore in 3D</button></div><div class="product-details"><p class="eyebrow">COMMUNITY / 2036</p><h3>TIP 01</h3><p class="price">$249</p><p>In the box: glasses, charging case and washable cover.</p><dl><div><dt>Connection</dt><dd>Workplace Wi-Fi or paired phone</dd></div><div><dt>Battery</dt><dd>Up to 8 hours of mixed use</dd></div><div><dt>Controls</dt><dd>Voice or touch on the frame</dd></div><div><dt>Warranty</dt><dd>12-month limited warranty</dd></div></dl><p class="team-plan">Team plan · $89 per restaurant / month<br>Up to 20 team members.</p><p class="small">Concept prototype · Not for sale.</p></div></div></section>
</main>
<footer class="footer section" id="contact"><div class="footer-main"><div class="footer-brand"><img src="${asset('imgTipLogoFullImageOriginalProportions.png')}" alt="tip"><h3>Restaurant teams.<br>Helping each other.</h3></div><div class="footer-links"><p class="eyebrow">PRODUCT</p><a href="#product">TIP 01</a><a href="#demo">AR demo</a><a href="#how-it-works">How it works</a></div><div class="footer-links"><p class="eyebrow">CONTACT</p><div class="social-icons"><span aria-label="Email"><img src="${asset('imgEmailIcon.svg')}" alt="Email"></span></div></div><div class="footer-links"><p class="eyebrow">SOCIAL</p><div class="social-icons"><span aria-label="Instagram"><img src="${asset('imgInstagramIcon.svg')}" alt="Instagram"></span><span aria-label="YouTube"><img src="${asset('imgYouTubeIcon.svg')}" alt="YouTube"></span></div></div></div><div class="footer-bottom"><span>© 2036 TIP</span><span>Concept prototype · Not for sale.</span><a href="#home">Back to top ↑</a></div></footer><div id="toast" role="status" hidden></div>`;
