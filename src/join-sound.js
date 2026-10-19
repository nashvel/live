// Resume during the Join click so later room events can play audio.
export function createJoinSound(){
 const AudioContextClass=window.AudioContext||window.webkitAudioContext;
 if(!AudioContextClass)return {play(){},dispose(){}};
 let context;
 try{context=new AudioContextClass();}catch{return {play(){},dispose(){}};}
 void context.resume().catch(()=>{});
 const load=src=>fetch(src,{cache:'no-cache'}).then(response=>{
  if(!response.ok)throw new Error('Join sound unavailable');
  return response.arrayBuffer();
 }).then(data=>context.decodeAudioData(data)).catch(()=>null);
 const buffers={join:load('/audio/join.mp3'),hand:load('/audio/raise_hand.mp3')};
 let disposed=false;
 return {
  async play(cue='join'){
   const decoded=await buffers[cue==='hand'?'hand':'join'];
   if(disposed||!decoded||context.state!=='running')return;
   const source=context.createBufferSource(),gain=context.createGain();
   source.buffer=decoded;
   gain.gain.value=cue==='reaction'?0.2:cue==='hand'?1:0.35;
   source.playbackRate.value=cue==='reaction'?1.65:1;
   source.connect(gain).connect(context.destination);
   source.onended=()=>{source.disconnect();gain.disconnect();};
   source.start();
  },
  dispose(){disposed=true;void context.close().catch(()=>{});}
 };
}
