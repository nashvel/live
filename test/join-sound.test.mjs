import test from 'node:test';
import assert from 'node:assert/strict';
import {createJoinSound} from '../src/join-sound.js';

test('join sound unlocks on creation, plays on request, and stops after disposal',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;
 let resumed=0,started=0,closed=0,volume,rate;
 class AudioContext{
  state='running';
  resume(){resumed++;return Promise.resolve();}
  decodeAudioData(){return Promise.resolve({});}
  createBufferSource(){return {playbackRate:{set value(value){rate=value;}},connect(){return {connect(){}};},start(){started++;},disconnect(){}};}
  createGain(){return {gain:{set value(value){volume=value;}},disconnect(){}};}
  close(){closed++;return Promise.resolve();}
 }
 globalThis.window={AudioContext};
 globalThis.fetch=async path=>{assert.ok(['/audio/join.mp3','/audio/raise_hand.mp3'].includes(path));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};};
 try{
  const sound=createJoinSound();
  assert.equal(resumed,1);
  assert.equal(started,0);
  await sound.play();
  assert.equal(started,1);
  assert.equal(volume,0.35);
  await sound.play('reaction');
  assert.equal(volume,0.2);
  assert.equal(rate,1.65);
  await sound.play('hand');
  assert.equal(volume,1);
  assert.equal(rate,1);
  sound.dispose();
  await sound.play();
  assert.equal(started,3);
  assert.equal(closed,1);
 }finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch;}
});
