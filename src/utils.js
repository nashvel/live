export function normalizeCode(value,origin=globalThis.location?.origin){
 let raw=value.trim();
 if(/^https?:\/\//i.test(raw)){
  try{const url=new URL(raw);if(url.origin!==origin)throw new Error();raw=url.pathname.replace(/^\/m\//,'').replace(/\/$/,'');}catch{throw new Error('Use a Nashvel meeting link or meeting code.');}
 }
 raw=raw.toLowerCase().replace(/\s/g,'');
 if(/^[a-z]{10}$/.test(raw))raw=raw.slice(0,3)+'-'+raw.slice(3,7)+'-'+raw.slice(7);
 if(!/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(raw))throw new Error('Enter a meeting code such as abc-defg-hij, or paste your meeting link.');
 return raw;
}
export function localDateValue(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export function calendarText(meeting){
 const escape=s=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const stamp=date=>new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const start=new Date(meeting.startsAt),end=new Date(start.getTime()+meeting.duration*60000);
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Nashvel//Meet//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${meeting.code}@live.nashvel.com`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escape(meeting.title)}`,`DESCRIPTION:${escape('Join your Nashvel meeting: '+meeting.url+'\nMeeting code: '+meeting.code)}`,`LOCATION:${meeting.url}`,`URL:${meeting.url}`,'END:VEVENT','END:VCALENDAR'];
 // RFC 5545: fold physical content lines at 75 UTF-8 octets.
 return lines.map(line=>{let out='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>75){out+='\r\n ';bytes=1;}out+=ch;bytes+=size;}return out;}).join('\r\n')+'\r\n';
}
export function downloadCalendar(meeting){const blob=new Blob([calendarText(meeting)],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`nashvel-${meeting.code}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function request(path,body){const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});let data;try{data=await response.json();}catch{throw new Error('Unable to reach the meeting service. Please try again.');}if(!response.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data;}
export function readMeetings(){try{return JSON.parse(localStorage.getItem('nashvel-meetings')||'[]').filter(m=>m.expiresAt>Date.now()).slice(0,20);}catch{return [];}}
export function rememberMeeting(meeting){try{localStorage.setItem('nashvel-meetings',JSON.stringify([meeting,...readMeetings().filter(m=>m.code!==meeting.code)].slice(0,20)));}catch{}}
