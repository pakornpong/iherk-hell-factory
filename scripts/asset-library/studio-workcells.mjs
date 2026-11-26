import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#a8805d'}, walnut:{kind:'wood',color:'#785b48'},
  dark:{kind:'matte',color:'#404951'}, gray:{kind:'metal',color:'#737e87'},
  steel:{kind:'metal',color:'#a3a9aa'}, ivory:{kind:'matte',color:'#d8d0bd'},
  cloth:{kind:'matte',color:'#a18e7e'}, brick:{kind:'matte',color:'#a86959'},
  blue:{kind:'matte',color:'#658099'}, brass:{kind:'metal',color:'#b99d70'},
  glass:{kind:'glass',color:'#88a6b3'}, display:{kind:'emissive',color:'#a1bccb',glowRadius:1,glowIntensity:.09},
};
function area(w,z){
  return {w,end:w-6,mid:Math.floor(w/2),
    b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
    c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
    l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m)};
}
const work={
  'podcast-two-boom':({b,c,l,end})=>[
    b(5,7,0,end,24,4,'oak'),b(6,7,4,end-1,10,12,'cloth'),
    ...[9,end-3].flatMap(x=>[c(x,10,5,7,2,'gray'),l(x,10,7,x,13,23,'gray'),
      l(x,13,23,x,20,20,'steel'),b(x-1,19,17,x+1,21,20,'dark')]),
    b(12,14,5,end-6,22,6,'dark'),b(13,15,7,19,18,7,'display')],
  'studio-live-switcher':({b,c,end,mid})=>[
    b(5,7,0,end,24,4,'dark'),b(6,7,5,end-1,10,16,'gray'),
    ...[9,mid,end-4].map(x=>b(x-2,10,9,x+2,11,14,'display')),
    ...Array.from({length:Math.floor((end-6)/4)},(_,i)=>{
      const x=7+4*i;
      return [b(x,14,5,x+2,16,5,i%2?'ivory':'blue'),b(x,19,5,x+2,21,6,i%3?'gray':'brick')];
    }).flat(),c(end-3,22,5,6,1,'steel')],
  'color-grading-console':({b,c,end})=>[
    b(5,6,0,end,25,4,'walnut'),b(6,7,5,end-1,11,20,'dark'),b(7,11,7,end-2,11,18,'glass'),
    b(9,11,10,end-4,11,10,'ivory'),b(8,14,5,end-3,23,6,'gray'),
    ...[11,17,end-6].map((x,i)=>c(x,18,7,8,2,['blue','ivory','brick'][i]))],
  'animation-cel-lightbox':({b,c,l,end})=>[
    b(5,6,0,end,25,4,'oak'),b(7,8,5,end-2,23,6,'dark'),b(8,9,6,end-3,22,6,'display'),
    b(10,11,7,end-4,20,7,'glass'),l(11,13,7,end-6,18,7,'blue'),
    c(9,19,7,7,1,'dark'),b(end-8,7,6,end-3,10,10,'gray')],
  'analogue-reel-to-reel':({b,c,l,end})=>[
    b(5,7,0,end,23,3,'oak'),b(6,8,4,end-1,14,26,'gray'),
    ...[11,end-5].flatMap(x=>[
      b(x-4,14,14,x+4,15,22,'steel'),b(x-3,15,15,x+3,16,21,'dark'),
      b(x-1,16,17,x+1,16,19,'steel')]),
    l(11,15,14,17,16,10,'dark'),l(17,16,10,end-5,16,14,'dark'),
    b(9,14,6,end-4,15,8,'ivory')],
  'vinyl-cutting-lathe':({b,c,l,end})=>[
    b(5,7,0,end,24,4,'dark'),c(13,16,5,8,7,'steel'),c(13,16,9,9,6,'dark'),
    c(13,16,9,10,2,'brick'),b(end-6,8,4,end-3,11,19,'gray'),
    l(end-5,10,18,13,14,18,'steel'),l(13,14,18,13,16,9,'steel'),
    b(end-8,19,4,end-3,22,6,'display')],
  'photo-proofing-bench':({b,l,end})=>[
    b(5,7,0,end,24,3,'oak'),b(5,7,4,end,9,27,'ivory'),
    b(6,9,22,end-1,16,25,'steel'),b(6,15,20,end-1,16,22,'display'),
    b(8,11,4,end-3,21,4,'ivory'),l(10,12,4,end-6,18,4,'dark'),
    b(10,15,4,14,20,5,'blue'),b(end-9,11,4,end-5,16,5,'brick')],
  'instrument-pedal-patch':({b,l,end})=>[
    b(5,6,0,end,25,3,'oak'),b(6,7,4,end-1,24,6,'dark'),
    ...Array.from({length:Math.floor((end-7)/7)},(_,i)=>{
      const x=8+7*i;
      return [b(x,10,7,x+4,20,8,i%2?'brick':'blue'),b(x+1,10,9,x+3,12,9,'ivory'),
        b(x+1,18,9,x+3,19,9,'steel'),l(x+4,15,8,x+6,21,7,'dark')];
    }).flat(),b(7,7,7,end-2,8,10,'gray')],
  'foley-object-recording-tray':({b,c,l,end,mid})=>[
    b(5,7,0,end,23,4,'oak'),b(6,8,4,mid-1,22,6,'cloth'),
    b(mid,8,4,end-1,22,6,'ivory'),c(11,15,7,10,2,'steel'),
    b(end-7,10,7,end-3,20,8,'glass'),b(7,8,4,9,11,21,'steel'),
    l(8,9,20,16,13,19,'steel'),b(15,13,17,17,14,19,'dark')],
  'motion-control-slider':({b,l,end})=>[
    b(5,7,0,end,24,3,'gray'),
    b(6,10,4,end-1,12,6,'steel'),b(6,19,4,end-1,21,6,'steel'),
    b(11,10,7,20,21,9,'dark'),b(13,13,9,19,19,17,'dark'),
    b(14,18,12,18,22,16,'gray'),b(15,22,13,17,22,15,'glass'),
    l(18,9,7,end-1,9,7,'brass')],
  'large-format-scanner':({b,end})=>[
    b(5,6,0,end,25,5,'gray'),b(6,7,5,end-1,24,6,'dark'),
    b(8,8,6,end-3,22,6,'glass'),b(9,10,7,end-4,19,7,'ivory'),
    b(6,6,6,8,23,8,'dark'),b(end-3,6,6,end-1,23,8,'dark'),
    b(8,11,8,end-3,14,10,'gray'),b(9,14,9,end-4,14,9,'display'),
    b(end-7,21,6,end-3,23,7,'blue')],
  'editing-reference-monitor':({b,end})=>[
    b(5,7,0,end,24,4,'oak'),b(7,7,4,end-2,11,24,'dark'),
    b(8,11,7,end-3,11,22,'glass'),b(9,11,8,end-4,11,10,'blue'),
    b(9,11,19,end-4,11,20,'ivory'),b(8,15,5,end-3,20,6,'steel'),
    b(9,16,6,end-4,19,6,'dark'),b(end-9,23,5,end-5,24,6,'brick')],
};
const stations={
  'road-desk':w=>({z:12,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,4,'dark'))),
    B(4,6,4,w-5,25,10,'dark'),B(4,6,10,w-5,25,11,'steel'),B(5,25,7,14,26,9,'brass')]}),
  'floating-console':w=>({z:12,ops:[
    B(4,5,0,w-5,8,22,'cloth'),B(5,8,10,w-6,25,11,'walnut'),
    L(7,8,4,7,21,10,'steel'),L(w-8,8,4,w-8,21,10,'steel')]}),
  'iso-rack-bridge':w=>({z:17,ops:[
    B(5,6,0,13,24,16,'dark'),B(w-14,6,0,w-6,24,16,'dark'),
    ...[5,9,13].flatMap(z=>[B(6,24,z,12,25,z,'gray'),B(w-13,24,z,w-7,25,z,'gray')]),
    B(4,5,15,w-5,25,16,'oak')]}),
  'tabletop':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'dark'),B(5,7,1,w-6,24,2,'gray')]}),
  'steel-studio-trestle':w=>({z:14,ops:[
    ...[6,w-9].flatMap(x=>[L(x,7,0,x,15,13,'gray'),L(x,23,0,x,15,13,'gray')]),
    B(4,6,12,w-5,25,13,'oak'),B(6,10,4,w-7,22,5,'gray')]}),
};
const designs=[];
for(const [use,build] of Object.entries(work)){
  for(const [size,w] of [['compact',32],['suite-width',60]]){
    for(const [style,support] of Object.entries(stations)){
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`studio-${use}-${size}-${style}`,category:'studio',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials,ops:[...ops,...build(area(w,z))]});
    }
  }
}
await writeFamily('studio-workcells',designs);
