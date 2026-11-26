import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  oak:{kind:'wood',color:'#a4866b'}, marine:{kind:'matte',color:'#698294'},
  gray:{kind:'metal',color:'#9caaa9'}, iron:{kind:'metal',color:'#596672'},
  black:{kind:'matte',color:'#40494e'}, ivory:{kind:'matte',color:'#ddd3bf'},
  clay:{kind:'matte',color:'#ad6d56'}, ochre:{kind:'matte',color:'#c19e62'},
  tan:{kind:'matte',color:'#b69c7e'}, glass:{kind:'glass',color:'#8ba7b4'},
};
function form(w,z){
  return {e:w-6,w,mid:Math.floor(w/2),
    b:(x,y,h,X,Y,H,m)=>B(x,y,z+h,X,Y,z+H,m),
    c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
    l:(x,y,h,X,Y,H,m)=>L(x,y,z+h,X,Y,z+H,m)};
}
const equipment={
  'small-boat-cradle':({b,l,e})=>[
    b(5,7,0,e,24,3,'iron'),...([8,e-5].flatMap(x=>[
      l(x,8,3,x,13,10,'iron'),l(x,22,3,x,18,10,'iron')])),
    b(9,12,7,e-4,19,10,'marine'),b(7,11,10,e-2,20,13,'marine'),
    b(6,10,13,e-1,21,15,'ivory'),b(7,11,15,9,20,17,'ivory'),
    b(e-4,11,15,e-2,20,17,'ivory'),b(8,11,15,e-2,12,17,'ivory'),
    b(8,19,15,e-2,20,17,'ivory'),b(10,13,15,e-5,18,15,'oak'),
    b(e-14,13,16,e-8,18,18,'oak'),b(e-8,12,16,e-6,19,22,'glass')],
  'wetsuit-drying-rail':({b,l,e})=>[
    b(5,7,0,e,24,3,'gray'),b(6,9,4,8,11,39,'gray'),b(e-3,9,4,e-1,11,39,'gray'),
    b(6,9,38,e-1,11,40,'gray'),
    ...Array.from({length:Math.floor((e-12)/6)},(_,i)=>{
      const x=9+6*i;
      return [l(x,10,38,x,14,33,'gray'),b(x,12,20,x+2,17,33,i%2?'marine':'black'),
        b(x,13,13,x,17,21,'black'),b(x+2,13,13,x+2,17,21,'black')];
    }).flat()],
  'oar-storage-cradle':({b,l,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,7,3,9,24,16,'oak'),b(e-4,7,3,e-1,24,16,'oak'),
    ...[10,15,20].flatMap((y,i)=>[l(7,y,13+i%2,e-2,y+1,13+i%2,'oak'),
      b(e-8,y-1,13+i%2,e-1,y+2,14+i%2,i%2?'ivory':'marine')])],
  'marine-radio-and-weather-rack':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'oak'),b(6,8,4,e-1,11,27,'marine'),
    b(7,11,12,21,16,22,'iron'),b(9,16,17,16,16,20,'glass'),
    c(18,16,14,15,1,'gray'),l(8,9,23,7,9,35,'gray'),
    b(e-11,12,5,e-3,20,12,'ivory'),b(e-9,20,8,e-5,20,10,'glass')],
  'boat-winch-bollard':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'iron'),b(8,10,4,11,20,18,'gray'),b(20,10,4,23,20,18,'gray'),
    b(11,11,7,20,19,17,'tan'),c(15,15,17,20,4,'iron'),
    l(15,20,11,e-5,25,3,'tan'),c(e-5,18,4,14,3,'black'),
    c(e-5,18,14,16,4,'black')],
  'paddleboard-stacking-rack':({b,e})=>[
    b(5,7,0,e,24,3,'gray'),b(6,7,4,8,9,28,'gray'),b(e-3,7,4,e-1,9,28,'gray'),
    ...[5,13,21].flatMap((h,i)=>[b(7,9,h,e-2,23,h+1,'iron'),
      b(8,10,h+2,e-3,22,h+4,['marine','ivory','clay'][i]),b(10,13,h+4,e-6,20,h+4,'tan')])],
  'boatyard-outboard-service':({b,c,l,e})=>[
    b(5,7,0,e,24,4,'iron'),b(6,9,4,8,11,28,'gray'),b(e-3,9,4,e-1,11,28,'gray'),
    b(7,9,26,e-2,11,28,'oak'),c(15,14,24,34,5,'marine'),b(14,14,10,16,16,25,'black'),
    l(15,15,11,20,17,12,'gray'),b(19,16,11,22,18,13,'gray')],
  'life-jacket-cabinet':({b,e})=>[
    b(5,6,0,e,10,29,'marine'),b(5,7,0,7,24,29,'marine'),b(e-2,7,0,e,24,29,'marine'),
    b(5,7,28,e,24,30,'gray'),b(5,7,0,e,24,2,'gray'),
    ...Array.from({length:Math.floor((e-8)/5)},(_,i)=>{
      const x=8+5*i;
      return [b(x,12,12,x+2,16,23,'ochre'),b(x,16,15,x+2,17,16,'black'),b(x,16,20,x+2,17,21,'black')];
    }).flat()],
  'dockside-bilge-cart':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'iron'),b(7,8,4,20,23,13,'marine'),c(13,14,13,17,3,'gray'),
    b(19,12,8,e-4,15,11,'black'),l(e-5,14,10,e-2,24,5,'black'),
    l(e-2,24,5,e-8,28,5,'black'),b(7,19,13,12,24,15,'ivory')],
  'navigation-light-pedestal':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'iron'),...([10,e-5].flatMap((x,i)=>[
      c(x,14,3,23,1,'gray'),c(x,14,23,25,3,'black'),
      c(x,14,26,30,3,i?'ivory':'clay'),c(x,14,31,32,3,'black')])),
    l(10,14,10,e-5,14,10,'gray')],
  'fender-storage-tower':({b,c,e})=>[
    b(5,7,0,e,24,3,'gray'),b(6,7,4,e-1,9,33,'iron'),b(6,9,3,8,24,33,'iron'),
    b(e-3,9,3,e-1,24,33,'iron'),b(7,9,26,e-2,10,29,'gray'),
    ...[10,16,e-5].flatMap((x,i)=>[c(x,17,6,24+i%2,2,i%2?'ivory':'marine'),c(x,17,25,27,1,'black')])],
};
const mounts={
  'dock-wood':w=>({z:4,ops:[B(3,5,0,w-4,26,1,'iron'),
    ...[6,11,16,21].map(y=>B(4,y,2,w-5,y+3,3,'oak'))]}),
  'workshop-concrete':w=>({z:3,ops:[B(3,5,0,w-4,26,2,'gray'),B(4,24,2,w-5,25,2,'ochre')]}),
  'mobile-chassis':w=>({z:7,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'black'))),
    B(4,6,4,w-5,25,6,'iron'),B(w-7,7,6,w-5,24,9,'marine')]}),
  'stamped-service-tray':w=>({z:5,ops:[B(4,6,0,w-5,25,3,'iron'),B(5,7,4,w-6,24,4,'gray'),
    B(5,24,4,w-6,25,5,'marine')]}),
  'twin-bearer-skids':w=>({z:5,ops:[
    ...[7,22].map(y=>B(4,y,0,w-5,y+2,3,'oak')),B(4,6,4,w-5,25,4,'iron')]}),
};
const designs=[];
for(const [station,build] of Object.entries(equipment)){
  for(const [size,w] of [['dock-compact',34],['yard-wide',60]]){
    for(const [mount,support] of Object.entries(mounts)){
      if(mount==='mobile-chassis'&&['navigation-light-pedestal','life-jacket-cabinet'].includes(station))continue;
      const {z,ops}=support(w);
      designs.push({schemaVersion:1,id:`marina-${station}-${size}-${mount}`,category:'maritime',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
        palette:'office-night',materials,ops:[...ops,...build(form(w,z))]});
    }
  }
}
await writeFamily('marina-equipment',designs);
