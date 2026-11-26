import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  iron:{kind:'metal',color:'#596168'}, silver:{kind:'metal',color:'#a4acab'},
  wood:{kind:'wood',color:'#aa7e56'}, walnut:{kind:'wood',color:'#795e4c'},
  dark:{kind:'matte',color:'#41464b'}, cream:{kind:'matte',color:'#d9d0bb'},
  blue:{kind:'matte',color:'#607d97'}, copper:{kind:'metal',color:'#b78260'},
  brass:{kind:'metal',color:'#bda16b'}, red:{kind:'matte',color:'#ab6652'}, glass:{kind:'glass',color:'#91aeba'},
};
function hollow(x,y,z,Z,r,outer){
  return [c(x,y,z,Z,r,outer),c(x,y,z+1,Z,r-1,null)];
}
const cookware={
  'copper-stockpot':[
    ...hollow(15,14,2,12,8,'copper'),c(15,14,12,12,8,'silver'),c(15,14,13,14,7,'silver'),
    c(15,14,15,16,1,'dark'),b(5,12,7,8,16,8,'silver'),b(22,12,7,25,16,8,'silver')],
  'cast-skillet':[
    ...hollow(12,13,2,5,8,'iron'),b(18,12,4,29,14,6,'dark'),
    b(25,12,6,29,14,6,'wood'),b(5,16,3,8,17,4,'iron')],
  'kettle-gooseneck':[
    c(15,14,2,10,6,'silver'),c(15,14,11,12,5,'silver'),c(15,14,13,15,1,'dark'),
    l(10,14,7,6,14,8,'silver'),l(6,14,8,5,14,13,'silver'),l(5,14,13,3,14,14,'silver'),
    l(20,13,10,24,13,13,'dark'),l(24,13,13,24,13,8,'dark'),l(24,13,8,20,13,7,'dark')],
  'steamer-basket-stack':[
    c(15,15,2,14,8,'wood'),...([5,9,13].map(z=>c(15,15,z,z,9,'walnut'))),
    c(15,15,15,16,7,'wood'),b(12,14,17,18,16,18,'walnut')],
  'baking-roll-and-cutters':[
    b(8,8,2,22,12,6,'wood'),b(5,9,3,8,11,4,'walnut'),b(22,9,3,26,11,4,'walnut'),
    ...hollow(9,19,2,4,3,'silver'),...hollow(19,21,2,5,4,'silver'),
    b(12,15,2,17,18,2,'cream')],
  'mortar-pestle':[
    c(14,15,2,3,5,'walnut'),...hollow(14,15,4,10,7,'iron'),
    l(14,15,7,21,13,18,'silver'),l(15,16,7,22,14,18,'silver'),b(19,12,16,23,15,19,'wood')],
  'strainer-and-colander':[
    c(14,14,2,3,5,'silver'),...hollow(14,14,4,9,7,'silver'),
    c(14,14,5,5,3,'dark'),b(4,12,7,7,16,8,'iron'),b(21,12,7,24,16,8,'iron'),
    ...hollow(23,20,2,3,3,'silver'),b(23,22,3,24,28,3,'iron')],
  'enameled-roaster':[
    b(7,7,2,24,23,5,'blue'),b(7,7,6,8,23,9,'blue'),b(23,7,6,24,23,9,'blue'),
    b(8,7,6,23,8,9,'blue'),b(8,22,6,23,23,9,'blue'),b(8,8,9,23,22,10,'cream'),
    b(12,13,11,19,17,12,'silver'),b(4,12,5,7,17,6,'silver'),b(24,12,5,27,17,6,'silver')],
  'measuring-jugs-and-spoons':[
    ...hollow(11,14,2,12,5,'glass'),b(15,13,7,18,15,10,'glass'),
    b(15,13,8,16,14,10,'blue'),...hollow(22,13,2,8,3,'glass'),
    ...[10,15,20].flatMap((x,i)=>[c(x,21+i,2,2,1,'silver'),b(x,22+i,2,x,25+i,2,'silver')])],
  'chef-knives-docking-block':[
    b(7,8,2,19,22,13,'wood'),b(8,9,13,18,21,14,'walnut'),
    ...[9,12,15,18].flatMap((x,i)=>[l(x,13,13,x,10,19+i%2,'silver'),b(x,9,18+i%2,x+1,11,22+i%2,'dark')]),
    b(20,13,2,26,23,4,'cream'),b(22,16,4,25,20,5,'red')],
  'oil-and-vinegar-caddy':[
    b(6,8,2,25,23,5,'wood'),c(12,14,5,16,3,'glass'),c(12,14,16,18,1,'brass'),
    c(20,15,5,13,3,'glass'),c(20,15,14,17,1,'dark'),
    b(7,8,5,8,23,17,'wood'),b(24,8,5,25,23,17,'wood'),b(7,19,17,25,21,18,'wood')],
  'spice-jars-tiered-rack':[
    b(5,7,2,26,23,5,'wood'),b(5,7,5,26,13,9,'wood'),
    ...[9,15,21].flatMap((x,i)=>[c(x,17,5,9,2,i%2?'glass':'cream'),c(x,17,10,10,2,'dark'),
      c(x,10,10,14,2,i%2?'red':'glass'),c(x,10,15,15,2,'silver')])],
};
const supports={
  'bare-counter': [b(4,6,0,27,25,1,'cream')],
  'raised-wood-board': [b(4,5,0,27,26,1,'walnut'),b(5,6,1,26,25,1,'wood'),
    b(4,5,0,5,9,2,'walnut'),b(26,22,0,27,26,2,'walnut')],
  'enameled-utility-tray': [b(4,6,0,27,25,1,'blue'),b(4,6,1,5,25,3,'blue'),b(26,6,1,27,25,3,'blue'),
    b(5,6,1,26,7,3,'blue'),b(5,24,1,26,25,3,'blue')],
  'range-grate': [b(4,6,0,27,25,1,'iron'),b(5,8,1,26,23,1,'dark'),
    ...[7,14,21].map(y=>b(6,y,2,25,y+1,2,'iron'))],
  'apron-display-bench': [b(4,6,0,27,25,2,'wood'),b(4,6,0,6,25,1,'walnut'),
    b(25,6,0,27,25,1,'walnut'),b(4,8,2,5,23,7,'wood'),b(26,8,2,27,23,7,'wood')],
};
const designs=[];
for(const [item,ops] of Object.entries(cookware)){
  for(const [mount,base] of Object.entries(supports)){
    if(mount==='range-grate'&&!['copper-stockpot','cast-skillet','kettle-gooseneck','steamer-basket-stack','enameled-roaster'].includes(item))continue;
    designs.push({schemaVersion:1,id:`cookware-${item}-${mount}`,category:'kitchen',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],
      palette:'office-night',materials,ops:[...base,...ops]});
  }
}
await writeFamily('cookware',designs);
