export function remainingWheel(items,drawn=[]){const valid=new Set(drawn.filter(i=>Number.isInteger(i)&&i>=0&&i<items.length));return items.map((_,i)=>i).filter(i=>!valid.has(i));}
export function pickWheel(items,drawn=[],random=Math.random){const left=remainingWheel(items,drawn);return left.length?left[Math.min(left.length-1,Math.max(0,Math.floor(random()*left.length)))]:null;}
export function wheelRotation(previous,index,count){const target=(360-((index+.5)*360/count)%360)%360;return previous+4*360+((target-previous%360+360)%360);}
