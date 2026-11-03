// Each control owns one pointer so a second finger cannot release or replace
// the finger currently moving the player. Camera dragging owns its own pointer.
export function installTouchControls({joystick,jumpButton,onMove,onJump}){
  const knob=joystick.querySelector('.joystick-knob');
  let stickId=null,jumpId=null;
  const listen=(element,type,handler)=>element.addEventListener(type,handler,{passive:false});
  const consume=e=>{e.preventDefault();e.stopPropagation();};
  function move(e){
    const r=joystick.getBoundingClientRect(),radius=Math.min(r.width,r.height)*.34;
    let x=(e.clientX-r.left-r.width/2)/radius,z=(e.clientY-r.top-r.height/2)/radius;
    const length=Math.hypot(x,z),amount=Math.min(1,Math.max(0,(length-.12)/.88));
    if(length){x=x/length*amount;z=z/length*amount;}
    onMove(x,z);knob.style.transform=`translate(${x*radius*.72}px,${z*radius*.72}px)`;
  }
  function releaseStick(){
    const id=stickId;stickId=null;onMove(0,0);knob.style.transform='';joystick.classList.remove('is-pressed');
    if(id!==null&&joystick.hasPointerCapture(id))joystick.releasePointerCapture(id);
  }
  function releaseJump(){
    const id=jumpId;jumpId=null;onJump(false);jumpButton.classList.remove('is-pressed');
    if(id!==null&&jumpButton.hasPointerCapture(id))jumpButton.releasePointerCapture(id);
  }
  listen(joystick,'pointerdown',e=>{
    consume(e);if(stickId!==null||e.button>0)return;
    stickId=e.pointerId;joystick.setPointerCapture(stickId);joystick.classList.add('is-pressed');move(e);
  });
  listen(joystick,'pointermove',e=>{if(e.pointerId===stickId){consume(e);move(e);}});
  listen(jumpButton,'pointerdown',e=>{
    consume(e);if(jumpId!==null||e.button>0)return;
    jumpId=e.pointerId;jumpButton.setPointerCapture(jumpId);jumpButton.classList.add('is-pressed');onJump(true);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    listen(joystick,type,e=>{if(e.pointerId===stickId){consume(e);releaseStick();}});
    listen(jumpButton,type,e=>{if(e.pointerId===jumpId){consume(e);releaseJump();}});
  }
  listen(jumpButton,'keydown',e=>{if(['Space','Enter'].includes(e.code)){consume(e);onJump(true);jumpButton.classList.add('is-pressed');}});
  listen(jumpButton,'keyup',e=>{if(['Space','Enter'].includes(e.code)){consume(e);if(jumpId===null){onJump(false);jumpButton.classList.remove('is-pressed');}}});
  return {reset(){releaseStick();releaseJump();}};
}
