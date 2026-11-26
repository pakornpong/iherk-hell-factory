import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  steel:{kind:'metal',color:'#929fa7'}, iron:{kind:'metal',color:'#58616c'},
  dark:{kind:'matte',color:'#333c46'}, gray:{kind:'matte',color:'#767e83'},
  offwhite:{kind:'matte',color:'#d2ccbc'}, amber:{kind:'matte',color:'#c2a37a'},
  blue:{kind:'matte',color:'#627791'}, red:{kind:'matte',color:'#ab6658'},
  glass:{kind:'glass',color:'#88adb7'}, led:{kind:'emissive',color:'#a4c6d6',glowRadius:1,glowIntensity:.1},
};
const profiles=[
  ['desktop',30,21],
  ['floor-column',32,39],
  ['wide-enclosure',59,28],
];
const housing={
  'vented-cage':(w,h,z)=>[
    b(5,6,z,w-6,8,z+h,'iron'),b(5,8,z,7,24,z+h,'iron'),b(w-8,8,z,w-6,24,z+h,'iron'),
    b(5,7,z+h,w-6,24,z+h+1,'steel'),b(5,7,z,w-6,24,z+2,'dark'),
    ...[4,8,12,16].map(k=>b(5,24,z+k,6,25,z+k+1,'steel'))],
  'tinted-access-door':(w,h,z)=>[
    b(5,6,z,w-6,10,z+h,'dark'),b(5,10,z,7,22,z+h,'gray'),b(w-8,10,z,w-6,22,z+h,'gray'),
    b(5,9,z+h,w-6,23,z+h+1,'steel'),b(5,9,z,w-6,23,z+2,'dark'),
    b(w-7,10,z+3,w-7,24,z+h-2,'glass'),b(w-7,24,z+5,w-6,25,z+h-4,'iron')],
  'external-cable-tray':(w,h,z)=>[
    b(4,6,z,w-5,9,z+h,'iron'),b(5,8,z+h,w-6,24,z+h+1,'iron'),
    b(5,8,z,w-6,24,z+2,'dark'),b(5,9,z,7,24,z+h,'dark'),b(w-8,9,z,w-6,24,z+h,'dark'),
    b(w-8,13,z+1,w-3,23,z+3,'steel'),b(w-5,13,z+3,w-3,15,z+h+4,'steel'),
    b(w-5,21,z+3,w-3,23,z+h+4,'steel'),b(w-6,14,z+h+3,w-3,23,z+h+5,'iron')],
  'raised-fan-plenum':(w,h,z)=>[
    b(5,6,z,w-6,9,z+h,'iron'),b(5,9,z,7,24,z+h,'gray'),b(w-8,9,z,w-6,24,z+h,'gray'),
    b(5,9,z,w-6,24,z+2,'dark'),b(5,9,z+h,w-6,24,z+h+6,'iron'),
    ...[10,w-11].flatMap(x=>[c(x,16,z+h+6,z+h+6,4,'dark'),
      c(x,16,z+h+6,z+h+6,2,'steel')])],
};
const internals={
  'nas-hot-swap':(w,h,z)=>Array.from({length:Math.floor((h-4)/4)},(_,i)=>[
    b(8,10,z+3+i*4,w-9,23,z+5+i*4,'dark'),
    ...Array.from({length:Math.floor((w-18)/4)},(_,j)=>b(9+j*4,23,z+3+i*4,11+j*4,24,z+5+i*4,'steel')),
    b(w-11,24,z+4+i*4,w-10,24,z+4+i*4,'led')]).flat(),
  'patch-panel-fiber':(w,h,z)=>Array.from({length:Math.floor((h-5)/5)},(_,i)=>[
    b(8,10,z+3+i*5,w-9,22,z+5+i*5,'steel'),...([9,13,w-15,w-11].map(x=>
      b(x,22,z+4+i*5,x+2,23,z+4+i*5,'dark'))),
    l(10,23,z+3+i*5,w-13,25,z+6+i*5,i%2?'amber':'blue')]).flat(),
  'battery-backup-drawers':(w,h,z)=>Array.from({length:Math.floor((h-4)/6)},(_,i)=>[
    b(8,10,z+3+i*6,w-9,23,z+7+i*6,'iron'),
    b(9,23,z+4+i*6,14,24,z+6+i*6,'steel'),b(w-14,23,z+5+i*6,w-10,24,z+6+i*6,'amber')]).flat(),
  'graphics-render-node':(w,h,z)=>[
    b(8,9,z+3,w-9,24,z+7,'dark'),
    ...[11,Math.floor(w/2),w-12].flatMap(x=>[b(x-2,10,z+7,x+2,21,z+h-3,'steel'),
      b(x-1,21,z+11,x+1,22,z+h-4,'dark'),b(x-2,23,z+8,x+2,23,z+9,'led')]),
    b(8,8,z+h-3,w-9,24,z+h-2,'iron')],
  'hvac-loop-sensor-bank':(w,h,z)=>[
    b(8,10,z+3,w-9,23,z+8,'iron'),b(9,10,z+9,w-10,13,z+h-3,'steel'),
    ...[11,Math.floor(w/2),w-12].flatMap((x,i)=>[
      c(x,17,z+8,z+h-4,2,'blue'),b(x,16,z+h-3,x+1,18,z+h-2,i%2?'amber':'red'),
      l(x,19,z+9,x+i,25,z+6,'dark')])],
  'radio-repeater-stack':(w,h,z)=>Array.from({length:Math.floor((h-5)/7)},(_,i)=>[
    b(8,10,z+3+i*7,w-9,23,z+7+i*7,'offwhite'),
    b(9,23,z+5+i*7,16,24,z+6+i*7,'glass'),c(w-12,21,z+7+i*7,z+8+i*7,1,'dark'),
    l(w-10,19,z+7+i*7,w-10,20,z+10+i*7,'iron')]).flat(),
  'maintenance-diagnostic-rack':(w,h,z)=>[
    b(8,10,z+2,w-9,23,z+5,'dark'),b(9,10,z+6,w-10,15,z+h-2,'steel'),
    b(10,15,z+8,w-11,15,z+h-3,'glass'),b(10,16,z+8,w-11,20,z+9,'dark'),
    b(11,17,z+10,w-12,19,z+10,'offwhite'),b(12,21,z+6,17,24,z+7,'amber')],
  'tape-backup-carousel':(w,h,z)=>[
    b(8,9,z+2,w-9,24,z+6,'dark'),
    ...[11,Math.floor(w/2),w-12].flatMap(x=>[c(x,16,z+6,z+h-4,3,'steel'),
      c(x,16,z+h-3,z+h-2,1,'dark'),b(x-2,19,z+9,x+2,22,z+10,'amber')])],
};
const bases={
  'equipment-feet':w=>({z:2,ops:[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,1,'dark')))}),
  'service-casters':w=>({z:6,ops:[
    ...[5,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+3,y+2,3,'dark'))),b(4,6,4,w-5,24,5,'steel')]}),
  'raised-floor-sleeve':w=>({z:6,ops:[b(3,5,0,w-4,25,2,'dark'),b(4,6,3,w-5,24,5,'gray'),
    b(5,24,4,13,25,5,'blue'),b(w-14,24,4,w-6,25,5,'iron')]}),
};
function exterior(job,w,h,z) {
  const x=w-10;
  switch(job) {
    case 'nas-hot-swap':
      return [b(8,8,z+h+1,13,12,z+h+2,'gray')];
    case 'patch-panel-fiber':
      return [c(w-8,14,z+h+2,z+h+5,4,'dark'),c(w-8,14,z+h+5,z+h+5,2,'steel'),
        l(w-6,14,z+h+3,w-3,19,z+h-3,'amber')];
    case 'battery-backup-drawers':
      return [b(9,8,z+h+1,w-10,13,z+h+4,'offwhite'),b(10,12,z+h+4,w-11,13,z+h+4,'amber')];
    case 'graphics-render-node':
      return [b(7,9,z+h+1,w-8,23,z+h+3,'iron'),
        c(11,16,z+h+3,z+h+4,4,'dark'),c(w-12,16,z+h+3,z+h+4,4,'dark')];
    case 'hvac-loop-sensor-bank':
      return [b(x,12,z+h+1,x+4,15,z+h+9,'blue'),b(x,15,z+h+5,x+4,16,z+h+8,'glass'),
        l(x+2,16,z+h+2,x+3,20,z+h-4,'gray')];
    case 'radio-repeater-stack':
      return [l(x,11,z+h+1,x,11,z+h+13,'steel'),l(x-5,15,z+h+1,x-5,17,z+h+10,'iron'),
        b(x-3,10,z+h+9,x+2,11,z+h+10,'gray')];
    case 'maintenance-diagnostic-rack':
      return [b(7,10,z+h+1,17,16,z+h+6,'iron'),b(8,16,z+h+2,16,16,z+h+5,'glass'),
        b(10,17,z+h+1,17,21,z+h+2,'gray')];
    case 'tape-backup-carousel':
      return [b(8,8,z+h+1,20,18,z+h+5,'dark'),c(12,14,z+h+5,z+h+5,2,'steel'),
        c(17,14,z+h+5,z+h+5,2,'amber')];
  }
  throw new Error(job);
}
const designs=[];
for(const [job,build] of Object.entries(internals)){
  for(const [format,w,h] of profiles){
    for(const [enclosure,frame] of Object.entries(housing)){
      for(const [base,support] of Object.entries(bases)){
        if(base==='service-casters'&&format==='desktop')continue;
        if(enclosure==='raised-fan-plenum'&&job==='hvac-loop-sensor-bank'&&format==='desktop')continue;
        const {z,ops}=support(w);
        designs.push({schemaVersion:1,id:`it-${job}-${format}-${enclosure}-${base}`,category:'it-infrastructure',
          layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
          footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...frame(w,h,z),...build(w,h,z),...exterior(job,w,h,z)]});
      }
    }
  }
}
await writeFamily('it-infrastructure',designs);
