import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L } from './industrial-layout.mjs';

const materials=colors({
  oak:['#aa8560','wood'],ice:['#b8c6c9'],snow:['#dfdfd4'],steel:['#9ba8ac','metal'],
  frame:['#5c6873','metal'],rubber:['#40484e'], sand:['#ae9d83'],blue:['#668096'],
  red:['#a76555'],gold:['#c0a46e'],cloth:['#aba08f'],glass:['#91abb5','glass'],
});
const gear={
  'ski-rental-upright-rack':({e,b,l})=>[
    b(5,7,0,e,24,3,'oak'),b(5,7,4,e,9,34,'oak'),
    b(6,9,17,e-1,14,19,'steel'),
    ...[9,15,e-4].flatMap((x,i)=>[
      l(x,13,4,x,10,35,i%2?'blue':'red'),l(x+2,13,4,x+2,10,36,i%2?'blue':'red'),
      b(x,12,16,x+2,14,18,'rubber')])],
  'snowboard-benching-clamps':({e,b,l})=>[
    ...[6,e-1].flatMap(x=>[l(x,8,0,x,15,12,'steel'),l(x,23,0,x,15,12,'steel')]),
    b(5,7,12,e,24,14,'oak'),b(7,13,15,e-2,17,16,'blue'),b(10,12,16,13,18,18,'rubber'),
    b(e-8,12,16,e-5,18,18,'rubber'),b(7,11,14,8,20,18,'steel'),b(e-3,11,14,e-2,20,18,'steel')],
  'winter-boot-dryer-locker':({e,b,c})=>[
    b(5,7,0,e,24,4,'frame'),b(6,7,4,e-1,10,28,'steel'),b(6,9,16,e-1,23,17,'steel'),
    ...[10,17,e-5].flatMap((x,i)=>[
      c(x,14,5,10,2,'steel'),b(x-2,11,10,x+2,21,12,'rubber'),
      b(x-2,11,12,x+2,15,19,i%2?'red':'blue'),b(x-2,11,19,x+2,15,20,'cloth')])],
  'ice-rink-scraper-cart':({e,b,l})=>[
    b(5,7,0,e,24,6,'blue'),b(6,8,7,15,20,14,'blue'),b(7,9,14,14,17,15,'rubber'),
    b(e-9,8,7,e-1,22,13,'steel'),b(e-9,18,4,e,24,7,'steel'),
    l(9,12,8,16,11,22,'steel'),b(14,9,22,20,13,23,'rubber')],
  'compact-snowblower':({e,b,c,l})=>[
    b(6,8,0,e-4,23,6,'frame'),c(9,9,0,7,3,'rubber'),c(9,22,0,7,3,'rubber'),
    b(8,9,6,18,21,14,'red'),b(e-9,8,4,e-1,23,13,'red'),
    b(e-8,9,5,e,22,10,'rubber'),c(e-7,14,13,24,2,'red'),
    l(e-7,14,24,e-5,18,25,'red'),l(9,10,10,6,9,26,'steel'),l(9,20,10,6,22,26,'steel'),
    b(5,9,25,7,22,26,'rubber')],
  'field-avalanche-safety-post':({e,m,b,c})=>[
    c(m,14,0,3,7,'frame'),c(m,14,3,32,1,'steel'),
    b(m-7,13,18,m+7,16,27,'red'),b(m-5,16,20,m+5,16,25,'snow'),
    b(m-1,16,21,m+1,16,24,'red'),b(e-8,18,0,e-3,24,8,'blue')],
  'wood-sled-and-rope':({e,b,l})=>[
    ...[8,22].flatMap(y=>[b(7,y,0,e-1,y+1,2,'steel'),l(6,y,4,9,y,1,'steel')]),
    b(8,8,3,e-2,23,6,'oak'),...([10,15,20].map(y=>b(7,y,6,e-3,y+1,7,'sand'))),
    l(7,10,4,4,15,9,'cloth'),l(4,15,9,7,21,4,'cloth')],
  'glove-warming-lockers':({e,b,c})=>[
    b(5,7,0,e,24,28,'steel'),b(6,24,4,e-1,25,25,'blue'),
    ...[8,15,22].map(h=>b(7,25,h,e-2,25,h,'frame')),
    ...[10,17,e-5].flatMap(x=>[b(x-1,25,9,x+2,26,12,'cloth'),c(x,26,15,17,1,'gold')]),
    b(7,8,28,e-2,24,30,'steel')],
  'ice-rescue-ring-rack':({e,m,b,c,l})=>[
    b(5,7,0,e,24,3,'frame'),b(6,8,4,8,11,31,'steel'),b(e-3,8,4,e-1,11,31,'steel'),
    b(6,8,30,e-1,11,32,'steel'),...([13,18,23].map(h=>b(m-5,11,h,m+5,12,h+2,'red'))),
    b(m-6,11,13,m-4,12,24,'red'),b(m+4,11,13,m+6,12,24,'red'),
    c(e-6,20,4,7,3,'cloth'),l(e-6,18,7,e-5,12,15,'cloth')],
  'insulated-lodge-drink-station':({e,b,c})=>[
    b(5,7,0,e,24,3,'oak'),c(12,14,4,22,6,'steel'),c(12,14,23,24,5,'rubber'),
    c(12,14,25,27,1,'steel'),b(11,18,12,13,21,13,'rubber'),
    ...[10,19].map(y=>c(e-5,y,4,8,2,'snow'))],
  'frosted-salt-bin-and-scoop':({e,b,l})=>[
    b(5,7,0,e,24,14,'blue'),b(5,7,14,e,10,17,'steel'),
    b(6,10,14,e-1,22,14,'sand'),b(6,22,14,e-1,24,17,'steel'),
    l(10,14,15,e-3,20,19,'steel'),b(9,13,14,15,18,16,'frame')],
};
const pads={
  'snowpack':w=>({z:3,ops:[B(3,5,0,w-4,26,1,'sand'),B(4,6,2,w-5,25,2,'snow')]}),
  'ice-deck':w=>({z:4,ops:[B(4,6,0,w-5,25,2,'ice'),B(5,7,3,w-6,24,3,'glass'),B(6,24,3,w-7,25,3,'snow')]}),
  'lodge-boardwalk':w=>({z:5,ops:[B(4,6,0,w-5,25,2,'frame'),...([6,11,16,21].map(y=>B(4,y,3,w-5,y+3,4,'oak')))]}),
  'service-cart':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,4,'rubber'))),
    B(4,6,4,w-5,25,7,'steel'),B(w-7,7,7,w-5,23,10,'red')]}),
  'gritted-step':w=>({z:6,ops:[B(3,5,0,w-4,26,2,'frame'),B(4,6,3,w-5,25,5,'sand'),
    B(5,23,5,w-6,25,5,'gold')]}),
};
const designs=[];
for(const [item,build] of Object.entries(gear))for(const [size,w] of [['compact',34],['lodge-wide',60]]){
  for(const [site,mount] of Object.entries(pads)){
    if(item==='compact-snowblower'&&site==='service-cart')continue;
    const {z,ops}=mount(w);
    const addon=size==='lodge-wide'?[B(w-18,14,z+2,w-8,23,z+9,'blue'),
      B(w-17,14,z+9,w-9,23,z+11,'cloth'),L(w-13,17,z+11,w-8,20,z+17,'steel')]:[];
    designs.push(asset(`winter-${item}-${size}-${site}`,'winter-service',w,materials,[...ops,...build(partAt(w,z)),...addon]));
  }
}
await writeFamily('winter-service',designs);
