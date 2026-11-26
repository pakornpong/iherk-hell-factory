import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  black:{kind:'matte',color:'#293542'}, metal:{kind:'metal',color:'#768a96'},
  gray:{kind:'matte',color:'#4f626e'}, red:{kind:'matte',color:'#bd5e49'},
  gold:{kind:'metal',color:'#b89b5e'}, glass:{kind:'glass',color:'#75b4c3'},
  lcd:{kind:'emissive',color:'#90bebe',glowRadius:1,glowIntensity:.15},
};

const bodies={
  'box-cinema': z=>[
    b(8,6,z,23,16,z+13,'black'),b(9,5,z+2,22,6,z+11,'gray'),
    ...[8,10,12,14].map(y=>b(8,y,z+3,8,y,z+8,'metal')),b(13,15,z+10,18,16,z+12,'red')],
  'mirrorless-prism': z=>[
    b(6,8,z,25,16,z+9,'black'),b(21,7,z,25,19,z+8,'gray'),
    b(11,9,z+10,20,14,z+11,'gray'),b(13,10,z+12,18,13,z+13,'black'),
    b(22,9,z+9,23,11,z+10,'red')],
  'shoulder-eng': z=>[
    b(8,3,z,23,16,z+10,'gray'),b(9,2,z-1,22,8,z+1,'black'),
    b(9,3,z+3,22,6,z+12,'black'),b(6,9,z+7,9,13,z+13,'black'),
    b(4,10,z+10,6,12,z+12,'glass')],
  'cine-twin-magazine': z=>[
    b(7,6,z,24,16,z+11,'black'),c(11,9,z+11,z+15,4,'gray'),c(20,9,z+11,z+15,4,'gray'),
    b(8,11,z+12,22,13,z+16,'metal'),b(7,10,z+3,7,13,z+6,'gold')],
};
const lenses={
  'prime-matte-box': z=>[
    b(11,16,z+2,20,20,z+9,'gray'),b(8,21,z,23,24,z+11,'black'),
    b(10,24,z+2,21,24,z+9,'glass')],
  'telephoto-cage': z=>[
    b(12,16,z+3,19,28,z+8,'metal'),b(11,20,z+2,20,22,z+9,'black'),
    b(11,26,z+2,20,28,z+9,'black'),b(12,28,z+3,19,28,z+8,'glass'),
    b(9,16,z,10,28,z,'metal'),b(21,16,z,22,28,z,'metal')],
  'vintage-bellows': z=>[
    ...Array.from({length:5},(_,i)=>b(10+i%2,17+i*2,z+2,21-i%2,18+i*2,z+9,i%2?'gray':'black')),
    b(11,27,z+3,20,27,z+8,'gold'),b(12,27,z+4,19,27,z+7,'glass')],
};
const stands={
  'tripod-spreader': {height:24, ops:[
    ...[[5,24],[25,25],[15,3]].flatMap(([x,y])=>[
      l(15,13,21,x,y,0,'metal'),l(16,13,21,x+1,y,0,'black'),l(15,14,8,Math.round((15+x)/2),Math.round((14+y)/2),8,'gray')]),
    c(15,14,20,23,3,'black')]},
  'dolly-platform': {height:18, ops:[
    ...[4,24].flatMap(x=>[5,23].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
    b(3,4,3,28,27,5,'gray'),c(15,14,6,17,3,'metal'),
    b(9,8,16,22,18,17,'black'),l(25,7,5,25,2,20,'metal'),b(23,2,20,28,3,21,'red')]},
  'tabletop-gimbal': {height:11, ops:[
    c(15,13,0,2,9,'black'),c(15,13,3,7,2,'metal'),b(6,10,7,24,15,10,'gray'),
    b(6,10,10,8,12,21,'gray'),b(23,10,10,25,12,21,'gray'),
    c(7,11,19,22,2,'metal'),c(24,11,19,22,2,'metal')]},
  'hi-hat-platform': {height:7, ops:[
    b(4,4,0,27,25,2,'black'),...[[6,6],[24,6],[15,23]].map(([x,y])=>l(15,13,5,x,y,1,'metal')),
    c(15,13,3,6,4,'gray')]},
};
const designs=[];
for(const [camera, body] of Object.entries(bodies)){
  for(const [optic, buildLens] of Object.entries(lenses)){
    for(const [mount,{height,ops}] of Object.entries(stands)){
      designs.push({schemaVersion:1,id:`camera-${camera}-${optic}-${mount}`,category:'media',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[1,1],palette:'office-night',materials,
        ops:[...ops,...body(height),...buildLens(height)]});
    }
  }
}
await writeFamily('cameras',designs);
