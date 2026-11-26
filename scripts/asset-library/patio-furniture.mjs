import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  oak:['#a87e58','wood'],walnut:['#745743','wood'],stone:['#aaa39a'],cream:['#d8ceba'],
  fabric:['#aa9985'],steel:['#9ca9ab','metal'],frame:['#586671','metal'],
  blue:['#637e94'],red:['#a46454'],clay:['#a9765f'],glass:['#8fadb8','glass'],
  plant:['#6d805f'],earth:['#8a735c'],
});
const patios={
  'adirondack-reading':({b,l,e})=>[
    ...[7,e-2].flatMap(x=>[l(x,7,0,x,13,11,'oak'),l(x,23,0,x,18,11,'oak')]),
    b(6,10,9,e-1,23,12,'oak'),
    ...across(Math.floor((e-7)/4),i=>[l(7+i*4,13,11,7+i*4,7,28,'oak'),
      l(8+i*4,13,11,8+i*4,7,28,'oak')]),
    b(6,12,15,8,22,17,'walnut'),b(e-3,12,15,e-1,22,17,'walnut')],
  'serving-island-grill':({b,e})=>[
    b(5,7,0,e,25,15,'walnut'),b(4,6,15,e+1,25,17,'stone'),
    b(8,9,17,24,20,23,'frame'),...([11,14,17,20].map(x=>b(x,10,23,x,19,23,'steel'))),
    b(8,8,23,24,11,36,'steel'),b(9,11,33,23,14,36,'frame'),
    b(e-10,18,17,e-3,22,19,'oak')],
  'garden-wicker-sofa':({b,e})=>[
    b(5,7,0,e,24,5,'oak'),b(5,7,5,e,10,21,'oak'),b(6,10,5,e-1,23,9,'fabric'),
    b(5,10,6,8,23,16,'oak'),b(e-3,10,6,e,23,16,'oak'),
    ...[10,13,16,19].map(h=>b(6,8,h,e-1,8,h,'walnut')),
    b(8,10,10,14,14,16,'blue'),b(e-11,10,10,e-5,14,16,'cream')],
  'garden-teak-bench':({b,l,e})=>[
    ...[6,e-1].flatMap(x=>[l(x,8,0,x,12,12,'walnut'),l(x,22,0,x,18,12,'walnut')]),
    ...[11,15,19,23].map(y=>b(5,y,11,e,y+2,12,'oak')),
    b(6,8,12,8,10,25,'oak'),b(e-2,8,12,e,10,25,'oak'),
    ...[17,21,25].map(h=>b(6,8,h,e,10,h+1,'oak'))],
  'umbrella-dining-trestle':({b,c,l,e,m})=>[
    b(5,7,0,e,24,3,'oak'),c(m,15,3,15,2,'frame'),c(m,15,15,16,9,'oak'),
    c(m,15,16,43,1,'steel'),...([[m-10,15],[m+10,15],[m,6],[m,24]].map(([x,y])=>l(m,15,43,x,y,34,'cream'))),
    c(m,15,39,43,5,'cream'),c(m,15,35,38,8,'cream'),c(m,15,34,34,10,'blue')],
  'modular-patio-planter-seat':({b,c,e})=>[
    b(5,7,0,e,24,3,'stone'),b(6,8,4,16,23,15,'stone'),b(7,9,15,15,22,15,'earth'),
    c(11,15,15,24,3,'plant'),b(16,9,7,e-1,22,10,'oak'),
    b(e-4,8,4,e-1,23,9,'stone'),b(17,9,10,e-2,12,16,'oak')],
  'swing-bench-pergola':({b,l,e})=>[
    ...[6,e-1].flatMap(x=>[b(x,7,0,x+1,9,37,'oak'),b(x,23,0,x+1,25,37,'oak')]),
    b(5,7,35,e+1,10,37,'oak'),b(5,22,35,e+1,25,37,'oak'),
    ...across(Math.floor((e-7)/5),i=>b(7+i*5,7,37,8+i*5,25,38,'walnut')),
    b(8,11,10,e-3,23,12,'oak'),b(8,10,12,e-3,12,22,'oak'),
    ...[9,e-4].flatMap(x=>[l(x,11,13,x,9,35,'steel'),l(x,22,13,x,22,35,'steel')])],
  'poolside-sunbed':({b,s,e})=>[
    b(5,7,0,e,25,4,'oak'),b(6,8,4,e-1,24,7,'cream'),
    s(6,6,7,e-1,14,22,'-Y','blue'),b(7,15,7,e-2,23,9,'blue'),
    b(8,10,18,e-3,12,20,'cream')],
  'wall-potting-console':({b,c,e})=>[
    b(5,7,0,e,10,31,'oak'),b(5,9,12,e,24,14,'oak'),
    b(5,9,22,e,16,24,'oak'),b(6,9,4,e-1,22,6,'walnut'),
    ...[10,e-5].flatMap((x,i)=>[c(x,15,14,19,3,'clay'),c(x,15,19,22,2,'plant'),
      c(x,12,24,28,2,i?'clay':'cream')])],
  'balcony-breakfast-rail':({b,c,e})=>[
    b(5,7,0,e,9,28,'frame'),b(6,8,22,e-1,22,24,'oak'),
    ...[8,e-3].map(x=>b(x,8,6,x+1,9,27,'steel')),
    c(11,16,24,25,3,'cream'),c(11,16,25,27,2,'cream'),
    c(e-6,16,24,27,2,'glass'),b(e-11,11,24,e-6,12,24,'red')],
};
const pads={
  'stone-paving':w=>({z:3,ops:[B(3,5,0,w-4,26,1,'frame'),B(4,6,2,w-5,25,2,'stone')]}),
  'timber-deck':w=>({z:5,ops:[B(4,6,0,w-5,25,2,'walnut'),...([6,11,16,21].map(y=>B(4,y,3,w-5,y+3,4,'oak')))]}),
  'gardenside-kerb':w=>({z:4,ops:[B(3,5,0,w-4,26,1,'earth'),B(4,6,2,w-5,25,3,'earth'),
    B(4,6,3,w-5,8,3,'plant'),B(4,23,3,w-5,25,3,'stone')]}),
  'resort-platform':w=>({z:7,ops:[B(4,6,0,w-5,25,4,'stone'),B(4,6,5,w-5,25,6,'cream'),
    B(4,24,5,w-5,25,6,'blue')]}),
  'foldable-showroom':w=>({z:6,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'frame'))),
    B(4,6,4,w-5,25,5,'steel'),B(4,24,5,w-5,25,6,'red')]}),
};
const designs=[];
for(const [item,build] of Object.entries(patios))for(const [size,w] of [['compact',34],['wide',58]]){
  for(const [terrain,mount] of Object.entries(pads)){
    if(item==='swing-bench-pergola'&&terrain==='foldable-showroom')continue;
    const {z,ops}=mount(w);
    const side=size==='wide'?[B(w-17,19,z,w-7,24,z+5,'oak'),B(w-16,19,z+5,w-8,24,z+6,'cream')]:[];
    designs.push(asset(`patio-${item}-${size}-${terrain}`,'patio',w,materials,[...ops,...build(partAt(w,z)),...side]));
  }
}
await writeFamily('patio-furniture',designs);
