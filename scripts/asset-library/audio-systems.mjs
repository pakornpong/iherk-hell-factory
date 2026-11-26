import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  cabinet:{kind:'wood',color:'#8f6952'}, burl:{kind:'wood',color:'#ac815f'},
  black:{kind:'matte',color:'#353941'}, grille:{kind:'matte',color:'#5f5b58'},
  rubber:{kind:'matte',color:'#4d5159'}, aluminum:{kind:'metal',color:'#a1a8aa'},
  brass:{kind:'metal',color:'#c2a166'}, ivory:{kind:'matte',color:'#d2cbb6'},
  red:{kind:'matte',color:'#9e594f'},
};

function disc(x,y,z,r,material){
  const ops=[];
  for(let dz=-r;dz<=r;dz++){
    const width=Math.floor(Math.sqrt(r*r-dz*dz));
    ops.push(b(x-width,y,z+dz,x+width,y,z+dz,material));
  }
  return ops;
}
function drivers(x,y,z,r){
  return [...disc(x,y,z,r,'rubber'),...disc(x,y+1,z,r-1,'grille'),...disc(x,y+2,z,Math.max(1,r-3),'aluminum')];
}
const enclosures={
  'tower-three-way': (z)=>[
    b(7,8,z,24,22,z+33,'cabinet'),b(8,9,z+33,23,21,z+34,'burl'),
    ...drivers(15,22,z+8,6),...drivers(15,22,z+20,5),...drivers(15,22,z+28,2)],
  'studio-nearfield': (z)=>[
    b(6,7,z,25,21,z+25,'black'),b(8,8,z+25,23,20,z+26,'rubber'),
    ...drivers(15,21,z+8,6),...drivers(15,21,z+19,4),b(8,22,z+2,22,22,z+3,'aluminum')],
  'pa-horn-loaded': (z)=>[
    b(5,6,z,26,21,z+29,'black'),b(6,21,z+2,25,22,z+14,'grille'),
    ...drivers(15,22,z+9,6),b(7,21,z+16,24,22,z+27,'aluminum'),
    b(8,22,z+17,23,23,z+26,'black'),b(12,23,z+20,19,24,z+23,'rubber'),
    b(13,23,z+21,18,24,z+22,'brass')],
  'portable-boombox': (z)=>[
    b(3,8,z,28,21,z+16,'rubber'),b(4,21,z+1,27,22,z+15,'aluminum'),
    ...drivers(8,22,z+7,4),...drivers(23,22,z+7,4),b(12,22,z+5,19,23,z+9,'black'),
    b(13,23,z+6,18,23,z+8,'ivory'),b(8,11,z+16,9,12,z+21,'black'),
    b(22,11,z+16,23,12,z+21,'black'),b(8,11,z+21,23,12,z+22,'black')],
  'horizontal-center': (z)=>[
    b(3,9,z,28,23,z+12,'cabinet'),b(4,23,z+1,27,23,z+11,'black'),
    ...drivers(9,23,z+6,4),...drivers(15,23,z+6,2),...drivers(22,23,z+6,4)],
  'vintage-console-radio': (z)=>[
    b(5,7,z,26,23,z+17,'cabinet'),b(7,8,z+17,24,22,z+19,'burl'),
    b(7,23,z+2,23,23,z+11,'grille'),...[4,7,10].map(h=>b(8,24,z+h,22,24,z+h,'brass')),
    b(8,23,z+13,18,23,z+15,'ivory'),...disc(22,24,z+14,2,'aluminum')],
  'line-array-module': (z)=>[
    b(6,7,z,25,22,z+23,'black'),b(8,22,z,23,23,z+23,'grille'),
    ...[5,12,19].flatMap(h=>[...disc(12,23,z+h,3,'rubber'),...disc(19,23,z+h,3,'rubber'),
      b(7,23,z+h-3,24,23,z+h-3,'aluminum')])],
  'subwoofer-ported': (z)=>[
    b(6,6,z,25,24,z+21,'cabinet'),b(7,24,z+1,24,24,z+20,'black'),
    ...drivers(15,24,z+12,7),b(8,25,z+2,23,26,z+4,'aluminum'),b(9,26,z+2,22,26,z+3,'black')],
};
const supports={
  'isolating-wedges':{z:3,ops:[
    ...[8,21].flatMap(x=>[b(x,9,0,x+2,23,1,'rubber'),b(x,9,2,x+2,17,2,'rubber')])]},
  'low-media-stand':{z:8,ops:[
    ...[5,24].flatMap(x=>[8,23].map(y=>b(x,y,0,x+2,y+2,7,'cabinet'))),
    b(4,7,6,27,26,7,'burl')]},
  'rolling-case':{z:8,ops:[
    ...[5,24].flatMap(x=>[7,23].map(y=>b(x,y,0,x+2,y+2,3,'black'))),
    b(4,6,4,27,25,7,'aluminum'),b(5,6,5,7,25,7,'black'),b(24,6,5,26,25,7,'black')]},
  'swing-wall-bracket':{z:12,ops:[
    b(8,5,0,23,7,17,'aluminum'),l(8,7,3,8,18,11,'black'),l(23,7,3,23,18,11,'black'),
    b(5,8,10,26,25,11,'black')]},
  'raised-tripod':{z:19,ops:[
    ...[[5,23],[26,23],[15,4]].map(([x,y])=>l(15,15,18,x,y,0,'aluminum')),
    c(15,15,14,18,2,'black'),b(7,8,18,24,24,18,'black')]},
};
const designs=[];
for(const [speaker,build] of Object.entries(enclosures)){
  const mounts = ['subwoofer-ported','tower-three-way'].includes(speaker)
    ? ['isolating-wedges','low-media-stand','rolling-case']
    : Object.keys(supports);
  for(const mount of mounts){
    const {z,ops}=supports[mount];
    designs.push({schemaVersion:1,id:`audio-${speaker}-${mount}`,category:'audio',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
      footprintTiles:[1,1],palette:'office-night',materials,ops:[...ops,...build(z)]});
  }
}
await writeFamily('audio-systems',designs);
