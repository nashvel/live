/** Local by default: stale QA links must never redirect a local test to production. */
export function testOrigin(value = process.env.MEET_TEST_ORIGIN || 'http://localhost:3000', allowRemote = process.env.MEET_TEST_ALLOW_REMOTE === '1') {
  const target = new URL(value);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Use a plain HTTP(S) origin for MEET_TEST_ORIGIN.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && !allowRemote) {
    throw new Error('Remote browser tests require explicit MEET_TEST_ALLOW_REMOTE=1.');
  }
  return target.origin;
}

export function assertLocalTestLink(link, origin = testOrigin()) {
  const url = new URL(link);
  if (url.origin !== origin || !/^\/m\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new Error('The saved meeting link does not match this test target. Run browser.mjs first.');
  }
}
