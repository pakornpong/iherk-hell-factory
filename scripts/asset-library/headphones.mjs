import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  frame:{kind:'metal',color:'#788e9f'}, leather:{kind:'matte',color:'#303c4b'},
  cushion:{kind:'matte',color:'#5e6b7d'}, mesh:{kind:'matte',color:'#849f9c'},
  brass:{kind:'metal',color:'#c3a25d'}, red:{kind:'matte',color:'#b36757'},
};

function oval(x, X, cy, cz, ry, rz, material, hollow=false){
  const ops=[];
  for(let dz=-rz;dz<=rz;dz++){
    const half=Math.floor(ry*Math.sqrt(1-(dz/rz)**2));
    const z=cz+dz;
    if(!hollow || Math.abs(dz)>=rz-1){
      ops.push(b(x,cy-half,z,X,cy+half,z,material));
    } else {
      ops.push(b(x,cy-half,z,X,cy-half+1,z,material),
        b(x,cy+half-1,z,X,cy+half,z,material));
    }
  }
  return ops;
}

const earcups={
  'sealed-rectangular': (x,X)=>[
    b(x,9,3,X,21,14,'frame'),b(x,11,2,X,19,15,'frame'),
    b(x,10,4,X,20,13,'red')],
  'open-grille-round': (x,X)=>[
    ...oval(x,X,15,9,7,7,'frame',true),
    ...[5,7,9,11,13].map(z=>b(x,11,z,X,19,z,'mesh'))],
  'compact-oval': (x,X)=>oval(x,X,15,9,4,7,'brass'),
  'large-oblong': (x,X)=>[
    ...oval(x,X,15,10,8,9,'frame'),...oval(x,X,15,10,7,7,'leather',true)],
  'faceted-studio': (x,X)=>[
    b(x,8,6,X,22,12,'frame'),b(x,10,3,X,20,15,'frame'),
    b(x,12,4,X,18,14,'mesh'),b(x,7,8,X,8,10,'brass')],
  'vented-sports': (x,X)=>[
    ...oval(x,X,15,9,5,6,'red',true),b(x,12,5,X,18,6,'frame'),
    b(x,10,10,X,20,11,'frame'),b(x,13,13,X,17,14,'brass')],
};

function arch(y, height, depth, material, width=10){
  const ops=[];
  let lastZ=14;
  for(let x=15-width;x<=15+width;x++){
    const dx=(x-15)/width;
    const z=14+Math.round(height*Math.sqrt(1-dx*dx));
    const thick=material==='leather'?3:2;
    const bottom=Math.min(z,lastZ)-thick;
    ops.push(b(x,y,bottom,x,y+depth,z,material));
    if(lastZ>z) ops.push(b(x-1,y,z-thick,x-1,y+depth,lastZ,material));
    lastZ=z;
  }
  return ops;
}

const bands={
  'padded-arch': ()=>arch(13,14,5,'leather'),
  'double-wire': ()=>[...arch(12,16,0,'frame'),...arch(18,16,0,'frame'),
    b(10,12,25,20,18,26,'cushion')],
  'suspension-sling': ()=>[...arch(15,16,1,'frame'),
    b(9,12,23,21,19,24,'mesh'),l(7,15,21,10,15,24,'frame'),l(23,15,21,20,15,24,'frame')],
  'telescoping-band': ()=>[
    l(5,15,13,8,15,24,'frame'),l(25,15,13,22,15,24,'frame'),
    b(7,13,19,9,17,24,'brass'),b(21,13,19,23,17,24,'brass'),
    b(9,12,24,21,18,27,'leather')],
  'angular-yoke': ()=>[
    b(4,13,12,6,16,21,'frame'),b(24,13,12,26,16,21,'frame'),
    l(5,14,21,11,14,29,'frame'),l(25,14,21,19,14,29,'frame'),
    b(10,12,28,20,17,30,'leather')],
};
const fittings={
  'over-ear': [b(7,10,4,9,20,14,'cushion'),b(21,10,4,23,20,14,'cushion')],
  'broadcast-boom': [
    b(7,10,5,8,20,14,'cushion'),b(22,10,5,23,20,14,'cushion'),
    l(6,18,8,9,25,7,'frame'),l(9,25,7,16,27,8,'frame'),b(15,26,7,18,28,9,'leather')],
};
const designs=[];
for(const [name,shape] of Object.entries(earcups)){
  for(const [band, buildBand] of Object.entries(bands)){
    for(const [fitting, extras] of Object.entries(fittings)){
      designs.push({schemaVersion:1,id:`headset-${name}-${band}-${fitting}`,category:'electronics',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[1,1],palette:'office-night',materials,
        ops:[...shape(4,7),...shape(23,26),...extras,...buildBand()]});
    }
  }
}
await writeFamily('headphones',designs);
