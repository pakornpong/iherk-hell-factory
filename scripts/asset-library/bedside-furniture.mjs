import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, round as C } from './industrial-layout.mjs';

const materials=colors({
  oak:['#ac825d','wood'],walnut:['#795b47','wood'],linen:['#b5a18d'],paper:['#e0d4bf'],
  cream:['#d1c6b2'],blue:['#637b90'],iron:['#535f67','metal'],steel:['#9da8a9','metal'],
  brass:['#bda271','metal'],glass:['#91acb5','glass'],brick:['#aa695c'],marble:['#aaa39a'],
});
const fixtures={
  'single-drawer-book-cubby':({b,e})=>[
    b(5,7,0,e,24,3,'walnut'),b(5,7,3,7,24,20,'oak'),b(e-2,7,3,e,24,20,'oak'),
    b(5,7,19,e,24,21,'oak'),b(7,8,12,e-2,23,13,'oak'),
    b(7,23,14,e-2,24,18,'walnut'),b(11,24,17,17,25,17,'brass'),
    b(9,11,4,16,21,7,'blue'),b(10,12,8,17,20,10,'paper')],
  'two-door-vintage-nightstand':({b,e,m})=>[
    b(5,6,0,e,24,21,'walnut'),b(6,24,3,m-1,25,19,'oak'),b(m+1,24,3,e-1,25,19,'oak'),
    b(m-4,25,9,m-3,26,13,'brass'),b(m+2,25,9,m+3,26,13,'brass'),
    b(4,5,20,e+1,25,22,'marble')],
  'open-shelf-and-tissue':({b,e})=>[
    b(5,7,0,7,24,22,'steel'),b(e-2,7,0,e,24,22,'steel'),
    ...[1,10,21].map(h=>b(6,8,h,e-1,23,h+1,'oak')),
    b(8,10,3,15,20,6,'cream'),b(10,13,6,12,14,9,'paper'),
    b(9,10,12,17,19,15,'blue')],
  'fluted-vanity-drawers':({b,e})=>[
    b(5,7,0,e,24,23,'oak'),b(6,24,4,e-1,25,10,'walnut'),b(6,24,12,e-1,25,19,'walnut'),
    ...Array.from({length:Math.floor((e-8)/3)},(_,i)=>b(7+i*3,25,4,7+i*3,25,19,'oak')),
    b(9,26,8,16,26,9,'brass'),b(9,26,16,16,26,17,'brass'),
    b(4,6,22,e+1,25,24,'marble')],
  'lamp-niche-tower':({b,c,e})=>[
    b(5,6,0,e,9,37,'oak'),b(5,9,0,7,24,37,'oak'),b(e-2,9,0,e,24,37,'oak'),
    b(5,9,35,e,24,37,'oak'),b(5,9,14,e,24,16,'oak'),b(5,9,0,e,24,2,'oak'),
    c(12,15,16,18,4,'brass'),c(12,15,18,24,1,'brass'),c(12,15,24,30,5,'cream'),
    b(9,13,3,17,21,6,'paper')],
  'cantilever-breakfast-tray':({b,l,e})=>[
    b(5,7,0,11,24,3,'steel'),b(6,7,3,8,24,21,'steel'),
    b(6,8,19,e,23,21,'oak'),b(7,9,21,e-1,22,21,'linen'),
    l(7,10,8,14,10,19,'steel'),l(7,22,8,14,22,19,'steel'),
    b(10,12,22,18,19,23,'paper')],
  'bedding-chest-lift-top':({b,e})=>[
    b(5,7,0,e,24,16,'walnut'),b(6,24,3,e-1,25,14,'oak'),
    b(5,7,15,e,11,21,'oak'),b(6,11,16,e-1,14,20,'oak'),
    b(8,13,14,18,22,17,'linen'),b(10,14,17,18,21,20,'cream'),
    b(11,25,10,17,26,11,'brass')],
  'window-low-bookshelf':({b,e})=>[
    b(5,7,0,e,24,3,'oak'),b(5,7,3,7,24,21,'oak'),b(e-2,7,3,e,24,21,'oak'),
    b(5,7,20,e,24,22,'oak'),b(6,8,11,e-1,23,12,'oak'),
    ...Array.from({length:Math.floor((e-9)/4)},(_,i)=>b(8+i*4,12,3,10+i*4,21,8+i%2,i%2?'brick':'blue')),
    b(9,12,13,16,19,15,'paper'),b(9,13,15,14,19,17,'blue')],
  'linen-folding-step':({b,e})=>[
    b(5,7,0,e,24,4,'oak'),b(5,7,4,e,19,8,'oak'),b(5,7,8,e,14,13,'oak'),
    b(7,15,8,15,21,10,'linen'),b(8,16,10,14,20,12,'cream'),
    b(e-10,8,13,e-2,13,16,'blue')],
  'bedside-charging-shelf':({b,l,c,e})=>[
    b(5,7,0,8,11,25,'iron'),b(e-3,7,0,e,11,25,'iron'),b(5,8,18,e,24,21,'oak'),
    b(6,8,21,e-1,11,25,'walnut'),b(9,13,21,16,21,22,'blue'),
    b(10,14,22,15,20,22,'glass'),l(13,15,22,13,9,22,'steel'),
    c(e-5,16,22,23,2,'brass')],
};
const fixturesBase={
  'recessed-plinth':w=>({z:4,ops:[B(5,7,0,w-6,24,2,'walnut'),B(4,6,3,w-5,25,3,'oak')]}),
  'brass-sled':w=>({z:7,ops:[...[6,w-9].flatMap(x=>[
    B(x,7,0,x+1,24,1,'brass'),B(x,7,1,x+1,8,6,'brass'),B(x,23,1,x+1,24,6,'brass')])]}),
  'outward-legs':w=>({z:8,ops:[...[7,w-10].flatMap(x=>[8,22].map(y=>L(x+(x<15?-2:2),y+(y<15?-2:2),0,x,y,7,'walnut'))),
    B(4,6,7,w-5,25,7,'oak')]}),
  'floating-backboard':w=>({z:10,ops:[
    B(4,5,0,w-5,7,31,'linen'),B(5,8,8,w-6,24,9,'oak'),L(6,7,3,6,22,8,'steel')]}),
  'hidden-caster':w=>({z:7,ops:[
    ...[6,w-9].flatMap(x=>[8,21].map(y=>C(x,y,0,3,2,'iron'))),
    B(4,6,4,w-5,25,6,'walnut'),B(5,7,6,w-6,24,6,'oak')]}),
};
const designs=[];
for(const [name,build] of Object.entries(fixtures))for(const [size,w] of [['bedside',32],['wide-suite',60]]){
  for(const [base,support] of Object.entries(fixturesBase)){
    if(name==='linen-folding-step'&&base==='floating-backboard')continue;
    const {z,ops}=support(w);
    const extra=size==='wide-suite'?[B(w-20,9,z+3,w-8,21,z+6,'walnut'),B(w-19,10,z+7,w-9,20,z+8,'linen')]:[];
    designs.push(asset(`bedroom-${name}-${size}-${base}`,'bedroom',w,materials,[...ops,...build(partAt(w,z)),...extra]));
  }
}
await writeFamily('bedside-furniture',designs);
