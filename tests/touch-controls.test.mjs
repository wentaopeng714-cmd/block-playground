import assert from 'node:assert/strict';
import {installTouchControls} from '../dist/touch-controls.js';

class Control extends EventTarget{
  constructor(){super();this.captured=new Set();this.classes=new Set();this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c)};this.knob={style:{}};}
  querySelector(){return this.knob;}
  getBoundingClientRect(){return {left:10,top:20,width:112,height:112};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);this.send('lostpointercapture',id);}
  send(type,pointerId,x=66,y=76){const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId,clientX:x,clientY:y,button:0});this.dispatchEvent(e);}
}
const joystick=new Control(),jumpButton=new Control();let movement=[0,0],jump=false;
const controls=installTouchControls({joystick,jumpButton,onMove:(x,z)=>movement=[x,z],onJump:value=>jump=value});
joystick.send('pointerdown',1,66,28);assert(movement[1]<-.99);
jumpButton.send('pointerdown',2);assert(jump);assert(movement[1]<-.99,'The jumping finger must not cancel movement');
joystick.send('pointerdown',3,110,76);joystick.send('pointermove',3,110,76);joystick.send('pointerup',3);
assert(movement[1]<-.99,'A second finger must neither replace nor release the moving finger');
jumpButton.send('pointerup',3);assert(jump,'Another finger lifting must not release jump');
jumpButton.send('pointercancel',2);assert(!jump);assert(movement[1]<-.99,'Jump cancellation must preserve movement');
joystick.send('pointermove',1,300,-300);assert(Math.hypot(...movement)<=1.000001,'Dragging beyond the pad must remain clamped');
joystick.send('lostpointercapture',1);assert.deepEqual(movement,[0,0]);assert.equal(joystick.knob.style.transform,'');
joystick.send('pointerdown',4,67,76);assert.deepEqual(movement,[0,0],'Small thumb jitter stays in the dead zone');
joystick.send('pointermove',4,95,76);jumpButton.send('pointerdown',5);assert(movement[0]>0&&jump);
controls.reset();controls.reset();assert.deepEqual(movement,[0,0]);assert(!jump);assert(!joystick.captured.size&&!jumpButton.captured.size,'Blur/rotation resets both captured fingers');
joystick.send('pointerdown',6,66,28);assert(movement[1]<-.99,'Controls work immediately after reset');
joystick.send('pointerup',6);assert.deepEqual(movement,[0,0]);
console.log('Passed: independent moving/jumping fingers, pointer ownership, cancellation/capture loss, clamped drag, thumb dead zone, interruption reset and resume.');
