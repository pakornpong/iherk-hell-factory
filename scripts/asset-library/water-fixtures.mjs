import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  white:{kind:'matte',color:'#dedbd1'}, stone:{kind:'matte',color:'#ada69b'},
  steel:{kind:'metal',color:'#a1aaae'}, chrome:{kind:'metal',color:'#87959e'},
  brass:{kind:'metal',color:'#b99c66'}, slate:{kind:'matte',color:'#59636c'},
  blue:{kind:'glass',color:'#9eafb4'}, oak:{kind:'wood',color:'#a17d5a'},
  grout:{kind:'matte',color:'#7e7b75'}, linen:{kind:'matte',color:'#c3b5a2'},
};
function basin(x,X,y,Y,z,depth,material='white'){
  return [b(x,y,z,X,Y,z+1,material),b(x,y,z+2,X,y+1,z+depth,material),
    b(x,Y-1,z+2,X,Y,z+depth,material),b(x,y+2,z+2,x+1,Y-2,z+depth,material),
    b(X-1,y+2,z+2,X,Y-2,z+depth,material)];
}
const models={
  'clawfoot-tub':(w)=>[
    ...[7,w-10].flatMap(x=>[8,22].map(y=>c(x,y,0,5,2,'brass'))),
    ...basin(4,w-5,5,26,5,13),b(4,5,18,w-5,7,19,'white'),b(4,24,18,w-5,26,19,'white'),
    c(w-9,15,7,7,2,'chrome')],
  'square-soak-tub':(w)=>[
    b(4,5,0,w-5,26,3,'stone'),...basin(4,w-5,5,26,4,16,'white'),
    b(4,5,19,w-5,9,20,'stone'),b(4,23,19,w-5,26,20,'stone'),
    b(w-13,10,7,w-7,22,12,'white'),c(9,17,6,6,2,'chrome')],
  'laundry-trough':(w)=>[
    ...[6,w-8].flatMap(x=>[7,22].map(y=>b(x,y,0,x+2,y+2,12,'chrome'))),
    ...basin(4,w-5,5,25,12,10,'steel'),b(5,5,22,w-6,8,31,'chrome'),
    b(6,20,20,15,23,21,'slate'),c(w-10,15,14,14,2,'chrome')],
  'workshop-mop-sink':(w)=>[
    b(4,5,0,w-5,26,2,'stone'),...basin(4,w-5,5,26,3,6,'stone'),
    b(5,5,9,w-6,8,35,'slate'),b(6,8,11,w-7,8,33,'steel'),
    c(Math.floor(w/2),18,5,5,2,'chrome'),b(6,20,7,11,24,9,'linen')],
  'step-in-shower':(w)=>[
    ...basin(4,w-5,5,26,0,4,'stone'),b(4,6,4,6,24,37,'blue'),
    b(4,6,4,w-5,8,42,'white'),b(7,8,10,w-6,8,40,'slate'),
    b(4,24,4,6,25,41,'chrome'),b(w-6,7,4,w-5,25,42,'chrome'),
    c(Math.floor(w/2),17,2,2,2,'chrome')],
  'sauna-floor-wash-station':(w)=>[
    b(4,5,0,w-5,25,2,'stone'),...basin(5,w-6,6,23,3,5,'stone'),
    b(5,6,10,7,8,26,'oak'),b(w-8,6,10,w-6,8,26,'oak'),
    ...[0,4,8,12].map(h=>b(6,6,13+h,w-7,7,14+h,'oak')),
    c(12,15,6,12,4,'oak'),c(12,15,12,12,3,'blue')],
  'fold-away-utility-basin':(w)=>[
    b(4,5,0,w-5,8,41,'stone'),...basin(5,w-6,9,25,18,6,'steel'),
    l(6,10,15,6,23,18,'chrome'),l(w-7,10,15,w-7,23,18,'chrome'),
    b(w-13,8,28,w-8,10,33,'slate'),c(11,17,20,20,2,'chrome')],
};
const fittings={
  'wall-riser':w=>[
    b(w-11,7,14,w-10,8,40,'steel'),b(w-11,8,39,w-10,15,40,'steel'),
    c(w-10,16,38,39,3,'chrome'),b(w-12,9,22,w-9,11,24,'chrome')],
  'freestanding-mixer':w=>[
    c(w-9,10,0,27,1,'brass'),c(w-5,10,0,27,1,'brass'),
    b(w-9,9,26,w-5,11,28,'brass'),b(w-8,10,27,w-6,17,28,'brass'),
    c(w-7,17,26,27,1,'chrome')],
  'sprayer-hose':w=>[
    b(w-9,6,14,w-8,8,22,'slate'),l(w-9,8,16,w-5,12,9,'chrome'),
    l(w-5,12,9,w-5,16,9,'chrome'),l(w-5,16,9,w-7,16,25,'chrome'),
    b(w-8,15,25,w-6,20,27,'steel')],
  'assist-rail':w=>[
    b(4,9,3,5,10,28,'chrome'),b(4,23,3,5,24,28,'chrome'),
    b(4,10,27,5,23,29,'steel'),b(w-9,7,17,w-7,12,18,'chrome'),
    b(w-9,8,18,w-8,9,23,'steel')],
};
const designs=[];
for(const [name,build] of Object.entries(models)){
  for(const [variant,w] of [['compact',31],['wide',54]]){
    for(const [hardware,attachment] of Object.entries(fittings)){
      designs.push({schemaVersion:1,id:`plumbing-${name}-${variant}-${hardware}`,category:'plumbing',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[Math.ceil(w/32),1],palette:'office-night',materials,ops:[...build(w),...attachment(w)]});
    }
  }
}
await writeFamily('water-fixtures',designs);
