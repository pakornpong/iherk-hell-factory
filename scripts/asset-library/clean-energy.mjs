import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  steel:['#9ea8aa','metal'],frame:['#566674','metal'],blue:['#587287'],
  slate:['#424b51'],tan:['#ac9679'],cream:['#d9d3c7'],
  anodized:['#8798a2','metal'], amber:['#b89b65'],earth:['#8b755d'],
  oak:['#9d7e60','wood'],copper:['#b37e61','metal'],glass:['#91aeb7','glass'],
});

const units={
  'panel-rack':({e,b,l})=>[
    ...[8,e-3].flatMap(x=>[l(x,8,3,x,19,17,'steel'),l(x,21,3,x,14,23,'steel')]),
    ...across(11,i=>b(6,9+i,17+Math.floor(i/2),e,9+i,18+Math.floor(i/2),i%3===0?'anodized':'blue')),
    ...across(Math.floor((e-8)/6),i=>l(7+i*6,9,18,7+i*6,19,23,'steel'))],
  'charging-gantry':({e,b,c,l})=>[
    b(6,7,0,8,10,34,'frame'),b(e-2,7,0,e,10,34,'frame'),b(6,7,32,e,11,34,'frame'),
    b(7,8,34,e-1,23,36,'steel'),...([11,e-6].flatMap(x=>[
      b(x-3,9,3,x+3,13,23,'cream'),b(x-1,13,16,x+1,14,20,'glass'),
      l(x+2,13,18,x+4,19,8,'slate'),c(x+4,19,7,9,1,'slate')]))],
  'battery-storage-pod':({e,b})=>[
    b(5,7,0,e,24,28,'cream'),b(6,24,3,e-1,25,26,'frame'),
    ...across(Math.floor((e-7)/6),i=>[b(7+i*6,25,4,11+i*6,26,25,'steel'),
      b(8+i*6,26,16,10+i*6,26,18,'blue')]),
    b(6,8,28,e-1,23,31,'steel'),b(7,9,31,14,19,34,'frame')],
  'wind-turbine-model':({m,b,c,l})=>[
    c(m,14,0,2,6,'frame'),c(m,14,3,39,2,'cream'),b(m-3,13,39,m+3,19,44,'cream'),
    c(m,17,41,42,2,'steel'),l(m,18,41,m,18,56,'steel'),l(m,18,41,m-10,18,32,'cream'),
    l(m,18,41,m+10,18,32,'cream'),b(m-1,17,49,m+1,18,57,'cream')],
  'vertical-axis-turbine':({m,c,l})=>[
    c(m,15,0,3,7,'frame'),c(m,15,4,48,2,'steel'),
    ...[[m-7,14],[m+5,9],[m+6,20]].flatMap(([x,y],i)=>[
      l(m,15,12,x,y,12,'frame'),l(m,15,44,x,y,44,'frame'),
      l(x,y,12,x+(i%2?2:-1),y+2,27,'anodized'),l(x+(i%2?2:-1),y+2,27,x,y,44,'anodized')])],
  'heat-pump-compressor':({e,b,c,l})=>[
    b(5,7,0,e,24,22,'cream'),b(6,24,2,e-1,25,20,'steel'),
    ...[6,10,14,18].map(h=>b(8,25,h,e-3,25,h,'frame')),
    ...[11,e-6].flatMap(x=>[c(x,15,22,23,4,'slate'),c(x,15,23,23,2,'steel')]),
    l(e-3,24,6,e,27,5,'copper'),l(e,27,5,e,27,12,'copper')],
  'microhydro-waterwheel':({m,e,b,c,l})=>[
    b(5,6,0,e,25,3,'frame'),b(7,9,3,e-2,17,5,'glass'),b(7,8,4,e-2,9,19,'steel'),
    c(m,14,5,21,7,'frame'),c(m,14,20,22,4,'steel'),
    ...[8,12,16,20].map(k=>b(m-3,20,k,m+5,23,k+1,'anodized')),
    b(e-8,20,5,e-1,24,11,'blue'),l(m+5,18,13,e-5,22,11,'steel')],
  'ev-battery-cradle':({e,b,l})=>[
    b(5,7,0,e,24,4,'frame'),b(6,8,5,e-1,23,8,'steel'),
    ...across(Math.floor((e-8)/5),i=>b(8+i*5,9,9,10+i*5,22,10,'anodized')),
    b(6,8,11,8,23,14,'frame'),b(e-3,8,11,e-1,23,14,'frame'),
    l(9,13,10,12,22,12,'amber'),l(e-6,11,10,e-4,20,11,'copper')],
  'island-control-monitor':({e,b,l})=>[
    b(5,7,0,e,24,4,'frame'),b(6,7,5,e-1,11,23,'cream'),
    b(8,11,9,e-3,11,20,'glass'),l(10,11,12,e-5,11,18,'blue'),
    b(8,14,5,e-3,21,7,'steel'),b(e-6,15,7,e-4,18,8,'amber')],
  'solar-thermal-cylinders':({e,b,c,l})=>[
    b(5,7,0,e,24,4,'frame'),...([12,e-6].flatMap(x=>[c(x,14,5,24,5,'cream'),c(x,14,24,26,4,'steel'),
      c(x,14,27,30,1,'copper'),l(x,14,29,x,8,31,'copper')])),
    b(12,8,31,e-6,9,32,'copper'),b(9,20,6,e-3,22,8,'steel')],
};
const mounts={
  'ballast-roof':w=>({z:4,ops:[B(3,5,0,w-4,26,2,'slate'),...([5,w-11].map(x=>B(x,7,2,x+6,24,3,'steel')))]}),
  'ground-rail':w=>({z:4,ops:[B(3,5,0,w-4,26,1,'earth'),B(4,6,2,w-5,8,3,'steel'),B(4,22,2,w-5,24,3,'steel')]}),
  'service-deck':w=>({z:8,ops:[B(4,6,0,w-5,25,3,'frame'),B(5,7,4,w-6,24,7,'steel'),
    B(6,23,7,w-7,25,7,'amber'),L(5,7,2,w-6,7,7,'blue')]}),
  'trailer-bed':w=>({z:8,ops:[...[6,w-10].flatMap(x=>[6,22].map(y=>B(x,y,0,x+3,y+2,4,'slate'))),
    B(4,6,4,w-5,25,7,'frame'),B(w-6,13,4,w-1,16,6,'amber')]}),
  'timber-test-plinth':w=>({z:6,ops:[B(4,6,0,w-5,25,2,'frame'),
    ...[6,11,16,21].map(y=>B(4,y,3,w-5,y+3,5,'oak'))]}),
};
const designs=[];
for(const [unit,make] of Object.entries(units)) for(const [layout,w] of [['field',34],['facility',60]]){
  for(const [base,mount] of Object.entries(mounts)){
    const {z,ops}=mount(w);
    const extra=layout==='facility'?[
      B(w-18,18,z+2,w-8,24,z+8,'frame'),B(w-17,24,z+5,w-9,24,z+6,'glass'),
      L(w-15,20,z+7,w-19,17,z+12,'copper')]:[];
    designs.push(asset(`energy-${unit}-${layout}-${base}`,'renewable-energy',w,materials,[...ops,...make(partAt(w,z)),...extra]));
  }
}
await writeFamily('clean-energy',designs);
