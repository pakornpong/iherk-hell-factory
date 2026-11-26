import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  steel:['#9ba8ab','metal'],iron:['#596772','metal'],wood:['#a18362','wood'],
  rock:['#9e968b'],black:['#424b51'],blue:['#667f93'],orange:['#aa6853'],
  ivory:['#dbd3bb'],amber:['#c1a16a'],glass:['#8baab5','glass'],
});
const stations={
  'track-inspection-trolley':({e,b,c,l})=>[
    b(5,8,0,e,23,3,'iron'),...[8,e-4].flatMap(x=>[9,22].map(y=>c(x,y,0,4,2,'black'))),
    b(6,9,4,e-1,22,6,'amber'),b(9,10,6,17,19,9,'steel'),b(e-10,10,6,e-2,18,11,'blue'),
    b(e-4,7,6,e-2,9,24,'steel'),l(e-3,8,24,e-8,17,25,'steel')],
  'rail-wheel-lift-stand':({e,b,c,l})=>[
    b(5,7,0,e,24,3,'iron'),b(7,8,3,9,23,25,'blue'),b(e-4,8,3,e-2,23,25,'blue'),
    b(7,8,24,e-2,23,26,'iron'),l(9,11,5,e-3,20,21,'steel'),
    c(13,15,7,11,6,'steel'),c(e-6,15,14,18,6,'black')],
  'cable-trough-inspection':({e,b,l})=>[
    b(5,7,0,e,24,3,'rock'),b(6,8,3,e-1,11,12,'rock'),
    b(6,19,3,e-1,23,12,'rock'),b(7,11,3,e-2,19,5,'iron'),
    ...[12,15,17].map((y,i)=>l(7,y,6,e-2,y,7+i,'black')),
    b(e-10,11,9,e-2,19,13,'rock')],
  'platform-departure-display':({e,b})=>[
    b(5,7,0,e,24,3,'rock'),b(7,9,3,9,11,37,'steel'),b(e-4,9,3,e-2,11,37,'steel'),
    b(7,8,24,e-2,12,36,'blue'),b(8,12,25,e-3,12,35,'black'),
    ...[27,30,33].map(h=>b(10,12,h,e-5,12,h,'ivory'))],
  'rail-lubrication-box-art':({e,b,c,l})=>[
    b(5,7,0,e,24,3,'iron'),b(6,8,4,22,22,15,'blue'),
    b(7,8,15,21,22,17,'steel'),c(12,15,17,20,2,'iron'),
    l(18,19,8,e-5,24,5,'black'),b(e-8,18,4,e-2,22,8,'iron')],
  'switch-motor-housing-prop':({e,b,l})=>[
    b(5,7,0,e,24,3,'wood'),b(6,8,4,20,18,12,'iron'),b(7,8,12,19,18,14,'steel'),
    b(8,9,13,18,17,15,'steel'),l(19,14,7,e-1,14,6,'iron'),
    b(e-11,16,4,e-2,20,7,'steel'),b(e-9,19,8,e-4,20,9,'amber')],
  'yard-work-light-tower':({e,m,b,c,l})=>[
    ...[[6,24],[e-1,24],[m,7]].map(([x,y])=>l(m,15,21,x,y,0,'steel')),
    c(m,15,20,39,1,'iron'),b(m-8,13,34,m+8,16,36,'iron'),
    ...[m-6,m+5].flatMap(x=>[b(x-2,13,34,x+2,17,40,'black'),
      b(x-1,17,35,x+1,17,39,'ivory')])],
  'signal-cabinet-visual':({e,b,c})=>[
    b(5,7,0,e,24,4,'rock'),b(6,8,5,21,22,30,'steel'),
    b(7,22,7,20,23,28,'blue'),b(8,23,13,12,23,20,'glass'),
    b(19,23,12,20,24,17,'iron'),c(e-5,11,4,39,1,'iron'),
    b(e-7,11,29,e-3,14,38,'black'),b(e-6,14,33,e-4,14,35,'orange')],
  'rail-shoe-spares':({e,b,l})=>[
    b(5,7,0,e,24,4,'wood'),b(5,7,4,e,9,13,'wood'),
    ...across(Math.floor((e-7)/5),i=>[b(7+i*5,10,5,10+i*5,21,7,'iron'),
      b(7+i*5,14,7,10+i*5,18,9,'steel')]),
    l(7,21,8,e-2,21,8,'amber')],
  'trackside-sand-hopper':({e,b,c})=>[
    b(5,7,0,e,24,3,'iron'),b(7,8,3,21,23,14,'blue'),
    b(6,7,14,22,24,23,'steel'),b(7,8,23,21,23,24,'amber'),
    b(10,12,4,18,20,7,'iron'),c(e-5,15,4,8,3,'orange')],
  'station-platform-benches':({e,b,l})=>[
    ...[6,e-2].flatMap(x=>[b(x,8,0,x+1,22,9,'iron'),l(x,8,8,x,7,21,'steel')]),
    b(5,8,9,e,22,11,'wood'),b(5,7,16,e,9,17,'wood'),
    b(5,7,20,e,9,21,'wood'),b(7,20,11,8,23,15,'steel')],
  'maintenance-gantry-frame':({e,b,l})=>[
    b(6,7,0,8,10,39,'steel'),b(e-2,7,0,e,10,39,'steel'),
    b(6,7,37,e,11,39,'steel'),l(7,8,29,15,8,38,'steel'),
    l(e-1,8,29,e-8,8,38,'steel'),b(8,8,33,e-2,10,35,'amber'),
    b(12,9,28,16,13,33,'iron'),b(13,11,19,14,12,29,'iron')],
};
const sites={
  'bare-ballast':w=>({z:3,ops:[B(3,5,0,w-4,26,1,'rock'),B(4,6,2,w-5,25,2,'rock')]}),
  'sleeper-track':w=>({z:5,ops:[
    B(3,5,0,w-4,26,1,'rock'),...across(Math.floor((w-7)/5),i=>B(4+i*5,6,2,6+i*5,25,3,'wood')),
    B(4,8,4,w-5,9,4,'steel'),B(4,22,4,w-5,23,4,'steel')]}),
  'service-skid':w=>({z:6,ops:[...[7,22].map(y=>B(4,y,0,w-5,y+2,3,'wood')),B(4,6,4,w-5,25,5,'iron')]}),
  'concrete-platform':w=>({z:7,ops:[B(3,5,0,w-4,26,5,'rock'),B(4,6,6,w-5,25,6,'ivory'),
    B(4,24,6,w-5,25,6,'amber')]}),
  'wheeled-service-base':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'black'))),
    B(4,6,4,w-5,25,7,'iron'),B(w-7,7,5,w-4,9,8,'amber')]}),
};
const designs=[];
for(const [unit,build] of Object.entries(stations))for(const [size,w] of [['wayside',34],['yard-wide',60]]){
  for(const [site,mount] of Object.entries(sites)){
    if(site==='wheeled-service-base'&&['signal-cabinet-visual','maintenance-gantry-frame'].includes(unit))continue;
    const {z,ops}=mount(w);
    const extension=size==='yard-wide'?[B(w-20,16,z+2,w-8,24,z+8,'blue'),
      B(w-18,24,z+5,w-10,24,z+6,'ivory'),L(w-16,16,z+7,w-19,13,z+11,'steel')]:[];
    designs.push(asset(`rail-${unit}-${size}-${site}`,'railway',w,materials,[...ops,...build(partAt(w,z)),...extension]));
  }
}
await writeFamily('rail-yard',designs);
