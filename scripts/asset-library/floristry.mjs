import { writeFamily } from './render.mjs';
import { asset, colors, partAt, box as B, rod as L, across } from './industrial-layout.mjs';

const materials=colors({
  oak:['#a98461','wood'],walnut:['#755a48','wood'],steel:['#9da9ad','metal'],frame:['#5a6774','metal'],
  dark:['#414a51'],ivory:['#ded4bf'],linen:['#b8a68c'],pink:['#ad7480'],rose:['#a05f5f'],
  leaf:['#637c55'],paleLeaf:['#819069'],glass:['#90acb6','glass'],
  amber:['#c1a06b'],clay:['#a6735c'],
});
function stems({b,c,l},x,y,h,tone){
  return [l(x,y,h,x-2,y-1,h+8,'leaf'),l(x,y,h,x+2,y+1,h+11,'leaf'),
    l(x,y,h,x+1,y-2,h+13,'paleLeaf'),c(x-2,y-1,h+8,h+10,1,tone),
    c(x+2,y+1,h+11,h+12,1,tone),c(x+1,y-2,h+13,h+14,1,tone),
    b(x-1,y+1,h+4,x+2,y+2,h+5,'leaf')];
}
const fixtures={
  'cut-flower-bucket-tier':a=>[
    a.b(5,7,0,a.e,24,3,'oak'),a.b(5,7,4,a.e,13,10,'oak'),
    ...[10,a.e-5].flatMap((x,i)=>[
      a.c(x,17,4,11,4,'steel'),...stems(a,x,17,11,i?'pink':'ivory'),
      a.c(x,10,10,16,3,'clay'),...stems(a,x,10,16,i?'ivory':'rose')])],
  'glass-vase-bench':a=>[
    a.b(5,7,0,a.e,24,3,'oak'),
    ...[10,17,a.e-4].flatMap((x,i)=>[
      a.c(x,13+i%2*5,4,9+i,3,'glass'),a.c(x,13+i%2*5,10+i,13+i,2,'glass'),
      ...stems(a,x,13+i%2*5,12+i,i%2?'pink':'ivory')])],
  'wreath-making-rail':({b,l,e,m})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,8,11,35,'walnut'),b(e-3,8,4,e-1,11,35,'walnut'),
    b(6,8,33,e-1,11,35,'walnut'),
    ...across(32,i=>{
      const angle=i/32*2*Math.PI;
      const x=Math.round(m+8*Math.cos(angle)),h=Math.round(21+8*Math.sin(angle));
      return b(x,11,h,x+1,12,h+1,i%5===0?'rose':i%4===0?'ivory':'leaf');
    }),l(m,10,30,m,10,34,'linen'),b(8,17,4,16,22,6,'linen')],
  'bouquet-paper-dispenser':({b,c,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,8,11,32,'walnut'),b(e-3,8,4,e-1,11,32,'walnut'),
    ...[11,19,27].flatMap((h,i)=>[b(7,9,h,e-2,11,h+1,'steel'),
      b(8,10,h-2,e-3,14,h+2,['linen','ivory','pink'][i])]),
    b(8,15,4,e-3,23,5,'linen'),c(e-5,18,6,8,2,'amber')],
  'stem-conditioning-sink':a=>[
    a.b(5,7,0,a.e,24,4,'steel'),a.b(6,8,5,a.e-1,23,8,'steel'),
    a.b(8,10,8,a.e-3,21,8,'glass'),a.b(a.e-5,8,8,a.e-4,9,23,'steel'),
    a.l(a.e-5,9,23,a.e-5,16,21,'steel'),
    a.c(11,16,9,13,3,'clay'),...stems(a,11,16,13,'pink')],
  'cooled-bouquet-case':a=>[
    a.b(5,7,0,a.e,24,5,'frame'),a.b(5,7,5,a.e,9,31,'steel'),
    a.b(5,9,5,7,24,31,'glass'),a.b(a.e-2,9,5,a.e,24,31,'glass'),
    a.b(5,7,31,a.e,24,33,'steel'),
    ...[10,a.e-5].flatMap((x,i)=>[a.c(x,16,6,13,3,'clay'),...stems(a,x,16,13,i?'ivory':'rose')]),
    a.b(6,23,27,a.e-1,24,29,'glass')],
  'ribbon-spool-hutch':({b,c,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,e-1,10,29,'walnut'),
    ...[5,13,21].flatMap((h,i)=>[b(6,9,h,e-1,22,h+1,'oak'),
      ...[10,17,e-5].map((x,j)=>c(x,16,h+2,h+5,2,['ivory','rose','linen'][(i+j)%3]))])],
  'flower-delivery-vase-locker':a=>[
    a.b(5,7,0,a.e,24,19,'oak'),a.b(6,24,3,a.e-1,25,15,'ivory'),
    a.b(7,25,7,13,26,9,'steel'),a.b(a.e-8,25,7,a.e-2,26,9,'steel'),
    a.b(5,7,19,a.e,24,21,'walnut'),
    a.c(12,14,22,28,3,'ivory'),...stems(a,12,14,27,'pink'),
    a.c(a.e-5,14,22,29,3,'glass'),...stems(a,a.e-5,14,28,'ivory')],
  'pressed-botanicals-book':({b,l,e,m})=>[
    b(5,7,0,e,24,3,'oak'),b(7,9,4,m,22,5,'walnut'),b(m,9,4,e-2,22,5,'walnut'),
    b(8,10,6,m-1,21,6,'ivory'),b(m+1,10,6,e-3,21,6,'ivory'),
    l(10,17,6,m-3,12,6,'leaf'),l(m+3,18,6,e-4,12,6,'paleLeaf'),
    b(m+5,14,6,m+7,16,6,'pink'),b(9,8,4,12,9,5,'clay')],
  'floral-display-urn':a=>[
    a.b(5,7,0,a.e,24,4,'walnut'),a.c(a.m,15,5,8,5,'ivory'),
    a.c(a.m,15,9,15,7,'ivory'),a.c(a.m,15,16,19,5,'ivory'),
    ...stems(a,a.m-3,15,19,'rose'),...stems(a,a.m+3,15,20,'ivory'),
    ...stems(a,a.m,19,20,'pink')],
  'retail-garden-tool-rack':({b,l,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,e-1,10,28,'walnut'),b(6,10,22,e-1,15,24,'oak'),
    ...[10,17,e-5].flatMap((x,i)=>[l(x,12,5,x,12,23,'steel'),
      b(x-2,11,5,x+2,13,9,i%2?'clay':'frame'),b(x-1,11,23,x+1,13,25,'linen')])],
};
const stands={
  'stall-wood':w=>({z:4,ops:[B(4,6,0,w-5,25,2,'walnut'),B(5,7,3,w-6,24,3,'oak')]}),
  'shop-counter':w=>({z:14,ops:[B(5,7,0,w-6,24,12,'oak'),B(4,6,12,w-5,25,13,'ivory'),
    B(7,24,4,w-8,25,9,'linen')]}),
  'market-trolley':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'dark'))),
    B(4,6,4,w-5,25,7,'steel'),B(5,7,7,7,23,10,'amber')]}),
  'decorative-trestle':w=>({z:13,ops:[...[6,w-9].flatMap(x=>[L(x,7,0,x,15,12,'walnut'),L(x,24,0,x,15,12,'walnut')]),
    B(4,6,11,w-5,25,12,'oak'),B(6,8,4,w-7,23,5,'walnut')]}),
  'ceramic-display-plinth':w=>({z:8,ops:[B(4,6,0,w-5,25,6,'ivory'),B(3,5,6,w-4,26,7,'linen')]}),
};
const designs=[];
for(const [prop,build] of Object.entries(fixtures))for(const [size,w] of [['boutique',34],['greenhouse',60]]){
  for(const [stand,mount] of Object.entries(stands)){
    if(prop==='cooled-bouquet-case'&&stand==='decorative-trestle')continue;
    const {z,ops}=mount(w);
    const display=size==='greenhouse'?[B(w-18,19,z+3,w-8,23,z+5,'walnut'),B(w-17,19,z+5,w-9,23,z+6,'ivory')]:[];
    designs.push(asset(`florist-${prop}-${size}-${stand}`,'florist',w,materials,[...ops,...build(partAt(w,z)),...display]));
  }
}
await writeFamily('floristry',designs);
