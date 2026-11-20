import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findAuthCookie, getAuthCookieName } from './auth-cookie.js';

function store(cookies) {
  const map = new Map(cookies.map((c) => [c.name, c]));
  return {
    get(name) {
      return map.get(name);
    },
    getAll() {
      return [...map.values()];
    },
  };
}

describe('auth-cookie', () => {
  it('prefers AUTH_COOKIE_NAME', () => {
    process.env.AUTH_COOKIE_NAME = 'pbn_forum_cholink_auth';
    delete process.env.FORUM_ID;
    assert.equal(getAuthCookieName(), 'pbn_forum_cholink_auth');
    const found = findAuthCookie(store([
      { name: 'auth_token', value: 'legacy' },
      { name: 'pbn_forum_cholink_auth', value: 'forum' },
    ]));
    assert.deepEqual(found, { name: 'pbn_forum_cholink_auth', value: 'forum' });
    delete process.env.AUTH_COOKIE_NAME;
  });

  it('derives from FORUM_ID when AUTH_COOKIE_NAME unset', () => {
    delete process.env.AUTH_COOKIE_NAME;
    process.env.FORUM_ID = 'forum_cholink';
    assert.equal(getAuthCookieName(), 'pbn_forum_cholink_auth');
    delete process.env.FORUM_ID;
  });

  it('discovers pbn_*_auth when preferred name is missing', () => {
    delete process.env.AUTH_COOKIE_NAME;
    delete process.env.FORUM_ID;
    assert.equal(getAuthCookieName(), 'auth_token');
    const found = findAuthCookie(store([
      { name: 'pbn-locale', value: 'vi-VN' },
      { name: 'pbn_forum_cholink_auth', value: 'session' },
    ]));
    assert.deepEqual(found, { name: 'pbn_forum_cholink_auth', value: 'session' });
  });

  it('returns null when no auth cookie exists', () => {
    delete process.env.AUTH_COOKIE_NAME;
    delete process.env.FORUM_ID;
    assert.equal(findAuthCookie(store([{ name: 'pbn-locale', value: 'en-US' }])), null);
  });
});
