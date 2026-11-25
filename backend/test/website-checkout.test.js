const test=require('node:test'),assert=require('node:assert/strict');
test('legacy Telegram order creation stops before database or payment access',async t=>{
  const db=require('../lessonfold/src/db'),pay=require('../lessonfold/src/pay');let calls=0;
  t.mock.method(db,'q',()=>{calls++;throw Error('Unexpected DB access');});
  t.mock.method(pay,'createPayment',()=>{calls++;throw Error('Unexpected payment');});
  await assert.rejects(require('../lessonfold/src/orders').createTg({sku:'fixture',from:{id:1}}),e=>e.status===410);
  assert.equal(calls,0);
});
test('new and old bot purchase buttons lead directly to website checkout without creating orders',async t=>{
  const db=require('../lessonfold/src/db'),tg=require('../lessonfold/src/telegram'),catalog=require('../lessonfold/src/catalog'),orders=require('../lessonfold/src/orders'),{config}=require('../lessonfold/src/config');
  const original=config.publicUrl;config.publicUrl='https://shop.example.test';t.after(()=>{config.publicUrl=original;});
  const sent=[];t.mock.method(tg,'call',async(method,payload)=>{sent.push({method,payload});return {};});
  t.mock.method(db,'upsertUser',async()=>{});t.mock.method(db,'userPurchases',async()=>[]);
  t.mock.method(catalog,'product',()=>({sku:'fixture-lesson',title:'Fixture lesson',price:249,description:'Original',type:'lesson',status:'available'}));
  t.mock.method(catalog,'purchasable',()=>true);t.mock.method(catalog,'isCourse',()=>false);t.mock.method(catalog,'moduleOf',()=>null);
  t.mock.method(orders,'create',()=>assert.fail('A bot must not create a website order'));
  t.mock.method(orders,'createTg',()=>assert.fail('A bot must not create a Telegram order'));
  const bot=require('../lessonfold/src/bot');
  for(const data of ['p:fixture-lesson','buy:fixture-lesson']){
    sent.length=0;
    await bot.handleUpdate({callback_query:{id:'fixture',data,from:{id:123},message:{chat:{id:123},message_id:1}}});
    const buttons=sent.flatMap(s=>s.payload.reply_markup?.inline_keyboard?.flat()||[]);
    assert.ok(buttons.some(b=>b.url==='https://shop.example.test/?buy=fixture-lesson'));
    assert.ok(!buttons.some(b=>b.callback_data?.startsWith('buy:')));
    assert.ok(!sent.some(s=>s.method==='sendInvoice'));
  }
});
