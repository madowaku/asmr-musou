/* Render-state ring: exact transformed body vertices, debris instances and FX.
 * 30Hz / 1.5s, max 32MiB; playback submits snapshots, never emits live events. */
(function(L){
  let ring=[],clip=[],last=-Infinity,cutAt=-Infinity,replay=null,recorder=null,stream=null;
  const button=()=>document.getElementById('record'),message=t=>document.getElementById('capture-status').textContent=t;
  L.capture={
    cut(){cutAt=L.time;clip=ring.filter(s=>s.time>=L.time-.15);},
    reset(){ring=[];clip=[];replay=null;last=cutAt=-Infinity;},
    sample(renderer){
      if(L.time-last<1/30-.001)return;last=L.time;
      const s=renderer.snapshot();s.time=L.time;ring.push(s);
      while(ring.length>46||ring[0]?.time<L.time-1.5)ring.shift();
      let bytes=ring.reduce((n,s)=>n+s.bytes,0);while(bytes>32*1024*1024&&ring.length>1)bytes-=ring.shift().bytes;
      if(L.time-cutAt<=1.35)clip.push(s);
    },
    startReplay(){if(clip.length<2){message('一度斬ってから、リプレイできます。');return false;}replay={frames:clip.slice(),at:0};message('¼ リプレイ · 音なし');return true;},
    get replaying(){return !!replay;},
    play(renderer,dt){if(!replay)return false;const frames=replay.frames;replay.at+=dt*.25;const time=frames[0].time+replay.at;let s=frames[0];for(const f of frames){if(f.time>time)break;s=f;}renderer.restore(s,.035);if(time>=frames.at(-1).time){replay=null;message('リプレイ終了');}return true;},
    stats(){return {ringFrames:ring.length,clipFrames:clip.length,ringBytes:ring.reduce((n,s)=>n+s.bytes,0),replaying:!!replay,recording:recorder?.state==='recording'};},
    async record(canvas){
      if(recorder?.state==='recording'){recorder.stop();return;}
      if(!window.MediaRecorder||!canvas.captureStream){message('このブラウザーでは録画できません。');return;}
      const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      if(!mime){message('WebM録画に対応していません。');return;}
      stream=canvas.captureStream(60);
      const audio=L.audio?.captureStream?.()||L.audio?.destination?.stream||L.audio?.recordingDestination?.stream;
      // Clone shared audio tracks: stopping our recorder must not stop game audio.
      for(const track of audio?.getAudioTracks?.()||[])stream.addTrack(track.clone());
      const chunks=[];
      try{
        recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
        recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        recorder.onstop=()=>{const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='asmr-cut-'+new Date().toISOString().replace(/[:.]/g,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);stream.getTracks().forEach(t=>t.stop());button().textContent='● 録画 R';message('9:16 WebMを保存しました');};
        recorder.onerror=()=>{stream.getTracks().forEach(t=>t.stop());message('録画に失敗しました。');button().textContent='● 録画 R';};
        recorder.start(200);button().textContent='■ 保存 R';message(stream.getAudioTracks().length?'録画中 · 音あり':'録画中 · 映像のみ');
      }catch(e){stream.getTracks().forEach(t=>t.stop());message('録画を開始できません: '+e.message);}
    }
  };
})(window.LAB);
