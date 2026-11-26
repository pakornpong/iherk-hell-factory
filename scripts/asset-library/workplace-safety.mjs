import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  frame:{kind:'metal',color:'#667783'}, steel:{kind:'metal',color:'#a0a8a7'},
  ivory:{kind:'matte',color:'#ddd8c8'}, rubber:{kind:'matte',color:'#454b51'},
  orange:{kind:'matte',color:'#c3844e'}, yellow:{kind:'matte',color:'#c9ac61'},
  red:{kind:'matte',color:'#aa5d4f'}, blue:{kind:'matte',color:'#5a778e'},
  gray:{kind:'matte',color:'#9a9891'}, glass:{kind:'glass',color:'#94aeb6'},
};
function mark(x,y,z){
  return [b(x-1,y,z-3,x+1,y,z+3,'red'),b(x-3,y,z-1,x+3,y,z+1,'red')];
}
const stations={
  'first-aid-door': z=>[
    b(6,7,z,25,23,z+24,'ivory'),b(7,23,z+2,24,24,z+22,'steel'),
    b(9,24,z+4,22,24,z+21,'ivory'),...mark(15,24,z+15),
    b(10,25,z+5,14,25,z+6,'frame'),b(23,24,z+7,23,25,z+12,'frame')],
  'hearing-eye-protection-rack': z=>[
    b(5,6,z,26,9,z+30,'frame'),b(6,9,z+4,25,19,z+6,'steel'),
    b(6,9,z+16,25,17,z+18,'steel'),
    b(9,10,z+6,12,15,z+12,'blue'),b(18,11,z+6,21,15,z+12,'red'),
    b(9,11,z+12,21,13,z+13,'rubber'),b(9,11,z+18,22,14,z+21,'glass'),
    b(12,9,z+24,22,9,z+26,'ivory')],
  'spill-kit-with-sorbents': z=>[
    b(5,7,z,26,24,z+14,'yellow'),b(4,6,z+14,27,25,z+16,'rubber'),
    b(7,24,z+3,24,25,z+11,'ivory'),b(9,25,z+6,21,25,z+7,'orange'),
    c(11,12,z+17,z+23,3,'ivory'),c(21,17,z+17,z+22,3,'ivory'),
    b(8,7,z+17,24,8,z+31,'yellow')],
  'wall-hose-cabinet': z=>[
    b(5,6,z,26,23,z+30,'red'),b(6,23,z+2,25,24,z+28,'frame'),
    b(8,24,z+5,23,24,z+25,'glass'),
    ...[7,9,11,13].flatMap((r,i)=>Array.from({length:20},(_,j)=>{
      const a=j/20*2*Math.PI;
      const x=Math.round(15+(.52*r)*Math.cos(a)),h=Math.round(z+15+(.67*r)*Math.sin(a));
      return b(x,25-i%2,h,x,25-i%2,h,i%2?'red':'rubber');
    })),b(21,24,z+7,23,25,z+9,'steel')],
  'mobile-safety-screen': z=>[
    b(4,7,z,27,9,z+28,'frame'),b(5,9,z+4,26,10,z+26,'orange'),
    b(5,9,z+25,26,11,z+27,'yellow'),b(5,9,z+3,26,11,z+5,'yellow'),
    l(8,10,z+6,22,10,z+23,'red'),l(8,10,z+23,22,10,z+6,'red'),
    b(6,8,z,7,19,z+2,'steel'),b(24,8,z,25,19,z+2,'steel')],
  'defibrillator-station': z=>[
    b(7,7,z,24,21,z+22,'ivory'),b(8,21,z+3,23,23,z+19,'frame'),b(9,23,z+4,22,23,z+18,'glass'),
    b(10,22,z+6,21,24,z+14,'red'),b(12,24,z+10,19,24,z+12,'ivory'),
    b(12,11,z+22,20,15,z+30,'ivory'),...mark(16,15,z+26)],
  'helmet-rack': z=>[
    b(5,6,z,26,10,z+28,'frame'),...([8,16,24].map(h=>b(5,9,z+h,26,22,z+h+1,'steel'))),
    ...[9,17,25].flatMap((h,i)=>[c(10,15,z+h,z+h+2,3,i%2?'yellow':'ivory'),
      c(21,15,z+h,z+h+2,3,i%2?'ivory':'orange')])],
  'chemical-cabinet-secondary-tray': z=>[
    b(5,6,z,26,24,z+27,'yellow'),b(6,24,z+3,15,25,z+24,'orange'),
    b(17,24,z+3,25,25,z+24,'orange'),b(14,25,z+11,15,26,z+16,'rubber'),
    b(17,25,z+11,18,26,z+16,'rubber'),b(7,24,z+19,13,25,z+22,'ivory'),
    b(4,6,z,27,25,z+3,'frame')],
};
const bases={
  'fixed-plinth':{z:4,ops:[b(4,6,0,27,25,2,'gray'),b(5,6,2,26,24,3,'rubber')]},
  'caster-frame':{z:6,ops:[...[5,24].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,3,'rubber'))),
    b(4,6,4,27,25,5,'steel')]},
  'upright-panel':{z:10,ops:[b(4,5,0,27,9,37,'frame'),b(4,8,5,27,19,9,'gray'),
    b(4,9,36,27,9,38,'yellow')]},
  'desk-edge':{z:3,ops:[b(4,6,0,27,24,2,'gray'),b(4,22,0,6,26,8,'steel'),
    b(25,22,0,27,26,8,'steel')]},
};
const designs=[];
for(const [unit, build] of Object.entries(stations)){
  for(const [mount,{z,ops}] of Object.entries(bases)){
    designs.push({schemaVersion:1,id:`safety-${unit}-${mount}`,category:'workplace-safety',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
      footprintTiles:[1,1],palette:'office-night',materials,ops:[...ops,...build(z)]});
  }
}
await writeFamily('workplace-safety',designs);
