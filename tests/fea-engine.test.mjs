import assert from 'node:assert/strict';
import {solveModel,exampleModel,sampleMember,frameStiffness} from '../fea-engine.mjs';
import fs from 'node:fs';
let checks=0;
const close=(a,b,label,tol=1e-8)=>{assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);checks++;};
const n=(id,x,y,support='free',loads={})=>({id,x,y,support,...loads});
const m=(id,a,b,type='frame',more={})=>({id,a,b,type,E:200e9,A:.003,I:8e-6,...more});
let model=exampleModel('cantilever'),r=solveModel(model),L=3,P=10000,EI=200e9*8e-6;
close(r.nodes[1].uy,-P*L**3/(3*EI),'Cantilever tip deflection');close(r.nodes[1].rotation,-P*L**2/(2*EI),'Cantilever rotation');close(r.nodes[0].ry,P,'Cantilever reaction');close(r.nodes[0].rm,P*L,'Cantilever moment');close(r.members[0].maxMoment,P*L,'Moment recovery');close(r.strainEnergy,P**2*L**3/(6*EI),'Strain energy');
model.members[0].G=80e9;model.members[0].As=.002;r=solveModel(model);close(r.nodes[1].uy,-P*L**3/(3*EI)-P*L/(80e9*.002),'Timoshenko shear deflection');
model={nodes:[n('a',0,0,'pin'),n('b',2,0,'rollerY',{fx:10000})],members:[m('bar','a','b','truss')]};r=solveModel(model);close(r.nodes[1].ux,10000*2/(200e9*.003),'Axial elongation');close(r.members[0].axial,10000,'Axial tension');close(r.members[0].stress,10000/.003,'Axial stress');close(r.nodes[0].rx,-10000,'Axial support reaction');
model=exampleModel('triangle');r=solveModel(model);close(r.nodes[0].ry,10000,'Triangle left reaction');close(r.nodes[1].ry,10000,'Triangle right reaction');close(r.members[0].axial,10000,'Triangle tie force');close(r.members[1].axial,-10000*Math.SQRT2,'Triangle diagonal compression');
model={nodes:[n('a',0,0,'pin'),n('b',4,0,'rollerY')],members:[m('beam','a','b','frame',{w:-6000})]};r=solveModel(model);close(r.nodes[0].ry,12000,'Uniform beam left reaction');close(r.nodes[1].ry,12000,'Uniform beam right reaction');close(r.nodes[0].rotation,-6000*4**3/(24*EI),'Uniform beam end rotation');close(r.members[0].maxMoment,6000*4**2/8,'Uniform beam maximum moment');close(sampleMember(model.members[0],r.members[0],1).moment,0,'Uniform beam end moment');assert.ok(r.maxDeformation>0);checks++;
// Releases retain private rotation DOFs; fully fixed external nodes do not suppress end hinges.
model={nodes:[n('a',0,0,'fixed'),n('b',4,0,'fixed')],members:[m('beam','a','b','frame',{w:-6000,pinA:true,pinB:true})]};r=solveModel(model);close(r.members[0].localForces[2],0,'Released start moment');close(r.members[0].localForces[5],0,'Released end moment');close(r.nodes[0].ry,12000,'Released beam reaction');
model={nodes:[n('a',0,0,'pin'),n('b',4,0,'rollerY')],members:[m('beam','a','b','frame',{loads:[{kind:'pl',value:-10000,a:1}]})]};r=solveModel(model);close(r.nodes[0].ry,7500,'Point load left reaction');close(r.nodes[1].ry,2500,'Point load right reaction');close(sampleMember(model.members[0],r.members[0],.25).moment,7500,'Point load moment');
model.members[0].loads=[{kind:'pl',value:-10000}];r=solveModel(model);close(r.members[0].maxMoment,10000,'Default midpoint load recovery');
model.members[0].loads=[{kind:'lvl',value:-6000,peak_at:2}];r=solveModel(model);close(r.nodes[0].ry,4000,'Triangular load left reaction');close(r.nodes[1].ry,8000,'Triangular load right reaction');
model=exampleModel('cantilever');model.nodes[0].fy=-5000;r=solveModel(model);close(r.nodes[0].ry,15000,'Constrained external load included in reaction');
const original=JSON.stringify(model);solveModel(model);assert.equal(JSON.stringify(model),original,'Solving does not modify input');checks++;
model.nodes[0].support='free';assert.throws(()=>solveModel(model),/unstable|unrestrained/);checks++;
model=exampleModel();model.nodes.push(n('orphan',10,10));assert.throws(()=>solveModel(model),/disconnected/);checks++;
model=exampleModel('triangle');model.nodes[2].mz=1000;assert.throws(()=>solveModel(model),/nodal moment/);checks++;
for(const [i,row] of frameStiffness(200e9,8e-6,.003,4).entries())row.forEach((v,j)=>close(v,frameStiffness(200e9,8e-6,.003,4)[j][i],'Stiffness symmetry'));
// Frozen outputs generated from Jules' original Python frame_toolkit.Structure.
const fixtures=JSON.parse(fs.readFileSync(new URL('./python-reference.json',import.meta.url),'utf8'));
for(const fixture of fixtures){const actual=solveModel(fixture.model);fixture.members.forEach(expected=>{const member=actual.members.find(e=>e.id===expected.id);member.localDisplacements.forEach((v,i)=>close(v,expected.d[i],fixture.name+' displacement'));member.localForces.forEach((v,i)=>close(v,expected.f[i],fixture.name+' force'));});}
console.log(`${checks} numerical checks passed: analytical mechanics, stability and original Python parity.`);
