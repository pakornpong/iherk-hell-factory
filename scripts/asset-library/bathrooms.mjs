import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  porcelain:{kind:'matte',color:'#e4e5de'}, shadow:{kind:'matte',color:'#aabec5'},
  chrome:{kind:'metal',color:'#98aeb9'}, dark:{kind:'matte',color:'#49586a'},
  wood:{kind:'wood',color:'#a97a53'}, tile:{kind:'matte',color:'#648e90'},
  brass:{kind:'metal',color:'#c2a060'}, glass:{kind:'glass',color:'#78aebc'},
};

const bodies = {
  'square-vanity': (w) => [b(4,6,0,w-5,27,3,'dark'),b(4,6,4,w-5,25,20,'wood'),
    b(6,25,5,w-7,26,10,'tile'),b(6,25,12,w-7,26,18,'tile'),
    b(9,27,7,w-10,27,7,'chrome'),b(9,27,15,w-10,27,15,'chrome')],
  'open-shelf': (w) => [4,w-7].flatMap(x=>[6,24].map(y=>b(x,y,0,x+2,y+2,20,'wood')))
    .concat(b(4,6,6,w-5,26,8,'wood'),b(8,8,9,w-9,21,11,'porcelain'),b(9,9,12,w-10,19,13,'shadow')),
  'wall-hung': (w) => [b(4,4,0,w-5,5,21,'shadow'),b(4,5,12,w-5,24,20,'tile'),
    b(5,24,14,w-6,25,18,'wood'),b(7,26,15,w-8,26,16,'brass')],
  'tube-frame': (w) => [5,w-7].flatMap(x=>[6,24].map(y=>b(x,y,0,x+1,y+1,20,'chrome')))
    .concat(b(5,6,4,w-6,7,5,'chrome'),b(5,24,10,w-6,25,11,'chrome'),
      b(7,24,9,15,25,13,'porcelain')),
};

const basins = {
  'ceramic-trough': w => [b(3,5,20,w-4,27,21,'porcelain'),b(3,5,22,w-4,10,25,'porcelain'),
    b(3,11,22,5,25,25,'porcelain'),b(w-6,11,22,w-4,25,25,'porcelain'),
    b(3,25,22,w-4,27,25,'porcelain'),c(Math.floor(w/2),18,22,22,2,'chrome')],
  'vessel-bowl': w => [b(3,5,20,w-4,27,21,'wood'),
    c(Math.floor(w/2),18,22,24,7,'porcelain'),c(Math.floor(w/2),18,25,27,8,'porcelain'),
    {op:'cylinder',center:[Math.floor(w/2),18],zFrom:25,zTo:27,radius:6,material:null}],
  'inset-pair': w => [
    b(3,5,20,w-4,27,22,'porcelain'),
    ...[Math.floor(w/4),Math.floor(3*w/4)].flatMap(x=>[
      {op:'cylinder',center:[x,18],zFrom:22,zTo:22,radius:4,material:null},
      c(x,18,21,21,2,'shadow'),b(x-1,16,21,x+1,17,21,'chrome'),
    ])],
};

const fittings = {
  'bridge-mixer': w => [Math.floor(w/2)-5,Math.floor(w/2)+4].flatMap(x=>[
    c(x,8,23,27,1,'brass'),b(x-1,7,27,x+1,9,27,'brass')])
    .concat(b(Math.floor(w/2)-5,8,25,Math.floor(w/2)+4,8,26,'brass'),
      b(Math.floor(w/2)-1,8,26,Math.floor(w/2),14,27,'brass')),
  'gooseneck': w => [
    c(Math.floor(w/2),8,23,30,1,'chrome'),b(Math.floor(w/2)-1,8,30,Math.floor(w/2)+1,15,31,'chrome'),
    c(Math.floor(w/2),15,28,30,1,'chrome')],
  'wall-spout': w => [b(4,4,22,w-5,6,33,'tile'),
    b(Math.floor(w/2)-1,6,28,Math.floor(w/2)+1,14,29,'chrome'),
    c(Math.floor(w/2),14,27,28,1,'chrome')],
  'utility-sprayer': w => [b(5,5,22,w-6,7,34,'shadow'),c(w-9,8,23,32,1,'dark'),
    b(w-11,8,32,w-8,13,33,'chrome'),b(w-12,12,29,w-8,14,32,'dark')],
};

const designs=[];
for(const [body, support] of Object.entries(bodies)){
  for(const [basin, counter] of Object.entries(basins)){
    for(const [fitting, faucet] of Object.entries(fittings)){
      const w = basin==='inset-pair' || body==='open-shelf' ? 49 : 31;
      designs.push({
        schemaVersion:1,id:`washbasin-${body}-${basin}-${fitting}`,category:'bathroom',layer:'object',
        outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials,ops:[...support(w),...counter(w),...faucet(w)],
      });
    }
  }
}
await writeFamily('bathrooms',designs);
