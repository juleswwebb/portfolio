const $$=(el,s)=>[...el.querySelectorAll(s)],$=(el,s)=>el.querySelector(s);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
for(const el of document.querySelectorAll('[data-elevator]')){
 const car=$(el,'.elevator-car'),shaft=$(el,'.elevator-shaft');let position=1,speed=0,direction=1,target=null,state='idle',clock=0,hold=false,queue=[],last=0;
 const enqueue=(floor,kind)=>{if(!queue.some(r=>r.floor===floor&&r.kind===kind))queue.push({floor,kind});paint();};
 $$ (el,'[data-floor]').forEach(b=>b.addEventListener('click',()=>enqueue(Number(b.dataset.floor),'car')));
 $$(el,'[data-call]').forEach(b=>b.addEventListener('click',()=>enqueue(Number(b.dataset.call),b.dataset.direction)));
 function nextTarget(){
  if(!queue.length)return null;
  let ahead=queue.filter(r=>(r.floor-position)*direction>.025),compatible=ahead.filter(r=>r.kind==='car'||r.kind===(direction>0?'up':'down'));
  if(!ahead.length){direction*=-1;ahead=queue.filter(r=>(r.floor-position)*direction>.025);compatible=ahead.filter(r=>r.kind==='car'||r.kind===(direction>0?'up':'down'));}
  if(!ahead.length)return Math.round(position);
  const candidates=compatible.length?compatible:ahead;candidates.sort((a,b)=>compatible.length?Math.abs(a.floor-position)-Math.abs(b.floor-position):Math.abs(b.floor-position)-Math.abs(a.floor-position));return candidates[0].floor;
 }
 function serveFloor(){const floor=Math.round(position);const anyAhead=queue.some(r=>(r.floor-floor)*direction>0&&(r.kind==='car'||r.kind===(direction>0?'up':'down')));queue=queue.filter(r=>r.floor!==floor||(r.kind!=='car'&&anyAhead&&r.kind!==(direction>0?'up':'down')));state='opening';clock=0;speed=0;target=null;}
 function paint(){const gap=shaft.clientHeight/5;car.style.setProperty('--car-y',`${-(position-1)*gap}px`);car.classList.toggle('door-open',state==='opening'||state==='open');
  $(el,'[data-elevator-floor]').textContent=String(Math.round(position)).padStart(2,'0');$(el,'[data-elevator-state]').textContent=state==='moving'?`${direction>0?'↑ MOVING UP':'↓ MOVING DOWN'} / DOORS LOCKED`:state==='open'?(hold?'DOOR OPEN / HOLD':'DOOR OPEN / DWELL'):state.toUpperCase()+(state==='idle'?' / AT FLOOR':'');$(el,'[data-target]').textContent=target??'—';$(el,'[data-encoder]').textContent=Math.round(1985+(position-1)*79997).toLocaleString('en-NZ');$(el,'[data-interlock]').textContent=state==='idle'||state==='moving'?'LOCKED':'AT FLOOR';$(el,'[data-queue]').textContent=queue.length?queue.map(r=>`${r.floor}${r.kind==='up'?'↑':r.kind==='down'?'↓':''}`).join(' · '):'NONE';
  $$(el,'[data-floor]').forEach(b=>b.setAttribute('aria-pressed',String(queue.some(r=>r.floor===Number(b.dataset.floor)&&r.kind==='car'))));$$(el,'[data-call]').forEach(b=>b.setAttribute('aria-pressed',String(queue.some(r=>r.floor===Number(b.dataset.call)&&r.kind===b.dataset.direction))));$$(el,'[data-state]').forEach(b=>b.classList.toggle('active',b.dataset.state===state));$(el,'[data-door="open"]').setAttribute('aria-pressed',String(hold));
 }
 $(el,'[data-door="open"]').addEventListener('click',()=>{if(state==='moving'){ $(el,'[data-elevator-state]').textContent='OPEN INHIBITED / CAR IN MOTION';return;}hold=!hold;if(hold&&(state==='idle'||state==='closing')){state='opening';clock=0;}paint();});
 $(el,'[data-door="close"]').addEventListener('click',()=>{hold=false;if(state==='open'){state='closing';clock=0;}paint();});
 $(el,'[data-elevator-reset]').addEventListener('click',()=>{position=1;speed=0;direction=1;target=null;state='idle';clock=0;hold=false;queue=[];paint();});
 let visible=true;new IntersectionObserver(e=>{visible=e[0].isIntersecting;}).observe(el);
 function tick(time){requestAnimationFrame(tick);const dt=Math.min(.05,(time-last)/1000||0);last=time;if(document.hidden||!visible)return;clock+=dt;
  if(state==='idle'&&queue.length){if(queue.some(r=>r.floor===Math.round(position))){serveFloor();}else{target=nextTarget();direction=Math.sign(target-position)||direction;state='moving';}}
  else if(state==='moving'){
   const compatible=queue.filter(r=>(r.floor-position)*direction>0&&(r.kind==='car'||r.kind===(direction>0?'up':'down'))).sort((a,b)=>Math.abs(a.floor-position)-Math.abs(b.floor-position));const candidate=compatible[0]?.floor??target,stopping=speed*speed/(2*1.3)+.15;if(candidate!=null&&candidate!==target&&(candidate-position)*direction>stopping&&(candidate-target)*direction<0)target=candidate;
   const distance=Math.abs(target-position),desired=Math.min(.8,Math.sqrt(2*1.3*distance));speed+=clamp(desired-speed,-1.3*dt,1.3*dt);const travel=speed*dt;if(travel>=distance||distance<.006){position=target;serveFloor();}else position+=direction*travel;
  }else if(state==='opening'&&clock>=.85){state='open';clock=0;}
  else if(state==='open'&&!hold&&clock>=5){state='closing';clock=0;}
  else if(state==='closing'&&clock>=.85){state='idle';clock=0;}
  paint();
 }paint();requestAnimationFrame(tick);addEventListener('resize',paint);
}
for(const el of document.querySelectorAll('[data-cnc]')){
 const gantry=$(el,'[data-cnc-gantry]'),head=$(el,'[data-cnc-head]'),part=$(el,'[data-cnc-part]');let axes={x:50,y:50,z:50},running=false,phase=0,phaseStart=0,start={},carrying=false,last=0;
 const path=[{x:15,y:45,z:85,label:'APPROACH PICK POSITION'},{x:15,y:45,z:10,label:'LOWER TO PICK',grab:true},{x:15,y:45,z:85,label:'LIFT COMPONENT'},{x:78,y:65,z:85,label:'TRANSFER ABOVE BED'},{x:78,y:65,z:10,label:'LOWER TO PLACE',drop:true},{x:78,y:65,z:85,label:'RETRACT TOOLHEAD'},{x:50,y:50,z:85,label:'RETURN TO READY'}];
 function xy(x,y){return {x:145+x*2.4+y*1.8,y:155-x*1.35+y};}
 let partPosition=xy(15,45);
 function paint(){gantry.setAttribute('transform',`translate(${axes.x*2.4} ${-axes.x*1.35})`);head.setAttribute('transform',`translate(${145+axes.y*1.8} ${155+axes.y})`);const length=35+(100-axes.z)*(55/90);$(el,'[data-cnc-z]').setAttribute('d',`M0 20V${length}`);$(el,'[data-cnc-tool]').setAttribute('d',`M-9 ${length}L0 ${length+15}L9 ${length}`);const p=carrying?xy(axes.x,axes.y):partPosition;part.setAttribute('transform',`translate(${p.x-252} ${p.y+(carrying?length+15:105)-340})`);$$(el,'[data-axis]').forEach(input=>{input.value=Math.round(axes[input.dataset.axis]);$(el,`[data-output="${input.dataset.axis}"]`).textContent=Math.round(axes[input.dataset.axis]);});$(el,'[data-cnc-readout]').textContent=`X ${Math.round(axes.x)} · Y ${Math.round(axes.y)} · Z ${Math.round(axes.z)}`;}
 $$(el,'[data-axis]').forEach(input=>input.addEventListener('input',()=>{running=false;carrying=false;axes[input.dataset.axis]=Number(input.value);$(el,'[data-cnc-cycle]').textContent='Run pick & place ↗';$(el,'[data-cnc-status]').textContent='MANUAL POSITIONING';paint();}));
 $(el,'[data-cnc-cycle]').addEventListener('click',()=>{if(running){running=false;carrying=false;$(el,'[data-cnc-status]').textContent='CYCLE PAUSED';$(el,'[data-cnc-cycle]').textContent='Run pick & place ↗';return;}running=true;phase=0;phaseStart=performance.now();start={...axes};carrying=false;partPosition=xy(15,45);$(el,'[data-cnc-cycle]').textContent='Pause cycle Ⅱ';});
 let visible=true;new IntersectionObserver(e=>{visible=e[0].isIntersecting;}).observe(el);
 function tick(t){requestAnimationFrame(tick);if(!running){last=t;return;}if(document.hidden||!visible){phaseStart+=t-last;last=t;return;}last=t;const current=path[phase],duration=phase===0||phase===3?1800:1000,p=clamp((t-phaseStart)/duration,0,1),s=p*p*(3-2*p);for(const axis of ['x','y','z'])axes[axis]=start[axis]+(current[axis]-start[axis])*s;$(el,'[data-cnc-status]').textContent=`0${phase+1} / ${current.label}`;paint();if(p===1){if(current.grab)carrying=true;if(current.drop){carrying=false;partPosition=xy(78,65);}phase++;if(phase===path.length){running=false;$(el,'[data-cnc-status]').textContent='CYCLE COMPLETE / READY';$(el,'[data-cnc-cycle]').textContent='Run pick & place ↗';}else{start={...axes};phaseStart=t;}}}
 paint();requestAnimationFrame(tick);
}
for(const el of document.querySelectorAll('[data-step-counter]')){
 let count=0,goal=1000,view=0,alt=false,alerted=false,waves=Array(90).fill(50),pulse=0;
 const names=['Steps','Distance','Goal'];
 function paint(){const percent=Math.min(100,Math.floor(count*100/goal)),metres=Math.floor(count*.8);$(el,'[data-step-title]').textContent=names[view];$(el,'[data-step-value]').textContent=view===0?(alt?percent+'%':count.toLocaleString('en-NZ')):view===1?(alt?Math.floor(metres*1.094)+' yd':(Math.floor(metres/100)/10).toFixed(1)+' km'):`${percent}%`;$(el,'[data-step-unit]').textContent=view===0?(alt?'of daily goal':'steps'):view===1?'estimated distance':`${count.toLocaleString('en-NZ')} / ${goal.toLocaleString('en-NZ')}`;$(el,'[data-step-progress]').style.width=percent+'%';$$(el,'.progress-leds i').forEach((led,i)=>led.classList.toggle('on',percent>=(i+1)*10));$(el,'[data-step-goal-output]').textContent=goal.toLocaleString('en-NZ');
  if(count>=goal&&!alerted){alerted=true;el.classList.remove('goal-hit');void el.offsetWidth;el.classList.add('goal-hit');$(el,'[data-step-status]').textContent='GOAL REACHED / ONE-SHOT ALERT';}else if(count<goal){alerted=false;el.classList.remove('goal-hit');$(el,'[data-step-status]').textContent='TRACKING / '+percent+'% OF DAILY GOAL';}
 }
 $$(el,'[data-add-steps]').forEach(b=>b.addEventListener('click',()=>{count=Math.min(65535,count+Number(b.dataset.addSteps));pulse=28;paint();}));
 $$(el,'[data-step-view]').forEach(b=>b.addEventListener('click',()=>{view=(view+(b.dataset.stepView==='next'?1:2))%3;alt=false;paint();}));$(el,'[data-step-alt]').addEventListener('click',()=>{alt=!alt;paint();});$(el,'[data-step-goal]').addEventListener('input',e=>{goal=Number(e.target.value);alerted=false;paint();});$(el,'[data-step-reset]').addEventListener('click',()=>{count=0;view=0;alt=false;alerted=false;waves.fill(50);paint();});
 let visible=true;new IntersectionObserver(e=>{visible=e[0].isIntersecting;}).observe(el);let last=0;
 function wave(t){requestAnimationFrame(wave);if(document.hidden||!visible||t-last<60)return;last=t;const amplitude=pulse?18:1.5;waves.shift();waves.push(50+Math.sin(t*.025)*amplitude);pulse=Math.max(0,pulse-1);$(el,'[data-step-wave]').setAttribute('d',waves.map((v,i)=>`${i?'L':'M'}${i*4} ${v.toFixed(1)}`).join(' '));}paint();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(wave);
}
