import { writeFamily } from './render.mjs';

const B=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const C=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const L=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials={
  charcoal:{kind:'matte',color:'#414950'}, iron:{kind:'metal',color:'#606e77'},
  alloy:{kind:'metal',color:'#9facad'}, ivory:{kind:'matte',color:'#dcd2bc'},
  blue:{kind:'matte',color:'#627e94'}, red:{kind:'matte',color:'#a46151'},
  tan:{kind:'matte',color:'#a59078'}, wood:{kind:'wood',color:'#a68058'},
  brass:{kind:'metal',color:'#bda16c'}, glass:{kind:'glass',color:'#8caab7'},
  screen:{kind:'emissive',color:'#a8c1cf',glowRadius:1,glowIntensity:.09},
};
const controls=(w,z)=>({
  e:w-6,m:Math.floor(w/2),
  b:(x,y,h,X,Y,H,m)=>B(x,y,h+z,X,Y,H+z,m),
  c:(x,y,h,H,r,m)=>C(x,y,z+h,z+H,r,m),
  l:(x,y,h,X,Y,H,m)=>L(x,y,h+z,X,Y,H+z,m),
});
const gadgets={
  'desktop-label-maker':({b,c,e})=>[
    b(6,7,0,e,23,7,'ivory'),b(7,7,8,e-1,13,13,'blue'),b(8,13,8,e-2,19,9,'charcoal'),
    ...[10,14,18].map(x=>b(x,15,9,x+1,17,10,'alloy')),b(8,22,3,e-2,24,5,'charcoal'),
    b(11,24,4,e-5,28,4,'ivory'),c(e-3,10,13,14,1,'red')],
  'handheld-audio-recorder':({b,c,l,e})=>[
    b(6,8,0,e,21,4,'charcoal'),b(8,10,5,e-2,16,5,'screen'),
    ...[10,14,18].map(x=>c(x,19,5,6,1,'alloy')),c(9,8,5,10,2,'iron'),
    c(e-4,8,5,10,2,'iron'),l(9,8,10,11,10,12,'iron'),l(e-4,8,10,e-6,10,12,'iron')],
  'portable-shortwave-radio':({b,c,l,e})=>[
    b(6,7,0,e,22,15,'blue'),b(7,22,3,e-1,23,12,'alloy'),
    ...[4,6,8].map(z=>b(9,23,z,15,23,z,'charcoal')),b(17,23,8,e-2,23,11,'glass'),
    c(10,12,15,17,1,'iron'),l(e-2,8,15,e-1,7,28,'alloy')],
  'compact-slide-projector':({b,c,e})=>[
    b(5,7,0,e,24,4,'iron'),b(6,8,5,e-1,22,13,'ivory'),
    b(8,21,6,16,24,11,'charcoal'),b(9,24,7,15,25,10,'glass'),
    c(e-4,13,14,16,4,'charcoal'),c(e-4,13,16,16,2,'alloy')],
  'travel-voltage-adapter':({b,c,l,e})=>[
    b(6,8,0,19,20,8,'ivory'),b(7,20,2,18,21,6,'blue'),
    b(10,21,3,10,24,4,'alloy'),b(15,21,3,15,24,4,'alloy'),
    b(e-5,11,0,e,20,5,'charcoal'),c(e-3,16,5,6,1,'red'),
    l(19,14,3,e-5,14,3,'charcoal')],
  'desktop-card-encoder':({b,c,e})=>[
    b(6,8,0,e,23,5,'blue'),b(7,9,6,e-1,21,10,'ivory'),
    b(8,21,6,e-2,22,8,'charcoal'),b(10,22,7,e-4,26,7,'ivory'),
    b(11,23,7,e-5,23,7,'red'),c(e-4,12,10,11,1,'iron')],
  'smart-home-control-bay':({b,c,e})=>[
    b(5,7,0,e,24,4,'ivory'),b(6,7,5,e-1,10,21,'blue'),
    b(8,10,9,e-3,11,19,'glass'),b(10,11,12,e-5,11,13,'screen'),
    ...[10,16,22].map(x=>c(x,17,5,7,1,'alloy'))],
  'handheld-thermal-camera':({b,c,l,e})=>[
    b(9,8,2,21,15,10,'charcoal'),b(10,9,10,20,17,20,'blue'),
    b(11,17,12,19,18,18,'glass'),b(11,7,13,19,9,18,'iron'),
    b(12,7,14,18,7,17,'glass'),b(13,14,3,16,19,8,'charcoal'),
    l(14,19,4,e-4,24,2,'iron')],
  'portable-photo-printer':({b,e})=>[
    b(6,8,0,e,22,7,'ivory'),b(7,9,8,e-1,13,10,'blue'),
    b(8,21,3,e-2,22,6,'charcoal'),b(10,22,5,e-4,28,5,'ivory'),
    b(11,24,5,e-5,27,5,'glass'),b(10,24,5,e-4,24,5,'blue')],
  'portable-music-cassette':({b,c,e})=>[
    b(6,8,0,e,23,5,'blue'),b(7,9,5,e-1,21,6,'alloy'),
    b(9,11,6,e-3,18,6,'glass'),c(12,14,6,7,1,'charcoal'),
    c(e-6,14,6,7,1,'charcoal'),...([11,15,19].map(x=>b(x,20,6,x+1,22,7,'ivory')))],
  'receipt-and-barcode-reader':({b,l,e})=>[
    b(5,7,0,e,24,4,'charcoal'),b(6,8,5,17,17,12,'ivory'),
    b(7,17,9,16,18,10,'charcoal'),b(8,18,9,15,22,9,'ivory'),
    l(e-6,13,4,e-6,13,20,'iron'),b(e-9,12,19,e-2,17,22,'charcoal'),
    b(e-8,16,19,e-3,17,20,'glass')],
  'portable-digital-scale':({b,c,e})=>[
    b(6,7,0,e,24,3,'iron'),b(7,9,4,e-1,19,5,'alloy'),
    b(8,20,4,18,23,6,'blue'),b(9,22,6,17,23,6,'screen'),
    c(e-5,21,5,6,1,'red')],
  'conference-speakerphone':({b,c,e,m})=>[
    c(m,15,0,5,9,'charcoal'),c(m,15,5,6,8,'alloy'),
    c(m,15,6,6,6,'charcoal'),b(m-2,20,6,m+2,22,6,'screen'),
    ...[9,15,21].map(x=>b(x,13,6,x+1,15,6,'iron')),b(e-3,12,1,e,17,2,'charcoal')],
  'field-gps-antenna':({b,c,l,e})=>[
    b(5,7,0,e,24,3,'charcoal'),b(6,8,4,14,21,10,'blue'),
    b(7,11,10,13,18,10,'screen'),c(e-6,13,4,18,1,'iron'),
    c(e-6,13,18,21,5,'ivory'),c(e-6,13,21,22,4,'alloy'),
    l(13,14,7,e-4,21,5,'charcoal')],
};
const bases={
  'rubber-shell':w=>({z:2,ops:[B(5,7,0,w-6,24,1,'charcoal'),B(6,8,1,w-7,23,1,'iron')]}),
  'desk-dock':w=>({z:4,ops:[B(4,6,0,w-5,25,2,'alloy'),B(5,7,3,w-6,24,3,'iron'),
    B(6,24,2,13,25,3,'glass')]}),
  'case-insert':w=>({z:5,ops:[
    B(4,6,0,w-5,25,4,'charcoal'),B(4,6,4,5,25,9,'alloy'),B(w-6,6,4,w-5,25,9,'alloy'),
    B(5,6,5,w-6,9,18,'blue')]}),
  'portable-stand':w=>({z:8,ops:[
    ...[6,w-8].flatMap(x=>[L(x,7,0,x,15,7,'alloy'),L(x,24,0,x,15,7,'alloy')]),
    B(5,7,6,w-6,24,7,'iron')]}),
  'retail-cradle':w=>({z:7,ops:[
    B(4,6,0,w-5,25,5,'wood'),B(5,7,6,w-6,24,6,'tan'),
    B(6,24,3,13,25,4,'ivory'),B(w-8,7,6,w-6,10,13,'alloy')]}),
};
function accessory(gadget,size,base,w,z) {
  const {e,b,c,l}=controls(w,z);
  const ops=[];
  if(size==='station'){
    const x=e-7;
    if(gadget==='desktop-label-maker'||gadget==='portable-photo-printer'||gadget==='receipt-and-barcode-reader'){
      ops.push(b(x,8,8,e-1,16,13,'blue'),b(x+1,10,13,e-2,14,15,'ivory'),b(x+1,16,10,e-2,20,11,'charcoal'));
    } else if(gadget==='handheld-audio-recorder'||gadget==='conference-speakerphone'||gadget==='portable-music-cassette'){
      ops.push(b(x,9,4,e,19,12,'charcoal'),b(x+1,19,6,e-1,19,10,'iron'),
        ...[6,8,10].map(h=>b(x+2,20,h,e-1,20,h,'alloy')));
    } else if(gadget==='portable-shortwave-radio'||gadget==='field-gps-antenna'){
      ops.push(c(x,13,5,20,1,'iron'),l(x,13,19,x-5,12,24,'alloy'),l(x,13,19,x+5,12,24,'alloy'));
    } else if(gadget==='compact-slide-projector'||gadget==='handheld-thermal-camera'){
      ops.push(b(x,9,3,e,18,10,'iron'),b(x+1,18,5,e-1,18,8,'glass'),
        l(x,15,4,x-6,22,2,'charcoal'));
    } else {
      ops.push(b(x,9,5,e,17,12,'blue'),b(x+1,17,7,e-1,17,10,'screen'),
        b(x+1,11,12,x+4,14,13,'alloy'));
    }
  }
  if(base==='desk-dock') ops.push(b(6,23,-1,10,26,1,'alloy'),b(7,26,0,9,26,0,'screen'));
  if(base==='retail-cradle') ops.push(b(6,7,0,7,9,10,'alloy'),b(6,8,8,13,9,11,'ivory'),
    b(7,9,9,12,9,10,'blue'));
  if(base==='portable-stand') ops.push(l(7,21,-2,12,24,2,'alloy'),b(11,23,2,15,25,3,'charcoal'));
  return ops;
}
const designs=[];
for(const [gadget,build] of Object.entries(gadgets)) for(const [size,w] of [['compact',32],['station',44]]){
  for(const [mount,support] of Object.entries(bases)){
    const {z,ops}=support(w);
    designs.push({schemaVersion:1,id:`electronics-${gadget}-${size}-${mount}`,category:'electronics',
      layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
      palette:'office-night',materials,ops:[...ops,...build(controls(w,z)),...accessory(gadget,size,mount,w,z)]});
  }
}
await writeFamily('small-electronics',designs);
