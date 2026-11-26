import { writeFamily } from './render.mjs';

const b=(x,y,z,X,Y,Z,material)=>({op:'box',from:[x,y,z],to:[X,Y,Z],material});
const c=(x,y,zFrom,zTo,radius,material)=>({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
const materials={
  gray:{kind:'matte',color:'#a4acb1'}, cream:{kind:'matte',color:'#ded7bd'},
  blue:{kind:'matte',color:'#4b7487'}, dark:{kind:'metal',color:'#384252'},
  rubber:{kind:'matte',color:'#232b39'}, orange:{kind:'matte',color:'#c68744'},
  display:{kind:'emissive',color:'#7bc4bd',glowRadius:1,glowIntensity:.2},
  ink:{kind:'matte',color:'#39606b'},
};

const displays={
  'crt-bell': [b(6,5,22,25,16,36,'cream'),b(9,2,24,22,5,34,'cream'),
    b(7,16,23,24,17,35,'dark'),b(9,17,25,22,17,33,'display'),
    b(11,17,28,18,17,28,'ink'),b(19,17,30,20,17,30,'ink')],
  'flat-wide': [b(2,11,24,29,14,36,'dark'),b(3,14,25,28,14,35,'display'),
    b(5,14,27,8,14,34,'ink'),b(13,14,29,25,14,29,'ink'),b(13,14,32,21,14,32,'ink')],
  'vertical-touch': [b(9,11,21,22,15,43,'blue'),b(10,15,24,21,15,41,'display'),
    ...[27,32,37].map(z=>b(12,15,z,19,15,z+1,'ink'))],
  'dual-status': [
    b(4,10,23,15,14,37,'dark'),b(5,14,24,14,14,35,'display'),b(7,14,26,12,14,27,'ink'),
    b(17,10,23,28,14,37,'dark'),b(18,14,24,27,14,35,'display'),b(22,14,26,24,14,32,'ink')],
  'sun-hood': [b(5,9,22,27,13,38,'gray'),b(7,13,24,25,13,36,'display'),
    b(5,13,37,27,21,39,'dark'),b(5,13,24,6,20,37,'dark'),b(26,13,24,27,20,37,'dark'),
    b(10,13,28,22,13,31,'ink')],
};

const chassis={
  'rack-case': [b(4,6,0,27,26,2,'dark'),b(5,7,3,26,24,14,'gray'),
    ...[5,8,11].map(z=>b(7,25,z,24,25,z,'dark')),b(6,7,15,25,25,18,'gray'),
    b(12,11,19,19,15,24,'dark')],
  'kiosk-column': [b(5,7,0,26,25,3,'dark'),b(9,9,4,22,17,20,'blue'),
    b(7,9,18,24,24,21,'gray'),b(12,10,21,19,14,25,'dark'),
    b(11,18,6,20,18,15,'ink')],
  'mobile-cart': [
    ...[5,25].flatMap(x=>[6,24].map(y=>b(x,y,0,x+2,y+2,4,'rubber'))),
    b(4,5,4,28,27,6,'dark'),b(7,7,6,10,9,18,'gray'),b(22,7,6,25,9,18,'gray'),
    b(6,7,10,26,22,11,'gray'),b(4,6,17,28,25,20,'blue'),b(12,10,20,19,14,25,'dark')],
  'arm-mounted': [b(4,4,0,27,7,19,'dark'),b(7,6,17,12,14,20,'gray'),
    b(10,12,16,22,16,21,'gray'),b(20,10,16,24,14,24,'dark'),
    b(8,15,17,23,23,18,'blue'),b(12,11,21,21,14,24,'dark')],
};

const controls={
  'keyboard-tray': [
    b(5,20,20,26,27,21,'cream'),
    ...[21,23,25].map(y=>b(7,y,21,23,y,21,'dark')),b(24,25,21,26,26,22,'gray')],
  'industrial-dial': [
    b(6,19,20,25,27,23,'blue'),c(10,23,24,25,3,'rubber'),c(21,24,24,24,2,'orange'),
    b(15,21,24,16,22,24,'cream')],
  'scanner-slot': [b(9,18,20,22,24,26,'gray'),b(11,24,22,20,24,23,'rubber'),
    b(13,24,22,19,27,22,'cream'),b(11,21,26,13,22,26,'display')],
  'operator-levers': [b(6,18,20,25,27,21,'dark'),
    ...[10,15,21].flatMap(x=>[c(x,23,22,23,2,'blue'),c(x,23,24,26,0,'gray'),c(x,23,27,28,1,'orange')])],
};

const designs=[];
for(const [screen, display] of Object.entries(displays)){
  for(const [caseName, body] of Object.entries(chassis)){
    for(const [input, panel] of Object.entries(controls)){
      designs.push({schemaVersion:1,id:`terminal-${screen}-${caseName}-${input}`,category:'computers',
        layer:'object',outlineMode:'silhouette',tilePreset:'64x32',voxelsPerTile:32,
        footprintTiles:[1,1],palette:'office-night',materials,ops:[...body,...display,...panel]});
    }
  }
}
await writeFamily('terminals',designs);
