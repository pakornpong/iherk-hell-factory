import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const s=(x,y,z,X,Y,Z,axis,material)=>({op:'slope',from:[x,y,z],to:[X,Y,Z],axis,material});
const materials={
  concrete:{kind:'matte',color:'#aaa5a0'}, oak:{kind:'wood',color:'#a7805d'},
  steel:{kind:'metal',color:'#9da8aa'}, slate:{kind:'metal',color:'#677481'},
  ivory:{kind:'matte',color:'#ddd6c7'}, rubber:{kind:'matte',color:'#414a50'},
  amber:{kind:'matte',color:'#c2a366'}, blue:{kind:'matte',color:'#627c98'},
  red:{kind:'matte',color:'#ac6a55'}, glass:{kind:'glass',color:'#8cabb8'},
};
const fixtures={
  'threshold-ramp-pair':(w,z)=>[
    s(4,7,z,w-5,25,z+10,'+X','steel'),b(w-9,7,z+9,w-5,25,z+10,'rubber'),
    ...[7,24].map(y=>l(4,y,z+1,w-5,y,z+11,'slate'))],
  'handrail-platform':(w,z)=>[
    s(4,7,z,w-10,25,z+11,'+X','concrete'),b(w-10,7,z,w-5,25,z+11,'concrete'),
    ...[7,24].flatMap(y=>[b(5,y,z,6,y+1,z+20,'steel'),b(w-7,y,z+10,w-6,y+1,z+29,'steel'),
      l(5,y,z+20,w-6,y,z+29,'steel'),l(5,y,z+17,w-6,y,z+26,'steel')])],
  'tactile-map-lectern':(w,z)=>[
    b(5,7,z,7,10,z+26,'slate'),b(w-8,7,z,w-6,10,z+26,'slate'),
    s(4,7,z+19,w-5,22,z+27,'-Y','ivory'),l(7,12,z+25,w-9,12,z+25,'blue'),
    l(10,15,z+24,15,18,z+23,'red'),l(w-15,15,z+24,w-10,16,z+24,'slate'),
    ...[8,14,w-10].flatMap(x=>[18,20].map(y=>c(x,y,z+22,z+23,0,'steel')))],
  'accessible-call-station':(w,z)=>[
    b(5,6,z,w-6,9,z+31,'ivory'),b(7,9,z+8,w-8,13,z+22,'steel'),
    b(9,13,z+13,w-10,13,z+20,'glass'),c(12,13,z+10,z+12,1,'blue'),
    b(w-12,13,z+9,w-10,14,z+11,'amber'),b(8,9,z+25,w-9,10,z+27,'blue')],
  'lowered-check-in-counter':(w,z)=>[
    b(4,7,z,9,24,z+18,'oak'),b(w-10,7,z,w-5,24,z+18,'oak'),
    b(4,7,z+16,w-5,24,z+19,'ivory'),b(5,7,z+20,w-6,9,z+27,'oak'),
    b(7,12,z+20,16,19,z+21,'slate'),b(10,13,z+21,14,15,z+29,'slate'),
    b(8,14,z+27,17,17,z+33,'rubber'),b(9,17,z+28,16,17,z+32,'glass')],
  'wheelchair-seat-space':(w,z)=>[
    b(4,7,z,w-5,24,z+2,'blue'),b(5,8,z+2,w-6,23,z+2,'ivory'),
    b(7,9,z+2,w-8,22,z+2,'blue'),c(13,14,z+3,z+3,3,'ivory'),
    l(13,14,z+3,17,18,z+3,'ivory'),b(5,7,z+3,6,8,z+21,'steel'),
    b(w-7,7,z+3,w-6,8,z+21,'steel'),b(5,7,z+20,w-6,9,z+21,'steel')],
  'fold-down-shower-seat':(w,z)=>[
    b(4,6,z,w-5,8,z+34,'ivory'),b(6,8,z+12,w-7,22,z+15,'oak'),
    ...[7,w-8].flatMap(x=>[l(x,8,z+5,x,21,z+12,'steel'),
      b(x,8,z+20,x+1,10,z+24,'slate')]),
    b(7,9,z+23,w-7,11,z+24,'steel'),b(7,21,z+11,w-7,23,z+13,'steel')],
  'portable-listening-station':(w,z)=>[
    b(5,7,z,w-6,23,z+8,'slate'),b(6,7,z+9,w-7,11,z+29,'blue'),
    b(8,11,z+21,w-9,11,z+26,'glass'),b(8,14,z+8,16,21,z+13,'rubber'),
    l(11,15,z+13,13,15,z+24,'steel'),l(13,15,z+24,21,16,z+25,'steel'),
    b(20,16,z+21,23,17,z+25,'slate')],
};
const bases={
  'rubber-hallway':w=>({z:2,ops:[b(3,5,0,w-4,26,1,'rubber'),b(4,6,1,w-5,7,1,'amber')]}),
  'stone-entry':w=>({z:4,ops:[
    b(3,5,0,w-4,26,2,'concrete'),b(3,5,3,w-4,8,3,'ivory'),b(4,23,3,w-5,25,3,'amber')]}),
  'threshold-board':w=>({z:3,ops:[
    b(3,5,0,w-4,26,1,'oak'),...([6,11,16,21].map(y=>b(4,y,2,w-5,y+3,2,'oak')))]}),
  'guide-path':w=>({z:3,ops:[
    b(3,5,0,w-4,26,2,'concrete'),b(3,22,2,w-4,26,2,'amber'),
    ...Array.from({length:Math.floor((w-7)/4)},(_,i)=>c(5+4*i,23,3,3,1,'amber'))]}),
};
const designs=[];
for(const [item,form] of Object.entries(fixtures)){
  for(const [layout,w] of [['compact',32],['wide',60]]){
    for(const [mount,base] of Object.entries(bases)){
      const {z,ops}=base(w);
      const sideRail=layout==='wide'&&['accessible-call-station','portable-listening-station'].includes(item)
        ? [b(w-17,13,z+9,w-8,13,z+28,'steel'),b(w-16,13,z+12,w-9,13,z+26,'blue')]
        : [];
      designs.push({schemaVersion:1,id:`access-${item}-${layout}-${mount}`,category:'accessibility',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...form(w,z),...sideRail]});
    }
  }
}
await writeFamily('accessibility',designs);
