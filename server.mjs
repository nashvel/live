import express from 'express';
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

const app=express();
const origin=process.env.PUBLIC_ORIGIN || 'https://live.nashvel.com';
const port=Number(process.env.PORT || 3000);
const dataDir=process.env.DATA_DIR || '/data';
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'meetings.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS meetings (code TEXT PRIMARY KEY, title TEXT NOT NULL, starts_at TEXT, duration INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
const credentials=readFileSync(process.env.LIVEKIT_KEY_FILE || '/run/secrets/livekit_keys','utf8').trim();
const split=credentials.indexOf(':');
if(split<1)throw new Error('Invalid LiveKit key file');
const key=credentials.slice(0,split).trim();
const secret=credentials.slice(split+1).trim();
const roomService=new RoomServiceClient('http://127.0.0.1:7880',key,secret);
app.disable('x-powered-by');
app.set('trust proxy','loopback');
app.use((req,res,next)=>{
 res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(self), microphone=(self), display-capture=(self)',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' wss://live.nashvel.com; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
 if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
 next();
});
const rates=new Map();
setInterval(()=>{const now=Date.now();for(const [key,value]of rates)if(value.until<now)rates.delete(key);db.prepare('DELETE FROM meetings WHERE expires_at < ?').run(now);},60000).unref();
function limit(req,res,next){
 const kind=req.path==='/meetings'&&req.method==='POST'?'create':req.path.endsWith('/token')?'token':'read';
 const window=kind==='create'?3600000:60000;
 const max=kind==='create'?20:kind==='token'?40:150;
 const bucket=kind+':'+req.ip;
 let rate=rates.get(bucket);if(!rate||rate.until<Date.now())rate={count:0,until:Date.now()+window};
 if(rates.size>=20000&&!rates.has(bucket))return res.status(503).json({error:'Please try again in a moment.'});
 rates.set(bucket,rate);
 if(++rate.count>max){res.set('Retry-After',String(Math.ceil((rate.until-Date.now())/1000)));return res.status(429).json({error:'Too many requests. Please wait and try again.'});}next();
}
app.use('/api',limit);
app.use('/api',express.json({limit:'4kb'}));
app.use('/api',(req,res,next)=>{if(req.method!=='GET'&&req.get('origin')!==origin)return res.status(403).json({error:'Request origin not allowed.'});next();});
const codePattern=/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
const publicMeeting=row=>({code:row.code,title:row.title,startsAt:row.starts_at,duration:row.duration,expiresAt:row.expires_at,url:origin+'/m/'+row.code});
function findMeeting(code){if(!codePattern.test(code))return null;return db.prepare('SELECT * FROM meetings WHERE code=? AND expires_at>?').get(code,Date.now());}
app.get('/api/health',async(req,res)=>{try{const check=await fetch('http://127.0.0.1:7880/',{signal:AbortSignal.timeout(2500)});res.status(check.ok?200:503).json({available:check.ok});}catch{res.status(503).json({available:false});}});
app.post('/api/meetings',(req,res)=>{
 const {title='New meeting',startsAt=null,duration=60}=req.body || {};
 if(typeof title!=='string'||!title.trim()||title.trim().length>100||/[\u0000-\u001f]/.test(title))return res.status(400).json({error:'Use a meeting title of 1–100 characters.'});
 if(!Number.isInteger(duration)||duration<15||duration>480)return res.status(400).json({error:'Choose a duration between 15 minutes and 8 hours.'});
 const start=startsAt===null?null:Date.parse(startsAt);
 if(startsAt!==null&&(typeof startsAt!=='string'||!Number.isFinite(start)||start<Date.now()-60000||start>Date.now()+365*86400000))return res.status(400).json({error:'Choose a future date within the next year.'});
 if(db.prepare('SELECT count(*) AS n FROM meetings').get().n>=10000)return res.status(503).json({error:'Meeting creation is temporarily unavailable.'});
 const chars=()=>Array.from({length:10},()=>String.fromCharCode(97+randomInt(26))).join('');
 let code;do{const s=chars();code=s.slice(0,3)+'-'+s.slice(3,7)+'-'+s.slice(7);}while(findMeeting(code));
 const now=Date.now();
 db.prepare('INSERT INTO meetings VALUES(?,?,?,?,?,?)').run(code,title.trim(),start===null?null:new Date(start).toISOString(),duration,now,(start??now)+30*86400000);
 res.status(201).json(publicMeeting(findMeeting(code)));
});
app.get('/api/meetings/:code',(req,res)=>{const row=findMeeting(req.params.code);if(!row)return res.status(404).json({error:'Meeting not found. Check the code or ask for a new link.'});res.json(publicMeeting(row));});
app.post('/api/meetings/:code/token',async(req,res)=>{
 const row=findMeeting(req.params.code);if(!row)return res.status(404).json({error:'Meeting not found. Check the code or ask for a new link.'});
 const name=req.body?.name;
 if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\u0000-\u001f]/.test(name))return res.status(400).json({error:'Enter your name (up to 80 characters).'});
 try{
  await roomService.createRoom({name:'meet-'+row.code,maxParticipants:12,emptyTimeout:300,departureTimeout:30});
  const token=new AccessToken(key,secret,{identity:randomUUID(),name:name.trim(),ttl:'15m'});
  token.addGrant({roomJoin:true,room:'meet-'+row.code,canPublish:true,canSubscribe:true,canPublishData:true,canUpdateOwnMetadata:false});
  res.json({token:await token.toJwt(),serverUrl:'wss://live.nashvel.com'});
 }catch(error){console.error('Token issuance failed:',error.code||error.name);res.status(503).json({error:'The meeting service is temporarily unavailable. Please try again.'});}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Not found.'}));
const root=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(root,'dist'),{index:false,maxAge:'1h',setHeaders:(res,file)=>{if(file.endsWith('index.html'))res.set('Cache-Control','no-cache');}}));
app.use((req,res,next)=>{if(req.method==='GET'&&(req.path==='/'||/^\/m\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(req.path))){res.set('Cache-Control','no-cache');return res.sendFile(path.join(root,'dist/index.html'));}next();});
app.use((req,res)=>res.status(404).send('Not found'));
app.use((error,req,res,next)=>res.status(error.status===413?413:400).json({error:'Invalid request.'}));
const server=app.listen(port,'127.0.0.1',()=>console.log('Nashvel Meet listening on loopback port '+port));
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
