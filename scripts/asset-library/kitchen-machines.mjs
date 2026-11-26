import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  steel:{kind:'metal',color:'#a3b3bc'}, brushed:{kind:'metal',color:'#718392'},
  black:{kind:'matte',color:'#344252'}, ivory:{kind:'matte',color:'#dfd8c1'},
  teal:{kind:'matte',color:'#528a87'}, red:{kind:'matte',color:'#b2604d'},
  glass:{kind:'glass',color:'#7daeba'}, gold:{kind:'metal',color:'#cfac62'},
  light:{kind:'emissive',color:'#e6c280',glowRadius:1,glowIntensity:0.2},
};

const supports={
  'counter': () => ({ lift:0, ops:[b(5,5,0,26,24,1,'black')] }),
  'open-stand': () => ({ lift:10, ops:[b(4,5,9,27,26,10,'steel'),
    ...[5,24].flatMap(x=>[6,23].map(y=>b(x,y,0,x+2,y+2,9,'brushed'))),
    b(6,7,3,25,23,4,'brushed')] }),
  'drawer-station': () => ({ lift:13, ops:[b(5,5,0,26,25,1,'black'),b(5,5,2,26,24,13,'brushed'),
    b(6,24,4,25,25,7,'steel'),b(6,24,9,25,25,12,'steel'),
    b(12,25,6,19,26,6,'black'),b(12,25,10,19,26,10,'black')] }),
};

const appliances={
  'espresso-lever': z => [
    b(4,5,z,27,25,z+3,'brushed'),b(5,5,z+4,26,13,z+23,'ivory'),
    b(5,12,z+18,26,19,z+22,'ivory'),c(15,16,z+15,z+18,3,'gold'),
    b(14,17,z+14,17,22,z+15,'black'),b(15,10,z+22,16,11,z+30,'gold'),
    b(13,10,z+29,18,12,z+31,'black'),c(15,17,z+4,z+8,3,'ivory')],
  'spiral-mixer': z => [
    b(5,5,z,26,25,z+4,'red'),b(7,5,z+4,24,10,z+26,'red'),b(7,8,z+23,24,20,z+28,'red'),
    c(15,16,z+5,z+12,8,'steel'),c(15,16,z+13,z+14,8,'brushed'),
    {op:'cylinder',center:[15,16],zFrom:z+13,zTo:z+14,radius:6,material:null},
    c(15,16,z+14,z+23,1,'steel'),c(21,18,z+25,z+28,2,'gold')],
  'vacuum-sealer': z => [
    b(5,6,z,26,25,z+9,'steel'),b(6,7,z+9,25,24,z+11,'black'),
    b(7,6,z+12,24,11,z+25,'glass'),b(7,10,z+18,24,15,z+25,'glass'),
    b(7,18,z+11,24,20,z+11,'gold'),b(18,25,z+5,25,25,z+8,'black'),b(20,25,z+6,23,25,z+7,'light')],
  'hot-holding-case': z => [
    b(4,5,z,27,26,z+6,'brushed'),b(4,5,z+6,27,8,z+23,'ivory'),
    b(4,8,z+6,6,25,z+23,'glass'),b(25,8,z+6,27,25,z+23,'glass'),
    b(4,5,z+23,27,25,z+26,'brushed'),b(7,10,z+13,24,23,z+14,'steel'),
    b(8,11,z+8,16,19,z+9,'gold'),b(17,11,z+15,23,18,z+17,'red')],
  'induction-wok': z => [
    b(4,5,z,27,26,z+7,'black'),b(6,8,z+7,25,23,z+8,'brushed'),
    c(15,15,z+8,z+9,5,'black'),c(15,15,z+10,z+11,8,'black'),c(15,15,z+12,z+13,9,'black'),
    {op:'cylinder',center:[15,15],zFrom:z+11,zTo:z+13,radius:7,material:null},
    b(23,14,z+11,29,16,z+12,'gold'),b(18,25,z+4,24,26,z+5,'light')],
  'chamber-dishwasher': z => [
    b(4,5,z,27,24,z+27,'steel'),b(5,24,z+5,26,25,z+23,'brushed'),
    b(7,25,z+7,24,25,z+21,'glass'),b(5,25,z+23,26,27,z+25,'black'),
    b(7,25,z+25,11,26,z+26,'light'),b(19,25,z+25,23,26,z+26,'red')],
  'soda-carbonator': z => [
    b(5,5,z,26,25,z+3,'black'),b(7,7,z+4,24,13,z+28,'teal'),
    b(7,12,z+23,24,19,z+29,'teal'),b(14,17,z+19,16,19,z+24,'gold'),
    c(15,18,z+4,z+16,3,'glass'),c(15,18,z+17,z+18,2,'steel'),b(19,19,z+24,22,19,z+26,'light')],
  'food-dehydrator': z => [
    b(6,5,z,25,25,z+24,'ivory'),b(7,25,z+3,24,25,z+21,'black'),
    b(8,25,z+5,23,25,z+19,'glass'),...[7,11,15,19].map(h=>b(9,25,z+h,22,26,z+h,'gold')),
    b(10,25,z+22,15,25,z+23,'light'),b(19,25,z+21,22,26,z+23,'black')],
};

const designs=[];
for(const [machine, cook] of Object.entries(appliances)){
  for(const [stand, base] of Object.entries(supports)){
    const { lift, ops } = base();
    designs.push({schemaVersion:1,id:`kitchen-${machine}-${stand}`,category:'kitchen',layer:'object',
      outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[1,1],palette:'office-night',
      materials,ops:[...ops,...cook(lift+1)]});
  }
}
await writeFamily('kitchen-machines',designs);
