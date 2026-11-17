import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initViewer(){
 const open=document.querySelector('#model-open');
 const stage=document.querySelector('#product-viewer');
 let started=false;
 const start=()=>{
  if(started)return;
  started=true;
  stage.classList.add('is-open');
  stage.dataset.modelOpen='true';
  if(open)open.hidden=true;
  const poster=document.querySelector('#model-poster');
  if(poster)poster.hidden=false;
  stage.querySelectorAll('[data-model-controls]').forEach(el=>el.hidden=false);
  const loader=document.querySelector('#model-loader');
  if(loader)loader.hidden=false;
  createViewer();
 };
 if(open)open.addEventListener('click',start);
 else start();
}

async function createViewer(){
 const host=document.querySelector('#glasses-canvas'),stage=document.querySelector('#product-viewer'),loader=document.querySelector('#model-loader');
 const poster=document.querySelector('#model-poster');
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{if(poster)poster.hidden=true;host.innerHTML='<img class="model-fallback" src="./models/tip-glasses-hero.webp?v=20261117b" alt="TIP 01 matte black AR glasses"><p class="model-top">3D is unavailable. Product view shown.</p>';return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
 renderer.setSize(host.clientWidth, host.clientHeight);
 renderer.outputColorSpace = THREE.SRGBColorSpace;
 renderer.toneMapping = THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure = 1;
 host.prepend(renderer.domElement);
 renderer.domElement.style.opacity = '0';

 const scene = new THREE.Scene();
 scene.background = new THREE.Color(getComputedStyle(stage).getPropertyValue('--paper').trim());
 const camera = new THREE.OrthographicCamera(-.12, .12, .08, -.08, .001, 10);
 const controls = new OrbitControls(camera, renderer.domElement);
 controls.enableDamping = true;
 controls.dampingFactor = .08;
 controls.enablePan = false;
 controls.enableZoom = false;
 controls.minPolarAngle = .15;
 controls.maxPolarAngle = Math.PI - .15;

 // Broad studio reflections describe the brow and the clear lens edge during rotation.
 const studio = new THREE.Scene();
 studio.background = new THREE.Color(.28, .28, .28);
 const panelGeometry = new THREE.PlaneGeometry(1, 1);
 function softbox(position, width, height, radiance) {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(...radiance), toneMapped: false });
  const panel = new THREE.Mesh(panelGeometry, material);
  panel.position.set(...position);
  panel.scale.set(width, height, 1);
  panel.lookAt(0, 0, 0);
  studio.add(panel);
 }
 softbox([2.4, 2.7, 1.7], 3.8, 1.1, [5.2, 5.5, 6]);
 softbox([-2.7, .8, 1.5], 1.6, 3.4, [3.6, 3.4, 3.2]);
 softbox([.2, 1.4, -2.4], 3.6, .55, [5, 5.2, 5.4]);
 const pmrem = new THREE.PMREMGenerator(renderer);
 scene.environment = pmrem.fromScene(studio, .035).texture;
 pmrem.dispose();
 studio.children.forEach(panel => panel.material.dispose());
 panelGeometry.dispose();

 const key = new THREE.DirectionalLight(0xfffaf2, 1.2);
 key.position.set(-.3, .5, .4);
 scene.add(key);
 // A soft contact shadow grounds the geometry without an opaque backdrop.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d');const g=ctx.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(25,32,40,.2)');g.addColorStop(1,'rgba(25,32,40,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.24,.22),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 const center = new THREE.Vector3();
 const samplePoints = [];
 const lastDirection = new THREE.Vector3();
 const direction = new THREE.Vector3();
 const screenRight = new THREE.Vector3();
 const screenUp = new THREE.Vector3();
 const angles = {
  'three-quarter': new THREE.Vector3(.63, .44, 1),
  front: new THREE.Vector3(0, .02, 1),
  side: new THREE.Vector3(1, .12, .015)
 };
 const orbitDistance = .45;
 let targetOrbit = null;
 let ready = false;
 let visible = true;

 function fitSilhouette(force = false) {
  if (!ready) return;
  direction.copy(camera.position).sub(center).normalize();
  if (!force && direction.distanceToSquared(lastDirection) < 1e-9) return;
  lastDirection.copy(direction);
  camera.updateMatrixWorld();
  screenRight.setFromMatrixColumn(camera.matrixWorld, 0);
  screenUp.setFromMatrixColumn(camera.matrixWorld, 1);
  let left = Infinity, right = -Infinity, top = -Infinity, bottom = Infinity;
  for (const point of samplePoints) {
   const x = point.dot(screenRight), y = point.dot(screenUp);
   left = Math.min(left, x);
   right = Math.max(right, x);
   top = Math.max(top, y);
   bottom = Math.min(bottom, y);
  }
  const aspect = host.clientWidth / host.clientHeight;
  // Reserve space for the existing controls at the edges of the product stage.
  const height = Math.max((top - bottom) / .72, (right - left) / (.87 * aspect));
  const x = (left + right) / 2, y = (top + bottom) / 2;
  camera.left = x - height * aspect / 2;
  camera.right = x + height * aspect / 2;
  camera.top = y + height / 2;
  camera.bottom = y - height / 2;
  camera.updateProjectionMatrix();
 }

 function setAngle(name, immediate = false) {
  const vector = angles[name] || angles['three-quarter'];
  targetOrbit = new THREE.Spherical().setFromVector3(vector);
  controls.target.copy(center);
  if (immediate) {
   camera.position.copy(vector).normalize().multiplyScalar(orbitDistance).add(center);
   targetOrbit = null;
  }
  document.querySelectorAll('[data-angle]').forEach(button => {
   button.setAttribute('aria-pressed', String(button.dataset.angle === name));
  });
 }

 try {
  const gltf = await new GLTFLoader().loadAsync('./models/tip-01.glb?v=20261117b');
  const model = gltf.scene;
  scene.add(model);
  const box = new THREE.Box3().setFromObject(model, true);
  box.getCenter(center);
  model.updateMatrixWorld(true);
  model.traverse(node => {
   if (!node.isMesh) return;
   node.geometry.computeBoundingBox();
   const { min, max } = node.geometry.boundingBox;
   for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
     for (const z of [min.z, max.z]) {
      samplePoints.push(new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld).sub(center));
     }
    }
   }
  });
  shadow.position.set(center.x, box.min.y - .003, center.z);
  setAngle('three-quarter', true);
  controls.update();
  ready = true;
  fitSilhouette(true);
  loader.hidden = true;
  host.dataset.ready = 'true';
  renderer.domElement.style.opacity='1';
  if(!reducedMotion.matches){
   renderer.domElement.animate([{opacity:0},{opacity:1}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});
   if(poster){const fade=poster.animate([{opacity:1},{opacity:0}],{duration:380,easing:'ease-out'});fade.finished.then(()=>poster.hidden=true).catch(()=>poster.hidden=true);}
  }else if(poster)poster.hidden=true;
 }catch(err){loader.innerHTML='The model could not load. <button id="retry-model" class="text-button">Try again</button>';document.querySelector('#retry-model').onclick=()=>location.reload();console.error('TIP model load failed',err);}
 document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>setAngle(b.dataset.angle));document.querySelector('#model-reset').onclick=()=>setAngle('three-quarter');
 controls.addEventListener('start',()=>{targetOrbit=null;document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed','false'))});
 host.addEventListener('keydown',e=>{if(e.target!==host)return;if(e.key==='Home'){e.preventDefault();setAngle('three-quarter');return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();targetOrbit=null;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(center));s.theta+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0),.15,Math.PI-.15);camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(center));});
 function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  fitSilhouette(true);
 }
 new ResizeObserver(resize).observe(host);new IntersectionObserver(es=>visible=es[0].isIntersecting,{rootMargin:'100px'}).observe(host);
 document.querySelector('#model-expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen()}catch{stage.classList.toggle('expanded-model');document.querySelector('#model-expand').setAttribute('aria-label',stage.classList.contains('expanded-model')?'Close 3D glasses':'Expand 3D glasses');resize()}};
 document.addEventListener('fullscreenchange',()=>{document.querySelector('#model-expand').setAttribute('aria-label',document.fullscreenElement?'Close 3D glasses':'Expand 3D glasses');resize()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('expanded-model')){stage.classList.remove('expanded-model');document.querySelector('#model-expand').setAttribute('aria-label','Expand 3D glasses');resize()}});
 const orbit = new THREE.Spherical();
 renderer.setAnimationLoop(() => {
  if (!ready || !visible || document.hidden) return;
  if (targetOrbit) {
   orbit.setFromVector3(direction.copy(camera.position).sub(center));
   const angle = targetOrbit.theta - orbit.theta;
   const thetaStep = Math.atan2(Math.sin(angle), Math.cos(angle));
   const phiStep = targetOrbit.phi - orbit.phi;
   const blend = reducedMotion.matches ? 1 : .10;
   orbit.theta += thetaStep * blend;
   orbit.phi += phiStep * blend;
   camera.position.setFromSpherical(orbit).add(center);
   if (Math.abs(thetaStep) + Math.abs(phiStep) < .0002 || blend === 1) targetOrbit = null;
  }
  controls.update();
  fitSilhouette();
  renderer.render(scene, camera);
 });
}
