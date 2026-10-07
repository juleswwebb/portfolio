const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
const progress=document.createElement('div');progress.className='scroll-progress';progress.setAttribute('aria-hidden','true');document.body.prepend(progress);
if(!reduced.matches)document.documentElement.classList.add('motion-enabled');else document.querySelector('#hero-model')?.removeAttribute('auto-rotate');
let pending=false;
const scene=document.querySelector('.system-scroll'),steps=[...document.querySelectorAll('[data-system-step]')],modules=[...document.querySelectorAll('[data-module]')],hero=document.querySelector('.hero'),stage=document.querySelector('.art-stage');
function updateScroll(){
 pending=false;const scroll=window.scrollY,max=document.documentElement.scrollHeight-innerHeight;document.documentElement.style.setProperty('--scroll-progress',Math.max(0,Math.min(1,scroll/Math.max(1,max))));
 if(stage&&!reduced.matches&&scroll<hero.offsetHeight){stage.style.setProperty('--hero-parallax',`${scroll*.05}px`);stage.style.setProperty('--hero-rotate',`${Math.min(5,scroll*.01)}deg`);}
 if(scene){let nearest=0,best=Infinity;const target=innerHeight*(innerWidth<760?.72:.55);steps.forEach((s,i)=>{const r=s.getBoundingClientRect(),distance=Math.abs(r.top+r.height/2-target);if(distance<best){best=distance;nearest=i;}});steps.forEach((s,i)=>s.classList.toggle('is-active',i===nearest));modules.forEach((s,i)=>s.classList.toggle('active',i===nearest));scene.style.setProperty('--system-progress',(nearest+1)/4);document.querySelector('[data-system-number]').textContent=`0${nearest+1} / 04`;}
}
addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(updateScroll);}},{passive:true});addEventListener('resize',updateScroll);updateScroll();
if(fine.matches&&!reduced.matches){
 document.querySelectorAll('.project-card').forEach(card=>{const image=card.querySelector('.project-image');card.addEventListener('pointermove',e=>{const r=image.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;image.style.setProperty('--card-x',`${x*100}%`);image.style.setProperty('--card-y',`${y*100}%`);if(y>=0&&y<=1)image.style.transform=`perspective(1200px) rotateY(${(x-.5)*5}deg) rotateX(${(.5-y)*4}deg) translateY(-3px)`;});card.addEventListener('pointerleave',()=>image.style.transform='');});
 stage?.addEventListener('pointermove',e=>{const r=stage.getBoundingClientRect();stage.style.setProperty('--pointer-x',`${(e.clientX-r.left)/r.width*100}%`);stage.style.setProperty('--pointer-y',`${(e.clientY-r.top)/r.height*100}%`);});
}
const sectionLinks=[...document.querySelectorAll('nav a[href^="#"],nav a[href^="index.html#"]')];
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)sectionLinks.forEach(a=>a.classList.toggle('is-current',a.hash===`#${entry.target.id}`));},{rootMargin:'-20% 0px -60% 0px'});document.querySelectorAll('main>section[id]').forEach(s=>observer.observe(s));}
// A small native canvas gives the hero a technical field without a video download.
const canvas=document.querySelector('#hero-field');let heroVisible=true,sceneVisible=false;
if(canvas&&!reduced.matches){
 const ctx=canvas.getContext('2d');let width=0,height=0,ratio=1;const resize=new ResizeObserver(()=>{width=hero.clientWidth;height=hero.clientHeight;ratio=Math.min(devicePixelRatio||1,2);canvas.width=width*ratio;canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);});resize.observe(hero);
 const visibility=new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;});visibility.observe(hero);
 let last=0;function paint(t){requestAnimationFrame(paint);if(reduced.matches||!heroVisible||document.hidden||t-last<50)return;last=t;ctx.clearRect(0,0,width,height);const spacing=75;
  for(let x=28;x<width;x+=spacing)for(let y=25;y<height;y+=spacing){const a=.2+.15*Math.sin(t*.0005+x*.015+y*.005);ctx.fillStyle=`rgba(160,181,140,${a})`;ctx.fillRect(x,y,1.5,1.5);}
  for(let i=0;i<5;i++){const y=height*(i+1)/6,x=((t*.015+i*width/5)%(width+200))-100;ctx.strokeStyle='rgba(186,160,121,.17)';ctx.beginPath();ctx.moveTo(x-75,y);ctx.lineTo(x,y);ctx.lineTo(x+35,y-35);ctx.lineTo(x+85,y-35);ctx.stroke();ctx.fillStyle='rgba(232,189,133,.6)';ctx.fillRect(x+82,y-37,4,4);}
 }requestAnimationFrame(paint);
}
const particle=document.querySelector('.signal-particle');
if(particle&&!reduced.matches){const visibility=new IntersectionObserver(entries=>{sceneVisible=entries[0].isIntersecting;});visibility.observe(scene);let last=0;function animate(t){requestAnimationFrame(animate);if(reduced.matches||!sceneVisible||document.hidden||t-last<40)return;last=t;const d=(t*.065)%960;let x,y;if(d<300){x=150+d;y=120;}else if(d<480){x=450;y=120+d-300;}else if(d<780){x=450-(d-480);y=300;}else{x=150;y=300-(d-780);}particle.setAttribute('cx',x);particle.setAttribute('cy',y);}requestAnimationFrame(animate);}
