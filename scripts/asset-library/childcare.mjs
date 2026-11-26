import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  wood:{kind:'wood',color:'#b58b64'}, oak:{kind:'wood',color:'#9b7555'},
  ivory:{kind:'matte',color:'#ddd3bf'}, linen:{kind:'matte',color:'#b7a58e'},
  red:{kind:'matte',color:'#ac6c5c'}, blue:{kind:'matte',color:'#6d8498'},
  steel:{kind:'metal',color:'#8f9ba1'}, yellow:{kind:'matte',color:'#c4a463'},
  dark:{kind:'matte',color:'#4a535a'}, pink:{kind:'matte',color:'#a97880'},
  mats:{kind:'matte',color:'#978d86'},
};
const play={
  'dollhouse-open-room': (w,z)=>[
    b(5,6,z,w-6,25,z+3,'wood'),b(5,6,z,w-6,9,z+24,'ivory'),
    b(5,6,z+3,7,24,z+24,'wood'),b(w-8,6,z+3,w-6,24,z+24,'wood'),
    b(7,8,z+12,w-8,23,z+13,'wood'),
    ...[11,w-14].flatMap(x=>[b(x,11,z+4,x+3,18,z+7,'blue'),b(x,11,z+14,x+2,18,z+17,'red')]),
    l(5,7,z+24,Math.floor(w/2),7,z+34,'red'),l(w-6,7,z+24,Math.floor(w/2),7,z+34,'red')],
  'pretend-kitchen-sink':(w,z)=>[
    b(5,6,z,w-6,24,z+13,'wood'),b(4,5,z+13,w-5,25,z+15,'ivory'),
    b(6,24,z+3,14,25,z+11,'blue'),b(w-15,24,z+3,w-7,25,z+11,'red'),
    c(11,15,z+16,z+16,4,'dark'),c(w-11,16,z+16,z+16,5,'steel'),c(w-11,16,z+16,z+16,3,'blue'),
    b(w-12,9,z+16,w-11,10,z+22,'steel'),b(w-12,10,z+21,w-11,14,z+22,'steel')],
  'toy-train-activity-table':(w,z)=>[
    ...[6,w-9].flatMap(x=>[7,22].map(y=>b(x,y,z,x+2,y+2,z+7,'wood'))),
    b(4,5,z+7,w-5,25,z+9,'wood'),
    ...[9,20].map(y=>b(7,y,z+10,w-8,y+1,z+10,'dark')),
    b(7,9,z+10,8,21,z+10,'dark'),b(w-9,9,z+10,w-8,21,z+10,'dark'),
    b(12,9,z+11,17,12,z+14,'red'),b(18,9,z+11,23,12,z+13,'blue'),
    b(w-12,14,z+10,w-9,18,z+13,'yellow')],
  'soft-climb-and-slide':(w,z)=>[
    ...[0,1,2].map(i=>b(6+i*5,9,z,10+i*5,22,z+3+4*i,['blue','yellow','red'][i])),
    {op:'slope',from:[20,9,z],to:[w-6,22,z+12],axis:'-X',material:'blue'},
    b(20,9,z,21,22,z+12,'red')],
  'nap-mat-stack':(w,z)=>[
    b(4,6,z,w-5,25,z+3,'oak'),
    ...[4,7,10,13].map((h,i)=>b(6,8,z+h,w-7,23,z+h+2,['blue','pink','linen','ivory'][i])),
    b(7,8,z+16,15,14,z+18,'ivory'),b(w-16,17,z+16,w-7,23,z+17,'pink')],
  'sensory-peg-panel':(w,z)=>[
    b(5,6,z,w-6,9,z+26,'wood'),b(5,8,z,w-6,22,z+3,'wood'),
    ...[6,13,19].flatMap((h,i)=>Array.from({length:Math.floor((w-10)/5)},(_,j)=>
      b(7+5*j,9,z+h,9+5*j,11,z+h+2,['blue','red','yellow','ivory'][(i+j)%4]))),
    b(6,12,z+4,w-7,17,z+5,'linen')],
  'puzzle-cubby-bench':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'wood'),b(5,6,z+3,7,24,z+14,'wood'),
    b(w-8,6,z+3,w-6,24,z+14,'wood'),b(6,6,z+13,w-7,24,z+15,'wood'),
    b(Math.floor(w/2),7,z+3,Math.floor(w/2)+1,23,z+13,'wood'),
    b(8,13,z+4,14,22,z+8,'blue'),b(w-15,9,z+4,w-9,21,z+9,'red'),
    b(9,9,z+15,18,18,z+16,'yellow'),b(12,11,z+16,14,13,z+17,'red')],
  'coat-cubbies-with-pegs':(w,z)=>[
    b(5,6,z,w-6,9,z+29,'wood'),b(5,9,z,w-6,24,z+3,'wood'),
    b(5,8,z+27,w-6,24,z+29,'wood'),
    ...Array.from({length:Math.floor((w-9)/6)},(_,i)=>{
      const x=7+6*i;
      return [b(x,9,z+3,x+1,23,z+28,'wood'),b(x+2,9,z+21,x+3,13,z+22,'steel'),
        b(x+2,10,z+7,x+4,11,z+20,i%2?'blue':'red')];
    }).flat()],
  'reading-tent-nook':(w,z)=>[
    b(5,6,z,w-6,24,z+3,'mats'),b(7,9,z+3,w-8,23,z+5,'blue'),
    l(6,7,z+4,Math.floor(w/2),7,z+29,'wood'),l(w-7,7,z+4,Math.floor(w/2),7,z+29,'wood'),
    l(6,23,z+4,Math.floor(w/2),23,z+29,'wood'),l(w-7,23,z+4,Math.floor(w/2),23,z+29,'wood'),
    ...Array.from({length:13},(_,i)=>{
      const x=Math.round(6+i*(w-13)/12);
      return b(x,8,z+5+Math.round((6-Math.abs(i-6))*4),x,15,z+6+Math.round((6-Math.abs(i-6))*4),'ivory');
    }),b(9,17,z+5,15,22,z+7,'pink')],
  'art-easel-with-smock':(w,z)=>[
    l(9,11,z,13,12,z+29,'wood'),l(w-10,11,z,w-14,12,z+29,'wood'),
    l(Math.floor(w/2),25,z,Math.floor(w/2),12,z+29,'wood'),
    b(9,11,z+14,w-10,15,z+29,'wood'),b(10,15,z+15,w-11,15,z+28,'ivory'),
    l(12,15,z+18,w-14,15,z+22,'red'),l(12,15,z+23,w-15,15,z+19,'blue'),
    b(8,13,z+12,w-9,18,z+13,'wood'),c(11,16,z+14,z+17,1,'yellow')],
};
const bases={
  'cork-floor':w=>({z:2,ops:[b(3,5,0,w-4,26,1,'mats'),b(4,6,1,w-5,25,1,'linen')]}),
  'raised-oak-deck':w=>({z:6,ops:[
    b(4,6,0,w-5,25,2,'oak'),...([6,11,16,21].map(y=>b(4,y,3,w-5,y+3,5,'wood')))]}),
  'soft-edge-pad':w=>({z:4,ops:[
    b(3,5,0,w-4,26,2,'blue'),b(4,6,2,w-5,25,3,'mats'),
    b(4,6,3,w-5,7,3,'yellow')]}),
  'storage-platform':w=>({z:8,ops:[
    b(4,6,0,w-5,25,6,'oak'),b(5,7,6,w-6,24,7,'mats'),
    b(7,25,2,w-8,26,5,'wood'),b(12,26,4,17,26,4,'steel')]}),
};
function activityExtras(item, base, w, z) {
  if (base === 'cork-floor') return [];
  const right = w - 5;
  const mid = Math.floor(w / 2);
  if (item === 'soft-climb-and-slide') {
    if (base === 'raised-oak-deck') return [l(7,8,z+4,20,8,z+18,'wood'),l(7,22,z+4,20,22,z+18,'wood')];
    if (base === 'soft-edge-pad') return [b(right-6,11,z+1,right,21,z+4,'yellow')];
    return [b(6,7,z,8,24,z+11,'wood'),b(8,24,z+4,23,25,z+7,'blue')];
  }
  if (item === 'nap-mat-stack') {
    if (base === 'raised-oak-deck') return [b(6,6,z+3,right,7,z+28,'wood'), b(6,7,z+24,right,12,z+27,'wood')];
    if (base === 'soft-edge-pad') return [b(7,19,z+14,16,24,z+18,'blue'), b(10,21,z+18,13,25,z+21,'linen')];
    return [b(5,8,z+3,7,24,z+24,'wood'), b(right-2,8,z+3,right,24,z+24,'wood'),
      b(5,8,z+23,right,24,z+24,'wood')];
  }
  if (base === 'raised-oak-deck') {
    const limit = Math.max(18, mid+4);
    return [b(5,6,z+5,7,8,z+18,'wood'),b(5,7,z+17,limit,13,z+19,'wood'),
      c(10,10,z+20,z+23,2,'red'),b(14,9,z+20,17,11,z+23,'linen')];
  }
  if (base === 'soft-edge-pad') {
    return [b(4,23,z+1,11,28,z+6,'blue'),b(right-6,23,z+1,right,28,z+7,'pink'),
      b(right-5,23,z+7,right-1,27,z+8,'linen')];
  }
  return [b(right-8,8,z,right,22,z+12,'wood'),b(right-7,10,z+12,right-1,21,z+14,'linen'),
    b(right-6,14,z+15,right-2,19,z+18,'red')];
}
const designs=[];
for(const [item,build] of Object.entries(play)){
  for(const [size,w] of [['small',32],['group',60]]){
    for(const [base,support] of Object.entries(bases)){
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`childcare-${item}-${size}-${base}`,category:'childcare',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...ops,...build(w,z),...activityExtras(item,base,w,z)]});
    }
  }
}
await writeFamily('childcare',designs);
