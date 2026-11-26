import { writeFamily } from './render.mjs';

const box=(f,t,material)=>({op:'box',from:f,to:t,material});
const line=(f,t,material)=>({op:'line',from:f,to:t,material});
const cylinder=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const finishes={
  metal:['#95a1a3','metal'],frame:['#555f69','metal'],paper:['#dfd3bc','matte'],
  blue:['#64798d','matte'],oxide:['#9d6054','matte'],iron:['#3f464c','matte'],
  oak:['#a58162','wood'],linen:['#b6a38c','matte'],glass:['#8babb6','glass'],
  graphite:['#676d70','matte'],brass:['#c0a170','metal'],
};
const materials=Object.fromEntries(Object.entries(finishes).map(([key,[color,kind]])=>[key,{color,kind}]));
const B=(x,y,z,X,Y,Z,m)=>box([x,y,z],[X,Y,Z],m);
const L=(x,y,z,X,Y,Z,m)=>line([x,y,z],[X,Y,Z],m);
const C=cylinder;
function setup(w,z){
  return {
    e:w-6, mid:Math.floor(w/2),
    b:(x,y,h,X,Y,H,m)=>B(x,y,h+z,X,Y,H+z,m),
    l:(x,y,h,X,Y,H,m)=>L(x,y,h+z,X,Y,H+z,m),
    c:(x,y,h,H,r,m)=>C(x,y,h+z,H+z,r,m),
  };
}
const machines={
  'letterpress-platen':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'frame'),b(6,7,4,10,22,26,'frame'),b(e-4,7,4,e,22,26,'frame'),
    b(7,7,22,e-1,20,27,'blue'),b(9,15,8,e-3,24,12,'metal'),
    b(10,16,12,e-4,23,13,'paper'),c(e-2,15,16,18,5,'iron'),
    l(e-3,15,18,e,20,29,'metal')],
  'offset-ink-rolls':({b,c,e})=>[
    b(5,6,0,e,25,6,'blue'),b(6,7,6,e-1,10,24,'frame'),
    b(6,7,6,9,23,24,'frame'),b(e-3,7,6,e-1,23,24,'frame'),
    ...[8,14,20].map((h,i)=>b(8,11+i*3,h,e-3,13+i*3,h+3,i%2?'oxide':'metal')),
    b(9,22,6,e-4,27,7,'paper'),c(e-3,16,24,25,1,'brass')],
  'perfect-binding-station':({b,e})=>[
    b(4,6,0,e+1,24,6,'iron'),b(5,7,6,e,12,20,'blue'),
    b(5,10,18,e,17,20,'metal'),b(7,13,8,e-2,23,9,'iron'),
    b(8,14,9,17,21,13,'paper'),b(e-9,14,9,e-3,21,12,'linen'),
    b(e-6,16,18,e-2,16,19,'glass')],
  'foil-stamping-press':({b,c,l,e,mid})=>[
    b(5,7,0,e,24,5,'frame'),b(6,7,6,e-1,10,25,'blue'),
    b(7,9,22,e-2,18,25,'blue'),c(mid,15,13,23,2,'metal'),
    b(mid-5,10,11,mid+5,21,13,'brass'),b(8,12,6,e-3,22,7,'paper'),
    l(e-3,12,23,e,18,31,'iron')],
  'roll-plotter-stand':({b,c,e})=>[
    b(4,7,0,e+1,25,3,'frame'),b(6,8,3,8,22,15,'iron'),b(e-2,8,3,e,22,15,'iron'),
    b(5,7,13,e,21,18,'blue'),b(7,21,14,e-2,22,17,'iron'),
    b(8,22,10,e-3,24,16,'paper'),b(8,24,8,e-3,26,10,'paper'),
    c(e-4,13,18,19,1,'brass')],
  'wide-format-drying-clips':({b,l,e})=>[
    b(5,7,0,e,24,4,'oak'),b(6,8,4,8,10,35,'frame'),b(e-3,8,4,e-1,10,35,'frame'),
    b(6,8,32,e,10,35,'frame'),...([9,17,e-6].map(x=>b(x,10,28,x+2,12,33,'metal'))),
    b(8,11,15,e-3,12,29,'paper'),l(10,12,17,e-5,12,25,'blue'),l(10,12,26,e-5,12,19,'oxide')],
  'repro-camera-vacuum-frame':({b,c,l,e,mid})=>[
    b(5,7,0,e,24,4,'iron'),b(7,9,5,e-2,22,6,'glass'),
    b(9,10,6,e-4,20,6,'paper'),b(6,7,5,8,8,36,'frame'),
    l(7,8,35,mid,14,31,'frame'),b(mid-4,12,28,mid+4,16,34,'iron'),
    c(mid,15,25,29,2,'glass')],
  'paper-jogging-table':({b,c,e})=>[
    b(5,7,0,e,24,4,'frame'),b(6,7,5,e-1,9,18,'metal'),
    b(6,9,5,8,23,18,'metal'),b(e-3,9,5,e-1,23,18,'metal'),
    ...[8,10,12,14].map(h=>b(8,10,h,e-3,21,h,'paper')),
    c(e-3,9,19,20,1,'oxide')],
  'numbered-ticket-perforator':({b,c,e})=>[
    b(5,7,0,e,24,4,'iron'),b(6,7,4,e-1,13,19,'blue'),
    b(7,13,15,e-2,18,19,'metal'),b(8,13,7,e-3,24,8,'paper'),
    ...[10,14,18,22].map(x=>b(x,15,8,x,23,8,'graphite')),
    c(e-4,19,17,20,2,'oxide')],
  'screen-washout-booth':({b,l,e})=>[
    b(5,7,0,e,24,4,'iron'),b(5,7,4,e,9,33,'metal'),b(5,9,4,7,24,33,'glass'),
    b(e-2,9,4,e,24,33,'glass'),b(6,7,32,e-1,24,34,'metal'),
    b(8,9,6,e-3,10,25,'blue'),b(9,10,8,e-4,10,24,'linen'),
    b(8,18,4,e-3,23,5,'metal'),l(e-3,13,23,e-5,19,11,'graphite')],
  'pantone-swatch-drawer':({b,e})=>[
    b(5,7,0,e,24,15,'oak'),b(6,24,3,e-1,25,7,'paper'),
    b(6,24,9,e-1,26,12,'oak'),b(7,25,11,e-2,28,12,'paper'),
    ...Array.from({length:Math.floor((e-8)/4)},(_,i)=>b(8+i*4,9,15,10+i*4,20,16,['blue','oxide','brass','linen'][i%4]))],
  'stacking-folding-machine':({b,e})=>[
    b(4,6,0,e+1,24,4,'frame'),b(6,7,5,e-1,15,17,'blue'),
    b(7,15,10,e-2,20,13,'metal'),b(7,19,5,e-2,27,6,'iron'),
    b(8,20,7,e-3,25,8,'paper'),b(10,8,17,e-4,12,18,'paper'),
    b(e-7,15,15,e-3,15,16,'glass')],
};
const foundation={
  'shop-insert':w=>({z:3,ops:[B(4,6,0,w-5,25,1,'iron'),B(5,7,1,w-6,24,2,'metal')]}),
  'mobile-press-pedestal':w=>({z:8,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'iron'))),B(4,6,4,w-5,25,7,'frame'),
    B(6,24,6,15,25,7,'brass')]}),
  'cabinet-base':w=>({z:13,ops:[
    B(5,7,0,w-6,24,11,'blue'),B(4,6,11,w-5,25,12,'metal'),
    B(7,24,4,w-8,25,8,'frame'),B(9,25,7,w-10,26,7,'metal')]}),
  'open-frame-press':w=>({z:15,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,14,'frame'))),
    B(4,6,13,w-5,25,14,'metal'),B(6,8,5,w-7,23,6,'oak'),B(9,10,7,17,19,9,'paper')]}),
  'industrial-anti-vibration':w=>({z:6,ops:[
    B(3,5,0,w-4,26,2,'iron'),B(4,6,3,w-5,25,5,'frame'),
    ...([5,w-7].map(x=>B(x,7,5,x+2,24,5,'brass')))]}),
};
const designs=[];
for(const [process,build] of Object.entries(machines)){
  for(const [span,w] of [['shop-width',34],['production-width',60]]){
    for(const [mount,support] of Object.entries(foundation)){
      if(mount==='shop-insert'&&process==='screen-washout-booth')continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`print-${process}-${span}-${mount}`,category:'printmaking',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(setup(w,z))]});
    }
  }
}
await writeFamily('print-production',designs);
