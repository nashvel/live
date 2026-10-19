import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCode,calendarText} from '../src/utils.js';
test('meeting links only accept this service, including unhyphenated codes',()=>{
 assert.equal(normalizeCode('https://live.nashvel.com/m/abc-defg-hij','https://live.nashvel.com'),'abc-defg-hij');
 assert.equal(normalizeCode('ABCDEFGHIJ'),'abc-defg-hij');
 assert.throws(()=>normalizeCode('https://evil.example/m/abc-defg-hij','https://live.nashvel.com'));
 assert.throws(()=>normalizeCode('../admin'));
});
test('calendar invites preserve UTC timing and escape user content',()=>{
 const text=calendarText({code:'abc-defg-hij',title:'Team, sync; Café\nBEGIN:VEVENT',startsAt:'2026-10-20T08:00:00Z',duration:90,url:'https://live.nashvel.com/m/abc-defg-hij'});
 assert.ok(text.includes('DTSTART:20261020T080000Z\r\n'));
 assert.ok(text.includes('DTEND:20261020T093000Z\r\n'));
 assert.ok(text.includes('SUMMARY:Team\\, sync\\; Café\\nBEGIN:VEVENT'));
 assert.equal(text.split('\r\n').filter(l=>l==='BEGIN:VEVENT').length,1);
 for(const line of text.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
