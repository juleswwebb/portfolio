/* Browser port of the ENME302 direct-stiffness formulation.
 * Internal units: N, m, Pa, rad. Local DOFs: u1,v1,theta1,u2,v2,theta2.
 * Trusses are axial bars; frames are Euler–Bernoulli or Timoshenko beams.
 */
const zeros = n => Array(n).fill(0);
const matrix = (r, c = r) => Array.from({length:r}, () => zeros(c));
const transpose = A => A[0].map((_, j) => A.map(row => row[j]));
const multiply = (A,B) => A.map(row => B[0].map((_,j) => row.reduce((s,v,k)=>s+v*B[k][j],0)));
const mv = (A,x) => A.map(row=>row.reduce((s,v,i)=>s+v*x[i],0));
const norm = v => Math.hypot(...v);
const finite = (v,label) => { if(!Number.isFinite(v)) throw new Error(`${label} must be a finite number.`); return v; };
const supports={free:[],pin:[0,1],rollerY:[1],rollerX:[0],fixed:[0,1,2],symmetryY:[0,2],symmetryX:[1,2]};

export function frameStiffness(E,I,A,L,G=null,As=null) {
  const a=E*A/L,b=E*I/L**3,phi=G&&As?12*E*I/(G*As*L**2):0,c=1+phi;
  const t12=12*b/c,t6=6*b*L/c,t4=(4+phi)*b*L**2/c,t2=(2-phi)*b*L**2/c;
  return [[a,0,0,-a,0,0],[0,t12,t6,0,-t12,t6],[0,t6,t4,0,-t6,t2],[-a,0,0,a,0,0],[0,-t12,-t6,0,t12,-t6],[0,t6,t2,0,-t6,t4]];
}

// Diagonal scaling keeps mixed translational / rotational units from dominating pivots.
export function linearSolve(K,F) {
  if(!K.length)return [];
  const scales=K.map((r,i)=>Math.sqrt(Math.abs(r[i])));
  if(scales.some(x=>!Number.isFinite(x)||x<1e-15)) throw new Error('The model has an unrestrained degree of freedom. Add supports or connect the loose node.');
  const A=K.map((r,i)=>[...r.map((v,j)=>v/(scales[i]*scales[j])),F[i]/scales[i]]),n=A.length;
  for(let k=0;k<n;k++){
    let p=k;for(let i=k+1;i<n;i++)if(Math.abs(A[i][k])>Math.abs(A[p][k]))p=i;
    if(Math.abs(A[p][k])<1e-11)throw new Error('This structure is unstable or too ill-conditioned to solve. Check supports, disconnected parts and missing truss diagonals.');
    [A[k],A[p]]=[A[p],A[k]];
    for(let i=k+1;i<n;i++){
      const f=A[i][k]/A[k][k];A[i][k]=0;
      for(let j=k+1;j<=n;j++)A[i][j]-=f*A[k][j];
    }
  }
  const q=zeros(n);
  for(let i=n-1;i>=0;i--)q[i]=(A[i][n]-A[i].slice(i+1,n).reduce((s,v,j)=>s+v*q[i+1+j],0))/A[i][i];
  return q.map((v,i)=>v/scales[i]);
}

function transform(c,s){return [[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]];}
function nodeAxes(angle=0){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[c,s,0],[-s,c,0],[0,0,1]];}
function equivalentLoads(member,L){
  const f=zeros(6),loads=member.loads||[];
  if(member.w)loads.push({kind:'udl',value:member.w});
  // The member is cloned by solveModel, so the input model is never modified.
  for(const load of loads){
    const v=finite(Number(load.value),'Member load'),a=finite(load.a??L/2,'Load position'),r=a/L;let v6;
    if(['pl','axial_pl'].includes(load.kind))load.a=a;
    if(member.type==='truss'&&!['axial_udl','axial_pl'].includes(load.kind))throw new Error(`Member ${member.id}: transverse member loads require a frame element.`);
    if(load.kind==='udl')v6=[0,L/2,L*L/12,0,L/2,-L*L/12];
    else if(load.kind==='lvl')v6=load.peak_at===1?[0,7*L/20,L*L/20,0,3*L/20,-L*L/30]:[0,3*L/20,L*L/30,0,7*L/20,-L*L/20];
    else if(load.kind==='pl'){
      if(a<0||a>L)throw new Error(`Member ${member.id}: point load is outside the span.`);
      v6=[0,1-3*r*r+2*r*r*r,L*(r*r*r-2*r*r+r),0,3*r*r-2*r*r*r,L*(r*r*r-r*r)];
    }else if(load.kind==='axial_udl')v6=[L/2,0,0,L/2,0,0];
    else if(load.kind==='axial_pl'){
      if(a<0||a>L)throw new Error(`Member ${member.id}: axial point load is outside the span.`);
      v6=[1-r,0,0,r,0,0];
    }else throw new Error(`Member ${member.id}: unknown load type.`);
    v6.forEach((t,i)=>f[i]+=v*t);
  }
  return {f,loads};
}

export function sampleMember(member,result,t){
  const L=result.length,x=t*L,d=result.localDisplacements,r=t;
  const u=(1-r)*d[0]+r*d[3];
  const v=member.type==='truss'?(1-r)*d[1]+r*d[4]:(1-3*r*r+2*r*r*r)*d[1]+L*(r*r*r-2*r*r+r)*d[2]+(3*r*r-2*r*r*r)*d[4]+L*(r*r*r-r*r)*d[5];
  let shear=result.localForces[1],moment=-result.localForces[2]+shear*x,axial=-result.localForces[0];
  for(const ld of result.loads){
    const w=ld.value;
    if(ld.kind==='udl'){shear+=w*x;moment+=w*x*x/2;}
    if(ld.kind==='lvl'){
      if(ld.peak_at===1){shear+=w*(x-x*x/(2*L));moment+=w*(x*x/2-x*x*x/(6*L));}
      else {shear+=w*x*x/(2*L);moment+=w*x*x*x/(6*L);}
    }
    if(ld.kind==='pl'&&x>=ld.a){shear+=w;moment+=w*(x-ld.a);}
    if(ld.kind==='axial_udl')axial-=w*x;
    if(ld.kind==='axial_pl'&&x>=ld.a)axial-=w;
  }
  const {c,s}=result;
  return {dx:c*u-s*v,dy:s*u+c*v,axial,shear,moment};
}

export function solveModel(input){
  const model=structuredClone(input),nodes=model.nodes,members=model.members;
  if(!Array.isArray(nodes)||!Array.isArray(members)||nodes.length<2||!members.length)throw new Error('Add at least two nodes and one member before analysing.');
  if(nodes.length>80||members.length>160)throw new Error('This browser workspace supports up to 80 nodes and 160 members.');
  const byId=new Map(),usedRot=new Set(),connected=new Set(),ids=new Set();
  nodes.forEach((n,i)=>{
    if(byId.has(n.id))throw new Error('Node identifiers must be unique.');
    finite(n.x,`Node ${n.id} X`);finite(n.y,`Node ${n.id} Y`);
    if(!supports[n.support||'free'])throw new Error(`Node ${n.id}: unknown support.`);
    n.index=i;n.axes=nodeAxes(finite(n.angle||0,`Node ${n.id} support angle`));byId.set(n.id,n);
  });
  let size=nodes.length*3;
  const records=members.map(m=>{
    if(ids.has(m.id))throw new Error('Member identifiers must be unique.');ids.add(m.id);
    if(!['truss','frame'].includes(m.type))throw new Error(`Member ${m.id}: choose truss or frame.`);
    const a=byId.get(m.a),b=byId.get(m.b);
    if(!a||!b)throw new Error(`Member ${m.id} references a missing node.`);
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);
    if(L<1e-6)throw new Error(`Member ${m.id} has zero length.`);
    if(!(finite(m.E,`Member ${m.id} E`)>0&&finite(m.A,`Member ${m.id} area`)>0))throw new Error(`Member ${m.id}: modulus and area must be positive.`);
    if(m.type==='frame'&&!(finite(m.I,`Member ${m.id} I`)>0))throw new Error(`Member ${m.id}: a frame needs positive second moment of area.`);
    if(m.G!=null&&(!(finite(m.G,'Shear modulus')>0)||!(finite(m.As,'Shear area')>0)))throw new Error(`Member ${m.id}: Timoshenko G and shear area must be positive.`);
    connected.add(a.id);connected.add(b.id);
    const map=[a.index*3,a.index*3+1,a.index*3+2,b.index*3,b.index*3+1,b.index*3+2];
    if(m.type==='frame'){
      if(m.pinA)map[2]=size++;else usedRot.add(a.id);
      if(m.pinB)map[5]=size++;else usedRot.add(b.id);
    }
    const c=dx/L,s=dy/L,T=transform(c,s),R=matrix(6);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){R[i][j]=a.axes[j][i];R[i+3][j+3]=b.axes[j][i];}
    const H=multiply(T,R),k=m.type==='frame'?frameStiffness(m.E,m.I,m.A,L,m.G,m.As):matrix(6);
    if(m.type==='truss'){const ea=m.E*m.A/L;k[0][0]=ea;k[3][3]=ea;k[0][3]=-ea;k[3][0]=-ea;}
    const kg=multiply(transpose(H),multiply(k,H)),{f,loads}=equivalentLoads(m,L),fg=mv(transpose(H),f);
    return {m,a,b,L,c,s,map,H,k,kg,f,fg,loads};
  });
  const K=matrix(size),F=zeros(size),fixed=new Set();
  for(const n of nodes){
    if(!connected.has(n.id))throw new Error(`Node ${n.id} is disconnected. Connect it or delete it.`);
    const applied=[n.fx||0,n.fy||0,n.mz||0].map((v,i)=>finite(v,`Node ${n.id} load ${i+1}`));
    if(!usedRot.has(n.id)&&Math.abs(applied[2])>1e-10)throw new Error(`Node ${n.id}: a nodal moment needs a connected frame with an unreleased end.`);
    mv(n.axes,applied).forEach((v,i)=>F[n.index*3+i]+=v);
    (supports[n.support||'free']).forEach(i=>fixed.add(n.index*3+i));
    if(!usedRot.has(n.id))fixed.add(n.index*3+2);
  }
  for(const rec of records)rec.map.forEach((i,a)=>{
    F[i]+=rec.fg[a];rec.map.forEach((j,b)=>K[i][j]+=rec.kg[a][b]);
  });
  const free=Array.from({length:size},(_,i)=>i).filter(i=>!fixed.has(i));
  const reduced=free.map(i=>free.map(j=>K[i][j])),load=free.map(i=>F[i]);
  const qf=linearSolve(reduced,load),q=zeros(size);free.forEach((i,j)=>q[i]=qf[j]);
  const residual=mv(K,q).map((v,i)=>v-F[i]);
  const relativeResidual=norm(free.map(i=>residual[i]))/Math.max(norm(load),1);
  if(relativeResidual>1e-7||q.some(v=>!Number.isFinite(v)))throw new Error('The numerical solve did not converge reliably. Check the model geometry and stiffness values.');
  const nodeResults=nodes.map(n=>{
    const base=n.index*3,displacement=mv(transpose(n.axes),q.slice(base,base+3));
    const reaction=mv(transpose(n.axes),residual.slice(base,base+3).map((v,i)=>fixed.has(base+i)?v:0));
    return {id:n.id,ux:displacement[0],uy:displacement[1],rotation:displacement[2],rx:reaction[0],ry:reaction[1],rm:reaction[2]};
  });
  const memberResults=records.map(rec=>{
    const d=mv(rec.H,rec.map.map(i=>q[i])),forces=mv(rec.k,d).map((v,i)=>v-rec.f[i]);
    const strain=(d[3]-d[0])/rec.L,axial=(forces[3]-forces[0])/2;
    const result={id:rec.m.id,length:rec.L,c:rec.c,s:rec.s,axial,stress:rec.m.E*strain,strain,localDisplacements:d,localForces:forces,loads:rec.loads,maxMoment:0,maxShear:0,maxDeformation:0,maxStress:0};
    for(let i=0;i<=100;i++){const t=sampleMember(rec.m,result,i/100);result.maxStress=Math.max(result.maxStress,Math.abs(t.axial)/rec.m.A);result.maxDeformation=Math.max(result.maxDeformation,Math.hypot(t.dx,t.dy));result.maxMoment=Math.max(result.maxMoment,Math.abs(t.moment));result.maxShear=Math.max(result.maxShear,Math.abs(t.shear));}
    return result;
  });
  return {nodes:nodeResults,members:memberResults,freeDofs:free.length,relativeResidual,stiffness:reduced,load,displacement:qf,maxDisplacement:Math.max(...nodeResults.map(n=>Math.hypot(n.ux,n.uy))),maxDeformation:Math.max(...memberResults.map(m=>m.maxDeformation)),maxStress:Math.max(...memberResults.map(m=>m.maxStress)),strainEnergy:q.reduce((sum,v,i)=>sum+v*(F[i]+residual[i]),0)/2};
}

export function exampleModel(name='bridge'){
  const node=(id,x,y,support='free',fy=0)=>({id,x,y,support,angle:0,fx:0,fy,mz:0});
  const member=(id,a,b,type='truss',more={})=>({id,a,b,type,E:200e9,A:.003,I:8e-6,w:0,...more});
  if(name==='cantilever')return {name:'Cantilever frame',nodes:[node('N1',0,0,'fixed'),node('N2',3,0,'free',-10000)],members:[member('M1','N1','N2','frame')]};
  if(name==='portal')return {name:'Portal frame',nodes:[node('N1',0,0,'fixed'),node('N2',0,3),node('N3',4,3),node('N4',4,0,'fixed')],members:[member('M1','N1','N2','frame'),member('M2','N2','N3','frame',{w:-6000}),member('M3','N3','N4','frame')]};
  if(name==='triangle')return {name:'Triangular truss',nodes:[node('N1',0,0,'pin'),node('N2',4,0,'rollerY'),node('N3',2,2,'free',-20000)],members:[member('M1','N1','N2'),member('M2','N1','N3'),member('M3','N3','N2')]};
  return {name:'Warren bridge truss',nodes:[node('N1',0,0,'pin'),node('N2',2,0,'free',-10000),node('N3',4,0,'free',-10000),node('N4',6,0,'rollerY'),node('N5',1,1.8),node('N6',3,1.8),node('N7',5,1.8)],members:[['N1','N2'],['N2','N3'],['N3','N4'],['N5','N6'],['N6','N7'],['N1','N5'],['N5','N2'],['N2','N6'],['N6','N3'],['N3','N7'],['N7','N4']].map(([a,b],i)=>member(`M${i+1}`,a,b))};
}
