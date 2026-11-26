import { writeFamily } from './render.mjs';
const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const s=(x,y,z,X,Y,Z,axis,material)=>({op:'slope',from:[x,y,z],to:[X,Y,Z],axis,material});
const palette={
  wood:{kind:'wood',color:'#a27955'}, walnut:{kind:'wood',color:'#795743'},
  brass:{kind:'metal',color:'#b8a06d'}, iron:{kind:'metal',color:'#636c72'},
  black:{kind:'matte',color:'#43464b'}, cloth:{kind:'matte',color:'#857871'},
  piping:{kind:'matte',color:'#a89788'}, pillow:{kind:'matte',color:'#c8b195'},
};
const cloth=[
  ['#7a6759','#9d8570','#d0b59a'],['#706e6a','#a09a92','#c6b5a2'],
  ['#4f6072','#788393','#bca88e'],['#8e6d52','#b98e67','#d7c6aa'],
  ['#805e5a','#a07772','#d0b69d'],['#a79b86','#c6baa4','#7c7068'],
];
const seats={
  'reading-wingback':(w,z)=>[
    b(5,7,z,w-6,23,z+5,'cloth'),b(5,7,z+5,w-6,10,z+30,'cloth'),
    b(5,10,z+16,8,17,z+32,'cloth'),b(w-9,10,z+16,w-6,17,z+32,'cloth'),
    b(8,10,z+6,w-9,22,z+10,'piping'),b(6,11,z+6,8,23,z+15,'cloth'),
    b(w-9,11,z+6,w-7,23,z+15,'cloth'),b(10,10,z+11,17,14,z+23,'pillow')],
  'deep-tub-chair':(w,z)=>[
    b(5,7,z,w-6,23,z+5,'cloth'),b(6,7,z+6,w-7,10,z+18,'cloth'),
    b(5,8,z+5,8,22,z+15,'cloth'),b(w-9,8,z+5,w-6,22,z+15,'cloth'),
    b(7,9,z+6,w-8,13,z+19,'piping'),b(9,12,z+6,w-10,21,z+9,'piping')],
  'open-cane-settee':(w,z)=>[
    b(5,8,z,w-6,23,z+4,'wood'),b(7,10,z+4,w-8,22,z+7,'cloth'),
    b(5,7,z,7,10,z+23,'wood'),b(w-8,7,z,w-6,10,z+23,'wood'),
    b(5,7,z+21,w-6,10,z+23,'wood'),b(6,7,z+9,w-7,9,z+11,'wood'),
    ...Array.from({length:Math.floor((w-10)/4)},(_,i)=>l(7+i*4,8,z+10,8+i*4,8,z+21,'brass')),
    b(5,9,z+10,7,22,z+11,'wood'),b(w-8,9,z+10,w-6,22,z+11,'wood')],
  'daybed-bolster':(w,z)=>[
    b(5,6,z,w-6,25,z+5,'wood'),b(6,7,z+5,w-7,24,z+9,'cloth'),
    b(7,7,z+10,w-8,10,z+15,'piping'),b(7,9,z+14,w-8,12,z+16,'piping'),
    b(7,12,z+10,11,21,z+13,'pillow'),b(w-12,12,z+10,w-8,21,z+13,'pillow')],
  'low-armless-modular':(w,z)=>[
    b(5,6,z,w-6,25,z+6,'cloth'),b(6,7,z+7,w-7,11,z+16,'cloth'),
    ...Array.from({length:Math.floor((w-8)/11)},(_,i)=>
      b(6+i*11,11,z+7,15+i*11,24,z+10,'piping')),
    b(9,10,z+10,15,13,z+15,'pillow')],
  'zero-wall-recliner':(w,z)=>[
    b(6,8,z,w-7,23,z+6,'cloth'),s(7,5,z+5,w-8,13,z+28,'-Y','cloth'),
    b(8,12,z+6,w-9,22,z+10,'piping'),s(7,23,z+5,w-8,30,z+9,'-Y','cloth'),
    b(6,10,z+8,8,23,z+15,'cloth'),b(w-9,10,z+8,w-7,23,z+15,'cloth'),
    b(w-7,19,z+11,w-7,20,z+12,'brass')],
  'channel-tufted-chaise':(w,z)=>[
    b(5,6,z,w-6,27,z+6,'cloth'),s(6,6,z+6,w-7,13,z+23,'-Y','cloth'),
    ...[13,17,21,25].map(y=>b(7,y,z+6,w-8,y+2,z+8,'piping')),
    b(6,8,z+8,9,22,z+14,'cloth'),b(w-12,8,z+10,w-8,12,z+15,'pillow')],
  'storage-ottoman':(w,z)=>[
    b(6,7,z,w-7,24,z+9,'cloth'),b(5,6,z+9,w-6,25,z+12,'piping'),
    b(8,9,z+12,w-9,22,z+13,'cloth'),b(9,24,z+3,w-10,24,z+3,'black'),
    b(Math.floor(w/2)-2,25,z+5,Math.floor(w/2)+2,25,z+6,'brass')],
};
const bases={
  'turned-walnut':w=>({z:7,ops:[7,w-10].flatMap(x=>[8,22].flatMap(y=>
    [c(x,y,0,2,2,'walnut'),c(x,y,3,6,1,'walnut'),c(x,y,6,6,2,'wood')]))}),
  'metal-sled':w=>({z:7,ops:[7,w-10].flatMap(x=>[
    b(x,7,0,x+2,24,1,'iron'),b(x,7,1,x+1,8,6,'iron'),b(x,23,1,x+1,24,6,'iron')])}),
  'platform-plinth':w=>({z:4,ops:[b(6,7,0,w-7,24,2,'walnut'),b(5,6,3,w-6,25,3,'wood')]}),
  'angled-timber':w=>({z:7,ops:[8,w-11].flatMap(x=>[8,22].map(y=>
    l(x+(x<15?-2:2),y+(y<15?-2:2),0,x,y,6,'walnut')))}),
  'recessed-blocks':w=>({z:4,ops:[10,w-14].flatMap(x=>[10,21].map(y=>b(x,y,0,x+3,y+3,3,'black')))}),
};
const layouts=[['accent',31],['snug',46],['wide',61]];
const designs=[];
for(const [chair,build] of Object.entries(seats)){
  for(const [size,w] of layouts){
    for(const [base,support] of Object.entries(bases)){
      if(chair==='zero-wall-recliner'&&size==='wide')continue;
      const {z,ops}=support(w);
      const finish=cloth[(chair.length+size.length*5+base.length*3)%cloth.length];
      const materials={...palette,cloth:{...palette.cloth,color:finish[0]},piping:{...palette.piping,color:finish[1]},
        pillow:{...palette.pillow,color:finish[2]}};
      designs.push({schemaVersion:1,id:`lounge-seat-${chair}-${size}-${base}`,category:'furniture',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
        palette:'office-night',materials,ops:[...ops,...build(w,z)]});
    }
  }
}
await writeFamily('lounge-seating',designs);
