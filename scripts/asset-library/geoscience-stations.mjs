import { writeFamily } from './render.mjs';
const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  frame:{kind:'metal',color:'#566674'}, steel:{kind:'metal',color:'#9fa9aa'},
  soil:{kind:'matte',color:'#8a6e58'}, stone:{kind:'matte',color:'#a09a91'},
  wood:{kind:'wood',color:'#a5815d'}, paper:{kind:'matte',color:'#ddd2bb'},
  amber:{kind:'matte',color:'#c2a06b'}, dark:{kind:'matte',color:'#404a51'},
  blue:{kind:'matte',color:'#647f94'}, oxide:{kind:'matte',color:'#a66956'},
  glass:{kind:'glass',color:'#8baab5'},
};
const design=(w,z)=>({
  w,e:w-6,m:Math.floor(w/2),
  b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
  c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m),
});
const units={
  'cores-logging-caddy':({b,e})=>[
    b(5,7,0,e,24,3,'wood'),b(5,7,4,e,9,10,'wood'),b(5,22,4,e,24,10,'wood'),
    ...[11,16,20].flatMap((y,i)=>[b(6,y,4,e-1,y+1,10,'wood'),b(8,y+1,5,e-5,y+2,7,['soil','stone','oxide'][i])]),
    b(10,10,8,15,15,8,'paper')],
  'hand-specimen-sorting-grid':({b,c,e})=>[
    b(5,7,0,e,24,3,'frame'),b(6,8,4,e-1,23,5,'paper'),
    ...[10,16,22].map(y=>b(7,y,6,e-2,y,7,'wood')),
    ...Array.from({length:Math.floor((e-7)/5)},(_,i)=>[
      b(7+i*5,8,6,7+i*5,22,7,'wood'),c(9+i*5,13,6,8+i%2,1,['soil','stone','oxide'][i%3]),
      c(9+i*5,19,6,8,1,['stone','blue','amber'][i%3])]).flat()],
  'soil-sieve-column':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'frame'),c(14,15,4,15,7,'steel'),
    ...[5,9,13,16].map(h=>c(14,15,h,h,8,'frame')),c(14,15,17,18,6,'soil'),
    b(e-8,8,4,e-6,12,24,'steel'),l(e-7,10,24,15,13,23,'steel'),
    c(14,13,19,22,1,'steel')],
  'topographic-table-model':({b,e})=>[
    b(5,7,0,e,24,3,'wood'),b(6,8,4,e-1,23,5,'paper'),
    b(8,10,6,e-3,21,6,'blue'),b(9,10,7,e-6,16,7,'soil'),
    b(11,11,8,e-9,16,8,'stone'),b(13,11,9,e-11,15,9,'paper'),
    b(15,12,10,e-13,14,11,'amber')],
  'portable-weather-mast':({b,c,l,e})=>[
    ...[[6,22],[23,22],[14,6]].map(([x,y])=>l(14,14,19,x,y,0,'steel')),
    c(14,14,18,42,1,'steel'),b(8,13,39,20,15,41,'frame'),
    ...[8,20].map(x=>c(x,15,41,43,2,'amber')),c(14,14,44,46,2,'steel'),
    b(e-10,12,0,e-4,21,9,'blue'),b(e-9,21,5,e-5,21,7,'glass')],
  'digital-sediment-logger':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'frame'),b(6,8,5,20,20,15,'blue'),b(7,20,9,19,21,13,'glass'),
    b(8,10,16,18,14,17,'steel'),b(e-9,8,5,e-7,12,23,'steel'),
    l(e-8,10,22,e-4,16,13,'dark'),c(e-4,17,6,12,2,'soil'),
    b(e-10,14,5,e-2,22,6,'paper')],
  'geology-thin-section-scope':({b,c,e})=>[
    b(5,7,0,e,24,3,'frame'),c(13,15,4,8,7,'steel'),
    b(12,9,8,15,12,30,'frame'),b(12,11,27,22,15,31,'frame'),
    c(20,15,22,28,2,'dark'),b(12,14,16,22,21,18,'steel'),b(15,16,18,20,19,19,'glass'),
    b(e-8,10,4,e-3,20,6,'paper')],
  'field-sample-crate-stack':({b,e,m})=>[
    b(5,7,0,e,24,3,'wood'),b(6,8,4,m,21,14,'soil'),b(5,7,14,m+1,22,16,'wood'),
    b(m+3,10,4,e-1,23,20,'stone'),b(m+2,9,20,e,24,22,'wood'),
    b(7,21,10,m-2,22,13,'paper'),b(m+5,23,14,e-3,24,17,'paper'),
    b(m+6,15,22,e-4,20,24,'blue')],
  'water-level-flume':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'steel'),b(6,8,4,e-1,10,13,'glass'),b(6,21,4,e-1,23,13,'glass'),
    b(6,10,4,8,21,12,'steel'),b(e-3,10,4,e-1,21,12,'steel'),
    b(8,10,5,e-3,21,5,'blue'),b(10,12,5,13,20,11,'stone'),
    c(16,13,5,21,1,'steel'),l(16,13,20,19,17,20,'amber')],
  'map-roll-field-desk':({b,l,e})=>[
    b(5,7,0,e,24,3,'wood'),b(6,7,4,e-1,10,25,'frame'),b(7,10,5,e-2,10,23,'paper'),
    l(9,10,8,e-4,10,17,'oxide'),l(10,10,18,e-5,10,11,'blue'),
    b(8,15,4,e-3,18,7,'paper'),b(9,20,4,e-4,23,7,'amber')],
};
const mounts={
  'folding-field-table':w=>({z:13,ops:[
    ...[6,w-9].flatMap(x=>[L(x,7,0,x,19,12,'frame'),L(x,24,0,x,8,12,'frame')]),
    B(4,6,11,w-5,25,12,'wood')]}),
  'survey-pelican-case':w=>({z:6,ops:[
    B(4,6,0,w-5,25,5,'dark'),B(4,6,4,w-5,25,5,'frame'),B(8,25,2,12,26,3,'amber')]}),
  'raised-pedestal':w=>({z:10,ops:[
    B(4,6,0,w-5,25,2,'frame'),B(7,8,3,w-8,23,8,'blue'),B(5,7,8,w-6,24,9,'steel')]}),
  'mobile-lab-cart':w=>({z:9,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'dark'))),
    B(4,6,4,w-5,25,5,'frame'),B(4,6,6,w-5,25,8,'steel'),B(5,6,8,7,23,9,'blue')]}),
  'hands-on-plinth':w=>({z:4,ops:[B(4,6,0,w-5,25,2,'stone'),B(5,7,3,w-6,24,3,'wood')]}),
};
const designs=[];
for(const [use,build] of Object.entries(units)){
  for(const [size,w] of [['field',34],['double-lab',61]]){
    for(const [station,support] of Object.entries(mounts)){
      if(use==='portable-weather-mast'&&['raised-pedestal','mobile-lab-cart'].includes(station))continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`geo-${use}-${size}-${station}`,category:'geoscience',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(design(w,z))]});
    }
  }
}
await writeFamily('geoscience-stations',designs);
