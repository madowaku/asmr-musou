/* WebGL2 only. CPU triangle batches, instanced debris, cut-face material pass,
 * additive glow and a final screen-space camera/slow-motion pass. */
(function(L){
  'use strict';
  const VS=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV;
  layout(location=2) in vec4 aColor; layout(location=3) in vec4 aExtra;
  out vec2 vUV; out vec4 vColor; out vec4 vExtra;
  void main(){gl_Position=vec4(aPos/vec2(720.,1280.)*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);vUV=aUV;vColor=aColor;vExtra=aExtra;}`;
  const FS=`#version 300 es
  precision highp float;
  in vec2 vUV; in vec4 vColor; in vec4 vExtra; uniform sampler2D uTex; uniform float uTime; uniform float uDebug;
  out vec4 outColor;
  void main(){
    float mode=vExtra.x;vec4 c=vColor;
    if(mode<.5){c*=texture(uTex,vUV);if(c.a<.03)discard;}
    else if(mode>1.5&&mode<3.5){c*=texture(uTex,fract(vUV));c.rgb*=1.06-.22*vExtra.y;if(mode>2.5){/* jelly cut face: depth-tinted translucent gel, wet edge line, travelling glossy sheen (was opaque -> read as paper) */float depth=clamp(vExtra.y,0.,1.);vec3 gel=mix(vec3(.86,.74,1.),vec3(.47,.27,.78),depth*.85);c.rgb=mix(c.rgb,gel,.55);c.rgb+=.55*exp(-pow((depth-.06)*16.,2.));float sheen=pow(max(0.,sin((vUV.x*1.3+vUV.y)*4.2-uTime*1.7)),18.);c.rgb+=sheen*.42*(1.-depth*.6);c.a=mix(.62,.86,depth)+sheen*.12;}}
    else if(mode>3.5){float d=length(vUV*2.-1.);c.a*=exp(-d*d*4.)*(1.-smoothstep(.7,1.,d));}
    if(uDebug>0.){if(mode<.5)c=vec4(0.,0.,1.,1.);else if(mode>1.5&&mode<3.5)c=vec4(1.,0.,0.,1.);else discard;}
    outColor=c;
  }`;
  const PVS=`#version 300 es
  precision highp float;
  layout(location=0) in vec2 aCorner;layout(location=1) in vec4 aTransform;
  layout(location=2) in vec4 aColor;layout(location=3) in vec2 aKind;
  out vec2 vP;out vec4 vC;out float vKind;
  void main(){float c=cos(aTransform.w),s=sin(aTransform.w);vec2 p=mat2(c,s,-s,c)*aCorner*aTransform.z+aTransform.xy;gl_Position=vec4(p/vec2(720.,1280.)*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);vP=aCorner;vC=aColor;vKind=aKind.x;}`;
  const PFS=`#version 300 es
  precision highp float;in vec2 vP;in vec4 vC;in float vKind;uniform sampler2D uAtlas;out vec4 outColor;
  void main(){float k=floor(vKind+.5);vec2 uv=(vec2(mod(k,4.),floor(k/4.))+(vP+1.)*.5)/4.;vec4 c=texture(uAtlas,uv)*vC;if(c.a<.02)discard;outColor=c;}`;
  const POSTVS=`#version 300 es
  precision highp float;out vec2 vUV;
  void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUV=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
  const POSTFS=`#version 300 es
  precision highp float;in vec2 vUV;uniform sampler2D uTex;uniform float uPunch;uniform float uSlow;out vec4 outColor;
  void main(){vec2 uv=(vUV-.5)/(1.+uPunch)+.5;vec3 c=texture(uTex,uv).rgb;float vignette=smoothstep(.8,.15,length(vUV-.5));c*=.9+.1*vignette;c=mix(c,c*vec3(.88,1.,1.05),uSlow*.17);outColor=vec4(c,1.);}`;
  class Batch{
    constructor(){this.data=new Float32Array(32768);this.n=0;}
    vertex(x,y,u,v,color,mode=1,energy=0){if(this.n+12>this.data.length){const d=new Float32Array(this.data.length*2);d.set(this.data);this.data=d;}const d=this.data;let n=this.n;d[n++]=x;d[n++]=y;d[n++]=u;d[n++]=v;d[n++]=color[0];d[n++]=color[1];d[n++]=color[2];d[n++]=color[3];d[n++]=mode;d[n++]=energy;d[n++]=0;d[n++]=0;this.n=n;}
  }
  L.createRenderer=canvas=>{
    const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if(!gl)throw new Error('WebGL2 が必要です。このブラウザーでは利用できません。');
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
    function program(vs,fs){const p=gl.createProgram(),v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));gl.deleteShader(v);gl.deleteShader(f);return p;}
    const prog=program(VS,FS),pprog=program(PVS,PFS),post=program(POSTVS,POSTFS),textures=new Map(),batches=new Map(),caps=new Map(),surface=new Batch(),solid=new Batch(),glow=new Batch();
    const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    for(const [i,n,offset]of [[0,2,0],[1,2,8],[2,4,16],[3,4,32]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,48,offset);}
    const pvao=gl.createVertexArray(),quad=gl.createBuffer(),instances=gl.createBuffer();
    gl.bindVertexArray(pvao);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,instances);
    for(const [i,n,offset]of [[1,4,0],[2,4,16],[3,2,32]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,40,offset);gl.vertexAttribDivisor(i,1);}
    let instanceData=new Float32Array(2048*10);
    const target=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,target);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,720,1280,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Incomplete scene framebuffer');
    let debug=false,lastInstances=0,lastTime=0,lastPunch=0,lastSlow=false;
    const debugLoc=gl.getUniformLocation(prog,'uDebug'),timeLoc=gl.getUniformLocation(prog,'uTime'),punchLoc=gl.getUniformLocation(post,'uPunch'),slowLoc=gl.getUniformLocation(post,'uSlow');
    function texture(name){const source=L.tex(name);let cached=textures.get(name);if(cached&&cached.source===source)return cached.tex;const tex=cached?cached.tex:gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);textures.set(name,{source,tex});return tex;}
    function batch(name){if(!batches.has(name))batches.set(name,new Batch());return batches.get(name);}
    function triangle(b,a,c,d,color,mode=1,energy=0){for(const p of [a,c,d])b.vertex(p.x,p.y,p.u||0,p.v||0,color,mode,energy);}
    function line(a,b,width,color,dest=solid){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.01)return;const nx=-dy/len*width/2,ny=dx/len*width/2,p={x:a.x+nx,y:a.y+ny},q={x:b.x+nx,y:b.y+ny},r={x:b.x-nx,y:b.y-ny},s={x:a.x-nx,y:a.y-ny};triangle(dest,p,q,r,color);triangle(dest,p,r,s,color);}
    function drawBatch(b,tex){if(!b.n)return;gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,b.data.subarray(0,b.n),gl.DYNAMIC_DRAW);if(tex)gl.bindTexture(gl.TEXTURE_2D,tex);gl.drawArrays(gl.TRIANGLES,0,b.n/12);}
    return {
      gl,
      setDebug(value){debug=value;},
      pixels(){const p=new Uint8Array(720*1280*4);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.readPixels(0,0,720,1280,gl.RGBA,gl.UNSIGNED_BYTE,p);gl.bindFramebuffer(gl.FRAMEBUFFER,null);return p;},
      snapshot(){const copy=b=>b.data.slice(0,b.n),s={batches:[...batches].map(([k,b])=>[k,copy(b)]),caps:[...caps].map(([k,b])=>[k,copy(b)]),solid:copy(solid),glow:copy(glow),instances:instanceData.slice(0,lastInstances),time:lastTime,punch:lastPunch,slow:lastSlow};s.bytes=[...s.batches,...s.caps].reduce((n,[,v])=>n+v.byteLength,0)+s.solid.byteLength+s.glow.byteLength+s.instances.byteLength;return s;},
      restore(s,zoom=0){this.begin();const put=(b,v)=>{if(b.data.length<v.length)b.data=new Float32Array(v.length);b.data.set(v);b.n=v.length;};for(const [k,v] of s.batches)put(batch(k),v);for(const [k,v] of s.caps){if(!caps.has(k))caps.set(k,new Batch());put(caps.get(k),v);}put(solid,s.solid);put(glow,s.glow);this.render([],s.time,s.punch+zoom,true,s.instances);},
      begin(){for(const b of [...batches.values(),...caps.values()])b.n=0;surface.n=solid.n=glow.n=0;},
      mesh(name,vertices,indices,color=[1,1,1,1]){const b=batch(name);for(const i of indices){const p=vertices[i];b.vertex(p.x,p.y,p.u,p.v,color,0);}},
      cap(name,vertices,indices,mode=2,color=[1,1,1,1]){if(!caps.has(name))caps.set(name,new Batch());const b=caps.get(name);for(const i of indices){const p=vertices[i];b.vertex(p.x,p.y,p.x/128,p.y/128,color,mode,p.shade||0);}},
      flash(a,b,width,color){line(a,b,width,color,glow);},
      polygon(name,vertices,color=[1,1,1,1]){this.mesh(name,vertices,L.slice.triangulate(vertices),color);},
      line,
      ribbon(a,b,width,color){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.1)return;const nx=-dy/len*width,ny=dx/len*width,mx=a.x+dx*.72,my=a.y+dy*.72,p={x:mx+nx,y:my+ny},q={x:mx-nx,y:my-ny};triangle(solid,a,p,b,color);triangle(solid,a,b,q,color);},
      face(a,b,width,material){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.1)return;const w=Math.min(width,len*.4),nx=-dy/len*w,ny=dx/len*w,pts=[{x:a.x,y:a.y,shade:0},{x:b.x,y:b.y,shade:0},{x:b.x+nx,y:b.y+ny,shade:1},{x:a.x+nx,y:a.y+ny,shade:1}];this.cap('xsec/'+material,pts,[0,1,2,0,2,3],material==='jelly'?3:2);line(a,b,material==='wax'?3:1.4,material==='wax'?[1,.66,.79,1]:[1,.9,1,.8]);},
      glow(x,y,r,color){const a={x:x-r,y:y-r,u:0,v:0},b={x:x+r,y:y-r,u:1,v:0},c={x:x+r,y:y+r,u:1,v:1},d={x:x-r,y:y+r,u:0,v:1};triangle(glow,a,b,c,color,4);triangle(glow,a,c,d,color,4);},
      render(particles,time,punch,slow,replayInstances=null){
        gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,720,1280);gl.clearColor(.039,.071,.091,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(prog);gl.uniform1f(timeLoc,time);gl.uniform1f(debugLoc,debug?1:0);
        for(const [name,b]of batches)drawBatch(b,texture(name));for(const [name,b]of caps)drawBatch(b,texture(name));if(!debug){drawBatch(surface);drawBatch(solid);}
        if(particles.length*10>instanceData.length)instanceData=new Float32Array(2**Math.ceil(Math.log2(particles.length*10)));
        let n=0;for(const p of particles){instanceData[n++]=p.x;instanceData[n++]=p.y;instanceData[n++]=p.size;instanceData[n++]=p.angle;instanceData[n++]=p.color[0];instanceData[n++]=p.color[1];instanceData[n++]=p.color[2];instanceData[n++]=Math.min(1,p.life/.2)*p.color[3];instanceData[n++]=p.kind;instanceData[n++]=0;}
        if(replayInstances){if(instanceData.length<replayInstances.length)instanceData=new Float32Array(replayInstances.length);instanceData.set(replayInstances);n=replayInstances.length;}
        lastInstances=n;lastTime=time;lastPunch=punch;lastSlow=slow;
        if(n&&!debug){gl.useProgram(pprog);gl.bindTexture(gl.TEXTURE_2D,texture('fx/atlas'));gl.bindVertexArray(pvao);gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,instanceData.subarray(0,n),gl.DYNAMIC_DRAW);gl.drawArraysInstanced(gl.TRIANGLES,0,6,n/10);}
        gl.useProgram(prog);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);if(!debug)drawBatch(glow);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.disable(gl.BLEND);gl.useProgram(post);gl.bindVertexArray(null);gl.bindTexture(gl.TEXTURE_2D,target);gl.uniform1f(punchLoc,punch);gl.uniform1f(slowLoc,slow?1:0);gl.drawArrays(gl.TRIANGLES,0,3);
      }
    };
  };
})(window.LAB);
