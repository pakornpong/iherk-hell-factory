import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, across } from './industrial-layout.mjs';

const materials=colors({
  frame:['#596975','metal'],zinc:['#9aa6a8','metal'],slate:['#424e55'],blue:['#647f96'],
  amber:['#c29f65'],earth:['#9e8569'],wood:['#a7835e','wood'],gray:['#a4a09a'],
  paper:['#d7cbb1'],red:['#aa6957'],glass:['#8eabb6','glass'],cream:['#d7d1c3'],
});
const forms={
  'cardboard-baler':({e,b,c})=>[
    b(5,7,0,e,24,27,'blue'),b(6,24,4,e-1,25,21,'frame'),b(8,25,7,e-3,25,19,'slate'),
    b(8,25,5,e-3,26,9,'paper'),b(9,25,10,e-4,27,12,'earth'),
    b(8,24,22,e-3,26,24,'zinc'),c(e-4,17,27,31,2,'frame')],
  'glass-color-bin':({e,b,c})=>[
    b(5,7,0,e,24,4,'frame'),...([8,e-9].flatMap((x,i)=>[
      b(x-2,8,5,x+4,23,17,i?'blue':'gray'),b(x-3,7,17,x+5,24,19,'zinc'),
      c(x+1,16,19,19,2,'slate'),b(x-1,23,9,x+3,24,11,'cream')]))],
  'return-can-vending':({e,b,c})=>[
    b(5,7,0,e,24,32,'gray'),b(6,24,4,e-1,25,30,'blue'),
    c(12,21,13,17,4,'slate'),b(8,24,11,16,26,19,'frame'),
    b(9,26,12,15,26,18,'slate'),b(e-12,25,21,e-3,25,26,'glass'),
    b(e-10,25,7,e-4,26,11,'cream')],
  'material-sort-conveyor':({e,b,l})=>[
    b(5,7,0,e,24,5,'blue'),b(6,8,5,e-1,23,6,'slate'),
    ...across(Math.floor((e-7)/4),i=>b(7+4*i,9,6,8+4*i,22,6,'frame')),
    b(8,10,7,13,18,10,'paper'),b(e-11,14,7,e-6,20,8,'glass'),
    l(6,7,6,e-1,7,13,'zinc'),l(6,23,6,e-1,23,13,'zinc')],
  'e-waste-sorting-hutch':({e,b})=>[
    b(5,7,0,e,24,3,'frame'),b(6,8,4,e-1,10,29,'gray'),
    b(7,9,15,e-2,18,16,'zinc'),b(7,21,6,e-2,23,8,'blue'),
    b(8,12,4,16,20,7,'slate'),b(9,12,8,15,18,10,'glass'),
    b(e-12,12,4,e-4,20,8,'paper'),b(e-11,12,8,e-5,15,9,'red')],
  'textile-collection-cage':({e,b})=>[
    b(5,7,0,e,24,5,'frame'),...([6,e-1].flatMap(x=>[8,22].map(y=>b(x,y,5,x+1,y+1,31,'zinc')))),
    b(6,8,30,e,24,31,'zinc'),...across(Math.floor((e-7)/4),i=>b(7+i*4,23,6,7+i*4,23,30,'zinc')),
    b(7,9,5,e-2,22,11,'paper'),b(9,11,11,18,21,17,'blue'),b(e-11,10,11,e-3,21,15,'red')],
  'organic-bin-wheel-pair':({e,b,c})=>[
    ...[9,e-6].flatMap((x,i)=>[c(x,15,0,3,4,'slate'),b(x-3,9,4,x+3,23,19,i?'gray':'blue'),
      b(x-4,8,19,x+4,24,21,'frame'),b(x-2,23,12,x+2,24,14,'cream')])],
  'pallet-of-baled-paper':({e,b})=>[
    ...[8,15,22].map(y=>b(4,y,0,e+1,y+2,2,'wood')),
    b(5,7,3,e,24,4,'wood'),b(6,8,5,e-1,23,18,'paper'),
    ...[9,14,19].map(y=>b(6,y,18,e-1,y,18,'earth')),
    ...[9,e-4].flatMap(x=>[b(x,8,18,x+1,23,19,'blue'),b(x,23,6,x+1,24,18,'blue')])],
  'paint-can-dropoff':({e,b,c})=>[
    b(5,7,0,e,24,3,'frame'),b(6,7,3,e-1,10,26,'gray'),b(7,10,16,e-2,23,17,'zinc'),
    ...[10,17,e-5].flatMap((x,i)=>[c(x,16,4,11,2,i%2?'cream':'red'),c(x,16,11,12,2,'zinc'),
      c(x,16,17,22,2,'gray')])],
  'reusable-crate-wash':({e,b,c,l})=>[
    b(5,7,0,e,24,6,'zinc'),b(6,8,6,e-1,23,7,'glass'),
    b(7,8,7,e-2,10,20,'zinc'),b(7,10,19,e-2,18,21,'zinc'),
    b(10,12,7,19,20,12,'blue'),b(e-10,18,7,e-3,23,11,'blue'),
    c(e-4,12,7,18,1,'frame'),l(e-4,12,18,e-7,17,15,'zinc')],
  'scale-ticket-station':({e,b,c})=>[
    b(5,7,0,e,24,3,'frame'),b(6,8,3,21,23,6,'zinc'),b(8,11,6,18,21,11,'paper'),
    b(e-8,8,3,e-6,10,25,'frame'),b(e-14,8,23,e-3,12,27,'slate'),
    b(e-12,12,24,e-5,12,26,'glass'),c(e-7,16,4,8,2,'red')],
  'reusable-bottle-wash-rack':({e,b,c})=>[
    b(5,7,0,e,24,4,'blue'),b(6,8,4,e-1,10,22,'zinc'),
    b(6,10,15,e-1,23,17,'zinc'),
    ...across(Math.floor((e-7)/5),i=>[c(8+i*5,17,4,11,2,'glass'),
      c(8+i*5,17,11,13,1,'glass'),c(8+i*5,17,17,24,2,'glass')])],
};
const supports={
  'warehouse-footing':w=>({z:3,ops:[B(4,6,0,w-5,25,2,'frame'),B(5,7,2,w-6,24,2,'gray')]}),
  'washdown-pad':w=>({z:5,ops:[B(3,5,0,w-4,26,3,'gray'),B(4,6,4,w-5,25,4,'zinc'),B(5,23,4,w-6,24,4,'slate')]}),
  'industrial-caster':w=>({z:8,ops:[...[6,w-9].flatMap(x=>[7,22].map(y=>B(x,y,0,x+3,y+2,3,'slate'))),
    B(4,6,4,w-5,25,7,'zinc'),B(w-8,7,7,w-5,22,10,'amber')]}),
  'timber-skid':w=>({z:5,ops:[...[7,22].map(y=>B(4,y,0,w-5,y+2,2,'wood')),B(4,6,3,w-5,25,4,'wood')]}),
  'sorting-side-deck':w=>({z:8,ops:[B(4,6,0,w-5,25,4,'frame'),B(5,7,5,w-6,24,7,'gray'),
    B(4,23,5,w-5,25,8,'amber'),B(5,5,5,w-6,7,8,'amber')]}),
};
const designs=[];
for(const [name,build] of Object.entries(forms))for(const [size,w] of [['local',34],['facility',60]]){
  for(const [base,support] of Object.entries(supports)){
    const {z,ops}=support(w);
    const annex=size==='facility'?[B(w-19,12,z+2,w-9,20,z+7,'frame'),B(w-18,12,z+8,w-10,20,z+9,'amber')]:[];
    designs.push(asset(`recycle-${name}-${size}-${base}`,'recycling',w,materials,[...ops,...build(partAt(w,z)),...annex]));
  }
}
await writeFamily('recycling-facility',designs);
