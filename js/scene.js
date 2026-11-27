/* うみくりのゲームばこ：商品写真のような、何もない背景に置いた木のおもちゃ箱（three.js）。
   - 背景はページの色（canvas はすきとおり）。床は、かげだけをうつす。
   - 木目は ambientCG の CC0 テクスチャ（img/wood.webp）。
   - 箱の中のせいれいは、はこにわ暮らしの せいれいのモデル（models/wood.fbx）。
   - さわれる物：ふた（あけしめ）・ゲームのパッケージ（紹介）・プレゼント（ゆれる）・せいれい（はねる）。 */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

export async function startScene({canvas,games,onGame,onSay,sfx,reduce}){
  const R=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  R.setPixelRatio(Math.min(2,devicePixelRatio||1));R.setClearColor(0x000000,0);
  R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.0;
  R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();
  const pm=new THREE.PMREMGenerator(R);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.45;
  const cam=new THREE.PerspectiveCamera(28,1,.1,60);

  /* ── テクスチャ ── */
  const TL=new THREE.TextureLoader();
  const tex=u=>new Promise(res=>TL.load(u,t=>{t.colorSpace=THREE.SRGBColorSpace;res(t)},undefined,()=>res(null)));
  const [woodImg,...shots]=await Promise.all([tex('img/wood.webp'),...games.map(g=>tex(g.shots[0]))]);
  await Promise.all(['700 64px "Shippori Mincho B1"','500 64px "Shippori Mincho B1"','italic 500 64px "Cormorant Garamond"'].map(f=>document.fonts.load(f).catch(()=>{})));
  const cvTex=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
  /* 明るいオーク：木の写真の色をうすくして、板のすきまを細く */
  const plank=(rows,tint,lift)=>cvTex(1024,1024,(x,w,h)=>{if(woodImg){x.filter='saturate(.55)';x.drawImage(woodImg.image,0,0,w,h);x.filter='none'}
    x.fillStyle=tint;x.globalCompositeOperation='multiply';x.fillRect(0,0,w,h);x.globalCompositeOperation='screen';x.fillStyle=lift;x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';
    for(let i=1;i<rows;i++){const y=i*h/rows;x.fillStyle='rgba(70,45,25,.35)';x.fillRect(0,y-1,w,3)}});
  const M={
    wood:new THREE.MeshStandardMaterial({map:plank(4,'#e2bf96','rgba(255,240,220,.18)'),roughness:.78}),
    lid:new THREE.MeshStandardMaterial({map:plank(5,'#e2bf96','rgba(255,240,220,.18)'),roughness:.75}),
    inside:new THREE.MeshStandardMaterial({map:plank(4,'#b48a62','rgba(0,0,0,0)'),roughness:.9}),
    metal:new THREE.MeshStandardMaterial({color:'#b89a6a',roughness:.38,metalness:.8}),
  };
  const RB=(w,h,d,r=.03,s=3)=>new RoundedBoxGeometry(w,h,d,s,r);
  const mesh=(g,m,cast=true,recv=true)=>{const o=new THREE.Mesh(g,m);o.castShadow=cast;o.receiveShadow=recv;return o};

  /* ── 床：かげだけ ── */
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.ShadowMaterial({opacity:.16}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  /* 接地のやわらかいかげ（箱の下） */
  const ao=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.2),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:cvTex(256,256,(x,w,h)=>{const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(60,40,25,.32)');g.addColorStop(1,'rgba(60,40,25,0)');x.fillStyle=g;x.fillRect(0,0,w,h)})}));
  ao.rotation.x=-Math.PI/2;ao.position.y=.002;scene.add(ao);

  /* ── 光（スタジオ：大きなやわらかい光と、うしろからのふちの光） ── */
  scene.add(new THREE.HemisphereLight('#fffaf2','#d9cbb6',1.1));
  const key=new THREE.DirectionalLight('#fff3e2',2.1);key.position.set(-3.5,6,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:1,far:24});key.shadow.bias=-.0004;key.shadow.normalBias=.02;key.shadow.radius=8;scene.add(key);
  const rim=new THREE.DirectionalLight('#fff',.9);rim.position.set(3,4,-4);scene.add(rim);

  /* ── 箱 ── */
  const W=2.4,D=1.25,H=1.0,T=.08;
  const root=new THREE.Group();scene.add(root);const chest=new THREE.Group();root.add(chest);
  const side=(w,h,d,x,y,z,m=M.wood)=>{const o=mesh(RB(w,h,d,.02),m);o.position.set(x,y,z);chest.add(o);return o};
  side(W,H,T,0,H/2,D/2-T/2);side(W,H,T,0,H/2,-D/2+T/2);side(T,H,D-T*2,-W/2+T/2,H/2,0);side(T,H,D-T*2,W/2-T/2,H/2,0);side(W-T*2,T,D-T*2,0,T/2+.02,0,M.inside);
  const inner=(w,h,x,y,z,ry)=>{const o=mesh(new THREE.PlaneGeometry(w,h),M.inside,false,true);o.position.set(x,y,z);o.rotation.y=ry;chest.add(o)};
  inner(W-T*2,H-T,0,H/2+T/2,D/2-T-.002,Math.PI);inner(W-T*2,H-T,0,H/2+T/2,-D/2+T+.002,0);inner(D-T*2,H-T,-W/2+T+.002,H/2+T/2,0,Math.PI/2);inner(D-T*2,H-T,W/2-T-.002,H/2+T/2,0,-Math.PI/2);
  /* 金具は小さく、すみだけ */
  for(const sx of[-1,1])for(const sz of[-1,1]){const c=mesh(RB(.1,.1,.1,.012),M.metal);c.position.set(sx*(W/2-.03),H-.03,sz*(D/2-.03));chest.add(c)}
  /* 名札：真ちゅうの細いわくに、明朝の字 */
  const plateTex=cvTex(1024,300,(x,w,h)=>{x.fillStyle='#f6efe3';x.fillRect(0,0,w,h);x.strokeStyle='#8a7350';x.lineWidth=3;x.strokeRect(18,18,w-36,h-36);
    x.fillStyle='#2b2620';x.textAlign='center';x.textBaseline='middle';x.font='700 84px "Shippori Mincho B1"';x.fillText('うみくりのゲームばこ',w/2,h/2-18);
    x.fillStyle='#8a7350';x.font='italic 500 46px "Cormorant Garamond"';x.fillText('Umikuri Games — Vol. 01',w/2,h/2+62)});
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.32),new THREE.MeshStandardMaterial({map:plateTex,roughness:.9}));plate.position.set(0,H*.5,D/2+.003);chest.add(plate);

  /* ふた */
  const lidPivot=new THREE.Group();lidPivot.position.set(0,H,-D/2);chest.add(lidPivot);
  const LT=.1,lidSlab=mesh(RB(W+.04,LT,D+.04,.03),M.lid);lidSlab.position.set(0,LT/2,D/2);lidPivot.add(lidSlab);

  /* ── 中身 ── */
  const items=[];
  const addItem=(obj,pos,delay,kind,extra={})=>{obj.position.copy(pos);chest.add(obj);const it={obj,base:pos.clone(),baseRot:obj.rotation.clone(),delay,kind,pop:0,v:0,bounce:0,shake:0,hov:0,lift:.4,...extra};obj.traverse(o=>{o.userData.item=it});items.push(it);return it};

  games.forEach((g,gi)=>{
    const coverTex=cvTex(768,960,(x,w,h)=>{x.fillStyle='#f6efe3';x.fillRect(0,0,w,h);
      const im=shots[gi]&&shots[gi].image;const top=h*.26;if(im){const ih=h-top-40,iw=ih*im.width/im.height;x.save();x.beginPath();x.rect(40,top,w-80,ih);x.clip();x.drawImage(im,(w-iw)/2,top,iw,ih);x.restore()}
      x.fillStyle='#8a7350';x.font='italic 500 40px "Cormorant Garamond"';x.textAlign='left';x.fillText('No. '+String(gi+1).padStart(2,'0'),40,72);
      x.fillStyle='#2b2620';x.font='700 92px "Shippori Mincho B1"';x.fillText(g.name,40,178);
      x.fillStyle='#2b2620';x.fillRect(40,206,120,3)});
    const spineTex=cvTex(128,960,(x,w,h)=>{x.fillStyle='#c46a4a';x.fillRect(0,0,w,h);x.save();x.translate(w/2,h/2);x.rotate(Math.PI/2);x.fillStyle='#f6efe3';x.font='700 52px "Shippori Mincho B1"';x.textAlign='center';x.textBaseline='middle';x.fillText(g.name,0,0);x.restore()});
    const plain=new THREE.MeshStandardMaterial({color:'#ece3d3',roughness:.7}),spine=new THREE.MeshStandardMaterial({map:spineTex,roughness:.6}),front=new THREE.MeshStandardMaterial({map:coverTex,roughness:.75,envMapIntensity:.3});
    const pw=.82,ph=1.02,pd=.13,box=new THREE.Mesh(RB(pw,ph,pd,.008,2),[spine,spine,plain,plain,front,plain]);box.castShadow=box.receiveShadow=true;box.position.y=ph/2;
    const grp=new THREE.Group();grp.add(box);grp.rotation.set(-.06,.06,-.03);
    addItem(grp,new THREE.Vector3(.08,.5,-.14),.5+gi*.15,'game',{game:g,lift:.6});
  });

  /* プレゼント（セージ色・1つだけ） */
  {const s=.3,g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:'#9aa88a',roughness:.7}),rb=new THREE.MeshStandardMaterial({color:'#f3ead9',roughness:.5});
    const b=mesh(RB(s,s,s,.02),m);b.position.y=s/2;g.add(b);
    const r1=mesh(new THREE.BoxGeometry(s+.01,s+.01,s*.12),rb);r1.position.y=s/2;g.add(r1);const r2=mesh(new THREE.BoxGeometry(s*.12,s+.01,s+.01),rb);r2.position.y=s/2;g.add(r2);
    for(const k of[-1,1]){const bow=mesh(new THREE.TorusGeometry(s*.15,s*.04,10,24),rb);bow.position.set(k*s*.13,s+s*.1,0);bow.rotation.set(0,.2,k*.6);bow.scale.set(1,.8,.6);g.add(bow)}
    g.rotation.set(0,.45,-.08);addItem(g,new THREE.Vector3(.78,.72,.18),.8,'gift',{say:'まだ ないしょ',lift:.35})}

  /* せいれい（はこにわ暮らしのモデル） */
  try{const f=await new FBXLoader().loadAsync('models/wood.fbx');f.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(f),s=.58/bb.getSize(new THREE.Vector3()).y;f.scale.multiplyScalar(s);
    const c={hood:'#8fb07a',cheek:'#ecb8a6',eye:'#2b2620',sprout:'#6f8f5a',acc:'#e6d3bb',body:'#fbf6ec'};
    const mat=(col,r=.65)=>new THREE.MeshStandardMaterial({color:col,roughness:r});
    f.traverse(o=>{if(!o.isMesh)return;const n=o.name.toLowerCase();o.castShadow=o.receiveShadow=true;o.frustumCulled=false;
      o.material=n.startsWith('eye')?mat(c.eye,.25):n.startsWith('cheek')?mat(c.cheek,.8):(n.startsWith('hood')||n.startsWith('hane'))?mat(c.hood,.7):n.startsWith('sprout')?mat(c.sprout):n.startsWith('headacc')?mat(c.acc):mat(c.body,.8)});
    const b2=new THREE.Box3().setFromObject(f);f.position.y-=b2.min.y;f.position.x-=(b2.min.x+b2.max.x)/2;f.position.z-=(b2.min.z+b2.max.z)/2;
    const sg=new THREE.Group();sg.add(f);sg.rotation.y=.45;addItem(sg,new THREE.Vector3(-.62,.66,-.05),1.0,'spirit',{lift:.35});
  }catch(e){console.warn('せいれいのモデルを読めなかった',e)}

  /* ── カメラ：ななめ上から、商品写真のように ── */
  const look=new THREE.Vector3(.15,.7,0),camBase=new THREE.Vector3();
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;R.setSize(w,h,false);cam.aspect=w/h;
    const hf=Math.tan(THREE.MathUtils.degToRad(cam.fov/2)),need=Math.max(4.3/(2*hf*cam.aspect),3.1/(2*hf));
    camBase.set(need*.42,need*.42,need*.8);cam.updateProjectionMatrix()}
  resize();new ResizeObserver(resize).observe(canvas);

  /* ── さわる ── */
  const ray=new THREE.Raycaster(),ptr=new THREE.Vector2(),par={x:0,y:0};let hover=null,down=null;
  const pick=e=>{const r=canvas.getBoundingClientRect();ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ptr,cam);
    const hits=ray.intersectObjects([...items.map(i=>i.obj),lidPivot],true);for(const h of hits){let o=h.object;while(o&&!o.userData.item&&o!==lidPivot)o=o.parent;if(o===lidPivot)return{lid:true};if(o&&o.userData.item&&o.userData.item.pop>.5)return o.userData.item}return null};
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();par.x=(e.clientX-r.left)/r.width-.5;par.y=(e.clientY-r.top)/r.height-.5;if(e.pointerType==='mouse'){hover=pick(e);canvas.style.cursor=hover?'pointer':''}});
  canvas.addEventListener('pointerleave',()=>{hover=null;par.x=par.y=0});
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
  canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)return;down=null;const h=pick(e);if(!h)return;
    if(h.lid){toggle();return}
    if(h.kind==='game'){sfx('pop');h.bounce=1;onGame(h.game)}
    else if(h.kind==='gift'){h.shake=1;sfx('shake');const p=h.obj.getWorldPosition(new THREE.Vector3());p.y+=.5;p.project(cam);const r=canvas.getBoundingClientRect();onSay(h.say,r.left+(p.x+1)/2*r.width,r.top+(1-p.y)/2*r.height)}
    else{h.bounce=1;sfx('boing')}});

  /* ── あけしめ・動き ── */
  let open=false,lidA=0,lidV=0,openT=-1;const OPEN=-1.85;
  const clock=new THREE.Clock();
  function toggle(){open=!open;if(open){openT=clock.elapsedTime;sfx('open')}else sfx('close')}
  const camNow=new THREE.Vector3();
  function frame(){const dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;
    const tgt=open?OPEN:0;if(reduce)lidA=tgt;else{lidV+=((tgt-lidA)*60-lidV*12)*dt;lidA+=lidV*dt}lidPivot.rotation.x=lidA;
    for(const it of items){const goal=open&&openT>=0&&t-openT>it.delay?1:0;
      if(reduce)it.pop=goal;else{it.v+=((goal-it.pop)*90-it.v*14)*dt;it.pop+=it.v*dt}
      it.hov+=((hover===it?1:0)-it.hov)*Math.min(1,dt*10);it.bounce=Math.max(0,it.bounce-dt*1.6);it.shake=Math.max(0,it.shake-dt*1.8);
      const bo=it.bounce>0?Math.max(0,Math.sin((1-it.bounce)*Math.PI*2.5))*.2*it.bounce:0;
      it.obj.position.set(it.base.x,it.base.y-(1-it.pop)*(it.lift+.8)+it.hov*.08+bo,it.base.z);
      it.obj.rotation.set(it.baseRot.x,it.baseRot.y+(it.kind==='spirit'&&!reduce?Math.sin(t*.7)*.2:0),it.baseRot.z+Math.sin(it.shake*30)*.2*it.shake);
      it.obj.visible=it.pop>.02}
    /* ゆっくり、すこしだけまわる */
    root.rotation.y=reduce?0:Math.sin(t*.25)*.06;
    camNow.set(camBase.x+par.x*.5,camBase.y-par.y*.25,camBase.z);cam.position.lerp(camNow,reduce?1:Math.min(1,dt*2.5));cam.lookAt(look);
    R.render(scene,cam);requestAnimationFrame(frame)}
  frame();
  setTimeout(()=>{if(!open)toggle()},reduce?0:1200);
  return {toggle};
}
