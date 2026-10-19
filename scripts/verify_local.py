"""Temporary synthetic local media test; no frontend or recording services."""
import asyncio
import argparse
import aiohttp
from livekit.protocol import rtc as signal_proto
from livekit.rtc._proto.room_pb2 import IceServer
import math
import struct
import time
from datetime import timedelta
from pathlib import Path
from livekit import api, rtc

args_parser = argparse.ArgumentParser()
args_parser.add_argument('--url', default='ws://127.0.0.1:7880')
args_parser.add_argument('--relay', action='store_true')
args_parser.add_argument('--turn-tls', action='store_true')
args_parser.add_argument('--turn-udp', action='store_true')
args = args_parser.parse_args()

async def main():
    key, secret = Path('/opt/livekit/keys.yaml').read_text().strip().split(': ', 1)
    room_name = 'deployment-smoke-' + str(time.time_ns())
    service = api.LiveKitAPI('http://127.0.0.1:7880', key, secret)
    pub, sub = rtc.Room(), rtc.Room()
    observed = set()
    bootstrap_session = None
    bootstrap_ws = None
    jobs = []
    streams = []
    async def receive_frame(track, source):
        stream = rtc.AudioStream(track) if track.kind == rtc.TrackKind.KIND_AUDIO else rtc.VideoStream(track)
        streams.append(stream)
        async for event in stream:
            observed.add('frame:' + rtc.TrackSource.Name(source))
            break
        await stream.aclose()
    @sub.on('track_subscribed')
    def track_subscribed(track, publication, participant):
        jobs.append(asyncio.create_task(receive_frame(track, publication.source)))
    @sub.on('data_received')
    def data_received(packet):
        observed.add('data:' + packet.data.decode())
    def token(identity):
        return (api.AccessToken(key,secret).with_identity(identity)
            .with_ttl(timedelta(minutes=5))
            .with_grants(api.VideoGrants(room_join=True,room=room_name)).to_jwt())
    try:
        await service.room.create_room(api.CreateRoomRequest(name=room_name,empty_timeout=30))
        ice_config=rtc.RtcConfiguration(ice_transport_type=rtc.IceTransportType.TRANSPORT_RELAY) if args.relay or args.turn_tls or args.turn_udp else None
        if args.turn_tls or args.turn_udp:
            bootstrap_session=aiohttp.ClientSession()
            bootstrap_ws=await bootstrap_session.ws_connect(
                args.url+'/rtc',params={'protocol':'15','sdk':'python','version':'1.1.21','auto_subscribe':'0'},
                headers={'Authorization':'Bearer '+token('smoke-bootstrap')})
            message=await bootstrap_ws.receive(timeout=10)
            if message.type != aiohttp.WSMsgType.BINARY: raise RuntimeError('Expected binary signal response')
            response=signal_proto.SignalResponse.FromString(message.data)
            if not response.HasField('join'): raise RuntimeError('Expected join response')
            for server in response.join.ice_servers:
                tls_urls=[u for u in server.urls if u.startswith('turns:' if args.turn_tls else 'turn:')]
                if tls_urls: ice_config.ice_servers.append(IceServer(urls=tls_urls,username=server.username,password=server.credential))
            if not ice_config.ice_servers: raise RuntimeError('Server advertised no matching TURN endpoint')
            print('Restricting ICE to advertised TURN URLs:',[list(s.urls) for s in ice_config.ice_servers])
        options=rtc.RoomOptions(connect_timeout=20, rtc_config=ice_config)
        await sub.connect(args.url,token('smoke-subscriber'),options)
        await pub.connect(args.url,token('smoke-publisher'),options)
        source=rtc.AudioSource(48000,1)
        track=rtc.LocalAudioTrack.create_audio_track('synthetic-microphone',source)
        await pub.local_participant.publish_track(track,rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
        cameras=[]
        for label, src, screen in [('camera',rtc.TrackSource.SOURCE_CAMERA,False),('screen',rtc.TrackSource.SOURCE_SCREENSHARE,True)]:
            vs=rtc.VideoSource(160,90,is_screencast=screen)
            vt=rtc.LocalVideoTrack.create_video_track('synthetic-'+label,vs)
            await pub.local_participant.publish_track(vt,rtc.TrackPublishOptions(source=src))
            cameras.append(vs)
        samples=struct.pack('<480h',*[int(2000*math.sin(2*math.pi*440*i/48000)) for i in range(480)])
        video=rtc.VideoFrame(160,90,rtc.VideoBufferType.RGB24,bytes([30,100,160])*(160*90))
        expected={'frame:SOURCE_MICROPHONE','frame:SOURCE_CAMERA','frame:SOURCE_SCREENSHARE','data:reliable','data:lossy'}
        for i in range(1000):
            await source.capture_frame(rtc.AudioFrame(samples,48000,1,480))
            if i%10==0:
                for vs in cameras: vs.capture_frame(video)
            if i%100==0:
                await pub.local_participant.publish_data('reliable',reliable=True)
                await pub.local_participant.publish_data('lossy',reliable=False)
            if expected <= observed: break
            await asyncio.sleep(0.01)
        missing=expected-observed
        if missing: raise RuntimeError('Not received: '+str(sorted(missing)))
        print('PASS: authenticated room API; two participants; decoded microphone, camera and screen-share frames; reliable and lossy data.')
        print('URL:', args.url, 'relay-only:', args.relay)
        stats=await pub.get_rtc_stats()
        for stat in stats.publisher_stats:
            if stat.HasField('local_candidate'):
                candidate=stat.local_candidate.candidate
                print('ICE local candidate:',candidate.candidate_type, candidate.protocol, candidate.relay_protocol, candidate.url)
        if args.turn_tls:
            relays=[s.local_candidate.candidate for s in stats.publisher_stats if s.HasField('local_candidate') and s.local_candidate.candidate.url.startswith('turns:')]
            if not relays: raise RuntimeError('No TURN/TLS candidate appeared in client stats')
        print('Scope: both clients run on this VPS; PH-US paths are not tested.')
    finally:
        await pub.disconnect()
        await sub.disconnect()
        for job in jobs:
            if not job.done(): job.cancel()
        if jobs: await asyncio.gather(*jobs,return_exceptions=True)
        await service.room.delete_room(api.DeleteRoomRequest(room=room_name))
        if bootstrap_ws: await bootstrap_ws.close()
        if bootstrap_session: await bootstrap_session.close()
        await service.aclose()

asyncio.run(main())
