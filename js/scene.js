/* うみくりのゲームばこ：日だまりの部屋の、3Dのおもちゃ箱（three.js）。
   - 木目・紙は ambientCG の CC0 テクスチャ（img/wood.webp・img/paper.webp）。
   - 箱の中のせいれいは、はこにわ暮らしの せいれいのモデル（models/wood.fbx）。
   - さわれる物：ふた（あけしめ）・ゲームのパッケージ（紹介）・プレゼント（ゆれる）・おもちゃとせいれい（はねる）。 */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

export async function startScene({canvas,games,onGame,onSay,sfx,reduce}){
  const R=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  R.setPixelRatio(Math.min(2,devicePixelRatio||1));
  R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=.98;
  R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ead3a8');scene.fog=new THREE.Fog('#ead3a8',9,20);
  const pm=new THREE.PMREMGenerator(R);scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture;scene.environmentIntensity=.35;
  const cam=new THREE.PerspectiveCamera(34,1,.1,60);

  /* ── テクスチャ ── */
  const TL=new THREE.TextureLoader();
  const tex=(u,rep=1)=>new Promise(res=>TL.load(u,t=>{t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rep,rep);t.anisotropy=8;res(t)},undefined,()=>res(null)));
  const [woodImg,paperImg,...shots]=await Promise.all([tex('img/wood.webp'),tex('img/paper.webp'),...games.map(g=>tex(g.shots[0]))]);
  await Promise.all(['900 64px "Zen Maru Gothic"','700 64px "Zen Maru Gothic"','600 64px "Klee One"'].map(f=>document.fonts.load(f).catch(()=>{})));
  const cvTex=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t};
  /* 板の木目：木の写真に、板のすきまの線を足す */
  const plank=(rows,tint)=>cvTex(1024,1024,(x,w,h)=>{if(woodImg)x.drawImage(woodImg.image,0,0,w,h);x.fillStyle=tint;x.globalCompositeOperation='multiply';x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';
    for(let i=1;i<rows;i++){const y=i*h/rows;x.fillStyle='rgba(50,25,8,.55)';x.fillRect(0,y-3,w,5);x.fillStyle='rgba(255,225,180,.18)';x.fillRect(0,y+2,w,3)}});
  const woodFront=plank(4,'#c98d55'),woodLid=plank(5,'#c98d55'),woodIn=plank(4,'#8a6040');
  const floorTex=cvTex(1024,1024,(x,w,h)=>{if(woodImg)x.drawImage(woodImg.image,0,0,w,h);x.fillStyle='#d9a066';x.globalCompositeOperation='multiply';x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';
    for(let i=0;i<6;i++){const y=i*h/6;x.fillStyle='rgba(60,30,10,.5)';x.fillRect(0,y,w,4);const s=(i*397)%w;x.fillRect(s,y,4,h/6)}});
  floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(3,3);
  const wallTex=cvTex(1024,1024,(x,w,h)=>{x.fillStyle='#f6e6c6';x.fillRect(0,0,w,h);if(paperImg){x.globalCompositeOperation='multiply';x.globalAlpha=.6;x.drawImage(paperImg.image,0,0,w,h);x.globalAlpha=1;x.globalCompositeOperation='source-over'}
    /* 小花もようのかべ紙 */
    for(let j=0;j<8;j++)for(let i=0;i<8;i++){const cx=(i+(j%2)*.5)*w/8+20,cy=j*h/8+20;x.fillStyle='rgba(214,150,110,.28)';for(let k=0;k<5;k++){const a=k*Math.PI*2/5;x.beginPath();x.arc(cx+Math.cos(a)*7,cy+Math.sin(a)*7,5,0,7);x.fill()}x.fillStyle='rgba(239,195,90,.5)';x.beginPath();x.arc(cx,cy,4,0,7);x.fill()}
    for(let i=0;i<16;i++){x.fillStyle='rgba(205,160,110,.10)';x.fillRect(i*w/16,0,2,h)}});
  wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping;wallTex.repeat.set(3,1.6);

  const M={
    wood:new THREE.MeshStandardMaterial({map:woodFront,roughness:.72,metalness:0}),
    lid:new THREE.MeshStandardMaterial({map:woodLid,roughness:.7}),
    inside:new THREE.MeshStandardMaterial({map:woodIn,roughness:.9}),
    brass:new THREE.MeshStandardMaterial({color:'#d8a548',roughness:.32,metalness:.85}),
    floor:new THREE.MeshStandardMaterial({map:floorTex,roughness:.6}),
    wall:new THREE.MeshStandardMaterial({map:wallTex,roughness:.95}),
    trim:new THREE.MeshStandardMaterial({color:'#b27a45',roughness:.6}),
    cream:new THREE.MeshStandardMaterial({color:'#fff5e2',roughness:.8}),
  };
  const RB=(w,h,d,r=.03,s=3)=>new RoundedBoxGeometry(w,h,d,s,r);
  const mesh=(g,m,cast=true,recv=true)=>{const o=new THREE.Mesh(g,m);o.castShadow=cast;o.receiveShadow=recv;return o};

  /* ── 部屋 ── */
  const floor=mesh(new THREE.PlaneGeometry(26,16),M.floor,false,true);floor.rotation.x=-Math.PI/2;floor.position.z=3;scene.add(floor);
  const wall=mesh(new THREE.PlaneGeometry(26,9),M.wall,false,true);wall.position.set(0,4.5,-2.6);scene.add(wall);
  const base=mesh(new THREE.BoxGeometry(26,.32,.08),M.trim,false,true);base.position.set(0,.16,-2.56);scene.add(base);
  /* まど（そとの空は光る絵） */
  const win=new THREE.Group();win.position.set(-3.4,2.9,-2.58);scene.add(win);
  const skyTex=cvTex(256,512,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#9fd4f0');g.addColorStop(.6,'#dff1f4');g.addColorStop(1,'#fbe9c4');x.fillStyle=g;x.fillRect(0,0,w,h);
    x.fillStyle='rgba(255,255,255,.95)';[[60,120,40],[100,110,30],[180,200,34],[210,190,24]].forEach(([a,b,r])=>{x.beginPath();x.arc(a,b,r,0,7);x.fill()});
    x.fillStyle='#9fc47e';x.beginPath();x.ellipse(70,470,120,60,0,0,7);x.fill();x.fillStyle='#86b46a';x.beginPath();x.ellipse(220,490,110,50,0,0,7);x.fill()});
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(1.3,2),new THREE.MeshBasicMaterial({map:skyTex,toneMapped:false}));glass.position.z=.01;win.add(glass);
  const fr=(w,h,x,y)=>{const o=mesh(RB(w,h,.14,.03),M.trim,true,true);o.position.set(x,y,.06);win.add(o)};
  fr(1.5,.12,0,1.06);fr(1.5,.14,0,-1.06);fr(.12,2.2,-.7,0);fr(.12,2.2,.7,0);fr(1.3,.06,0,.1);fr(.06,2,0,0);
  const sill=mesh(RB(1.8,.08,.32,.02),M.trim);sill.position.set(0,-1.14,.14);win.add(sill);
  /* 光の帯（まどから床へ） */
  const beamMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{t:{value:0}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v;uniform float t;void main(){float a=smoothstep(0.,.25,v.x)*smoothstep(1.,.7,v.x)*(.35+.65*v.y)*(.9+.1*sin(t*.7));gl_FragColor=vec4(1.,.86,.6,a*.16);}'});
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(1.4,6.5),beamMat);beam.position.set(-2.2,1.9,-1.1);beam.rotation.set(-.35,.35,.62);scene.add(beam);
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.4),new THREE.MeshBasicMaterial({map:cvTex(256,256,(x,w,h)=>{const g=x.createRadialGradient(w/2,h/2,10,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,220,160,.55)');g.addColorStop(1,'rgba(255,220,160,0)');x.fillStyle=g;x.fillRect(0,0,w,h)}),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  pool.rotation.x=-Math.PI/2;pool.position.set(-1.2,.01,.6);scene.add(pool);
  /* ガーランド */
  const gar=new THREE.Group();scene.add(gar);const GC=['#d9604f','#efc35a','#5f9fcf','#78b267','#ec9ab3'];
  const flagGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.16,0,0),new THREE.Vector3(.16,0,0),new THREE.Vector3(0,-.34,0)]);flagGeo.computeVertexNormals();
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.4,4.3,-2.5),new THREE.Vector3(1.4,3.3,-2.2),new THREE.Vector3(4.6,4.3,-2.5));
  gar.add(new THREE.Mesh(new THREE.TubeGeometry(curve,40,.012,6),new THREE.MeshStandardMaterial({color:'#8a5a30'})));
  const flags=[];for(let i=1;i<12;i++){const p=curve.getPoint(i/12),f=new THREE.Mesh(flagGeo,new THREE.MeshStandardMaterial({color:GC[i%5],side:THREE.DoubleSide,roughness:.9}));f.position.copy(p);f.castShadow=true;gar.add(f);flags.push(f)}

  /* ── 光 ── */
  scene.add(new THREE.HemisphereLight('#fff1d6','#8a5a30',.9));
  const sun=new THREE.DirectionalLight('#ffe2b0',2.4);sun.position.set(-4.5,6.5,3.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-3,near:1,far:20});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;sun.shadow.radius=4;scene.add(sun);
  const fill=new THREE.DirectionalLight('#cfe0ff',.35);fill.position.set(4,3,5);scene.add(fill);
  const glow=new THREE.PointLight('#ffcf8a',.7,3.5,1.6);glow.position.set(0,1.3,.1);scene.add(glow);

  /* ── 箱 ── */
  const W=2.6,D=1.3,H=1.05,T=.09;
  const chest=new THREE.Group();scene.add(chest);
  const side=(w,h,d,x,y,z,m=M.wood)=>{const o=mesh(RB(w,h,d,.025),m);o.position.set(x,y,z);chest.add(o);return o};
  side(W,H,T,0,H/2,D/2-T/2);side(W,H,T,0,H/2,-D/2+T/2);side(T,H,D-T*2,-W/2+T/2,H/2,0);side(T,H,D-T*2,W/2-T/2,H/2,0);side(W-T*2,T,D-T*2,0,T/2+.02,0,M.inside);
  /* 内がわ（少し暗い板）をはる */
  const inner=(w,h,x,y,z,ry)=>{const o=mesh(new THREE.PlaneGeometry(w,h),M.inside,false,true);o.position.set(x,y,z);o.rotation.y=ry;chest.add(o)};
  inner(W-T*2,H-T,0,H/2+T/2,D/2-T-.002,Math.PI);inner(W-T*2,H-T,0,H/2+T/2,-D/2+T+.002,0);inner(D-T*2,H-T,-W/2+T+.002,H/2+T/2,0,Math.PI/2);inner(D-T*2,H-T,W/2-T-.002,H/2+T/2,0,-Math.PI/2);
  /* ふちの金具・角の金具 */
  const brassBox=(w,h,d,x,y,z)=>{const o=mesh(RB(w,h,d,.015),M.brass);o.position.set(x,y,z);chest.add(o)};
  for(const sx of[-1,1])for(const sz of[-1,1]){brassBox(.2,.2,.2,sx*(W/2-.08),.1,sz*(D/2-.08));brassBox(.2,.2,.2,sx*(W/2-.08),H-.08,sz*(D/2-.08))}
  brassBox(W+.02,.06,.04,0,H*.5,D/2+.005);
  /* 名札 */
  const plateTex=cvTex(1024,256,(x,w,h)=>{x.fillStyle='#fbf0d8';x.fillRect(0,0,w,h);if(paperImg){x.globalCompositeOperation='multiply';x.globalAlpha=.5;x.drawImage(paperImg.image,0,0,w,w);x.globalAlpha=1;x.globalCompositeOperation='source-over'}
    x.fillStyle='#6a4322';x.font='900 92px "Zen Maru Gothic"';x.textAlign='center';x.textBaseline='middle';x.fillText('うみくりのゲームばこ',w/2,h/2+6);
    x.fillStyle='#9a6c1c';[[30,h/2],[w-30,h/2]].forEach(([a,b])=>{x.beginPath();x.arc(a,b,12,0,7);x.fill()})});
  const plateBack=mesh(RB(1.5,.42,.04,.03),M.brass);plateBack.position.set(0,H*.52,D/2+.02);chest.add(plateBack);
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(1.42,.355),new THREE.MeshStandardMaterial({map:plateTex,roughness:.85}));plate.position.set(0,H*.52,D/2+.043);chest.add(plate);

  /* ふた（うしろのふちが ちょうつがい） */
  const lidPivot=new THREE.Group();lidPivot.position.set(0,H,-D/2);chest.add(lidPivot);
  const LT=.13,lid=new THREE.Group();lidPivot.add(lid);
  const lidSlab=mesh(RB(W+.08,LT,D+.06,.04),[M.lid,M.lid,M.lid,M.lid,M.lid,M.lid].length?M.lid:M.lid);lidSlab.position.set(0,LT/2,D/2);lid.add(lidSlab);
  for(const x of[-.85,.85]){const b=mesh(RB(.16,LT+.02,D+.08,.02),M.brass);b.position.set(x,LT/2,D/2);lid.add(b)}
  const lidSay=cvTex(1024,256,(x,w,h)=>{x.font='600 120px "Klee One"';x.textAlign='center';x.textBaseline='middle';x.fillStyle='rgba(255,241,210,.95)';x.shadowColor='rgba(60,30,10,.7)';x.shadowOffsetY=4;x.fillText('あけてみて',w/2,h/2)});
  const say=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.3),new THREE.MeshBasicMaterial({map:lidSay,transparent:true,depthWrite:false}));say.rotation.x=-Math.PI/2;say.position.set(0,LT+.004,D/2+.05);lid.add(say);
  /* ふたのうら：はり紙とシール */
  const noteTex=cvTex(512,320,(x,w,h)=>{x.fillStyle='#fff6e2';x.fillRect(0,0,w,h);if(paperImg){x.globalCompositeOperation='multiply';x.drawImage(paperImg.image,0,0,w,w);x.globalCompositeOperation='source-over'}
    x.fillStyle='rgba(236,154,179,.75)';x.fillRect(w/2-70,0,140,36);x.fillStyle='#6a4322';x.font='600 64px "Klee One"';x.textAlign='center';x.fillText('たいせつな',w/2,140);x.fillText('ゲームたち',w/2,230)});
  const note=new THREE.Mesh(new THREE.PlaneGeometry(.62,.39),new THREE.MeshStandardMaterial({map:noteTex,roughness:.95}));note.position.set(-1.12,-.003,.36);note.rotation.set(Math.PI/2,0,.12);note.scale.setScalar(.62);lid.add(note);
  const starShape=new THREE.Shape();for(let i=0;i<10;i++){const r=i%2?.045:.11,a=i*Math.PI/5-Math.PI/2;starShape[i?'lineTo':'moveTo'](Math.cos(a)*r,Math.sin(a)*r)}
  [[1.12,.3,'#efc35a',1],[1.05,.62,'#ec9ab3',.7],[-1.12,.72,'#5f9fcf',.6]].forEach(([x,z,c,s])=>{const st=new THREE.Mesh(new THREE.ShapeGeometry(starShape),new THREE.MeshStandardMaterial({color:c,roughness:.6}));st.scale.setScalar(s);st.position.set(x,-.003,z);st.rotation.x=Math.PI/2;lid.add(st)});

  /* ── 中身 ── */
  const items=[];/* {obj,base:Vector3,delay,kind,...} */
  const addItem=(obj,pos,delay,kind,extra={})=>{obj.position.copy(pos);obj.userData.kind=kind;chest.add(obj);const it={obj,base:pos.clone(),baseRot:obj.rotation.clone(),delay,kind,pop:0,v:0,bounce:0,shake:0,...extra};obj.traverse(o=>{o.userData.item=it});items.push(it);return it};

  /* ゲームのパッケージ */
  games.forEach((g,gi)=>{
    const coverTex=cvTex(768,960,(x,w,h)=>{x.fillStyle='#fbf1dc';x.fillRect(0,0,w,h);
      /* 上：名前の帯。下：ゲームの絵（箱のふちにかくれても、名前が見えるように） */
      const im=shots[gi]&&shots[gi].image;if(im){const top=h*.25,ih=h-top,iw=ih*im.width/im.height;x.filter='saturate(1.35) contrast(1.12)';x.drawImage(im,(w-iw)/2,top,iw,ih);x.filter='none'}
      const band=x.createLinearGradient(0,0,0,h*.3);band.addColorStop(0,'#fbf1dc');band.addColorStop(.8,'#fbf1dc');band.addColorStop(1,'rgba(251,241,220,0)');x.fillStyle=band;x.fillRect(0,0,w,h*.3);
      x.fillStyle='#5a3a1e';x.font='900 100px "Zen Maru Gothic"';x.textAlign='center';x.textBaseline='alphabetic';x.fillText(g.name,w/2,h*.135);
      x.fillStyle='#8a6a4c';x.font='600 40px "Klee One"';x.fillText(g.catch||'',w/2,h*.205);
      x.save();x.translate(w-120,h*.32);x.rotate(.16);x.fillStyle='#d9604f';x.beginPath();x.roundRect(-96,-36,192,72,36);x.fill();x.fillStyle='#fff';x.font='900 40px "Zen Maru Gothic"';x.textBaseline='middle';x.fillText('あそべる',0,2);x.restore();
      x.strokeStyle='rgba(120,80,40,.25)';x.lineWidth=10;x.strokeRect(5,5,w-10,h-10)});
    const spineTex=cvTex(128,960,(x,w,h)=>{const gr=x.createLinearGradient(0,0,w,0);gr.addColorStop(0,'#c0503b');gr.addColorStop(1,'#e0715a');x.fillStyle=gr;x.fillRect(0,0,w,h);
      x.save();x.translate(w/2,h/2);x.rotate(Math.PI/2);x.fillStyle='#fff';x.font='900 56px "Zen Maru Gothic"';x.textAlign='center';x.textBaseline='middle';x.fillText(g.name,0,0);x.restore()});
    const plain=new THREE.MeshStandardMaterial({color:'#efe0c2',roughness:.6}),spine=new THREE.MeshStandardMaterial({map:spineTex,roughness:.5});
    const front=new THREE.MeshStandardMaterial({map:coverTex,roughness:.7,metalness:0,envMapIntensity:.4});
    const pw=.9,ph=1.12,pd=.15,box=new THREE.Mesh(RB(pw,ph,pd,.012,2),[spine,spine,plain,plain,front,plain]);box.castShadow=box.receiveShadow=true;
    const grp=new THREE.Group();grp.add(box);box.position.y=ph/2;grp.rotation.set(-.08,-.12,-.05);
    addItem(grp,new THREE.Vector3(.05,.56,-.12),.35+gi*.15,'game',{game:g,lift:.62});
  });

  /* プレゼント */
  const gift=(c,s)=>{const g=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:c,roughness:.55}),rb=new THREE.MeshStandardMaterial({color:'#fff4df',roughness:.4});
    const b=mesh(RB(s,s,s,.03),m);b.position.y=s/2;g.add(b);
    const r1=mesh(new THREE.BoxGeometry(s+.012,s+.012,s*.16),rb);r1.position.y=s/2;g.add(r1);const r2=mesh(new THREE.BoxGeometry(s*.16,s+.012,s+.012),rb);r2.position.y=s/2;g.add(r2);
    for(const k of[-1,1]){const bow=mesh(new THREE.TorusGeometry(s*.17,s*.06,10,24),rb);bow.position.set(k*s*.15,s+s*.12,0);bow.rotation.set(0,Math.PI/2*.15,k*.6);bow.scale.set(1,.8,.6);g.add(bow)}
    const knot=mesh(new THREE.SphereGeometry(s*.07,12,10),rb);knot.position.y=s+.02;g.add(knot);return g};
  const g1=gift('#5f9fcf',.34);g1.rotation.set(0,.5,-.12);addItem(g1,new THREE.Vector3(.85,.72,.12),.7,'gift',{say:'まだ ないしょ',lift:.3});
  const g2=gift('#ec9ab3',.26);g2.rotation.set(0,-.4,.1);addItem(g2,new THREE.Vector3(.56,.8,.34),.85,'gift',{say:'じゅんびちゅう',lift:.3});

  /* ボール */
  const ballTex=cvTex(512,256,(x,w,h)=>{const C=['#d9604f','#fff4df','#5f9fcf','#fff4df','#efc35a','#fff4df'];C.forEach((c,i)=>{x.fillStyle=c;x.fillRect(i*w/6,0,w/6+1,h)})});
  const ball=mesh(new THREE.SphereGeometry(.21,40,24),new THREE.MeshStandardMaterial({map:ballTex,roughness:.35}));const bg=new THREE.Group();ball.position.y=.21;ball.rotation.set(.3,.4,.5);bg.add(ball);
  addItem(bg,new THREE.Vector3(-.3,.78,.3),.95,'toy',{lift:.3});
  /* つみき */
  const blk=(ch,c)=>{const t=cvTex(256,256,(x,w,h)=>{x.fillStyle=c;x.fillRect(0,0,w,h);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(0,0,w,14);x.fillStyle='#fff';x.font='900 170px "Zen Maru Gothic"';x.textAlign='center';x.textBaseline='middle';x.shadowColor='rgba(0,0,0,.25)';x.shadowOffsetY=6;x.fillText(ch,w/2,h/2+10)});
    const m=new THREE.MeshStandardMaterial({map:t,roughness:.55});return mesh(RB(.24,.24,.24,.025),m)};
  const blocks=new THREE.Group();const b1=blk('う','#efc35a');b1.position.set(0,.12,0);const b2=blk('み','#78b267');b2.position.set(.05,.36,-.02);b2.rotation.y=.4;const b3=blk('く','#d9604f');b3.position.set(-.26,.12,.04);b3.rotation.y=-.3;
  blocks.add(b1,b2,b3);blocks.rotation.y=.2;addItem(blocks,new THREE.Vector3(-.98,.74,.22),1.05,'toy',{lift:.3});

  /* せいれい（はこにわ暮らしのモデル） */
  let spirit=null;
  try{const f=await new FBXLoader().loadAsync('models/wood.fbx');f.updateMatrixWorld(true);
    const bb=new THREE.Box3().setFromObject(f),sz=bb.getSize(new THREE.Vector3()),s=.62/sz.y;f.scale.multiplyScalar(s);
    const c={hood:'#6fae4c',cheek:'#f2b8a8',eye:'#3f2a1c',sprout:'#5e8f43',acc:'#e8cdb0',body:'#fdf8ef'};
    const mat=(col,r=.6)=>new THREE.MeshStandardMaterial({color:col,roughness:r});
    f.traverse(o=>{if(!o.isMesh)return;const n=o.name.toLowerCase();o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;
      o.material=n.startsWith('eye')?mat(c.eye,.25):n.startsWith('cheek')?mat(c.cheek,.8):(n.startsWith('hood')||n.startsWith('hane'))?mat(c.hood,.65):n.startsWith('sprout')?mat(c.sprout,.6):n.startsWith('headacc')?mat(c.acc):mat(c.body,.75)});
    const bb2=new THREE.Box3().setFromObject(f);f.position.y-=bb2.min.y;f.position.x-=(bb2.min.x+bb2.max.x)/2;f.position.z-=(bb2.min.z+bb2.max.z)/2;
    const sg=new THREE.Group();sg.add(f);sg.rotation.y=.35;
    spirit=addItem(sg,new THREE.Vector3(-.62,.68,-.32),1.2,'spirit',{lift:.3});
  }catch(e){console.warn('せいれいのモデルを読めなかった',e)}

  /* ── ほこり（光の中できらきら） ── */
  const NDUST=reduce?0:260,dg=new THREE.BufferGeometry(),dp=new Float32Array(NDUST*3),dseed=new Float32Array(NDUST);
  for(let i=0;i<NDUST;i++){dp[i*3]=-4+Math.random()*5;dp[i*3+1]=Math.random()*4.5;dp[i*3+2]=-2+Math.random()*3.5;dseed[i]=Math.random()*10}
  dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  const dotTex=cvTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,245,215,1)');g.addColorStop(1,'rgba(255,245,215,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
  const dust=new THREE.Points(dg,new THREE.PointsMaterial({map:dotTex,size:.05,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.85}));scene.add(dust);

  /* ── 紙ふぶき ── */
  const NC=reduce?0:140,conf=new THREE.InstancedMesh(new THREE.PlaneGeometry(.06,.09),new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.7}),Math.max(1,NC));
  conf.count=0;conf.frustumCulled=false;scene.add(conf);const CP=[];const tmpC=new THREE.Color();
  for(let i=0;i<NC;i++){conf.setColorAt(i,tmpC.set(GC[i%5]))}
  function burst(){if(!NC)return;CP.length=0;for(let i=0;i<NC;i++){const a=Math.random()*Math.PI*2,sp=1.2+Math.random()*2.4;
    CP.push({p:new THREE.Vector3((Math.random()-.5)*1.6,1.2,(Math.random()-.5)*.6),v:new THREE.Vector3(Math.cos(a)*sp*.6,2.2+Math.random()*1.8,Math.sin(a)*sp*.35+.7),r:new THREE.Euler(Math.random()*6,Math.random()*6,0),w:new THREE.Vector3(Math.random()*8-4,Math.random()*8-4,Math.random()*8-4),life:0})}conf.count=NC}

  /* ── カメラ（画面のはばに合わせる） ── */
  const look=new THREE.Vector3(0,1.05,0);let camBase=new THREE.Vector3();
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;R.setSize(w,h,false);cam.aspect=w/h;
    /* 箱（はば3.2）が入るきょり */
    const hf=Math.tan(THREE.MathUtils.degToRad(cam.fov/2)),need=Math.max((cam.aspect<1?4.6:4.6)/(2*hf*cam.aspect),3.7/(2*hf));
    camBase.set(0,1.05+need*.36,need*.93);look.set(0,cam.aspect<.8?1.25:1.05,0);cam.updateProjectionMatrix()}
  resize();addEventListener('resize',resize);

  /* ── さわる ── */
  const ray=new THREE.Raycaster(),ptr=new THREE.Vector2(),par={x:0,y:0};let hover=null,down=null;
  const pick=e=>{const r=canvas.getBoundingClientRect();ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ptr,cam);
    const hits=ray.intersectObjects([...items.map(i=>i.obj),lid],true);for(const h of hits){let o=h.object;while(o&&!o.userData.item&&o!==lid)o=o.parent;if(o===lid)return{lid:true};if(o&&o.userData.item&&o.userData.item.pop>.5)return o.userData.item}return null};
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();par.x=(e.clientX-r.left)/r.width-.5;par.y=(e.clientY-r.top)/r.height-.5;if(e.pointerType==='mouse'){hover=pick(e);canvas.style.cursor=hover?'pointer':''}});
  canvas.addEventListener('pointerleave',()=>{hover=null;par.x=par.y=0});
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});
  canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)return;down=null;const h=pick(e);if(!h)return;
    if(h.lid){toggle();return}
    if(h.kind==='game'){sfx('pop');h.bounce=1;onGame(h.game)}
    else if(h.kind==='gift'){h.shake=1;sfx('shake');const p=h.obj.getWorldPosition(new THREE.Vector3());p.y+=.55;p.project(cam);const r=canvas.getBoundingClientRect();onSay(h.say,r.left+(p.x+1)/2*r.width,r.top+(1-p.y)/2*r.height)}
    else{h.bounce=1;sfx('boing')}});

  /* ── あけしめ ── */
  let open=false,lidA=0,lidV=0,openT=-1;const OPEN=-1.95;
  function toggle(){open=!open;if(open){openT=clock.elapsedTime;sfx('open');setTimeout(burst,reduce?0:420)}else{sfx('close');for(const it of items)it.pop=Math.min(it.pop,.2)}}
  const clock=new THREE.Clock();
  const tmpM=new THREE.Matrix4(),tmpQ=new THREE.Quaternion(),tmpS=new THREE.Vector3(1,1,1);
  const camNow=new THREE.Vector3();
  function frame(){const dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;
    /* ふた：ばね */
    const tgt=open?OPEN:0;if(reduce){lidA=tgt}else{lidV+=((tgt-lidA)*90-lidV*11)*dt;lidA+=lidV*dt}lidPivot.rotation.x=lidA;
    /* 中身：ふたがあいたら、じゅんばんに顔を出す */
    for(const it of items){const on=open&&openT>=0&&t-openT>it.delay;const goal=on?1:0;
      if(reduce)it.pop=goal;else{it.v+=((goal-it.pop)*140-it.v*13)*dt;it.pop+=it.v*dt}
      const hv=hover===it?1:0;it.hov=(it.hov||0)+(hv-(it.hov||0))*Math.min(1,dt*10);
      it.bounce=Math.max(0,it.bounce-dt*1.6);it.shake=Math.max(0,it.shake-dt*1.8);
      const bo=it.bounce>0?Math.sin((1-it.bounce)*Math.PI*2.5)*.25*it.bounce:0;
      it.obj.position.set(it.base.x,it.base.y-(1-it.pop)*(it.lift+.9)+it.hov*.12+Math.max(0,bo),it.base.z);
      it.obj.rotation.set(it.baseRot.x,it.baseRot.y+(it.kind==='spirit'?Math.sin(t*.8)*.25:0),it.baseRot.z+Math.sin(it.shake*30)*.22*it.shake);
      it.obj.visible=it.pop>.02}
    if(spirit&&spirit.pop>.9&&!reduce){spirit.obj.position.y+=Math.abs(Math.sin(t*2.2))*.03}
    /* ガーランド・光・ほこり */
    flags.forEach((f,i)=>{f.rotation.x=Math.sin(t*1.3+i)*.12});beamMat.uniforms.t.value=t;
    if(NDUST){const a=dg.attributes.position.array;for(let i=0;i<NDUST;i++){a[i*3]+=Math.sin(t*.3+dseed[i])*.0012+.0006;a[i*3+1]+=.0015+Math.sin(t*.5+dseed[i]*2)*.001;a[i*3+2]+=Math.cos(t*.25+dseed[i])*.0008;if(a[i*3+1]>4.6){a[i*3+1]=0;a[i*3]=-4+Math.random()*5}}dg.attributes.position.needsUpdate=true}
    /* 紙ふぶき */
    if(conf.count){let alive=0;for(let i=0;i<CP.length;i++){const c=CP[i];c.life+=dt;c.v.y-=4.2*dt;c.v.multiplyScalar(1-1.1*dt);c.p.addScaledVector(c.v,dt);if(c.p.y<.02){c.p.y=.02;c.v.set(0,0,0);c.w.multiplyScalar(.9)}
      c.r.x+=c.w.x*dt;c.r.y+=c.w.y*dt;tmpQ.setFromEuler(c.r);const sc=c.life>5?Math.max(0,1-(c.life-5)):1;if(sc>0)alive++;tmpS.setScalar(sc);tmpM.compose(c.p,tmpQ,tmpS);conf.setMatrixAt(i,tmpM)}
      conf.instanceMatrix.needsUpdate=true;if(conf.instanceColor)conf.instanceColor.needsUpdate=true;if(!alive)conf.count=0}
    /* カメラ：ゆびの位置で少しずらす */
    camNow.set(camBase.x+par.x*.6,camBase.y-par.y*.3,camBase.z);cam.position.lerp(camNow,reduce?1:Math.min(1,dt*3));cam.lookAt(look);
    R.render(scene,cam);requestAnimationFrame(frame)}
  frame();
  setTimeout(()=>{if(!open)toggle()},reduce?0:900);
  return {toggle};
}
