import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l=(x,y,z,X,Y,Z,material)=>({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  frame:{kind:'metal',color:'#545d65'}, steel:{kind:'metal',color:'#98a4ae'},
  black:{kind:'matte',color:'#33343c'}, cherry:{kind:'wood',color:'#945f49'}, oak:{kind:'wood',color:'#b28159'},
  ivory:{kind:'matte',color:'#e0d8c9'}, gold:{kind:'metal',color:'#c4a05a'},
  red:{kind:'matte',color:'#aa5d56'}, blue:{kind:'matte',color:'#536e8a'},
  lcd:{kind:'emissive',color:'#a2b6c9',glowRadius:1,glowIntensity:.13},
};
const controls={
  'piano-keys': (w,z)=>Array.from({length:Math.floor((w-8)/2)},(_,i)=>[
    b(4+i*2,15,z,4+i*2,25,z,'ivory'),
    ...([0,1,3,4,5].includes(i%7)?[b(5+i*2,15,z+1,5+i*2,21,z+1,'black')]:[])]).flat(),
  'organ-drawbars': (w,z)=>[
    ...Array.from({length:Math.floor((w-8)/2)},(_,i)=>
      [b(4+i*2,19,z,4+i*2,25,z,'ivory'),b(4+i*2,10,z+3,4+i*2,16,z+3,'ivory')]).flat(),
    ...[6,9,12,15,18].map((x,i)=>b(x,6,z+4,x+1,8+i%3,z+5,i%2?'gold':'oak'))],
  'pad-sequencer': (w,z)=>[
    ...Array.from({length:Math.floor((w-9)/5)},(_,i)=>[13,18,23].map((y,j)=>
      b(5+i*5,y,z,8+i*5,y+2,z+1,['red','blue','ivory'][(i+j)%3]))).flat(),
    b(9,7,z+1,20,9,z+1,'lcd'),b(w-12,6,z+1,w-7,9,z+2,'black')],
  'waveform-modular': (w,z)=>[
    ...Array.from({length:Math.floor((w-8)/7)},(_,i)=>[
      b(5+7*i,10,z,10+7*i,25,z,'steel'),c(7+7*i,13,z+1,z+2,1,'black'),c(7+7*i,19,z+1,z+2,1,'black'),
      l(7+7*i,22,z+1,10+7*i,24,z+3,i%2?'red':'blue')]).flat(),
    b(6,6,z+1,13,8,z+1,'lcd')],
  'channel-mixer': (w,z)=>[
    ...Array.from({length:Math.floor((w-7)/4)},(_,i)=>[
      c(5+4*i,9,z+1,z+2,1,'ivory'),c(5+4*i,13,z+1,z+2,1,'blue'),
      b(5+4*i,16,z,5+4*i,24,z,'black'),b(4+4*i,16+i%5,z+1,6+4*i,17+i%5,z+1,'steel')]).flat()],
  'turntable-deck': (w,z)=>[
    ...[11,w-12].flatMap(x=>[c(x,16,z,z+1,6,'black'),c(x,16,z+2,z+2,2,'red'),
      c(x+6,9,z,z+2,1,'steel'),l(x+6,9,z+2,x+2,16,z+2,'steel')]),
    ...[14,18,22].map(y=>b(Math.floor(w/2)-1,y,z+1,Math.floor(w/2)+1,y,z+2,'ivory'))],
};
const cases={
  'wood-console': (w,z)=>[b(3,5,z,w-4,26,z+4,'oak'),b(4,6,z+4,w-5,9,z+8,'cherry'),
    b(3,6,z+3,4,26,z+6,'cherry'),b(w-5,6,z+3,w-4,26,z+6,'cherry')],
  'rack-flight-case': (w,z)=>[b(3,5,z,w-4,27,z+4,'black'),
    b(3,5,z,4,27,z+6,'steel'),b(w-5,5,z,w-4,27,z+6,'steel'),b(4,5,z+4,w-5,6,z+5,'steel'),
    b(5,27,z+1,8,28,z+3,'gold'),b(w-9,27,z+1,w-6,28,z+3,'gold')],
  'wedge-stage': (w,z)=>[b(3,5,z,w-4,26,z+4,'blue'),
    b(4,5,z+4,w-5,8,z+10,'frame'),l(3,6,z+9,3,24,z+4,'steel'),
    l(w-4,6,z+9,w-4,24,z+4,'steel')],
};
const stands={
  'portable': (w)=>({z:2,ops:[4,w-7].flatMap(x=>[7,24].map(y=>b(x,y,0,x+2,y+2,1,'black')))}),
  'folding-x': (w)=>({z:15,ops:[7,w-8].flatMap(x=>[
    l(x,7,0,x,23,14,'frame'),l(x,23,0,x,7,14,'frame'),b(x-1,7,14,x+1,23,14,'frame')])}),
  'road-dolly': (w)=>({z:9,ops:[
    ...[5,w-8].flatMap(x=>[7,23].map(y=>b(x,y,0,x+3,y+2,3,'black'))),
    b(3,5,4,w-4,27,8,'frame'),b(5,5,8,7,6,17,'steel'),b(w-8,5,8,w-6,6,17,'steel'),
    b(5,5,17,w-6,6,18,'steel')]}),
};
const designs=[];
for(const [instrument,build] of Object.entries(controls)){
  const w = instrument==='turntable-deck'?54:instrument==='pad-sequencer'?38:62;
  for(const [enclosure,caseOps] of Object.entries(cases)){
    for(const [mount,stand] of Object.entries(stands)){
      const {z,ops}=stand(w);
      designs.push({schemaVersion:1,id:`music-${instrument}-${enclosure}-${mount}`,category:'music',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[2,1],palette:'office-night',materials,ops:[...ops,...caseOps(w,z),...build(w,z+4)]});
    }
  }
}
await writeFamily('music-stations',designs);
