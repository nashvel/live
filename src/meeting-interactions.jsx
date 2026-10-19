import React,{useEffect,useRef,useState} from 'react';
import {useRoomContext} from '@livekit/components-react';
import {RoomEvent,ConnectionState} from 'livekit-client';
import {Hand,Smile} from 'lucide-react';

const topic='nashvel-interactions';
const reactions=[['👍','Like'],['👏','Applause'],['❤️','Love'],['😂','Laugh'],['🎉','Celebrate'],['💡','Idea']];
export default function MeetingInteractions({sound}){
 const room=useRoomContext(),raisedRef=useRef(false),timers=useRef(new Set()),menu=useRef(null);
 const [raised,setRaised]=useState(false),[hands,setHands]=useState({}),[open,setOpen]=useState(false),[sending,setSending]=useState(false),[notices,setNotices]=useState([]),[error,setError]=useState('');
 function notify(emoji,name,cue){
  const id=crypto.randomUUID();
  setNotices(current=>[...current.slice(-5),{id,emoji,name}]);
  void sound.current?.play(cue);
  const timer=setTimeout(()=>{timers.current.delete(timer);setNotices(current=>current.filter(item=>item.id!==id));},3000);
  timers.current.add(timer);
 }
 useEffect(()=>{
  const received=(bytes,participant,kind,messageTopic)=>{
   if(messageTopic!==topic||!participant||bytes.length>256)return;
   let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{return;}
   if(!data||typeof data!=='object')return;
   const name=participant.name||'Guest';
   if(data.type==='hand'&&typeof data.raised==='boolean'){
    setHands(current=>{const next={...current};if(data.raised)next[participant.identity]=name;else delete next[participant.identity];return next;});
    if(data.raised&&!data.sync)notify('✋',name+' raised their hand','hand');
   }else if(data.type==='reaction'&&reactions.some(([emoji])=>emoji===data.emoji))notify(data.emoji,name,'reaction');
  };
  const left=participant=>setHands(current=>{const next={...current};delete next[participant.identity];return next;});
  const joined=participant=>{
   if(raisedRef.current)void room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({type:'hand',raised:true,sync:true})),{reliable:true,topic,destinationIdentities:[participant.identity]}).catch(()=>{});
  };
  room.on(RoomEvent.DataReceived,received).on(RoomEvent.ParticipantDisconnected,left).on(RoomEvent.ParticipantConnected,joined);
  return()=>{room.off(RoomEvent.DataReceived,received).off(RoomEvent.ParticipantDisconnected,left).off(RoomEvent.ParticipantConnected,joined);for(const timer of timers.current)clearTimeout(timer);timers.current.clear();};
 },[room,sound]);
 useEffect(()=>{
  if(!open)return;
  const close=event=>{if(event.key==='Escape'||(event.type==='pointerdown'&&!menu.current?.contains(event.target)))setOpen(false);};
  window.addEventListener('pointerdown',close);window.addEventListener('keydown',close);
  return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',close);};
 },[open]);
 async function send(data){
  if(sending)return;
  setSending(true);setError('');setOpen(false);
  try{
   if(room.state!==ConnectionState.Connected)throw new Error('Disconnected');
   await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(data)),{reliable:true,topic});
   if(data.type==='hand'){
    raisedRef.current=data.raised;setRaised(data.raised);
    if(data.raised)notify('✋','You raised your hand','hand');
   }else notify(data.emoji,'You','reaction');
  }catch{setError('Could not send. Please try again.');}finally{setSending(false);}
 }
 const handNames=[...(raised?['You']:[]),...Object.values(hands)];
 return <div className="meeting-interactions">
  <button className="interaction-button" aria-pressed={raised} disabled={sending} onClick={()=>send({type:'hand',raised:!raised})}><Hand size={18}/>{raised?'Lower hand':'Raise hand'}</button>
  <div className="reaction-picker" ref={menu}>
   <button className="interaction-button" aria-expanded={open} aria-controls="reaction-options" onClick={()=>setOpen(!open)}><Smile size={18}/>Reactions</button>
   {open&&<div id="reaction-options" className="reaction-options" role="group" aria-label="Send a reaction">{reactions.map(([emoji,label])=><button key={emoji} disabled={sending} aria-label={label} title={label} onClick={()=>send({type:'reaction',emoji})}>{emoji}</button>)}</div>}
  </div>
  {handNames.length>0&&<span className="raised-hands" role="status">✋ {handNames.join(', ')}</span>}
  {error&&<span className="interaction-error" role="alert">{error}</span>}
  <div className="reaction-notices" aria-live="polite">{notices.map(item=><div key={item.id} className="reaction-notice"><span>{item.emoji}</span><small>{item.name}</small></div>)}</div>
 </div>;
}
