import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  soil:{kind:'matte',color:'#5d4635'}, leaf:{kind:'matte',color:'#597451'}, leafLight:{kind:'matte',color:'#7e915d'},
  leafDark:{kind:'matte',color:'#424f3f'}, bark:{kind:'wood',color:'#82664b'}, clay:{kind:'matte',color:'#a76851'},
  limewash:{kind:'matte',color:'#ccc3af'}, cement:{kind:'matte',color:'#929183'}, oak:{kind:'wood',color:'#a18160'},
  plum:{kind:'matte',color:'#9e657b'}, flower:{kind:'matte',color:'#d6ae54'}, iron:{kind:'metal',color:'#5f6468'},
};
const pots={
  'terracotta-rim': [c(15,15,0,1,6,'clay'),c(15,15,2,4,7,'clay'),c(15,15,5,8,8,'clay'),
    c(15,15,9,10,9,'clay'),c(15,15,10,10,7,'soil')],
  'cube-cement': [b(7,7,0,23,23,2,'cement'),b(6,6,3,24,24,10,'cement'),b(8,8,10,22,22,10,'soil')],
  'raised-oak': [7,22].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,10,'oak')))
    .concat(b(6,6,6,25,25,10,'oak'),b(8,8,10,23,23,10,'soil')),
  'fluted-ceramic': [
    c(15,15,0,10,8,'limewash'),c(15,15,10,10,6,'soil'),
    ...[[7,15],[23,15],[15,7],[15,23],[9,10],[21,10],[9,20],[21,20]].map(([x,y])=>
      b(x,y,3,x+1,y+1,8,'cement'))],
  'steel-tub': [
    b(5,8,1,25,22,9,'iron'),b(5,7,9,25,23,10,'iron'),b(7,9,10,23,21,10,'soil'),
    b(4,13,7,5,17,9,'iron'),b(25,13,7,26,17,9,'iron')],
  'stone-trough': [
    b(4,9,0,26,21,2,'cement'),b(3,8,3,27,22,6,'cement'),
    b(3,8,7,27,9,10,'cement'),b(3,21,7,27,22,10,'cement'),
    b(3,10,7,4,20,10,'cement'),b(26,10,7,27,20,10,'cement'),b(5,10,10,25,20,10,'soil')],
};
const plantTypes={
  'snake-leaf': (x,y)=>[
    b(x-1,y-2,11,x,y,35,'leaf'),l(x-3,y+2,13,x-6,y+3,29,'leafLight'),
    b(x+2,y-1,11,x+3,y,31,'leafDark'),l(x+2,y-2,18,x+6,y-4,28,'leaf'),l(x,y,16,x,y+5,30,'leafLight')],
  'split-leaf': (x,y)=>[
    ...[[-8,1,23],[7,-5,27],[7,7,20],[-2,-7,30]].flatMap(([dx,dy,z])=>[
      l(x,y,11,x+dx,y+dy,z,'leafDark'),b(x+dx-3,y+dy-2,z,x+dx+3,y+dy+2,z+1,'leaf'),
      b(x+dx-4,y+dy,z+1,x+dx+4,y+dy,z+1,'leafLight')])],
  'barrel-cactus': (x,y)=>[
    c(x,y,11,16,5,'leafDark'),c(x,y,17,23,6,'leaf'),c(x,y,24,26,4,'leafLight'),
    c(x,y,27,28,2,'flower'),...[[4,2],[-4,2],[1,5]].map(([dx,dy])=>b(x+dx,y+dy,15,x+dx,y+dy,23,'leafLight'))],
  'paddle-cactus': (x,y)=>[
    b(x-2,y-2,11,x+2,y+2,28,'leaf'),b(x+3,y,19,x+7,y+2,24,'leaf'),
    b(x+5,y,24,x+7,y+2,29,'leafLight'),b(x-7,y-2,16,x-3,y,20,'leafDark'),
    b(x-7,y-2,19,x-5,y,25,'leaf'),b(x+1,y+2,24,x+1,y+2,26,'leafLight')],
  'ficus-canopy': (x,y)=>[
    b(x,y,11,x+1,y+1,34,'bark'),l(x,y,23,x-5,y+2,31,'bark'),l(x,y,21,x+6,y-3,27,'bark'),
    c(x,y,30,35,7,'leaf'),c(x,y,36,39,4,'leafLight'),
    c(x-5,y+2,27,32,4,'leafDark'),c(x+5,y-3,25,30,4,'leaf')],
  'flower-spikes': (x,y)=>[
    ...[[-5,-3,24],[4,-2,27],[-1,4,31]].flatMap(([dx,dy,z],i)=>[
      l(x,y,11,x+dx,y+dy,z,'leaf'),l(x,y,15,x+dx+2,y+dy+1,19,'leafLight'),
      b(x+dx-1,y+dy-1,z-3,x+dx+1,y+dy+1,z,i%2?'flower':'plum')])],
  'fern-arches': (x,y)=>[
    ...[[-8,0],[8,0],[0,-7],[0,7],[-6,5],[6,-5]].flatMap(([dx,dy],i)=>[
      l(x,y,11,x+Math.round(dx/2),y+Math.round(dy/2),23+i%2,'leaf'),
      l(x+Math.round(dx/2),y+Math.round(dy/2),23+i%2,x+dx,y+dy,19,'leaf'),
      b(x+dx-1,y+dy-1,19,x+dx+1,y+dy+1,19,'leafLight')])],
  'hanging-trails': (x,y)=>[
    c(x,y,11,17,6,'leafDark'),c(x,y,16,19,4,'leaf'),
    ...[[7,2],[-7,4],[1,8]].flatMap(([dx,dy],i)=>[
      l(x,y,17,x+dx,y+dy,13,'leaf'),l(x+dx,y+dy,13,x+dx+1,y+dy+2,5+i*2,'leaf'),
      b(x+dx,y+dy+2,7+i*2,x+dx+2,y+dy+3,8+i*2,'leafLight')])],
  'mini-palm': (x,y)=>[
    l(x,y,11,x+2,y-1,40,'bark'),...[[8,0],[-7,2],[0,7],[0,-7]].flatMap(([dx,dy],i)=>[
      l(x+2,y-1,39,x+2+Math.round(dx/2),y-1+Math.round(dy/2),39+i%2,'leaf'),
      l(x+2+Math.round(dx/2),y-1+Math.round(dy/2),39+i%2,x+dx,y+dy,34,'leaf'),
      b(x+dx-1,y+dy-1,34,x+dx+1,y+dy+1,35,'leafLight')])],
  'bamboo-clump': (x,y)=>[
    ...[[-4,-2,33],[2,1,39],[4,-3,29],[-1,4,35]].flatMap(([dx,dy,z],i)=>[
      b(x+dx,y+dy,11,x+dx+1,y+dy+1,z,'leafLight'),
      ...[16,22,28].map(h=>b(x+dx,y+dy,h,x+dx+1,y+dy+1,h,'bark')),
      l(x+dx,y+dy,z-3,x+dx+(i%2?3:-3),y+dy+2,z-1,'leaf')])],
};
const designs=[];
for(const [plant, build] of Object.entries(plantTypes)){
  for(const [pot,ops] of Object.entries(pots)){
    designs.push({schemaVersion:1,id:`planter-${plant}-${pot}`,category:'gardening',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
      footprintTiles:[1,1],palette:'office-night',materials,ops:[...ops,...build(15,15)]});
  }
}
await writeFamily('gardening',designs);
