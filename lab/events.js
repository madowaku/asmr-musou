(function (L) {
  'use strict';
  const listeners=new Map(),history=[],CAP=2048,CONTINUOUS=new Set(['wobble','flow']);let cursor=0;
  L.events={
    on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return ()=>listeners.get(name).delete(fn);},
    emit(name,params={}){const event={...params,name,time:L.time||0,frame:L.frame||0};/* High-rate continuous events (wobble/flow/strain) would evict discrete ones from the debug history, so they get no history slot. */if(!CONTINUOUS.has(name)){if(history.length<CAP)history.push(event);else{history[cursor]=event;cursor=(cursor+1)%CAP;}}for(const fn of listeners.get(name)||[])fn(event);for(const fn of listeners.get('*')||[])fn(event);return event;},
    get history(){return cursor?history.slice(cursor).concat(history.slice(0,cursor)):history.slice();},clear(){history.length=0;cursor=0;}
  };
  L.materials={};
  // Shared hooks for material-wide systems (sand pile, slime threads); main.js runs them each frame.
  L.drawHooks=[];L.updateHooks=[];L.clearHooks=[];L.FLOOR=1100;
  L.registerMaterial=m=>{for(const key of ['id','name','hardness','layers','onCut','onImpact','onPress','update','crossSection'])if(m[key]===undefined)throw new Error('Missing material field: '+key);L.materials[m.id]=m;};
  let seed=317;L.seed=value=>{seed=value>>>0;};L.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
})(window.LAB=window.LAB||{});
