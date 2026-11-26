import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  oak:['#a3805e','wood'],tan:['#ae987d'],linen:['#d2c7af'],blue:['#627b90'],
  rust:['#a86955'],olive:['#737f64'],steel:['#9ca8aa','metal'],iron:['#596771','metal'],
  rubber:['#414a4f'], sand:['#bdab8b'],earth:['#8b755d'],glass:['#8daab8','glass'],
});
const gear={
  'ridge-tent':({e,m,b,l,s})=>[
    b(5,7,0,e,25,2,'tan'),s(5,7,2,m,24,27,'+X','linen'),s(m,7,2,e,24,27,'-X','olive'),
    b(m-2,24,2,m+2,25,13,'rubber'),l(m,7,27,m,4,0,'iron'),l(m,24,27,m,28,0,'iron')],
  'offset-tarp-shelter':({e,b,l})=>[
    b(6,7,0,8,9,32,'steel'),b(e-2,7,0,e,9,32,'steel'),b(6,24,0,7,25,16,'steel'),
    b(e-1,24,0,e,25,16,'steel'),
    ...across(16,i=>b(6,8+i,31-i,e,8+i,32-i,'blue')),
    l(6,7,31,3,6,0,'iron'),l(e,7,31,e+2,6,0,'iron')],
  'folding-cot':({e,b,l})=>[
    ...[7,e-2].flatMap(x=>[l(x,8,0,x,23,11,'steel'),l(x,23,0,x,8,11,'steel')]),
    b(5,7,11,e,24,13,'tan'),b(6,8,13,14,23,15,'linen'),
    b(14,8,13,e-1,23,16,'blue'),b(8,8,14,13,22,17,'linen')],
  'camp-cook-box':({e,b,c})=>[
    b(5,8,0,e,24,8,'iron'),b(5,8,8,e,11,20,'olive'),b(5,11,18,e,13,20,'olive'),
    c(12,16,8,9,4,'rubber'),c(e-6,16,8,9,4,'rubber'),c(12,16,10,15,4,'steel'),
    c(12,16,15,16,3,'steel'),b(e-8,23,5,e-4,24,7,'rust')],
  'lantern-and-water-jug':({e,b,c,l})=>[
    b(5,7,0,e,24,3,'oak'),c(11,15,4,7,4,'iron'),c(11,15,7,16,3,'glass'),
    c(11,15,16,19,4,'iron'),l(8,15,18,11,15,24,'steel'),l(11,15,24,14,15,18,'steel'),
    b(e-9,10,4,e-1,21,16,'blue'),b(e-7,12,16,e-3,16,18,'steel'),b(e-8,21,7,e-3,24,8,'iron')],
  'bear-box-and-daypack':({e,b,l})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,16,22,13,'iron'),b(5,7,13,17,23,15,'steel'),
    b(8,23,9,14,24,11,'iron'),b(e-10,11,4,e-2,22,20,'olive'),
    b(e-9,21,6,e-3,23,14,'tan'),l(e-8,12,20,e-4,12,23,'iron')],
  'canoe-portage-rack':({e,b,l})=>[
    ...[7,e-2].flatMap(x=>[l(x,8,0,x,14,14,'oak'),l(x,23,0,x,18,14,'oak')]),
    b(7,12,12,e-2,19,14,'rust'),b(5,11,14,e,20,16,'rust'),
    b(6,11,16,e-1,12,18,'linen'),b(6,19,16,e-1,20,18,'linen'),
    b(8,13,16,e-3,18,16,'oak'),b(11,13,16,13,18,18,'oak')],
  'portable-camp-kitchen':({e,b,c,l})=>[
    b(5,7,0,e,24,3,'oak'),...([6,e-1].flatMap(x=>[l(x,8,3,x,22,15,'steel'),l(x,22,3,x,8,15,'steel')])),
    b(5,8,14,e,23,16,'oak'),c(12,15,16,20,3,'steel'),b(15,14,17,18,16,18,'iron'),
    b(e-9,10,16,e-2,21,17,'tan'),b(e-8,13,17,e-3,19,18,'linen')],
  'gear-drying-tripod':({e,m,b,l})=>[
    ...[[6,24],[e-1,24],[m,6]].map(([x,y])=>l(m,14,36,x,y,0,'oak')),
    b(7,14,26,e-2,15,27,'oak'),b(9,14,12,15,16,26,'blue'),
    b(e-11,14,16,e-5,16,26,'rust'),b(9,20,0,14,24,4,'iron')],
  'camp-table-map-and-compass':({e,m,b,c,l})=>[
    ...([6,e-1].flatMap(x=>[l(x,8,0,x,21,12,'steel'),l(x,21,0,x,8,12,'steel')])),
    b(5,7,12,e,24,14,'oak'),b(7,9,15,e-2,21,15,'linen'),
    l(8,12,15,e-4,20,15,'blue'),l(11,20,15,e-7,10,15,'rust'),c(m,14,16,17,2,'iron')],
  'portable-sink-and-dishes':({e,b,c,l})=>[
    b(5,7,0,e,24,3,'iron'),b(6,8,4,e-1,23,11,'steel'),
    b(8,10,11,e-3,21,11,'glass'),c(12,15,12,12,3,'linen'),
    c(16,16,12,13,3,'linen'),l(e-5,9,11,e-5,9,22,'steel'),
    l(e-5,9,22,e-5,15,21,'steel')],
  'trail-register-supply-post':({e,b})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,4,8,11,39,'oak'),b(e-3,8,4,e-1,11,39,'oak'),
    b(6,8,35,e-1,14,39,'oak'),b(7,9,18,e-2,11,31,'linen'),
    b(8,11,21,e-3,11,25,'blue'),b(8,12,9,e-3,20,12,'oak'),
    b(9,13,12,16,18,13,'linen')],
};
const pads={
  'trail-earth':w=>({z:3,ops:[B(3,5,0,w-4,26,1,'tan'),B(4,6,2,w-5,25,2,'earth')]}),
  'boardwalk':w=>({z:5,ops:[B(4,6,0,w-5,25,2,'iron'),...([6,11,16,21].map(y=>B(4,y,3,w-5,y+3,4,'oak')))]}),
  'folded-groundsheet':w=>({z:3,ops:[
    B(3,5,0,w-4,26,1,'earth'),B(4,6,2,w-5,25,2,'blue'),
    B(4,6,3,w-5,7,3,'linen'),B(4,24,3,w-5,25,3,'linen'),
    ...[4,w-6].flatMap(x=>[6,24].map(y=>B(x,y,2,x+1,y+1,5,'iron')))]}),
  'campsite-gravel':w=>({z:4,ops:[B(3,5,0,w-4,26,2,'iron'),B(4,6,3,w-5,25,3,'sand')]}),
  'utility-skid':w=>({z:6,ops:[...[7,22].map(y=>B(4,y,0,w-5,y+2,3,'oak')),B(4,6,4,w-5,25,5,'steel')]}),
};
const designs=[];
for(const [gearName,build] of Object.entries(gear))for(const [size,w] of [['personal',34],['group',60]]){
  for(const [site,mount] of Object.entries(pads)){
    const {z,ops}=mount(w);
    const extra=size==='group'?[B(w-20,17,z+3,w-8,23,z+9,'olive'),B(w-19,18,z+9,w-9,22,z+10,'tan')]:[];
    designs.push(asset(`camp-${gearName}-${size}-${site}`,'camping',w,materials,[...ops,...build(partAt(w,z)),...extra]));
  }
}
await writeFamily('camp-supplies',designs);
