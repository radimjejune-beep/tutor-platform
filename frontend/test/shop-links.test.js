import test from 'node:test';
import assert from 'node:assert/strict';
import {buyLink} from '../src/shop-links.js';
test('paid lessons and preorders open website checkout, never Telegram',()=>{
  const shop={pay:true,bot:'fixture_bot',shop_url:'https://shop.example.test'};
  for(const status of ['available','preorder']){
    const action=buyLink({sku:'lesson-1',status},shop);
    assert.equal(action.href,'https://shop.example.test/?buy=lesson-1');
    assert.ok(!action.label.includes('Telegram'));
  }
  assert.equal(buyLink({sku:'lesson-1',status:'available'},{...shop,pay:false}),null);
  assert.deepEqual(buyLink({free:true,demo:'/demo/lesson-1'},shop),{href:'/demo/lesson-1',label:'Открыть бесплатно'});
  assert.equal(buyLink({status:'soon'},shop).quiet,true);
});
