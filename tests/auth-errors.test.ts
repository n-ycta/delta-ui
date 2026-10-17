import {test} from 'node:test';import assert from 'node:assert/strict';import {authError,sessionRejected} from '../src/auth/errors';import {tr} from '../src/i18n';
test('unregistered key has a recovery explanation, not a generic expiry error',()=>{assert.equal(authError({message:'public key is not enrolled',status:401,code:'unauthorized'}),tr('auth.keyNotEnrolled'))});
test('forbidden origin and expired setup links have actionable explanations',()=>{assert.equal(authError({message:'origin is not configured for key login',status:403}),tr('auth.originNotAllowed'));assert.equal(authError({message:'Setup link expired or consumed',status:401}),tr('auth.linkExpired'))});
test('expired owner access does not suggest creating another account',()=>{assert.equal(authError({message:'unauthorized',status:401}),tr('auth.accessExpired'))});

test('plugin restarts and network failures are not credential rejection',()=>{
 for(const error of [{code:'not_found',message:'capability web.info not found on nyxos'},{status:503},{code:'unavailable'},{status:403},undefined]) assert.equal(sessionRejected(error),false);
 assert.equal(sessionRejected({status:401}),true);
 assert.equal(sessionRejected({code:'unauthorized'}),true);
});
