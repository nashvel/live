"""Verify trusted TLS and authenticated TURN allocation without exposing credentials."""
import asyncio, hashlib, hmac, secrets, ssl, struct, time
from datetime import timedelta
from pathlib import Path
import aiohttp
from livekit import api
from livekit.protocol import rtc

MAGIC=0x2112A442

def attr(kind,data):
    return struct.pack('!HH',kind,len(data))+data+b'\0'*((-len(data))%4)

def message(kind,attributes,key=None):
    tx=secrets.token_bytes(12)
    size=len(attributes)+(24 if key else 0)
    header=struct.pack('!HHI12s',kind,size,MAGIC,tx)
    if key: attributes+=attr(0x0008,hmac.new(key,header+attributes,hashlib.sha1).digest())
    return header+attributes,tx

async def exchange(reader,writer,kind,attributes,key=None):
    packet,tx=message(kind,attributes,key)
    writer.write(packet)
    await writer.drain()
    header=await asyncio.wait_for(reader.readexactly(20),5)
    result,size,magic,rtx=struct.unpack('!HHI12s',header)
    if magic!=MAGIC or rtx!=tx: raise RuntimeError('STUN transaction mismatch')
    body=await asyncio.wait_for(reader.readexactly(size),5)
    attributes={}
    offset=0
    while offset<len(body):
        name,n=struct.unpack('!HH',body[offset:offset+4])
        attributes[name]=body[offset+4:offset+4+n]
        offset+=4+n+(-n)%4
    return result,attributes

async def main():
    key,secret=Path('/opt/livekit/keys.yaml').read_text().strip().split(': ',1)
    room='turn-smoke-'+str(int(time.time()))
    admin=api.LiveKitAPI('http://127.0.0.1:7880',key,secret)
    try:
        await admin.room.create_room(api.CreateRoomRequest(name=room,empty_timeout=30))
        token=(api.AccessToken(key,secret).with_identity('turn-smoke').with_ttl(timedelta(minutes=2))
               .with_grants(api.VideoGrants(room_join=True,room=room)).to_jwt())
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect('wss://live.nashvel.com/rtc',params={'protocol':'15','sdk':'python'},headers={'Authorization':'Bearer '+token}) as ws:
                response=await ws.receive(timeout=5)
                joined=rtc.SignalResponse.FromString(response.data)
                server=next(s for s in joined.join.ice_servers if any(u.startswith('turns:') for u in s.urls))
                reader,writer=await asyncio.wait_for(asyncio.open_connection('turn.live.nashvel.com',443,ssl=ssl.create_default_context(),server_hostname='turn.live.nashvel.com'),5)
                try:
                    transport=attr(0x0019,bytes([17,0,0,0]))
                    code,attrs=await exchange(reader,writer,0x0003,transport)
                    if code!=0x0113 or 0x0014 not in attrs or 0x0015 not in attrs:
                        raise RuntimeError('Expected TURN authentication challenge')
                    realm,nonce=attrs[0x0014],attrs[0x0015]
                    credential_key=hashlib.md5(server.username.encode()+b':'+realm+b':'+server.credential.encode()).digest()
                    auth=attr(0x0006,server.username.encode())+attr(0x0014,realm)+attr(0x0015,nonce)
                    code,attrs=await exchange(reader,writer,0x0003,transport+auth,credential_key)
                    if code!=0x0103 or 0x0016 not in attrs: raise RuntimeError('Authenticated allocation failed: '+hex(code))
                    relay=attrs[0x0016]
                    family=relay[1]
                    port=struct.unpack('!H',relay[2:4])[0]^(MAGIC>>16)
                    if family==1:
                        import socket
                        ip=socket.inet_ntoa(bytes(a^b for a,b in zip(relay[4:8],struct.pack('!I',MAGIC))))
                        print('TURN/TLS authenticated relay address:',ip,port)
                    code,_=await exchange(reader,writer,0x0004,attr(0x000D,struct.pack('!I',0))+auth,credential_key)
                    if code!=0x0104: raise RuntimeError('Allocation cleanup failed')
                    print('PASS: trusted TURN TLS on TCP 443, authentication challenge, signed allocation and allocation cleanup.')
                finally:
                    writer.close()
                    await writer.wait_closed()
    finally:
        await admin.room.delete_room(api.DeleteRoomRequest(room=room))
        await admin.aclose()

asyncio.run(main())
