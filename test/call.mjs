import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {link}=JSON.parse(await readFile('qa/meeting-test.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--auto-select-desktop-capture-source=Entire screen']});
const contexts=[];const pages=[];const errors=[];
try{
 for(const name of ['Alex Test','Sam Test']){
  const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['camera','microphone']});contexts.push(context);
  const page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(link,{waitUntil:'networkidle'});
  await page.locator('input[name="username"]').fill(name);
  await page.locator('button[data-lk-source="camera"]').click();
  await page.locator('button[data-lk-source="microphone"]').click();
  await page.waitForFunction(()=>{const v=document.querySelector('.lk-prejoin video');return v&&v.readyState>=2;});
  await page.getByRole('button',{name:'Join now',exact:true}).click();
  await page.locator('.lk-participant-tile').first().waitFor({timeout:30000});
 }
 const [one,two]=pages;
 await one.waitForFunction(()=>document.querySelector('.participant-count')?.textContent.trim()==='2',{timeout:30000});
 await two.waitForFunction(()=>document.querySelector('.participant-count')?.textContent.trim()==='2',{timeout:30000});
 for(const page of pages){await page.waitForFunction(()=>[...document.querySelectorAll('.lk-participant-tile video')].filter(v=>v.readyState>=2).length>=2,{timeout:30000});}
 await one.screenshot({path:'qa/two-participant-call.png',fullPage:true});
 console.log('PASS: two browser participants and two decoded live camera feeds.');
 console.log('Controls:',await one.getByRole('button').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,label:n.getAttribute('aria-label'),class:n.className,source:n.getAttribute('data-lk-source')}))));
 await one.locator('.lk-control-bar .lk-chat-toggle').click();
 const chat=one.locator('.lk-chat-form input, .lk-chat-form textarea');
 await chat.fill('Hello from browser QA');await chat.press('Enter');
 await two.locator('.lk-control-bar .lk-chat-toggle').click();await two.getByText('Hello from browser QA',{exact:true}).waitFor();
 console.log('PASS: in-call chat delivered between browsers.');
 await one.locator('button[data-lk-source="screen_share"]').click();
 await two.waitForFunction(()=>document.querySelector('[data-lk-source="screen_share"] video')?.readyState>=2,{timeout:15000});
 console.log('PASS: screen share delivered to the other browser.');
 await one.screenshot({path:'qa/screen-sharing.png',fullPage:true});
 assert.deepEqual(errors,[]);
 for(const page of pages){await page.getByRole('button',{name:/Leave/i}).click();await page.getByRole('heading',{name:'You’ve left the meeting.'}).waitFor();}
 console.log('PASS: both participants left cleanly.');
}finally{await browser.close();}
