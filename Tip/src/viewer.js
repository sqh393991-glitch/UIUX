import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
  if(poster)poster.hidden=true;
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
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{host.innerHTML='<img class="model-fallback" src="./models/tip-glasses-hero.webp" alt="TIP 01 graphite AR glasses"><p class="model-top">3D is unavailable. Product view shown.</p>';return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.prepend(renderer.domElement);
 const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,host.clientWidth/host.clientHeight,.001,10);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=.15;controls.maxPolarAngle=Math.PI-.15;controls.autoRotate=false;
 const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();
 scene.add(new THREE.HemisphereLight(0xe9f0ff,0xc8b498,2));const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-.3,.5,.4);scene.add(key);const rim=new THREE.DirectionalLight(0xa2bce5,3);rim.position.set(.3,.1,-.2);scene.add(rim);
 // A soft contact shadow grounds the geometry without an opaque backdrop.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;const ctx=shadowCanvas.getContext('2d');const g=ctx.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(25,32,40,.2)');g.addColorStop(1,'rgba(25,32,40,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.24,.22),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 let center=new THREE.Vector3(),radius=.12,boundRadius=.1,targetPos=null,ready=false,visible=true;
 const defaultVector=new THREE.Vector3(.70,.48,1);
 function setAngle(name,immediate=false){const directions={'three-quarter':defaultVector,front:new THREE.Vector3(0,.06,1),side:new THREE.Vector3(1,.20,.08)};const v=(directions[name]||defaultVector).clone().normalize().multiplyScalar(radius);targetPos=center.clone().add(v);if(immediate){camera.position.copy(targetPos);targetPos=null;}controls.target.copy(center);document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angle===name)));}
 try{const gltf=await new GLTFLoader().loadAsync('./models/tip-01.glb');const model=gltf.scene;scene.add(model);const box=new THREE.Box3().setFromObject(model);box.getCenter(center);const size=box.getSize(new THREE.Vector3());boundRadius=box.getBoundingSphere(new THREE.Sphere()).radius;radius=boundRadius/Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(35/2))*Math.min(camera.aspect,1)))*1.10;shadow.position.set(center.x,box.min.y-.008,center.z);model.traverse(n=>{if(n.isMesh&&n.material){n.material.envMapIntensity=1.6;}});setAngle('three-quarter',true);controls.update();ready=true;loader.hidden=true;host.dataset.ready='true';}catch(err){loader.innerHTML='The model could not load. <button id="retry-model" class="text-button">Try again</button>';document.querySelector('#retry-model').onclick=()=>location.reload();console.error('TIP model load failed',err);}
 document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>setAngle(b.dataset.angle));document.querySelector('#model-reset').onclick=()=>setAngle('three-quarter');
 controls.addEventListener('start',()=>{targetPos=null;document.querySelectorAll('[data-angle]').forEach(b=>b.setAttribute('aria-pressed','false'))});
 host.addEventListener('keydown',e=>{if(e.target!==host)return;if(e.key==='Home'){e.preventDefault();setAngle('three-quarter');return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();targetPos=null;const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(center));s.theta+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0),.15,Math.PI-.15);camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(center));});
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);if(ready){radius=boundRadius/Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(35/2))*Math.min(camera.aspect,1)))*1.10;setAngle('three-quarter');}}
 new ResizeObserver(resize).observe(host);new IntersectionObserver(es=>visible=es[0].isIntersecting,{rootMargin:'100px'}).observe(host);
 document.querySelector('#model-expand').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen()}catch{stage.classList.toggle('expanded-model');document.querySelector('#model-expand').setAttribute('aria-label',stage.classList.contains('expanded-model')?'Close 3D glasses':'Expand 3D glasses');resize()}};
 document.addEventListener('fullscreenchange',()=>{document.querySelector('#model-expand').setAttribute('aria-label',document.fullscreenElement?'Close 3D glasses':'Expand 3D glasses');resize()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&stage.classList.contains('expanded-model')){stage.classList.remove('expanded-model');document.querySelector('#model-expand').setAttribute('aria-label','Expand 3D glasses');resize()}});
 renderer.setAnimationLoop(()=>{if(!visible||document.hidden)return;if(targetPos){camera.position.lerp(targetPos,matchMedia('(prefers-reduced-motion: reduce)').matches?1:.09);if(camera.position.distanceTo(targetPos)<.0001)targetPos=null;}controls.update();renderer.render(scene,camera)});
}
