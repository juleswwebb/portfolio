import {exampleModel,sampleMember} from './fea-engine.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=3)=>Math.abs(v)<10**(-d)?'0':Number(v).toLocaleString('en-NZ',{maximumFractionDigits:d});
const number=(v)=>Number(v)||0;
const clone=x=>structuredClone(x);
const svg=$('#structure-canvas');
let model=exampleModel(),selected=null,tool='select',pending=null,result=null,revision=0,history=[],future=[],activeTab='members';
let view={cx:3,cy:.9,scale:130},pointer=null,ghost=null,animation=false,animationFrame=0,deflectionFactor=1;
const worker=new Worker('./fea-worker.mjs',{type:'module'});
const storageKey='jules-webb-structural-lab-v1';
const hints={select:'Select a node or member to edit it. Drag nodes to reshape the structure.',node:'Click the drawing to place a node. Coordinates snap to the grid.',member:'Select the first node, then the second to connect a member.',support:'Click a node to apply the quick support chosen below.',load:'Click a node to apply the quick vertical load chosen below.',delete:'Click a node or member to delete it. Deleting a node also removes its connected members.'};
function status(text,error=false){$('#lab-status').textContent=text;$('#lab-status').classList.toggle('is-error',error);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(model));}catch{}}
function snapshot(){history.push(clone(model));if(history.length>60)history.shift();future=[];}
function invalidate(){revision++;result=null;animation=false;$('#animate-model').setAttribute('aria-pressed','false');$('#animate-model').textContent='▶ Animate';$('#export-results').disabled=true;$('#solve-model').disabled=false;$('#solve-model').innerHTML='Analyse <span>↗</span>';status('Model updated. Analyse again to see the new response.');renderResults();persist();}
function change(action,inspect=true){snapshot();action();invalidate();render();if(inspect)renderInspector();}
function updateHistory(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function setTool(next){tool=next;pending=null;ghost=null;$$('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));$('#tool-hint').textContent=hints[tool];svg.dataset.tool=tool;render();}
function nextId(prefix,items){let i=1;while(items.some(x=>x.id===prefix+i))i++;return prefix+i;}
function worldToScreen(x,y){return {x:500+(x-view.cx)*view.scale,y:300-(y-view.cy)*view.scale};}
function screenToWorld(x,y){return {x:view.cx+(x-500)/view.scale,y:view.cy-(y-300)/view.scale};}
function eventPoint(event){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());return {x:p.x,y:p.y};}
function snapped(p){const w=screenToWorld(p.x,p.y),snap=Math.max(.01,Math.min(10,number($('#grid-snap').value)||.5));return {x:Math.round(w.x/snap)*snap,y:Math.round(w.y/snap)*snap};}
function fit(){if(!model.nodes.length){view={cx:3,cy:1.5,scale:110};return;}const xs=model.nodes.map(n=>n.x),ys=model.nodes.map(n=>n.y),dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys);view={cx:(Math.max(...xs)+Math.min(...xs))/2,cy:(Math.max(...ys)+Math.min(...ys))/2,scale:Math.min(750/Math.max(dx,2),410/Math.max(dy,2))};}
function nodeById(id){return model.nodes.find(n=>n.id===id);}
function deleteSelection(kind,id){if(kind==='node'){model.nodes=model.nodes.filter(n=>n.id!==id);model.members=model.members.filter(m=>m.a!==id&&m.b!==id);}else model.members=model.members.filter(m=>m.id!==id);selected=null;}
function actAt(kind,id,p){
  if(tool==='node'&&!kind){if(model.nodes.length>=80)return status('Maximum of 80 nodes reached.',true);const w=snapped(p);if(model.nodes.some(n=>Math.hypot(n.x-w.x,n.y-w.y)<1e-6))return status('There is already a node at that grid point.',true);change(()=>{const n={id:nextId('N',model.nodes),...w,support:'free',angle:0,fx:0,fy:0,mz:0};model.nodes.push(n);selected={kind:'node',id:n.id};});return;}
  if(tool==='member'&&kind==='node'){
    if(!pending){pending=id;selected={kind,id};render();renderInspector();status(`Connect ${id} to another node.`);return;}
    if(pending===id){pending=null;render();return;}
    if(model.members.some(m=>(m.a===pending&&m.b===id)||(m.b===pending&&m.a===id)))return status('Those nodes are already connected.',true);
    if(model.members.length>=160)return status('Maximum of 160 members reached.',true);
    change(()=>{const m={id:nextId('M',model.members),a:pending,b:id,type:$('#new-member-type').value,E:200e9,A:.003,I:8e-6,w:0};model.members.push(m);selected={kind:'member',id:m.id};});pending=id;render();return;
  }
  if(tool==='support'&&kind==='node'){change(()=>{nodeById(id).support=$('#quick-support').value;selected={kind,id};});return;}
  if(tool==='load'&&kind==='node'){change(()=>{nodeById(id).fy=number($('#quick-load').value)*1000;selected={kind,id};});return;}
  if(tool==='delete'&&kind){change(()=>deleteSelection(kind,id));return;}
  selected=kind?{kind,id}:null;render();renderInspector();
}
function supportSymbol(n,p){
  if(n.support==='free'||!n.support)return '';
  let shape='';
  if(n.support==='fixed')shape='<rect x="-12" y="7" width="24" height="6"/><path d="M-12 14l-7 7m14-7-7 7m14-7-7 7m14-7-7 7m14-7-7 7"/>';
  else shape='<path d="M0 7L-13 27H13Z"/>'+(n.support.startsWith('roller')?'<circle cx="-7" cy="32" r="3"/><circle cx="7" cy="32" r="3"/><path d="M-17 37h34"/>':'<path d="M-17 30h34m-30 0-5 6m13-6-5 6m13-6-5 6m13-6-5 6"/>');
  const angle=-(n.angle||0)+(n.support==='rollerX'?90:0);
  return `<g class="support-symbol" transform="translate(${p.x},${p.y}) rotate(${angle})">${shape}</g>`;
}
function arrow(p,fx,fy,color='load'){
  const mag=Math.hypot(fx,fy);if(mag<1e-7)return '';
  const dx=fx/mag,dy=-fy/mag,len=58,end={x:p.x-dx*10,y:p.y-dy*10},start={x:end.x-dx*len,y:end.y-dy*len};
  return `<g class="${color}-symbol"><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" marker-end="url(#${color==='load'?'load':'reaction'}-arrow)"/><text x="${start.x+8}" y="${start.y-9}">${fmt(mag/1000,2)} kN</text></g>`;
}
function render(){
  updateHistory();$('#model-name').value=model.name;$('#model-count').textContent=`${model.nodes.length} nodes / ${model.members.length} members`;
  const start=screenToWorld(0,600),end=screenToWorld(1000,0);let step=Math.max(.1,number($('#grid-snap').value)||.5);while((end.x-start.x)/step>45)step*=2;
  let grid='';for(let x=Math.ceil(start.x/step)*step;x<end.x;x+=step){const s=worldToScreen(x,0).x;grid+=`<line x1="${s}" y1="0" x2="${s}" y2="600"/><text x="${s+4}" y="590">${fmt(x,1)}</text>`;}
  for(let y=Math.ceil(start.y/step)*step;y<end.y;y+=step){const s=worldToScreen(0,y).y;grid+=`<line x1="0" y1="${s}" x2="1000" y2="${s}"/><text x="8" y="${s-5}">${fmt(y,1)}</text>`;}
  const o=worldToScreen(0,0);grid+=`<path class="axis" d="M${o.x} 0V600M0 ${o.y}H1000"/>`;$('#grid-layer').innerHTML=grid;
  let lines='',diagrams='',deflected='',annotations='',nodeMarkup='';
  const viewMode=$('#result-view').value,maxForce=result?Math.max(...result.members.map(m=>Math.abs(m.axial)),1):1,maxMoment=result?Math.max(...result.members.map(m=>m.maxMoment),1):1,maxShear=result?Math.max(...result.members.map(m=>m.maxShear),1):1;
  const amp=Math.max(0,Math.min(100000,number($('#deformation-scale').value)))*deflectionFactor;
  for(const m of model.members){
    const a=nodeById(m.a),b=nodeById(m.b);if(!a||!b)continue;
    const p=worldToScreen(a.x,a.y),q=worldToScreen(b.x,b.y),isSelected=selected?.kind==='member'&&selected.id===m.id,r=result?.members.find(x=>x.id===m.id);
    let color=isSelected?'#e8bd85':'#c5d0be';
    if(r&&['axial','stress'].includes(viewMode))color=r.axial>=0?'#82c8d5':'#f08e7e';
    lines+=`<g data-member="${esc(m.id)}" role="button" tabindex="0" aria-label="Member ${esc(m.id)}, ${esc(m.type)} from ${esc(m.a)} to ${esc(m.b)}"><line class="member-hit" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/><line class="member-line ${isSelected?'selected':''}" style="stroke:${color}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/><text class="member-label" x="${(p.x+q.x)/2+8}" y="${(p.y+q.y)/2-10}">${esc(m.id)}${r&&viewMode==='axial'?' · '+fmt(r.axial/1000,2)+' kN':r&&viewMode==='stress'?' · '+fmt(r.stress/1e6,2)+' MPa':''}</text></g>`;
    if(m.pinA)lines+=`<circle class="release-marker" cx="${p.x+(q.x-p.x)*.06}" cy="${p.y+(q.y-p.y)*.06}" r="4"/>`;
    if(m.pinB)lines+=`<circle class="release-marker" cx="${q.x+(p.x-q.x)*.06}" cy="${q.y+(p.y-q.y)*.06}" r="4"/>`;
    const udl=(m.w||0)+(m.loads||[]).filter(ld=>ld.kind==='udl').reduce((s,ld)=>s+ld.value,0);
    if(udl&&m.type==='frame'){
      const L=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/L,ny=(b.x-a.x)/L,sign=Math.sign(udl);let starts=[];
      for(let i=1;i<=6;i++){const t=i/7,u=worldToScreen(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t),v={x:u.x-nx*sign*34,y:u.y+ny*sign*34};starts.push(`${v.x},${v.y}`);annotations+=`<line class="udl-line" x1="${v.x}" y1="${v.y}" x2="${u.x-nx*sign*7}" y2="${u.y+ny*sign*7}" marker-end="url(#load-arrow)"/>`;}
      annotations+=`<polyline class="udl-line" points="${starts.join(' ')}"/><text class="udl-label" x="${(p.x+q.x)/2-nx*sign*47}" y="${(p.y+q.y)/2+ny*sign*47}">${fmt(udl/1000,2)} kN/m (local)</text>`;
    }
    for(const ld of (m.loads||[])){
      if(ld.kind==='udl')continue;
      const length=Math.hypot(b.x-a.x,b.y-a.y),c=(b.x-a.x)/length,sn=(b.y-a.y)/length;
      if(['pl','axial_pl'].includes(ld.kind)){
        const t=(ld.a??length/2)/length,p=worldToScreen(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);annotations+=arrow(p,ld.kind==='pl'?-sn*ld.value:c*ld.value,ld.kind==='pl'?c*ld.value:sn*ld.value);
      }else if(ld.kind==='lvl'||ld.kind==='axial_udl'){
        for(let i=1;i<=7;i++){const t=i/8,p=worldToScreen(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t),f=ld.value*(ld.kind==='lvl'?(ld.peak_at===1?1-t:t):1);const x=ld.kind==='lvl'?-sn:c,y=ld.kind==='lvl'?c:sn,sign=Math.sign(f),len=ld.kind==='lvl'?Math.abs(f/ld.value)*45:28;annotations+=`<line class="udl-line" x1="${p.x-x*sign*len}" y1="${p.y+y*sign*len}" x2="${p.x-x*sign*7}" y2="${p.y+y*sign*7}" marker-end="url(#load-arrow)"/>`;}
        annotations+=`<text class="udl-label" x="${(p.x+q.x)/2}" y="${(p.y+q.y)/2-55}">${fmt(ld.value/1000)} kN/m · ${ld.kind==='lvl'?'triangular':'axial'}</text>`;
      }
    }
    if(r&&$('#show-deflection').checked){let pts=[];for(let i=0;i<=24;i++){const t=i/24,d=sampleMember(m,r,t),v=worldToScreen(a.x+(b.x-a.x)*t+d.dx*amp,a.y+(b.y-a.y)*t+d.dy*amp);pts.push(`${v.x},${v.y}`);}deflected+=`<polyline class="deformed-member" points="${pts.join(' ')}"/>`;}
    if(r&&m.type==='frame'&&['moment','shear'].includes(viewMode)){
      let pts=[`${p.x},${p.y}`];for(let i=0;i<=24;i++){const t=i/24,d=sampleMember(m,r,t),v=worldToScreen(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t),value=viewMode==='moment'?d.moment/maxMoment:d.shear/maxShear;pts.push(`${v.x-r.s*value*65},${v.y-r.c*value*65}`);}pts.push(`${q.x},${q.y}`);diagrams+=`<polygon class="diagram-path" points="${pts.join(' ')}"/><text class="diagram-label" x="${(p.x+q.x)/2}" y="${(p.y+q.y)/2+60}">max ${fmt((viewMode==='moment'?r.maxMoment:r.maxShear)/1000,2)} ${viewMode==='moment'?'kNm':'kN'}</text>`;
    }
  }
  for(const n of model.nodes){const p=worldToScreen(n.x,n.y),sel=selected?.kind==='node'&&selected.id===n.id;
    nodeMarkup+=supportSymbol(n,p)+`<g data-node="${esc(n.id)}" role="button" tabindex="0" aria-label="Node ${esc(n.id)}, X ${n.x} metres, Y ${n.y} metres, ${esc(n.support||'free')} support"><circle class="node-hit" cx="${p.x}" cy="${p.y}" r="16"/><circle class="node-circle ${sel||pending===n.id?'selected':''}" cx="${p.x}" cy="${p.y}" r="${sel?7:5}"/><text class="node-label" x="${p.x+10}" y="${p.y-12}">${esc(n.id)}</text></g>`;
    annotations+=arrow(p,n.fx||0,n.fy||0);
    if(n.mz)annotations+=`<path class="moment-arrow" d="M${p.x-20} ${p.y}a20 20 0 1 1 12 18" marker-end="url(#load-arrow)"/><text class="udl-label" x="${p.x-45}" y="${p.y-30}">${fmt(n.mz/1000)} kNm</text>`;
    if(result&&$('#show-reactions').checked){const r=result.nodes.find(x=>x.id===n.id);if(r&&n.support!=='free'){annotations+=arrow({x:p.x+7,y:p.y-4},r.rx,r.ry,'reaction');if(Math.abs(r.rm)>1e-6)annotations+=`<text class="reaction-label" x="${p.x+15}" y="${p.y+43}">Rᴍ ${fmt(r.rm/1000)} kNm</text>`;}}
  }
  if(result)annotations+=`<text class="canvas-legend" x="25" y="32">${['axial','stress'].includes(viewMode)?'BLUE · TENSION     CORAL · COMPRESSION':'MODEL · UNDEFORMED'}${$('#show-deflection').checked?'     GOLD · DEFORMED ×'+fmt(amp,0):''}</text>`;
  $('#member-layer').innerHTML=lines;$('#diagram-layer').innerHTML=diagrams;$('#deflection-layer').innerHTML=deflected;$('#node-layer').innerHTML=nodeMarkup;$('#annotation-layer').innerHTML=annotations;
  let ghostMarkup='';if(pending&&ghost){const n=nodeById(pending);if(n){const p=worldToScreen(n.x,n.y);ghostMarkup=`<line class="ghost-member" x1="${p.x}" y1="${p.y}" x2="${ghost.x}" y2="${ghost.y}"/>`;}}$('#ghost-layer').innerHTML=ghostMarkup;
}
function field(label,name,value,step='any'){return `<label>${label}<input data-property="${name}" type="number" step="${step}" value="${Number(value)||0}"></label>`;}
function memberLoads(m){
  const types=m.type==='frame'?{udl:'Uniform transverse',pl:'Point transverse',lvl:'Triangular transverse',axial_pl:'Point axial',axial_udl:'Uniform axial'}:{axial_pl:'Point axial',axial_udl:'Uniform axial'};
  return `<details class="member-load-editor" open><summary>Additional member loads</summary>${(m.loads||[]).map((ld,i)=>`<div class="member-load-row"><label>Load type<select data-load-index="${i}" data-load-property="kind">${Object.entries(types).map(([v,t])=>`<option value="${v}" ${ld.kind===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Magnitude (${['udl','lvl','axial_udl'].includes(ld.kind)?'kN/m':'kN'})<input type="number" step="any" data-load-index="${i}" data-load-property="value" value="${ld.value/1000}"></label>${['pl','axial_pl'].includes(ld.kind)?`<label>Position a (m from start)<input type="number" step="any" data-load-index="${i}" data-load-property="a" value="${ld.a??Math.hypot(nodeById(m.b).x-nodeById(m.a).x,nodeById(m.b).y-nodeById(m.a).y)/2}"></label>`:''}${ld.kind==='lvl'?`<label>Peak at<select data-load-index="${i}" data-load-property="peak_at"><option value="1" ${ld.peak_at===1?'selected':''}>Start node</option><option value="2" ${ld.peak_at!==1?'selected':''}>End node</option></select></label>`:''}<button data-remove-load="${i}">Remove load</button></div>`).join('')}<button class="add-member-load">+ Add member load</button></details>`;
}
function renderInspector(){
  if(!selected){$('#inspector').innerHTML='<p class="lab-help">Select a node or member on the drawing to inspect its properties.</p>';return;}
  if(selected.kind==='node'){
    const n=nodeById(selected.id);if(!n){selected=null;return renderInspector();}
    const options={free:'Free',pin:'Pin',rollerY:'Roller · restrain Y',rollerX:'Roller · restrain X',fixed:'Fixed',symmetryY:'Symmetry · X + rotation',symmetryX:'Symmetry · Y + rotation'};
    $('#inspector').innerHTML=`<div class="inspector-title"><strong>${esc(n.id)}</strong><span>NODE</span></div><div class="field-pair">${field('X (m)','x',n.x)}${field('Y (m)','y',n.y)}</div><label>Support<select data-property="support">${Object.entries(options).map(([v,t])=>`<option value="${v}" ${n.support===v?'selected':''}>${t}</option>`).join('')}</select></label>${field('Support angle (° CCW)','angle',n.angle||0)}<div class="field-pair">${field('Fx (kN)','fx',(n.fx||0)/1000)}${field('Fy (kN)','fy',(n.fy||0)/1000)}</div>${field('Moment (kNm)','mz',(n.mz||0)/1000)}<button class="delete-selection">Delete node</button>`;
  }else{
    const m=model.members.find(x=>x.id===selected.id);if(!m){selected=null;return renderInspector();}
    const a=nodeById(m.a),b=nodeById(m.b);
    $('#inspector').innerHTML=`<div class="inspector-title"><strong>${esc(m.id)}</strong><span>${esc(m.a)} → ${esc(m.b)}</span></div><p class="lab-help">Length ${fmt(Math.hypot(b.x-a.x,b.y-a.y))} m</p><label>Element formulation<select data-property="type"><option value="truss" ${m.type==='truss'?'selected':''}>Truss · axial bar</option><option value="frame" ${m.type==='frame'?'selected':''}>Frame · bending + axial</option></select></label>${field('Young’s modulus E (GPa)','E',m.E/1e9)}${field('Cross-section A (mm²)','A',m.A*1e6)}${m.type==='frame'?`${field('Second moment I (mm⁴)','I',m.I*1e12)}${field('Local transverse UDL (kN/m)','w',(m.w||0)/1000)}<label class="check-field"><input data-property="pinA" type="checkbox" ${m.pinA?'checked':''}>Hinge at ${esc(m.a)}</label><label class="check-field"><input data-property="pinB" type="checkbox" ${m.pinB?'checked':''}>Hinge at ${esc(m.b)}</label><label class="check-field"><input data-property="shear" type="checkbox" ${m.G?'checked':''}>Include shear deformation</label>${m.G?`${field('Shear modulus G (GPa)','G',m.G/1e9)}${field('Shear area As (mm²)','As',m.As*1e6)}`:''}`:''}${memberLoads(m)}<button class="delete-selection">Delete member</button>`;
  }
}
// Update numeric fields on input without rebuilding the focused control.
// This also makes touch/keyboard edits work before focus leaves the inspector.
let editedInput=null;
$('#inspector').addEventListener('input',e=>{
  if(!selected||e.target.type!=='number')return;
  const value=Number(e.target.value);if(e.target.value===''||!Number.isFinite(value))return;
  if(editedInput!==e.target){snapshot();editedInput=e.target;}
  const item=selected.kind==='node'?nodeById(selected.id):model.members.find(m=>m.id===selected.id);
  if(e.target.dataset.loadProperty){const key=e.target.dataset.loadProperty;item.loads[Number(e.target.dataset.loadIndex)][key]=value*(key==='value'?1000:1);}
  else if(e.target.dataset.property){const key=e.target.dataset.property;item[key]=value*({fx:1000,fy:1000,mz:1000,E:1e9,G:1e9,A:1e-6,As:1e-6,I:1e-12,w:1000}[key]||1);}
  else return;
  invalidate();render();
});
$('#inspector').addEventListener('change',e=>{
  if(e.target===editedInput){editedInput=null;persist();return;}
  if(e.target.dataset.loadProperty&&selected?.kind==='member'){const index=Number(e.target.dataset.loadIndex),property=e.target.dataset.loadProperty;let value=property==='kind'?e.target.value:Number(e.target.value);if(typeof value==='number'&&!Number.isFinite(value))return;change(()=>{const m=model.members.find(m=>m.id===selected.id);m.loads[index][property]=property==='value'?value*1000:value;if(property==='kind'&&['pl','axial_pl'].includes(value)&&m.loads[index].a==null)m.loads[index].a=Math.hypot(nodeById(m.b).x-nodeById(m.a).x,nodeById(m.b).y-nodeById(m.a).y)/2;});return;}
  const property=e.target.dataset.property;if(!property||!selected)return;
  const v=e.target.type==='checkbox'?e.target.checked:e.target.tagName==='SELECT'?e.target.value:Number(e.target.value);
  if(typeof v==='number'&&!Number.isFinite(v))return status('Enter a finite numeric value.',true);
  change(()=>{const item=selected.kind==='node'?nodeById(selected.id):model.members.find(m=>m.id===selected.id);const factor={fx:1000,fy:1000,mz:1000,E:1e9,G:1e9,A:1e-6,As:1e-6,I:1e-12,w:1000}[property]||1;
    if(property==='shear'){item.G=v?item.E/2.6:null;item.As=v?item.A*5/6:null;}else item[property]=typeof v==='number'?v*factor:v;
    if(property==='type'&&v==='truss'){item.w=0;item.pinA=false;item.pinB=false;item.G=null;item.As=null;item.loads=(item.loads||[]).filter(ld=>['axial_udl','axial_pl'].includes(ld.kind));}
  });
});
$('#inspector').addEventListener('click',e=>{if(e.target.closest('.add-member-load')&&selected?.kind==='member'){change(()=>{const m=model.members.find(m=>m.id===selected.id);(m.loads??=[]).push({kind:m.type==='frame'?'pl':'axial_pl',value:-10000,a:Math.hypot(nodeById(m.b).x-nodeById(m.a).x,nodeById(m.b).y-nodeById(m.a).y)/2});});return;}const remove=e.target.closest('[data-remove-load]');if(remove&&selected?.kind==='member'){change(()=>model.members.find(m=>m.id===selected.id).loads.splice(Number(remove.dataset.removeLoad),1));return;}if(e.target.closest('.delete-selection')&&selected){const {kind,id}=selected;change(()=>deleteSelection(kind,id));}});
svg.addEventListener('pointerdown',event=>{
  if(event.button!==0&&event.button!==1)return;event.preventDefault();
  const p=eventPoint(event),hit=event.target.closest('[data-node],[data-member]'),kind=hit?.dataset.node?'node':hit?'member':null,id=hit?.dataset.node||hit?.dataset.member;
  if(event.button===1||event.altKey){pointer={type:'pan',p,view:{...view},id:event.pointerId};svg.setPointerCapture(event.pointerId);return;}
  if(tool==='select'&&kind==='node'){selected={kind,id};renderInspector();render();pointer={type:'drag',node:id,original:clone(model),moved:false,id:event.pointerId};svg.setPointerCapture(event.pointerId);}
  else actAt(kind,id,p);
});
svg.addEventListener('pointermove',event=>{
  const p=eventPoint(event),w=screenToWorld(p.x,p.y);$('#cursor-position').textContent=`X ${fmt(w.x,2)} / Y ${fmt(w.y,2)} m`;
  if(pointer?.type==='pan'){view.cx=pointer.view.cx-(p.x-pointer.p.x)/view.scale;view.cy=pointer.view.cy+(p.y-pointer.p.y)/view.scale;render();}
  else if(pointer?.type==='drag'){
    const n=nodeById(pointer.node),v=snapped(p);if(n.x===v.x&&n.y===v.y)return;
    if(!pointer.moved){history.push(pointer.original);future=[];pointer.moved=true;invalidate();}
    n.x=v.x;n.y=v.y;render();
  }else if(pending){ghost=p;render();}
});
svg.addEventListener('pointerup',()=>{if(pointer?.moved){invalidate();renderInspector();render();}pointer=null;});
svg.addEventListener('pointercancel',()=>{pointer=null;persist();});
svg.addEventListener('keydown',e=>{const hit=e.target.closest('[data-node],[data-member]');if(['Enter',' '].includes(e.key)&&hit){e.preventDefault();actAt(hit.dataset.node?'node':'member',hit.dataset.node||hit.dataset.member,{x:0,y:0});}});
svg.addEventListener('wheel',e=>{e.preventDefault();const p=eventPoint(e),w=screenToWorld(p.x,p.y);view.scale=Math.max(15,Math.min(800,view.scale*Math.exp(-e.deltaY*.001)));view.cx=w.x-(p.x-500)/view.scale;view.cy=w.y+(p.y-300)/view.scale;render();},{passive:false});
function historyAction(redo=false){const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(clone(model));model=from.pop();selected=null;pending=null;invalidate();render();renderInspector();}
$('#undo').addEventListener('click',()=>historyAction());$('#redo').addEventListener('click',()=>historyAction(true));
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();historyAction(e.shiftKey);}
  if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();const {kind,id}=selected;change(()=>deleteSelection(kind,id));}
  if(e.key==='Escape'){pending=null;setTool('select');}
});
$$('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$$('[data-preset]').forEach(b=>b.addEventListener('click',()=>{change(()=>{model=exampleModel(b.dataset.preset);selected=null;pending=null;});fit();render();solve();}));
$('#clear-model').addEventListener('click',()=>{change(()=>{model={name:'Untitled structure',nodes:[],members:[]};selected=null;pending=null;});fit();setTool('node');});
$('#model-name').addEventListener('change',e=>{model.name=e.target.value.trim().slice(0,80)||'Untitled structure';persist();});
$('#fit-model').addEventListener('click',()=>{fit();render();});$('#zoom-in').addEventListener('click',()=>{view.scale=Math.min(800,view.scale*1.25);render();});$('#zoom-out').addEventListener('click',()=>{view.scale=Math.max(15,view.scale/1.25);render();});
['result-view','show-deflection','show-reactions','deformation-scale','grid-snap'].forEach(id=>$('#'+id).addEventListener('change',render));
function solve(){animation=false;deflectionFactor=1;$('#animate-model').setAttribute('aria-pressed','false');$('#animate-model').textContent='▶ Animate';status('Assembling stiffness matrices and solving on your device…');$('#solve-model').disabled=true;$('#solve-model').textContent='Solving…';worker.postMessage({model,revision});}
$('#solve-model').addEventListener('click',solve);
worker.onmessage=({data})=>{
  if(data.revision!==revision)return;
  $('#solve-model').disabled=false;$('#solve-model').innerHTML='Analyse <span>↗</span>';
  if(data.error){result=null;status(data.error,true);renderResults();render();return;}
  result=data.result;$('#export-results').disabled=false;
  const max=Math.max(result.maxDeformation||0,1e-12);
  $('#deformation-scale').value=Math.min(100000,Math.max(1,Math.round(.35/max)));
  if($('#result-view').value==='geometry')$('#result-view').value='axial';
  status(`Solved · ${result.freeDofs} free DOFs · relative residual ${result.relativeResidual.toExponential(1)}. Blue is tension; coral is compression.`);
  renderResults();render();
};
worker.onerror=()=>{status('The calculation worker could not load. Refresh the page and try again.',true);$('#solve-model').disabled=false;};
function table(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function renderResults(){
  $('#export-results').disabled=!result;
  $('#result-stats').innerHTML=result?`<div><span>MAX NODAL DISPLACEMENT</span><strong>${fmt(result.maxDisplacement*1000,4)} <small>mm</small></strong></div><div><span>MAX AXIAL STRESS</span><strong>${fmt(result.maxStress/1e6,3)} <small>MPa</small></strong></div><div><span>FREE DEGREES OF FREEDOM</span><strong>${result.freeDofs}</strong></div><div><span>SOLVE RESIDUAL</span><strong>${result.relativeResidual.toExponential(1)}</strong></div>`:'<div><span>MAX NODAL DISPLACEMENT</span><strong>— <small>mm</small></strong></div><div><span>MAX AXIAL STRESS</span><strong>— <small>MPa</small></strong></div><div><span>FREE DEGREES OF FREEDOM</span><strong>—</strong></div><div><span>SOLVE RESIDUAL</span><strong>—</strong></div>';
  if(!result){$('#result-table').innerHTML='<p class="lab-help">Analyse the model to inspect forces, deflections, reactions and assembled matrices.</p>';return;}
  let html='';
  if(activeTab==='members')html=table(['Member','Length (m)','Mean axial (kN)','Mean axial stress (MPa)','State','Max |M| (kNm)','Max |V| (kN)'],result.members.map(m=>[esc(m.id),fmt(m.length),fmt(m.axial/1000),fmt(m.stress/1e6),`<span class="force-state ${m.axial>=0?'tension':'compression'}">${Math.abs(m.axial)<1e-6?'Zero-force':m.axial>=0?'Tension':'Compression'}</span>`,fmt(m.maxMoment/1000),fmt(m.maxShear/1000)]));
  if(activeTab==='nodes')html=table(['Node','Ux (mm)','Uy (mm)','Rotation (mrad)','Magnitude (mm)'],result.nodes.map(n=>[esc(n.id),fmt(n.ux*1000,5),fmt(n.uy*1000,5),fmt(n.rotation*1000,5),fmt(Math.hypot(n.ux,n.uy)*1000,5)]));
  if(activeTab==='reactions')html=table(['Support node','Rx (kN)','Ry (kN)','Moment (kNm)'],result.nodes.filter(n=>nodeById(n.id).support!=='free').map(n=>[esc(n.id),fmt(n.rx/1000),fmt(n.ry/1000),fmt(n.rm/1000)]));
  if(activeTab==='working'){
    const limit=12,K=result.stiffness.slice(0,limit).map(r=>r.slice(0,limit));
    html=`<div class="working-intro"><strong>Kq = F</strong><p>1. Form each local element stiffness matrix.<br>2. Transform to the node/support coordinate axes.<br>3. Assemble the global system and remove restrained DOFs.<br>4. Solve for displacements; recover element forces and support reactions.</p></div><p class="lab-help">Reduced stiffness matrix · SI units. ${result.freeDofs>limit?'First 12 rows and columns shown; download the working for the complete system.':''}</p>`+table(['K',...K.map((_,i)=>'q'+(i+1))],K.map((r,i)=>['q'+(i+1),...r.map(x=>x.toExponential(2))]))+`<p class="lab-help">Load vector F: [${result.load.map(x=>fmt(x,3)).join(', ')}]<br>Displacement vector q (m / rad): [${result.displacement.map(x=>x.toExponential(4)).join(', ')}]</p>`;
  }
  $('#result-table').innerHTML=html;
}
function selectTab(b){activeTab=b.dataset.resultTab;$$('[data-result-tab]').forEach(x=>{const active=x===b;x.setAttribute('aria-selected',String(active));x.tabIndex=active?0:-1;});$('#result-table').setAttribute('aria-labelledby',b.id);renderResults();}
$$('[data-result-tab]').forEach(b=>{b.addEventListener('click',()=>selectTab(b));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=$$('[data-result-tab]'),i=buttons.indexOf(b),j=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:-1)+4)%4;buttons[j].focus();selectTab(buttons[j]);});});
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#save-model').addEventListener('click',()=>download('structural-model.json',JSON.stringify({format:'jules-structural-lab',version:1,...model},null,2)));
$('#export-results').addEventListener('click',()=>{if(!result)return;download('structural-analysis.txt',`JULES WEBB / STRUCTURAL LAB\n${model.name}\nUnits: N, m, Pa, rad. Positive axial force = tension.\nLinear small-displacement analysis; axial stress excludes bending stress/buckling.\n\nMODEL\n${JSON.stringify(model,null,2)}\n\nRESULTS AND ASSEMBLED WORKING\n${JSON.stringify(result,null,2)}`,'text/plain');});
function validateImport(raw){
  if(!raw||!Array.isArray(raw.nodes)||!Array.isArray(raw.members))throw new Error('Choose a Structural Lab JSON model with nodes and members.');
  if(raw.nodes.length>80||raw.members.length>160)throw new Error('Model exceeds the 80-node / 160-member browser limit.');
  const validId=/^[A-Za-z0-9_-]{1,24}$/;
  if(raw.nodes.some(n=>!validId.test(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y)))throw new Error('Nodes need unique text identifiers and finite X/Y coordinates.');
  if(new Set(raw.nodes.map(n=>n.id)).size!==raw.nodes.length||new Set(raw.members.map(m=>m.id)).size!==raw.members.length)throw new Error('Duplicate node or member identifier.');
  const ids=new Set(raw.nodes.map(n=>n.id));
  if(raw.members.some(m=>!validId.test(m.id)||!ids.has(m.a)||!ids.has(m.b)||!['truss','frame'].includes(m.type)))throw new Error('A member identifier, endpoint or element type is invalid.');
  const supportNames=['free','pin','rollerY','rollerX','fixed','symmetryY','symmetryX'];
  for(const n of raw.nodes){if(!supportNames.includes(n.support||'free'))throw new Error('Unknown support type.');for(const key of ['angle','fx','fy','mz'])if(n[key]!=null&&!Number.isFinite(n[key]))throw new Error('A node property is not finite.');}
  for(const m of raw.members){for(const key of ['E','A','I','w','G','As'])if(m[key]!=null&&!Number.isFinite(m[key]))throw new Error('A member property is not finite.');if(m.loads!=null&&(!Array.isArray(m.loads)||m.loads.length>100))throw new Error('Use up to 100 member loads per element.');for(const ld of m.loads||[]){if(!ld||!['udl','lvl','pl','axial_udl','axial_pl'].includes(ld.kind)||!Number.isFinite(ld.value)||(ld.a!=null&&!Number.isFinite(ld.a))||(ld.peak_at!=null&&![1,2].includes(ld.peak_at)))throw new Error('A member load has an invalid type, magnitude or position.');}}
  return {name:String(raw.name||'Imported structure').slice(0,80),nodes:raw.nodes,members:raw.members};
}
$('#load-model').addEventListener('click',()=>$('#model-file').click());
$('#model-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1e6)throw new Error('Choose a model file smaller than 1 MB.');const loaded=validateImport(JSON.parse(await file.text()));change(()=>{model=loaded;selected=null;pending=null;});fit();render();status('Model imported. Inspect it, then analyse.');}catch(error){status(error.message,true);}e.target.value='';});
$('#animate-model').addEventListener('click',()=>{
  if(!result)return status('Analyse a stable model before animating its response.',true);
  animation=!animation;$('#animate-model').setAttribute('aria-pressed',String(animation));$('#animate-model').textContent=animation?'Ⅱ Pause':'▶ Animate';
  cancelAnimationFrame(animationFrame);if(!animation){deflectionFactor=1;render();return;}
  const start=performance.now();let last=0;
  function tick(now){if(!animation||!result)return;if(now-last>35&&!document.hidden){deflectionFactor=(1-Math.cos((now-start)*.002))/2;render();last=now;}animationFrame=requestAnimationFrame(tick);}animationFrame=requestAnimationFrame(tick);
});
try{const saved=localStorage.getItem(storageKey);if(saved)model=validateImport(JSON.parse(saved));}catch{}
fit();render();renderInspector();renderResults();solve();
