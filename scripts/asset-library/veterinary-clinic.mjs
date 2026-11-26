import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  steel:['#9fa9a9','metal'],iron:['#5a6773','metal'],rubber:['#414a50'],
  cream:['#dad4c5'],blue:['#647e94'],tan:['#ad9a83'],oak:['#a88461','wood'],
  glass:['#8dabb7','glass'],rust:['#a96a58'],linen:['#ded4bf'],amber:['#bc9e67'],
});
const clinic={
  'folding-animal-exam-table':({e,b,l})=>[
    ...[7,e-2].flatMap(x=>[l(x,8,0,x,22,12,'steel'),l(x,22,0,x,8,12,'steel')]),
    b(5,7,12,e,24,15,'steel'),b(6,8,15,e-1,23,16,'blue'),
    b(e-10,8,16,e-2,11,21,'cream'),b(7,18,16,15,22,17,'linen')],
  'wire-recovery-kennel':({e,b})=>[
    b(5,7,0,e,24,3,'steel'),b(5,7,22,e,24,24,'steel'),
    b(5,7,3,7,24,22,'cream'),b(e-2,7,3,e,24,22,'cream'),
    b(6,7,3,e-1,9,22,'cream'),
    ...across(Math.floor((e-7)/3),i=>b(7+i*3,24,3,7+i*3,24,22,'steel')),
    b(8,10,4,e-3,22,6,'blue')],
  'induction-recovery-cubby':({e,b,c})=>[
    b(5,7,0,e,24,24,'cream'),b(6,24,4,e-1,25,20,'glass'),
    b(7,25,6,e-2,25,8,'steel'),b(7,25,17,e-2,25,19,'steel'),
    b(8,23,7,e-3,24,9,'blue'),c(e-6,12,24,26,2,'steel'),b(e-10,12,26,e-2,18,28,'blue')],
  'large-animal-floor-scale':({e,b,c,l})=>[
    b(5,7,0,e,24,4,'iron'),b(6,8,4,e-1,23,5,'rubber'),
    ...[9,13,17,21].map(y=>b(7,y,5,e-2,y,5,'blue')),c(e-5,10,5,24,1,'steel'),
    b(e-9,10,23,e-2,14,27,'iron'),b(e-8,14,24,e-3,14,26,'glass'),
    l(e-6,10,6,e-2,19,4,'rubber')],
  'treatment-tray-vials':({e,b,c})=>[
    b(5,7,0,e,24,4,'steel'),b(5,7,4,e,9,7,'steel'),b(5,22,4,e,24,7,'steel'),
    ...[10,16,e-5].flatMap((x,i)=>[c(x,12,5,9+i,2,i%2?'blue':'glass'),c(x,12,9+i,10+i,1,'cream')]),
    b(8,17,5,17,21,7,'linen'),b(e-10,19,5,e-3,21,6,'steel')],
  'animal-oxygen-cart-prop':({e,b,c,l})=>[
    b(5,7,0,e,24,3,'iron'),c(10,13,4,27,4,'blue'),c(19,14,4,23,4,'cream'),
    c(10,13,27,30,2,'steel'),c(19,14,23,26,2,'steel'),
    b(5,21,7,23,23,9,'steel'),l(11,13,28,17,11,25,'rubber'),
    b(e-6,12,4,e-2,22,9,'tan')],
  'quarantine-wash-station':({e,b,c,l})=>[
    b(5,7,0,e,24,4,'steel'),b(6,8,4,e-1,23,11,'steel'),
    b(7,9,11,e-2,22,11,'glass'),b(e-5,8,11,e-4,9,24,'steel'),
    l(e-5,9,24,e-5,16,23,'steel'),c(12,14,12,17,2,'cream'),b(11,12,17,14,14,18,'steel')],
  'radiograph-panel-console':({e,b,l})=>[
    b(5,7,0,e,24,4,'iron'),b(6,8,5,e-1,12,32,'cream'),
    b(8,12,10,e-3,13,29,'glass'),b(9,13,13,13,13,25,'blue'),
    l(12,13,23,19,13,20,'linen'),l(18,13,20,e-4,13,13,'linen'),
    b(8,15,5,e-3,22,7,'steel')],
  'pet-carrier-cleaning-cage':({e,b})=>[
    b(5,7,0,e,24,4,'steel'),b(6,8,4,e-1,23,23,'cream'),
    b(7,23,7,e-2,24,20,'iron'),
    ...across(Math.floor((e-8)/3),i=>b(8+i*3,24,7,8+i*3,24,20,'steel')),
    b(10,12,23,17,14,26,'blue'),b(e-6,24,11,e-4,25,13,'amber')],
  'low-stress-ramp-and-mat':({e,b,s})=>[
    b(5,7,0,e,24,3,'rubber'),s(6,8,3,e-2,23,13,'+X','blue'),
    b(6,8,4,7,9,12,'steel'),b(e-3,22,8,e-2,23,15,'steel'),
    b(7,8,10,e-3,9,11,'steel'),b(7,22,12,e-3,23,13,'steel')],
};
const mounts={
  'sanitary-floor':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'rubber'),B(5,7,2,w-6,24,2,'cream')]}),
  'clinic-casters':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'rubber'))),
    B(4,6,4,w-5,25,7,'steel'),B(w-7,7,7,w-5,22,10,'blue')]}),
  'utility-bench':w=>({z:13,ops:[...[5,w-8].flatMap(x=>[L(x,7,0,x,15,12,'iron'),L(x,23,0,x,15,12,'iron')]),
    B(4,6,11,w-5,25,12,'steel'),B(6,8,5,w-7,24,6,'oak')]}),
  'cleanable-cabinet':w=>({z:12,ops:[B(4,6,0,w-5,25,2,'iron'),B(5,7,3,w-6,24,10,'cream'),
    B(4,6,10,w-5,25,11,'steel'),B(7,24,5,w-8,25,8,'blue')]}),
  'partition-backline':w=>({z:10,ops:[B(4,5,0,w-5,7,25,'cream'),B(4,7,8,w-5,25,9,'steel'),
    L(6,7,3,6,22,8,'iron'),L(w-7,7,3,w-7,22,8,'iron')]}),
};
const designs=[];
for(const [device,build] of Object.entries(clinic))for(const [size,w] of [['single',34],['clinic-span',60]]){
  for(const [base,support] of Object.entries(mounts)){
    if(['large-animal-floor-scale','low-stress-ramp-and-mat'].includes(device)&&base==='utility-bench')continue;
    const {z,ops}=support(w);
    const secondary=size==='clinic-span'?[B(w-19,14,z+3,w-9,22,z+8,'steel'),
      B(w-18,15,z+8,w-10,21,z+9,'linen'),B(w-15,16,z+9,w-12,19,z+12,'blue')]:[];
    designs.push(asset(`vet-${device}-${size}-${base}`,'veterinary',w,materials,[...ops,...build(partAt(w,z)),...secondary]));
  }
}
await writeFamily('veterinary-clinic',designs);
