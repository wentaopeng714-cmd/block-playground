// Cosmetic effects share a small particle pool. They never enter the voxel
// collider, resource ledger, or route generator.
export function createShieldMaterial(THREE){
  return new THREE.ShaderMaterial({
    uniforms:{tint:{value:new THREE.Color('#72d9ca')},strength:{value:1},time:{value:0}},
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vN;varying vec3 vV;varying vec3 vP;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;vP=position;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform vec3 tint;uniform float strength;uniform float time;varying vec3 vN;varying vec3 vV;varying vec3 vP;
      void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.4);float band=pow(.5+.5*sin(vP.y*12.-time*1.5),12.);float a=(.012+rim*.46+band*.025)*strength;gl_FragColor=vec4(tint,a);}`,
  });
}

export function createVisualEffects(THREE,scene,{reducedMotion=false,pixelRatio=1}={}){
  const CAP=256,particles=Array.from({length:CAP},()=>({alive:false})),position=new Float32Array(CAP*3),color=new Float32Array(CAP*3),size=new Float32Array(CAP),alpha=new Float32Array(CAP);
  const geometry=new THREE.BufferGeometry();
  for(const [name,array,itemSize]of [['position',position,3],['fxColor',color,3],['fxSize',size,1],['fxAlpha',alpha,1]])geometry.setAttribute(name,new THREE.BufferAttribute(array,itemSize).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({
    uniforms:{pixelRatio:{value:pixelRatio}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform float pixelRatio;attribute vec3 fxColor;attribute float fxSize;attribute float fxAlpha;varying vec3 vColor;varying float vAlpha;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vColor=fxColor;vAlpha=fxAlpha;gl_PointSize=clamp(fxSize*pixelRatio*190./max(1.,-mv.z),1.,46.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha;
      void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.||vAlpha<.01)discard;float glow=pow(1.-d,1.7);gl_FragColor=vec4(vColor,glow*vAlpha);}`,
  });
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
  const waves=Array.from({length:6},()=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(.94,1,64),new THREE.MeshBasicMaterial({color:'#78e2cf',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));mesh.visible=false;scene.add(mesh);return {mesh,alive:false};});
  let cursor=0,waveCursor=0,clock=0;
  function spawn(data){const p=particles[cursor++%CAP];Object.assign(p,{alive:true,born:clock,life:.6,kind:'spark',vx:0,vy:0,vz:0,gravity:1.4,size:.25,color:'#ffe1a0'},data);}
  function burst(origin,tint='#ffe1a0',count=14){
    for(let i=0;i<(reducedMotion?Math.min(4,count):count);i++){
      const a=Math.random()*Math.PI*2,r=.5+Math.random()*1.8;
      spawn({x:origin.x,y:origin.y,z:origin.z,vx:Math.cos(a)*r,vy:.7+Math.random()*1.8,vz:Math.sin(a)*r,life:.4+Math.random()*.45,color:tint,size:.16+Math.random()*.18});
    }
  }
  function wave(origin,tint,scale=1,floor=false){
    const w=waves[waveCursor++%waves.length];Object.assign(w,{alive:true,born:clock,life:reducedMotion?.25:.65,scale,floor});w.mesh.position.set(origin.x,origin.y,origin.z);w.mesh.material.color.set(tint);w.mesh.visible=true;
  }
  return {
    pickup(source){spawn({kind:'fly',x:source.x,y:source.y,z:source.z,life:reducedMotion?.2:.48,size:.36,color:'#ffe4a2'});burst(source,'#ffde8b',5);},
    craft(origin,tint){burst(origin,tint,30);wave(origin,tint,1.3);wave({x:origin.x,y:origin.y-.85,z:origin.z},tint,1.8,true);},
    shield(origin,tint){burst(origin,tint,22);wave(origin,tint,1.35);},
    build(origin,tint){burst(origin,tint,18);wave(origin,tint,2.3,true);},
    update(now,camera,focus,pixelRatio=1){
      clock=now;material.uniforms.pixelRatio.value=pixelRatio;
      particles.forEach((p,i)=>{
        const age=now-p.born,t=age/p.life;if(!p.alive||t>=1){p.alive=false;alpha[i]=0;size[i]=0;return;}
        let x,y,z;
        if(p.kind==='fly'&&focus){const u=1-Math.pow(1-t,2);x=p.x+(focus.x-p.x)*u;y=p.y+(focus.y-p.y)*u+Math.sin(t*Math.PI)*.7;z=p.z+(focus.z-p.z)*u;}
        else{x=p.x+p.vx*age;y=p.y+p.vy*age-p.gravity*age*age;z=p.z+p.vz*age;}
        position.set([x,y,z],i*3);const c=new THREE.Color(p.color);color.set([c.r,c.g,c.b],i*3);size[i]=p.size*(1-t*.5);alpha[i]=(1-t)*(p.kind==='fly'?1: .85);
      });
      for(const a of Object.values(geometry.attributes))a.needsUpdate=true;
      waves.forEach(w=>{const t=(now-w.born)/w.life;if(!w.alive||t>=1){w.alive=false;w.mesh.visible=false;return;}w.mesh.material.opacity=(1-t)*.5;w.mesh.scale.setScalar(w.scale*(.5+t*.9));if(w.floor)w.mesh.rotation.set(-Math.PI/2,0,0);else w.mesh.quaternion.copy(camera.quaternion);});
    },
  };
}
