import { writeFamily } from './render.mjs';

const b = (x,y,z,X,Y,Z,material) => ({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const l = (x,y,z,X,Y,Z,material) => ({op:'line',from:[x,y,z],to:[X,Y,Z],material});
const materials = {
  oak: {kind:'wood',color:'#aa7750'}, walnut: {kind:'wood',color:'#6c4939'},
  steel: {kind:'metal',color:'#879da9'}, cream: {kind:'matte',color:'#e4decf'},
  blue: {kind:'matte',color:'#587b95'}, trim: {kind:'matte',color:'#79a7a9'},
  gold: {kind:'metal',color:'#d3a749'}, green: {kind:'matte',color:'#537d71'},
};

const widths = { narrow: 30, double: 44, king: 60 };
const platforms = {
  'spindle-legs': w => [4, w-6].flatMap(x => [6, 54].map(y => b(x,y,0,x+2,y+2,9,'oak'))),
  'wing-plinth': w => [b(7,7,0,w-8,55,5,'walnut'), b(2,5,6,w-3,57,9,'oak')],
  'drawer-storage': w => [b(4,6,0,w-5,56,9,'oak'),
    ...[9,26,43].flatMap(y => [b(3,y,2,4,y+11,7,'walnut'),b(2,y+4,5,3,y+7,6,'gold')]),
    b(7,56,2,w-8,57,7,'walnut'), b(Math.floor(w/2)-2,58,5,Math.floor(w/2)+2,58,6,'gold')],
  'bent-steel': w => [4,w-6].flatMap(x => [b(x,7,0,x+1,55,1,'steel'),
    b(x,7,0,x+1,8,9,'steel'),b(x,54,0,x+1,55,9,'steel')]),
  'step-platform': w => [b(2,6,0,w-3,62,3,'walnut'), b(3,6,4,w-4,59,6,'oak'),
    b(4,6,7,w-5,56,9,'oak')],
};

const headboards = {
  'woven-panel': w => [b(4,4,8,6,7,29,'oak'),b(w-7,4,8,w-5,7,29,'oak'),
    b(6,4,17,w-7,6,29,'walnut'),
    ...Array.from({length:Math.floor((w-13)/3)},(_,i)=>l(7+3*i,7,18,8+3*i,7,26,'gold'))],
  'upholstered-wings': w => [b(4,4,8,w-5,7,35,'green'),b(4,7,18,7,16,32,'green'),
    b(w-8,7,18,w-5,16,32,'green'),b(8,7,32,w-9,7,36,'trim'),
    ...Array.from({length:Math.floor((w-14)/5)},(_,i)=>b(8+5*i,8,22,8+5*i,8,29,'trim'))],
  'library-shelf': w => [b(3,3,8,w-4,4,37,'walnut'),b(3,4,9,5,10,36,'oak'),
    b(w-6,4,9,w-4,10,36,'oak'),...([22,29,36].map(z=>b(4,4,z,w-5,11,z+1,'oak'))),
    b(7,5,31,11,10,35,'blue'),b(w-14,5,31,w-9,9,35,'green')],
  'canopy-frame': w => [4,w-6].flatMap(x=>[5,55].map(y=>b(x,y,8,x+1,y+1,47,'walnut')))
    .concat([5,55].map(y=>b(4,y,46,w-5,y+1,48,'oak')),
      [4,w-6].map(x=>b(x,5,46,x+1,56,48,'oak')),b(5,6,39,w-6,7,47,'cream')),
  'sleigh-board': w => [b(5,4,8,w-6,7,31,'walnut'),b(5,3,29,w-6,5,33,'oak'),
    b(5,2,32,w-6,4,34,'oak'),b(5,55,9,w-6,58,22,'walnut'),
    b(5,57,20,w-6,59,23,'oak')],
};

const designs = [];
for (const [size, w] of Object.entries(widths)) {
  for (const [head, buildHead] of Object.entries(headboards)) {
    for (const [base, buildBase] of Object.entries(platforms)) {
      const pillows = w <= 30 ? [[8,w-9]] : [[8,Math.floor(w/2)-2],[Math.floor(w/2)+1,w-9]];
      designs.push({
        schemaVersion:1, id:`bed-${size}-${head}-${base}`, category:'furniture',layer:'object',
        outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),2],
        palette:'office-night',materials,
        ops:[...buildBase(w),b(4,5,8,w-5,56,11,'oak'),b(6,7,12,w-7,55,16,'cream'),
          ...pillows.map(([a,z])=>b(a,10,17,z,19,20,'cream')),
          b(6,23,16,w-7,55,18,'blue'),b(6,23,18,w-7,27,19,'trim'),
          b(6,50,18,w-7,51,18,'trim'),...buildHead(w)],
      });
    }
  }
}
await writeFamily('beds', designs);
