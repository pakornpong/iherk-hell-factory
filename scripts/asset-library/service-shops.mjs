import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  oak:['#a78260','wood'],walnut:['#735744','wood'],steel:['#9da8ab','metal'],
  frame:['#586671','metal'],dark:['#41494f'],ivory:['#d9d1c0'],
  canvas:['#b3a58e'],red:['#a76354'],blue:['#657d94'],brass:['#c0a373','metal'],
  glass:['#8facb6','glass'],stone:['#aaa298'],
});
const departments={
  'key-blank-hook-wall':({e,b,l})=>[
    b(5,7,0,e,24,3,'oak'),b(6,7,4,e-1,10,32,'frame'),
    ...[10,17,24].flatMap(h=>across(Math.floor((e-8)/5),i=>{
      const x=8+i*5;
      return [l(x,10,h+3,x,12,h,'steel'),b(x,12,h-2,x+1,12,h,'brass')];
    })),b(6,7,31,e-1,13,33,'oak')],
  'parts-bin-cashwrap':({e,b})=>[
    b(5,6,0,e,25,16,'oak'),b(5,6,16,e,25,18,'stone'),
    ...[4,9].flatMap(h=>across(Math.floor((e-7)/6),i=>[
      b(7+6*i,25,h,11+6*i,26,h+3,'blue'),b(8+6*i,26,h+1,10+6*i,26,h+2,'ivory')])),
    b(9,9,19,21,18,22,'dark'),b(10,10,22,20,12,26,'glass')],
  'rental-equipment-return':({e,b})=>[
    b(5,7,0,e,24,4,'frame'),b(6,7,5,e-1,10,30,'ivory'),
    b(7,10,5,e-2,22,6,'steel'),b(7,10,15,e-2,22,16,'steel'),
    b(8,12,6,17,21,13,'blue'),b(e-10,11,16,e-3,21,23,'dark'),
    b(7,10,25,e-2,10,28,'red')],
  'bag-repair-intake':({e,b,l})=>[
    b(5,7,0,e,24,4,'oak'),b(6,7,5,e-1,10,28,'walnut'),
    b(9,12,5,18,23,15,'canvas'),b(10,13,15,17,16,17,'dark'),
    b(e-9,10,15,e-2,14,22,'blue'),l(e-8,12,22,e-4,12,27,'steel'),
    b(8,10,23,16,11,26,'ivory')],
  'framing-moulding-sample-fan':({e,b,l})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,5,e-1,10,29,'walnut'),
    ...across(Math.floor((e-7)/4),i=>[
      l(7+i*4,10,9,8+i*4,15,26,i%2?'brass':'oak'),
      l(8+i*4,15,26,10+i*4,18,19,'walnut')]),
    b(8,15,5,e-3,22,7,'ivory')],
  'paint-sample-swing-arms':({e,b,l})=>[
    b(5,7,0,e,24,4,'steel'),b(6,7,4,e-1,9,32,'frame'),
    ...[8,15,e-5].flatMap((x,i)=>[l(x,9,26,x,20,24,'steel'),
      b(x,12,10,x+2,22,23,['blue','ivory','red'][i]),b(x,20,13,x+2,21,16,'canvas')])],
  'glass-display-watch-trays':({e,b,c})=>[
    b(5,7,0,e,24,5,'oak'),b(6,8,5,e-1,9,23,'glass'),
    b(6,9,5,7,23,23,'glass'),b(e-2,9,5,e-1,23,23,'glass'),
    b(6,8,22,e-1,23,23,'glass'),
    ...[11,e-5].map(x=>c(x,16,6,10,2,'brass')),b(8,14,5,e-3,20,6,'canvas')],
  'hardware-bin-tilt-shelf':({e,b,c})=>[
    b(5,7,0,e,24,3,'steel'),b(6,7,4,e-1,10,34,'frame'),
    ...[6,15,24].flatMap(h=>[b(6,9,h,e-1,23,h+1,'steel'),b(7,21,h+1,e-2,23,h+4,'blue'),
      ...[10,16,e-5].map(x=>c(x,19,h+2,h+4,1,'brass'))])],
  'alteration-fitting-mirror':({e,b,l})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,5,e-1,12,38,'walnut'),
    b(7,12,7,e-2,13,37,'glass'),l(9,13,13,e-4,13,34,'ivory'),
    b(8,16,5,16,23,10,'blue'),b(e-8,17,5,e-3,22,8,'canvas')],
  'engraving-sample-station':({e,b,c,l})=>[
    b(5,7,0,e,24,4,'walnut'),b(6,8,5,e-1,12,28,'oak'),
    b(7,11,7,e-2,13,13,'brass'),b(7,11,16,e-2,13,22,'steel'),
    l(9,13,9,e-4,13,10,'dark'),l(9,13,19,e-4,13,19,'blue'),
    c(12,19,5,9,3,'brass'),b(e-10,17,5,e-3,22,6,'ivory')],
  'courier-locker-transfer-bins':({e,b})=>[
    b(5,7,0,e,24,27,'frame'),...across(Math.floor((e-7)/6),i=>[
      b(6+6*i,24,4,10+6*i,25,13,'blue'),b(6+6*i,24,15,10+6*i,25,24,'blue'),
      b(8+6*i,25,8,9+6*i,26,9,'steel'),b(8+6*i,25,19,9+6*i,26,20,'steel')])],
  'cash-counter-feedback-stand':({e,b,c})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,5,e-1,13,17,'ivory'),b(8,13,11,e-3,14,15,'glass'),
    c(10,19,5,6,2,'red'),c(16,19,5,6,2,'blue'),c(e-5,19,5,6,2,'brass'),
    b(7,8,17,e-2,13,19,'walnut')],
};
const counters={
  'inset':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'dark'),B(5,7,1,w-6,24,2,'steel')]}),
  'drawer-counter':w=>({z:13,ops:[B(5,7,0,w-6,24,11,'oak'),B(4,6,11,w-5,25,12,'stone'),
    B(7,24,4,w-8,25,9,'walnut'),B(9,25,7,w-10,26,7,'brass')]}),
  'casters':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'dark'))),
    B(4,6,4,w-5,25,7,'steel'),B(w-7,7,7,w-5,22,11,'frame')]}),
  'workshop-trestle':w=>({z:14,ops:[...[5,w-8].flatMap(x=>[L(x,7,0,x,15,13,'walnut'),L(x,23,0,x,15,13,'walnut')]),
    B(4,6,12,w-5,25,13,'oak'),B(6,8,5,w-7,23,6,'oak')]}),
  'panelled-backline':w=>({z:11,ops:[B(4,5,0,w-5,7,26,'walnut'),B(4,7,9,w-5,25,10,'oak'),
    L(6,7,2,6,22,9,'steel'),L(w-7,7,2,w-7,22,9,'steel')]}),
};
const designs=[];
for(const [role,build] of Object.entries(departments))for(const [size,w] of [['small-shop',34],['store-span',60]]){
  for(const [style,support] of Object.entries(counters)){
    if(role==='alteration-fitting-mirror'&&style==='casters')continue;
    const {z,ops}=support(w);
    const secondary=size==='store-span'?[B(w-20,15,z+4,w-8,23,z+10,'oak'),
      B(w-19,16,z+10,w-9,22,z+11,'canvas'),B(w-15,17,z+11,w-11,20,z+13,'ivory')]:[];
    designs.push(asset(`service-shop-${role}-${size}-${style}`,'service-retail',w,materials,[...ops,...build(partAt(w,z)),...secondary]));
  }
}
await writeFamily('service-shops',designs);
