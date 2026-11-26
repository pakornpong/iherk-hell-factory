import { writeFamily } from './render.mjs';

const b = (x,y,z,X,Y,Z,material) => ({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l = (x,y,z,X,Y,Z,material) => ({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials = {
  timber: {kind:'wood',color:'#9d6a49'}, charcoal: {kind:'metal',color:'#434f58'},
  jade: {kind:'matte',color:'#4f827b'}, marine: {kind:'matte',color:'#457187'},
  cream: {kind:'matte',color:'#dcd1b4'}, brass: {kind:'metal',color:'#cfa567'},
  shade: {kind:'matte',color:'#395e61'}, pink: {kind:'matte',color:'#bf827f'},
};

const plans = {
  loveseat: { width: 52, seats: 2, wings: [] },
  'three-seat': { width: 63, seats: 3, wings: [] },
  'chaise-left': { width: 63, seats: 3, wings: [[4,22,48]] },
  'double-chaise': { width: 63, seats: 3, wings: [[4,22,41],[40,59,48]] },
  'conversation-pit': { width: 63, seats: 3, wings: [[4,18,51],[44,58,51]], wrap: true },
};

const backs = {
  'loose-cushion': (x,X) => [b(x,6,14,X,9,28,'shade'),
    b(x+1,9,15,X-1,14,29,'jade'), b(x+2,10,29,X-2,13,30,'jade')],
  'tufted-club': (x,X) => [b(x,5,14,X,12,33,'marine'),
    ...Array.from({length:Math.floor((X-x)/5)},(_,i)=>b(x+2+i*5,13,22,x+2+i*5,13,23,'brass'))],
  'spindle-daybed': (x,X) => [b(x,6,29,X,9,31,'timber'),
    ...Array.from({length:Math.floor((X-x)/3)},(_,i)=>b(x+1+i*3,7,13,x+1+i*3,8,29,'timber'))],
  'low-bolster': (x,X) => [b(x,5,15,X,11,22,'shade'),
    b(x,7,20,X,12,25,'jade'), b(x+1,8,25,X-1,11,26,'jade')],
  'privacy-wing': (x,X) => [b(x,5,14,X,10,46,'marine'), b(x+1,10,17,X-1,12,43,'jade'),
    b(x+1,10,43,X-1,12,44,'cream')],
};

const supports = {
  'splayed-oak': (w) => [7,w-9].flatMap(x=>[7,26].map(y=>l(x,y,6,x+(x<15?-2:2),y+(y<15?-2:2),0,'timber'))),
  'full-plinth': (w) => [b(6,6,0,w-7,29,6,'timber')],
  'steel-raised': (w) => [6,w-8].flatMap(x=>[b(x,6,0,x+1,29,1,'charcoal'),
    b(x,6,1,x+1,7,6,'charcoal'),b(x,28,1,x+1,29,6,'charcoal')]),
  'recessed-feet': (w) => [10,w-14].flatMap(x=>[10,24].map(y=>b(x,y,0,x+3,y+3,6,'charcoal'))),
};
const designs = [];
for (const [plan, {width, seats, wings, wrap}] of Object.entries(plans)) {
  for (const [back, buildBack] of Object.entries(backs)) {
    for (const [base, buildBase] of Object.entries(supports)) {
      const right = width - 5;
      const wingParts = wings.flatMap(([x,X,Y])=>[b(x,27,6,X,Y,11,'shade'),b(x+1,27,12,X-1,Y-1,15,'jade'),
        b(x+3,Y-5,0,x+5,Y-3,6,base==='splayed-oak'?'timber':'charcoal')]);
      const armHeight = back === 'privacy-wing' ? 32 : (back === 'spindle-daybed' ? 22 : 20);
      const armEnd = wrap ? 50 : 27;
      const cushions = Array.from({length:seats},(_,i)=>{
        const x = 7 + Math.floor(i*(right-8)/seats);
        const X = 5 + Math.floor((i+1)*(right-8)/seats);
        return [b(x,11,12,X,26,15,'jade'),...buildBack(x,X)];
      }).flat();
      designs.push({
        schemaVersion:1,id:`sofa-${plan}-${back}-${base}`,category:'furniture',layer:'object',
        outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[2,wings.length?2:1],palette:'office-night',materials,
        ops:[...buildBase(width),b(4,5,6,right,28,11,'shade'),...wingParts,...cushions,
          b(4,6,12,6,armEnd,armHeight,'marine'),b(right-2,6,12,right,armEnd,armHeight,'marine'),
          ...([9,right-8].map((x,i)=>b(x,13,15,x+4,16,22,i?'pink':'cream')))],
      });
    }
  }
}
await writeFamily('sofas', designs);
