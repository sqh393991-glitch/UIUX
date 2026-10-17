export function initPanorama(){
 const stage=document.querySelector('#panorama'),world=document.querySelector('#pan-world');let offset=0,target='request',drag=false,startX=0,startOffset=0;
 const paint=x=>{offset=Math.max(Math.min(0,stage.clientWidth-world.clientWidth),Math.min(0,x));world.style.transform=`translate3d(${offset}px,0,0)`};
 const focus=name=>{target=name;const el=world.querySelector({team:'.pan-team',request:'.pan-request-anchor',handoff:'.pan-handoff'}[name]);paint(stage.clientWidth/2-el.offsetLeft-el.offsetWidth/2);stage.querySelectorAll('[data-pan-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panTarget===name)))};
 stage.querySelectorAll('[data-pan-target]').forEach(b=>b.onclick=()=>focus(b.dataset.panTarget));
 new ResizeObserver(()=>focus(target)).observe(stage);
 stage.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button,a,input,select,textarea,label,.pan-request'))return;drag=true;startX=e.clientX;startOffset=offset;stage.classList.add('dragging');stage.setPointerCapture(e.pointerId)});
 stage.addEventListener('pointermove',e=>{if(drag)paint(startOffset+e.clientX-startX)});
 const end=()=>{drag=false;stage.classList.remove('dragging')};stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
 stage.addEventListener('keydown',e=>{if(e.target!==stage)return;if(e.key==='Home'){e.preventDefault();focus('request')}else if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();paint(offset+(e.key==='ArrowLeft'?120:-120))}});
 document.querySelector('#pan-center').onclick=()=>focus('request');
 document.querySelector('#pan-fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen()}catch{stage.classList.toggle('expanded-scene');document.body.classList.toggle('scene-open',stage.classList.contains('expanded-scene'));document.querySelector('#pan-fullscreen').setAttribute('aria-label',stage.classList.contains('expanded-scene')?'Exit full screen':'Enter full screen');focus(target)}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('expanded-scene')){stage.classList.remove('expanded-scene');document.body.classList.remove('scene-open');focus(target)}});
 document.addEventListener('fullscreenchange',()=>{document.querySelector('#pan-fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');focus(target)});focus('request');
}
