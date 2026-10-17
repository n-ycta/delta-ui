export interface Rect { x:number; y:number; w:number; h:number }
export interface Guide { axis:'x'|'y'; value:number; from:number; to:number }
/** Threshold is measured in screen pixels, independent of camera zoom. */
export function snapRect(input:Rect, others:Rect[], zoom=1, edge='', bypass=false):{rect:Rect;guides:Guide[]} {
  const rect={...input},guides:Guide[]=[];
  if(bypass)return {rect,guides};
  const threshold=8/Math.max(.25,zoom);
  for(const axis of ['x','y'] as const){
    const size=axis==='x'?'w':'h', cross=axis==='x'?'y':'x', crossSize=axis==='x'?'h':'w';
    const low=axis==='x'?'w':'n', high=axis==='x'?'e':'s';
    if(edge&&!edge.includes(low)&&!edge.includes(high))continue;
    const anchors=edge?[edge.includes(low)?0:1]:[0,.5,1];
    let best:{delta:number;anchor:number;target:number;other:Rect}|undefined;
    for(const other of others)for(const anchor of anchors)for(const target of [other[axis],other[axis]+other[size]/2,other[axis]+other[size]]){
      const delta=target-(input[axis]+input[size]*anchor);
      if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,anchor,target,other};
    }
    if(!best)continue;
    if(!edge)rect[axis]+=best.delta;
    else if(best.anchor===0){rect[axis]+=best.delta;rect[size]-=best.delta;}
    else rect[size]+=best.delta;
    if(edge&&(rect[size]<(size==='w'?280:200)||rect[size]>3000)){rect[axis]=input[axis];rect[size]=input[size];continue;}
    guides.push({axis,value:best.target,from:Math.min(rect[cross],best.other[cross]),to:Math.max(rect[cross]+rect[crossSize],best.other[cross]+best.other[crossSize])});
  }
  return {rect,guides};
}
