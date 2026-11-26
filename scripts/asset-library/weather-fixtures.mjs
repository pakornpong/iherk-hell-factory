import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  frame:{kind:'metal',color:'#5b6874'}, silver:{kind:'metal',color:'#9da9aa'},
  pale:{kind:'matte',color:'#d7d2c5'}, dark:{kind:'matte',color:'#414950'},
  sky:{kind:'matte',color:'#657d93'}, amber:{kind:'matte',color:'#be9b62'},
  orange:{kind:'matte',color:'#aa6a53'}, wood:{kind:'wood',color:'#a58564'},
  glass:{kind:'glass',color:'#8cabb4'}, earth:{kind:'matte',color:'#8f765f'},
};
function tools(w,z){
  return {
    m:Math.floor(w/2),e:w-6,
    b:(x,y,h,X,Y,H,m)=>B(x,y,h+z,X,Y,H+z,m),
    l:(x,y,h,X,Y,H,m)=>L(x,y,h+z,X,Y,H+z,m),
    c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  };
}
const instruments={
  'tipping-bucket-rain-gauge':({b,c,e})=>[
    b(5,7,0,e,24,3,'frame'),c(13,15,4,20,6,'pale'),c(13,15,19,21,7,'silver'),
    c(13,15,21,21,5,'dark'),b(e-10,10,4,e-2,21,12,'sky'),b(e-8,21,7,e-4,21,9,'glass')],
  'stevenson-screen':({b,e})=>[
    ...[6,e-2].flatMap(x=>[8,22].map(y=>b(x,y,0,x+1,y+1,24,'silver'))),
    b(5,7,20,e,24,22,'pale'),b(5,7,33,e,24,36,'pale'),
    ...[23,26,29,32].map(h=>b(5,19,h,e,22,h+1,'pale')),
    b(5,7,22,7,18,33,'pale'),b(e-2,7,22,e,18,33,'pale')],
  'wind-vane-and-cup-mast':({b,c,l,m,e})=>[
    ...[[6,23],[e-2,23],[m,6]].map(([x,y])=>l(m,14,18,x,y,0,'frame')),
    c(m,14,15,42,1,'silver'),b(m-7,14,35,m+8,15,37,'amber'),
    b(m+6,13,34,m+8,16,38,'orange'),
    ...[[m-5,14],[m+4,10],[m+4,19]].flatMap(([x,y])=>[l(m,14,42,x,y,42,'silver'),c(x,y,42,44,2,'dark')])],
  'snow-depth-marker':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'pale'),b(6,8,4,e-1,23,4,'pale'),
    b(8,10,4,10,12,37,'orange'),
    ...[8,14,20,26,32].map(h=>b(9,12,h,11,12,h,'pale')),
    c(e-6,14,4,12,4,'pale'),b(e-7,14,12,e-5,15,22,'frame'),l(e-6,15,22,e-6,21,22,'silver')],
  'solar-radiation-platform':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'frame'),c(13,13,4,17,1,'silver'),c(13,13,17,20,5,'pale'),
    c(13,13,20,23,3,'glass'),l(14,15,17,e-5,19,10,'dark'),
    b(e-12,10,4,e-2,22,10,'sky'),b(e-10,22,6,e-4,22,8,'glass'),
    b(8,20,4,16,23,7,'silver')],
  'weather-balloon-crate':({b,c,l,e,m})=>[
    b(5,7,0,e,24,6,'wood'),b(6,8,7,e-1,23,10,'pale'),c(m,15,11,14,2,'pale'),
    c(m,15,15,17,4,'pale'),c(m,15,18,24,6,'pale'),c(m,15,25,28,4,'pale'),
    c(m,15,29,30,2,'pale'),l(m,15,11,e-4,20,7,'frame'),b(e-6,18,6,e-2,22,8,'sky')],
  'field-data-enclosure':({b,l,e})=>[
    b(5,7,0,e,24,3,'frame'),b(6,7,4,e-1,11,31,'silver'),
    b(7,11,10,20,19,23,'pale'),b(8,19,13,19,20,20,'glass'),
    b(e-8,11,8,e-2,17,21,'sky'),l(8,14,24,10,14,36,'frame'),
    l(e-5,18,16,e-4,23,7,'dark')],
  'fog-collection-screen':({b,l,e})=>[
    b(5,7,0,e,24,3,'frame'),b(6,8,3,7,10,35,'silver'),b(e-2,8,3,e-1,10,35,'silver'),
    b(6,8,33,e-1,10,35,'silver'),
    ...[14,18,22,26,30].map(h=>b(7,9,h,e-2,9,h,'pale')),
    ...Array.from({length:Math.floor((e-9)/4)},(_,i)=>b(9+i*4,9,12,9+i*4,9,33,'pale')),
    b(7,9,8,e-2,14,10,'sky'),l(e-3,12,10,e-4,20,3,'silver')],
  'forecast-display-desk':({b,e})=>[
    b(5,7,0,e,24,4,'wood'),b(6,8,5,e-1,11,28,'frame'),b(7,11,8,e-2,12,26,'glass'),
    b(9,12,11,14,12,17,'sky'),b(15,12,15,e-4,12,18,'pale'),
    b(10,12,21,e-4,12,22,'orange'),b(8,15,5,e-3,22,6,'silver'),
    b(11,16,6,18,21,6,'dark')],
  'water-stage-gauge':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'frame'),b(6,7,4,8,23,30,'sky'),b(6,18,5,e-1,24,6,'glass'),
    b(9,10,4,12,12,36,'pale'),...([8,14,20,26,32].map(h=>b(11,12,h,13,13,h,'orange'))),
    c(e-7,14,5,17,3,'silver'),l(e-7,14,18,e-3,14,23,'frame')],
};
const bases={
  'concrete-footing':w=>({z:4,ops:[B(4,6,0,w-5,25,2,'frame'),B(5,7,3,w-6,24,3,'pale')]}),
  'tripod-trailer':w=>({z:8,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,3,'dark'))),
    B(4,6,4,w-5,25,7,'silver'),B(w-7,13,3,w-1,16,5,'amber')]}),
  'soil-reference-plot':w=>({z:3,ops:[B(3,5,0,w-4,26,1,'wood'),B(4,6,2,w-5,25,2,'earth')]}),
  'calibration-bench':w=>({z:13,ops:[...[5,w-8].flatMap(x=>[7,22].map(y=>B(x,y,0,x+2,y+2,12,'frame'))),
    B(4,6,11,w-5,25,12,'wood'),B(6,9,6,w-7,23,7,'silver')]}),
  'roof-service-deck':w=>({z:5,ops:[B(4,6,0,w-5,25,3,'frame'),B(4,6,4,w-5,25,4,'silver'),
    B(5,6,4,w-6,8,5,'amber'),B(5,23,4,w-6,25,5,'amber')]}),
};
function fieldTelemetry(instrument,format,w,z) {
  if(format==='compact') return [];
  const {b,c,l,e}=tools(w,z);
  if(instrument==='weather-balloon-crate')
    return [b(8,11,6,17,21,11,'sky'),c(12,17,12,17,2,'silver'),l(12,17,17,16,20,22,'frame')];
  if(instrument==='stevenson-screen'||instrument==='fog-collection-screen')
    return [b(e-12,12,3,e-4,21,15,'sky'),b(e-11,21,9,e-5,21,12,'glass'),
      l(e-6,14,15,e-6,14,29,'silver')];
  if(instrument==='wind-vane-and-cup-mast'||instrument==='snow-depth-marker')
    return [c(e-10,14,3,24,1,'silver'),b(e-13,13,20,e-7,15,22,'amber'),
      b(e-12,13,23,e-8,15,25,'pale')];
  return [b(e-14,8,4,e-4,12,20,'frame'),b(e-13,12,16,e-5,18,19,'sky'),
    b(e-12,18,17,e-6,18,18,'glass'),l(e-9,15,15,e-6,20,8,'dark')];
}
const designs=[];
for(const [instrument,build] of Object.entries(instruments)) for(const [format,w] of [['compact',34],['station-wide',60]]){
  for(const [mount,base] of Object.entries(bases)){
    if(mount==='calibration-bench'&&instrument==='wind-vane-and-cup-mast')continue;
    const {z,ops}=base(w);
    designs.push({schemaVersion:1,id:`weather-${instrument}-${format}-${mount}`,category:'meteorology',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[2,1],
      palette:'office-night',materials,ops:[...ops,...build(tools(w,z)),...fieldTelemetry(instrument,format,w,z)]});
  }
}
await writeFamily('weather-fixtures',designs);
