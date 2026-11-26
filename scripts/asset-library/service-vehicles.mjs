import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const s=(x,y,z,X,Y,Z,axis,material)=>({op:'slope',from:[x,y,z],to:[X,Y,Z],axis,material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  tire:{kind:'matte',color:'#383d42'}, iron:{kind:'metal',color:'#53616b'}, silver:{kind:'metal',color:'#a4acac'},
  body:{kind:'metal',color:'#b0b6b7'}, band:{kind:'matte',color:'#7b8589'}, glass:{kind:'glass',color:'#849ea9'},
  window:{kind:'matte',color:'#536e80'}, lamp:{kind:'matte',color:'#e2d8b3'}, brake:{kind:'matte',color:'#9c4e46'},
  wood:{kind:'wood',color:'#977856'}, canvas:{kind:'matte',color:'#8e8880'}, box:{kind:'matte',color:'#b19a78'},
};
const finishes={
  civic:{color:'#a5a7a4',trim:'#65788b'},
  coldchain:{color:'#d2cec1',trim:'#6e8792'},
  taxi:{color:'#c5a252',trim:'#63543e'},
  works:{color:'#b58450',trim:'#5c656b'},
  service:{color:'#848e9e',trim:'#505f70'},
  transit:{color:'#9aaab1',trim:'#a06a55'},
};

function disc(x,y,z,r,material) {
  return Array.from({length:2*r+1},(_,i)=>{
    const dz=i-r,d=Math.floor(Math.sqrt(r*r-dz*dz));
    return b(x-d,y,z+dz,x+d,y,z+dz,material);
  });
}
function base(length, axles, clearance) {
  const ops=[b(5,5,clearance,length-6,25,clearance+2,'iron')];
  for(const axle of axles){
    const r=clearance+1;
    for(const [edge,face] of [[4,2],[26,28]]){
      ops.push(...disc(axle,edge,r,r,'tire'),...disc(axle,face,r,r,'tire'),
        ...disc(axle,Math.min(edge,face)+1,r,r,'tire'),...disc(axle,face,r,Math.max(1,r-2),'silver'));
    }
  }
  return ops;
}
const cabins={
  'bonnet-crew':({d})=>[
    b(3,5,d,29,25,d+7,'body'),s(4,6,d+7,13,24,d+11,'+X','body'),
    b(13,6,d+7,27,24,d+14,'body'),b(15,7,d+15,26,23,d+18,'body'),
    b(16,6,d+11,25,6,d+15,'window'),b(16,24,d+11,25,24,d+15,'window'),
    b(13,8,d+12,14,22,d+14,'glass'),b(3,7,d+3,3,23,d+4,'iron'),
    ...[6,22].map(y=>b(3,y,d+5,4,y+2,d+6,'lamp'))],
  'forward-cab':({d})=>[
    b(3,5,d,22,25,d+15,'body'),b(4,6,d+15,22,24,d+18,'body'),
    b(3,7,d+10,3,23,d+14,'glass'),b(6,5,d+10,17,5,d+14,'window'),
    b(6,25,d+10,17,25,d+14,'window'),b(3,9,d+3,3,21,d+6,'iron'),
    b(3,6,d+4,3,8,d+6,'lamp'),b(3,22,d+4,3,24,d+6,'lamp'),
    b(8,25,d+8,12,25,d+8,'silver')],
  'rounded-minivan':({d})=>[
    b(4,5,d,23,25,d+10,'body'),b(7,6,d+10,26,24,d+15,'body'),
    b(11,7,d+15,25,23,d+17,'body'),s(4,6,d+10,10,24,d+14,'+X','glass'),
    b(11,6,d+11,23,6,d+14,'window'),b(11,24,d+11,23,24,d+14,'window'),
    b(4,7,d+4,4,11,d+7,'lamp'),b(4,20,d+4,4,24,d+7,'lamp')],
  'low-cab-chauffeur':({d})=>[
    b(3,5,d,26,25,d+7,'body'),s(6,6,d+7,14,24,d+13,'+X','glass'),
    b(14,6,d+7,26,24,d+14,'body'),b(16,7,d+14,25,23,d+15,'body'),
    b(15,6,d+9,23,6,d+12,'window'),b(15,24,d+9,23,24,d+12,'window'),
    b(3,6,d+4,3,11,d+5,'lamp'),b(3,19,d+4,3,24,d+5,'lamp')],
};

const cargo={
  'stake-bed':({a,e,d})=>[
    b(a,5,d,e,25,d+3,'wood'),b(a,5,d+4,a+2,25,d+13,'iron'),b(e-1,5,d+4,e,25,d+10,'body'),
    ...[a+4,Math.floor((a+e)/2),e-2].flatMap(x=>[5,24].map(y=>b(x,y,d+3,x+1,y+1,d+11,'iron'))),
    b(a,5,d+8,e,6,d+10,'wood'),b(a,24,d+8,e,25,d+10,'wood')],
  'walk-in-delivery':({a,e,d})=>[
    b(a,5,d,e,25,d+21,'body'),b(e,7,d+3,e,23,d+19,'band'),b(e,14,d+3,e,15,d+19,'iron'),
    b(e,11,d+10,e,13,d+11,'silver'),b(e,17,d+10,e,19,d+11,'silver'),
    b(a+3,25,d+5,a+10,25,d+15,'silver'),b(a,5,d+16,e,5,d+17,'band')],
  'canteen-hatch':({a,e,d})=>[
    b(a,5,d,e,25,d+18,'body'),b(a+2,25,d+7,e-3,25,d+14,'window'),
    b(a+1,25,d+6,e-2,28,d+7,'silver'),b(a+1,24,d+15,e-2,29,d+17,'band'),
    b(a,7,d+19,e,23,d+20,'body'),b(a+4,10,d+20,a+13,13,d+22,'silver')],
  'tow-ramp':({a,e,d})=>[
    s(a,5,d-2,e,25,d+5,'-X','iron'),b(a,8,d+5,a+4,22,d+8,'band'),
    b(a,12,d+7,a+5,18,d+10,'iron'),l(a+3,15,d+9,e-3,15,d+3,'silver'),
    b(e-4,5,d-1,e,8,d,'silver'),b(e-4,22,d-1,e,25,d,'silver')],
  'service-bins':({a,e,d})=>[
    b(a,5,d,e,25,d+6,'body'),b(a+1,6,d+6,a+9,24,d+15,'body'),
    b(a+10,5,d+7,e,7,d+13,'band'),b(a+10,23,d+7,e,25,d+13,'band'),
    ...[a+3,a+12,e-6].map(x=>b(x,25,d+4,x+3,25,d+5,'silver')),
    b(e-5,8,d+7,e,22,d+11,'wood')],
  'refrigerated-box':({a,e,d})=>[
    b(a,5,d,e,25,d+22,'body'),b(a,8,d+22,a+10,21,d+26,'silver'),
    ...[a+2,a+4,a+6,a+8].map(x=>b(x,21,d+23,x,21,d+25,'iron')),
    b(e,7,d+4,e,23,d+20,'band'),b(e,10,d+5,e,11,d+19,'silver'),
    b(e,19,d+5,e,20,d+19,'silver'),b(a+4,25,d+13,e-3,25,d+14,'band')],
  'passenger-shuttle':({a,e,d})=>[
    b(a,5,d,e,25,d+15,'body'),b(a,6,d+15,e-2,24,d+17,'body'),
    ...Array.from({length:Math.floor((e-a)/6)},(_,i)=>[5,25].map(y=>b(a+1+6*i,y,d+9,a+4+6*i,y,d+13,'window'))).flat(),
    b(e,7,d+8,e,23,d+13,'glass'),b(a+2,25,d+4,e-2,25,d+5,'band')],
  'metered-passenger':({a,e,d})=>[
    b(a,5,d,e,25,d+8,'body'),b(a,6,d+8,e-6,24,d+14,'body'),
    s(e-8,7,d+8,e-3,23,d+13,'-X','glass'),b(a+2,6,d+9,e-10,6,d+12,'window'),
    b(a+2,24,d+9,e-10,24,d+12,'window'),b(a+3,12,d+14,a+9,18,d+16,'lamp'),
    b(e-4,7,d+8,e-3,23,d+8,'band')],
  'mobile-command':({a,e,d})=>[
    b(a,5,d,e,25,d+22,'body'),b(a+3,25,d+11,a+13,25,d+16,'window'),
    b(e-7,25,d+3,e-2,25,d+18,'band'),b(e-9,23,d,e-1,26,d+1,'silver'),
    b(a+8,13,d+22,a+10,15,d+31,'iron'),b(a+6,9,d+29,a+12,20,d+30,'silver')],
  'liftgate-box':({a,e,d})=>[
    b(a,5,d,e,25,d+21,'body'),b(e,7,d+3,e,23,d+18,'band'),
    ...[5,8,11,14,17].map(z=>b(e,8,d+z,e,22,d+z,'iron')),
    b(e-1,6,d-3,e+3,24,d-1,'silver'),b(e,5,d-2,e+1,7,d+20,'iron'),
    b(e,23,d-2,e+1,25,d+20,'iron')],
};
const fleet=[
  ['stake-bed','works',['bonnet-crew','forward-cab','rounded-minivan']],
  ['walk-in-delivery','service',['bonnet-crew','forward-cab','rounded-minivan']],
  ['canteen-hatch','civic',['bonnet-crew','forward-cab','rounded-minivan']],
  ['tow-ramp','works',['bonnet-crew','forward-cab']],
  ['service-bins','service',['bonnet-crew','forward-cab','rounded-minivan']],
  ['refrigerated-box','coldchain',['forward-cab','rounded-minivan']],
  ['passenger-shuttle','transit',['forward-cab','rounded-minivan']],
  ['metered-passenger','taxi',['low-cab-chauffeur','rounded-minivan']],
  ['mobile-command','civic',['forward-cab','rounded-minivan']],
  ['liftgate-box','service',['forward-cab','bonnet-crew']],
];
const frames={
  'city-short':{length:52,axles:[12,39],clearance:4},
  'long-wheelbase':{length:62,axles:[12,49],clearance:4},
  'raised-duty':{length:62,axles:[12,48],clearance:5},
};
function frameDetails(wheelbase, cab, a, e, d) {
  if (wheelbase === 'raised-duty') {
    const roof = d + (cab === 'rounded-minivan' ? 18 : 19);
    const start = cab === 'forward-cab' ? 7 : 15;
    const end = cab === 'forward-cab' ? 20 : Math.min(25, a - 2);
    return [
      b(start,7,roof,end,8,roof+3,'iron'),b(start,22,roof,end,23,roof+3,'iron'),
      b(start,8,roof+2,start+2,22,roof+3,'iron'),b(end-2,8,roof+2,end,22,roof+3,'iron'),
      b(a-9,3,d-2,a-2,5,d-1,'silver'),b(a-9,25,d-2,a-2,27,d-1,'silver'),
      b(2,4,d,4,26,d+2,'iron'),
    ];
  }
  if (wheelbase === 'long-wheelbase') {
    return [b(a+4,4,d-1,e-12,6,d,'band'),b(a+4,24,d-1,e-12,26,d,'band'),
      b(a+7,4,d-4,a+9,6,d-1,'silver'),b(a+7,24,d-4,a+9,26,d-1,'silver')];
  }
  return [b(e,8,d-1,e+2,23,d,'silver')];
}
const designs=[];
for(const [load,finish,variants] of fleet){
  for(const cab of variants){
    for(const [wheelbase,{length,axles,clearance}] of Object.entries(frames)){
      if((load==='metered-passenger'||load==='canteen-hatch')&&wheelbase==='raised-duty')continue;
      const d=clearance+3;
      const a=({ 'bonnet-crew':29,'forward-cab':22,'rounded-minivan':25,'low-cab-chauffeur':25 })[cab];
      const e=length-5;
      designs.push({schemaVersion:1,id:`vehicle-${load}-${cab}-${wheelbase}`,category:'transport',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[2,1],palette:'office-night',
        materials:{...materials,body:{...materials.body,color:finishes[finish].color},band:{...materials.band,color:finishes[finish].trim}},
        ops:[...base(length,axles,clearance),...cabins[cab]({d}),...cargo[load]({a,e,d}),...frameDetails(wheelbase,cab,a,e,d),
          b(e-1,5,d,e+1,7,d+1,'brake'),b(e-1,23,d,e+1,25,d+1,'brake')],
      });
    }
  }
}
await writeFamily('service-vehicles',designs);
