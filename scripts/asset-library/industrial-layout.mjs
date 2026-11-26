// Helpers for the 32-voxel tile grid used by workshop and field assets.
export const box = (x,y,z,X,Y,Z,material) => ({op:'box',from:[x,y,z],to:[X,Y,Z],material});
export const rod = (x,y,z,X,Y,Z,material) => ({op:'line',from:[x,y,z],to:[X,Y,Z],material});
export const round = (x,y,zFrom,zTo,radius,material) => ({op:'cylinder',center:[x,y],zFrom,zTo,radius,material});
export const ramp = (x,y,z,X,Y,Z,axis,material) => ({op:'slope',from:[x,y,z],to:[X,Y,Z],axis,material});
export function colors(entries){
  return Object.fromEntries(Object.entries(entries).map(([id,[color,kind='matte']])=>[id,{color,kind}]));
}
export function partAt(w,z){
  return {
    w, e:w-6, m:Math.floor(w/2),
    b:(x,y,k,X,Y,K,m)=>box(x,y,z+k,X,Y,z+K,m),
    l:(x,y,k,X,Y,K,m)=>rod(x,y,z+k,X,Y,z+K,m),
    c:(x,y,k,K,r,m)=>round(x,y,z+k,z+K,r,m),
    s:(x,y,k,X,Y,K,a,m)=>ramp(x,y,z+k,X,Y,z+K,a,m),
  };
}
export const across=(count,build)=>Array.from({length:count},(_,i)=>build(i)).flat();
export function asset(id,category,w,materials,ops){
  return {schemaVersion:1,id,category,layer:'object',outlineMode:'silhouette',
    tilePreset:'64x32',voxelsPerTile:32,footprintTiles:[Math.ceil(w/32),1],
    palette:'office-night',materials,ops};
}
