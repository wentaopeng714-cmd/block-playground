import {stepPlayer} from './world.js?v=10.0';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export const SECOND_PHASE_TYPES=['gate','spikes','log','fire','crusher'];
export function mechanismPhaseShift(m,period){return SECOND_PHASE_TYPES.includes(m.type)?(m.phase||0):m.type==='sweeper'?(m.phase||0)/m.speed:(m.phase||0)/TAU*period;}
export function createMechanismState(){return {collapse:new Map()};}
export function resetMechanismState(state,mechanisms,segment){
  if(segment===undefined){state.collapse.clear();return;}
  for(const m of mechanisms)if(m.segment===segment)state.collapse.delete(m.id);
}
export function mechanismPose(m,time,state=null){
  if(m.type==='ice')return {type:m.type,id:m.id,x:m.x,y:m.y,z:m.z,width:m.width,depth:m.depth,grip:m.grip,speed:m.speed};
  if(m.type==='log'){
    const cycle=((time+(m.phase||0))%m.period+m.period)%m.period,progress=clamp((cycle-m.warning)/m.rollDuration,0,1);
    return {type:m.type,id:m.id,x:m.x-(m.dir||1)*m.range*progress,y:m.y,z:m.z,radius:m.radius??.52,depth:m.depth??3.8,progress,angle:(m.dir||1)*m.range*progress/(m.radius??.52),active:cycle<m.warning+m.rollDuration,warning:cycle<m.warning};
  }
  if(m.type==='fire'){
    const cycle=((time+(m.phase||0))%m.period+m.period)%m.period,age=cycle-m.warning;
    const extension=smooth(age/.12)*(1-smooth((age-m.burst+.15)/.15));
    return {type:m.type,id:m.id,x:m.x,y:m.y,z:m.z,width:m.width??1.1,depth:3.4,height:3.4*extension,extension,active:extension>.08,warning:cycle<m.warning,open:cycle>=m.warning+m.burst};
  }
  if(m.type==='collapse'){
    const triggered=state?.collapse.get(m.id),age=triggered===undefined?0:Math.max(0,time-triggered),fall=Math.max(0,age-m.delay);
    return {type:m.type,id:m.id,x:m.x,y:m.y-Math.min(14,fall*fall*20),z:m.z,width:2,depth:3,thickness:.28,active:!fall,warning:triggered!==undefined,progress:clamp(age/m.delay,0,1),opacity:clamp(1-fall/1.1,0,1)};
  }
  if(m.type==='pendulum'){
    const angle=m.amplitude*Math.sin(TAU*time/m.period+(m.phase||0));
    return {type:m.type,id:m.id,x:m.x,y:m.y-m.length*Math.cos(angle),z:m.z+m.length*Math.sin(angle),angle,radius:.72,length:m.length};
  }
  if(m.type==='spikes'){
    const cycle=m.period?((time+(m.phase||0))%m.period+m.period)%m.period:1;
    const extension=m.period?smooth(cycle/.16)*(1-smooth((cycle-1.35)/.2)):1;
    return {type:m.type,id:m.id,x:m.x,y:m.y,z:m.z,width:.85,depth:3,height:(m.height??.65)*extension,extension,active:extension>.12};
  }
  if(m.type==='platform'){
    const progress=(1-Math.cos(TAU*time/m.period+(m.phase||0)))/2;
    return {type:m.type,id:m.id,x:m.x+m.dir*m.range*progress,y:m.y+m.lift*progress,z:m.z,width:3.2,depth:3,thickness:.35,progress};
  }
  if(m.type==='gate'||m.type==='crusher'){
    const cycle=((time+(m.phase||0))%m.period+m.period)%m.period;
    const closed=m.closedDuration??1.7,transition=m.transition??.5,open=m.openDuration??1.7;
    const opening=smooth((cycle-closed)/transition),closing=smooth((cycle-closed-transition-open)/transition),lift=4.3*(opening-closing);
    return {type:m.type,id:m.id,x:m.x,y:m.y+lift,z:m.z,width:m.type==='crusher'?2:.42,depth:m.type==='crusher'?3.8:5.5,height:m.type==='crusher'?3.4:3.2,lift,open:lift>1.7};
  }
  return {type:'sweeper',id:m.id,x:m.x,y:m.y,z:m.z,angle:time*m.speed+(m.phase||0),length:m.length??7.4,width:.3,height:.28};
}
function overlapFootprint(p,q,extra=0){return Math.abs(p.x-q.x)<q.width/2+.27+extra&&Math.abs(p.z-q.z)<q.depth/2+.27+extra;}
export function touchesMechanism(p,pose){
  if(pose.type==='platform'||pose.type==='collapse'||pose.type==='ice')return false;
  if(pose.type==='log'){
    if(!pose.active||Math.abs(p.z-pose.z)>=pose.depth/2+.27)return false;
    const dy=clamp(pose.y,p.y+.27,p.y+1.28)-pose.y;
    return (p.x-pose.x)**2+dy*dy<(pose.radius+.27)**2;
  }
  if(pose.type==='pendulum'){
    const nearestY=clamp(pose.y,p.y+.27,p.y+1.28),dx=p.x-pose.x,dy=nearestY-pose.y,dz=p.z-pose.z;
    return dx*dx+dy*dy+dz*dz<(pose.radius+.27)**2;
  }
  if(pose.type==='spikes'||pose.type==='fire')return pose.active&&overlapFootprint(p,pose)&&p.y<pose.y+pose.height&&p.y+1.55>pose.y;
  if(pose.type==='gate'||pose.type==='crusher')return overlapFootprint(p,pose)&&p.y<pose.y+pose.height&&p.y+1.55>pose.y;
  if(p.y>=pose.y+pose.height/2||p.y+1.55<=pose.y-pose.height/2)return false;
  const dx=p.x-pose.x,dz=p.z-pose.z,c=Math.cos(pose.angle),s=Math.sin(pose.angle);
  const along=dx*c+dz*s,across=-dx*s+dz*c;
  const a=Math.max(0,Math.abs(along)-pose.length/2),b=Math.max(0,Math.abs(across)-pose.width/2);
  return a*a+b*b<.27*.27;
}

// Moving decks are real support surfaces: carry the rider, permit jumping,
// catch downward landings, and release the rider after walking off an edge.
export function stepDynamicPlayer(p,dt,input,solid,mechanisms,time,state=null){
  const near=mechanisms.filter(m=>Math.abs(p.x-m.x)<18&&Math.abs(p.z-m.z)<9);
  const platforms=near.filter(m=>m.type==='platform'||m.type==='collapse').map(m=>({definition:m,prev:mechanismPose(m,time,state),next:mechanismPose(m,time+dt,state)})).filter(q=>q.next.active!==false);
  const support=platforms.find(q=>q.next.id===p.supportId);
  if(support&&overlapFootprint(p,support.prev)&&Math.abs(p.y-support.prev.y)<.12){
    p.x+=support.next.x-support.prev.x;p.y+=support.next.y-support.prev.y;p.z+=support.next.z-support.prev.z;p.grounded=true;
  }
  const before={x:p.x,y:p.y,z:p.z};
  const ice=near.find(m=>m.type==='ice'&&p.grounded&&Math.abs(p.y-m.y)<.12&&overlapFootprint(p,mechanismPose(m,time),-.27));
  p.onIce=!!ice;stepPlayer(p,dt,ice?{...input,groundResponse:ice.grip,surfaceSpeed:ice.speed}:input,solid);p.supportId=null;
  for(const {definition:m,next:q}of platforms){
    if(!overlapFootprint(p,q))continue;
    if(p.vy<=0&&before.y>=q.y-.09&&p.y<=q.y+.025){
      p.y=q.y;p.vy=0;p.grounded=true;p.supportId=q.id;
      if(m.type==='collapse'&&state&&!state.collapse.has(m.id)&&Math.abs(p.x-q.x)<q.width/2+.03&&Math.abs(p.z-q.z)<q.depth/2+.03)state.collapse.set(m.id,time+dt);
      continue;
    }
    if(p.y<q.y&&p.y+1.55>q.y-q.thickness){
      if(before.y+1.55<=q.y-q.thickness+.07){p.y=q.y-q.thickness-1.55;p.vy=Math.min(0,p.vy);}
      else{
        const left=q.x-q.width/2-.27,right=q.x+q.width/2+.27,back=q.z-q.depth/2-.27,front=q.z+q.depth/2+.27;
        const choices=[{n:Math.abs(p.x-left),axis:'x',v:left},{n:Math.abs(p.x-right),axis:'x',v:right},{n:Math.abs(p.z-back),axis:'z',v:back},{n:Math.abs(p.z-front),axis:'z',v:front}].sort((a,b)=>a.n-b.n);
        p[choices[0].axis]=choices[0].v;
      }
    }
  }
  for(const m of near){if(touchesMechanism(p,mechanismPose(m,time+dt,state)))return m;}
  return null;
}
export function reachedCheckpoint(segments,p,current=-1){
  let found=current;
  for(let i=current+1;i<segments.length;i++){
    const [x,y,z]=segments[i].entry;
    if(Math.hypot(p.x-x-.5,p.z-z-.5)<1.3&&Math.abs(p.y-y-1)<.45)found=i;
  }
  return found;
}
