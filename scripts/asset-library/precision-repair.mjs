import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  oak:['#aa815e','wood'], walnut:['#755847','wood'], frame:['#596673','metal'],
  steel:['#a0a9aa','metal'], black:['#3d464b'], paper:['#dfd3ba'],
  cloth:['#a6937d'],glass:['#8fabb5','glass'],blue:['#627b91'],
  brass:['#b99b68','metal'],red:['#a06254'],copper:['#ab795d','metal'],
});
const units={
  'watchmakers-magnifier':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'oak'),c(14,16,4,5,6,'cloth'),c(14,16,5,7,4,'steel'),
    c(14,16,7,7,3,'paper'),l(14,16,7,15,15,7,'black'),b(12,17,6,16,20,6,'copper'),
    c(e-4,10,4,6,3,'frame'),l(e-4,10,6,e-4,14,24,'steel'),
    b(e-8,13,22,e-2,18,24,'frame'),b(e-7,14,23,e-3,17,23,'glass')],
  'clock-movement-jig':({b,c,l,e,m})=>[
    b(5,7,0,e,24,4,'walnut'),b(6,7,4,8,21,24,'oak'),b(e-3,7,4,e-1,21,24,'oak'),
    b(6,8,22,e-1,11,24,'oak'),b(m-5,11,9,m+5,13,20,'brass'),
    c(m,13,14,15,2,'steel'),l(m,13,11,m,13,4,'steel'),c(m,13,4,5,2,'brass'),
    b(9,17,4,e-4,20,5,'cloth')],
  'precision-solder-fume-bench':({b,l,e})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,5,e-1,22,6,'blue'),b(9,10,6,17,18,7,'copper'),
    b(10,11,7,13,14,8,'black'),l(14,17,7,20,10,15,'steel'),
    b(e-9,8,5,e-2,13,17,'frame'),b(e-8,13,10,e-3,18,17,'black'),
    b(e-7,18,11,e-4,18,16,'steel')],
  'small-optics-alignment-rail':({b,c,e})=>[
    b(5,7,0,e,24,4,'frame'),b(6,10,4,e-1,12,5,'steel'),
    b(6,19,4,e-1,21,5,'steel'),
    ...[10,17,e-5].flatMap((x,i)=>[c(x,16,5,9+i,1,'steel'),
      b(x-2,14,10+i,x+2,17,14+i,'frame'),b(x-1,17,11+i,x+1,17,13+i,'glass')])],
  'phone-screen-repair-press':({b,c,l,e,m})=>[
    b(5,7,0,e,24,4,'frame'),b(6,8,5,8,23,24,'steel'),b(e-3,8,5,e-1,23,24,'steel'),
    b(6,8,22,e-1,23,24,'blue'),c(m,15,15,23,1,'steel'),b(m-5,11,13,m+5,20,15,'blue'),
    b(m-4,11,5,m+4,20,7,'glass'),l(m,15,24,e-3,19,28,'steel')],
  'camera-lens-opening-collar':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'oak'),c(13,15,5,8,6,'frame'),c(13,15,9,14,5,'black'),
    c(13,15,14,14,4,'glass'),c(e-5,16,4,6,3,'steel'),c(e-5,16,6,6,2,null),
    l(17,10,5,e-3,11,6,'steel'),b(e-9,19,4,e-4,22,5,'cloth')],
  'small-parts-sieve-and-cups':({b,c,e})=>[
    b(5,7,0,e,24,4,'walnut'),b(6,8,5,e-1,23,6,'paper'),
    c(13,15,6,8,5,'steel'),c(13,15,8,8,4,'frame'),
    ...[11,19].flatMap(y=>[c(e-6,y,6,9,2,'glass'),c(e-6,y,9,9,1,null)]),
    ...[9,13,17].map(x=>c(x,21,6,7,1,'brass'))],
  'hearing-aid-drying-dock':({b,c,e})=>[
    b(5,7,0,e,24,4,'steel'),b(7,9,5,e-2,20,10,'paper'),
    b(7,8,10,e-2,10,22,'blue'),b(8,10,10,e-3,13,13,'glass'),
    ...[11,e-6].flatMap((x,i)=>[c(x,16,10,12,2,'cloth'),b(x,16,12,x+3,17,13,'steel'),
      c(x,18,10,11,1,i?'blue':'red')])],
  'craft-knife-sharpening-jig':({b,l,e})=>[
    b(5,7,0,e,24,4,'oak'),b(7,9,5,e-2,21,7,'frame'),
    b(8,11,8,18,19,10,'blue'),b(e-9,10,7,e-3,15,15,'steel'),
    l(e-6,13,14,12,17,10,'steel'),b(10,16,10,14,18,10,'black')],
  'headphone-driver-test-rig':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,5,e-1,11,22,'frame'),
    b(8,11,13,e-3,11,19,'glass'),b(9,11,15,e-4,11,16,'paper'),
    ...[12,e-5].map(x=>c(x,17,5,9,3,'black')),l(15,19,5,e-5,20,5,'copper')],
};
const benches={
  'tabletop-repair':w=>({z:3,ops:[B(4,6,0,w-5,25,2,'frame')]}),
  'drawer-bench':w=>({z:13,ops:[B(5,7,0,w-6,24,11,'walnut'),B(4,6,11,w-5,25,12,'oak'),
    B(6,24,4,w-7,25,9,'cloth'),B(9,25,7,w-10,26,7,'brass')]}),
  'cart-deck':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'black'))),
    B(4,6,4,w-5,25,7,'steel'),B(w-7,7,7,w-5,23,10,'blue')]}),
  'wall-tool-rail':w=>({z:11,ops:[B(4,5,0,w-5,7,32,'cloth'),B(4,7,9,w-5,25,10,'oak'),
    B(5,7,24,w-6,8,25,'steel'),L(6,7,3,6,22,9,'frame')]}),
  'trestle-tool-bench':w=>({z:14,ops:[...[5,w-8].flatMap(x=>[L(x,7,0,x,15,13,'frame'),L(x,23,0,x,15,13,'frame')]),
    B(4,6,12,w-5,25,13,'oak'),B(6,8,5,w-7,24,6,'walnut')]}),
};
const designs=[];
for(const [unit,build] of Object.entries(units))for(const [size,w] of [['compact',34],['full-worktop',60]]){
  for(const [mount,support] of Object.entries(benches)){
    const {z,ops}=support(w);
    const taskCase=size==='full-worktop'?[B(w-18,9,z+4,w-8,20,z+10,'black'),
      B(w-17,10,z+10,w-9,19,z+11,'cloth'),B(w-15,12,z+11,w-10,15,z+12,'steel')]:[];
    designs.push(asset(`precision-${unit}-${size}-${mount}`,'precision-repair',w,materials,
      [...ops,...build(partAt(w,z)),...taskCase]));
  }
}
await writeFamily('precision-repair',designs);
