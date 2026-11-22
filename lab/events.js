(function (L) {
  'use strict';
  const listeners=new Map(),history=[];let cursor=0;
  L.events={
    on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return ()=>listeners.get(name).delete(fn);},
    emit(name,params={}){const event={...params,name,time:L.time||0,frame:L.frame||0};if(history.length<512)history.push(event);else{history[cursor]=event;cursor=(cursor+1)%512;}for(const fn of listeners.get(name)||[])fn(event);for(const fn of listeners.get('*')||[])fn(event);return event;},
    get history(){return cursor?history.slice(cursor).concat(history.slice(0,cursor)):history.slice();},clear(){history.length=0;cursor=0;}
  };
  L.materials={};
  L.registerMaterial=m=>{for(const key of ['id','name','hardness','layers','onCut','onImpact','onPress','update','crossSection'])if(m[key]===undefined)throw new Error('Missing material field: '+key);L.materials[m.id]=m;};
  L.random=(function(){let s=317;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();
})(window.LAB=window.LAB||{});
