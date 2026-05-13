// Cloudflare Pages Function — GitHub OAuth proxy for Decap CMS
// Requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars set in Cloudflare Pages.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Cloudflare-Pages-CMS-Auth'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const data = await res.json();

    if (data.error) {
      const errMsg = JSON.stringify('authorization:github:error:' + (data.error_description || data.error));
      return callbackPage(`window.opener.postMessage(${errMsg}, '*'); window.close();`);
    }

    const payload = JSON.stringify({ token: data.access_token, provider: 'github' });
    const successMsg = JSON.stringify('authorization:github:success:' + payload);

    // netlify-auth-providers handshake protocol:
    // 1. popup sends "authorizing:github" to opener
    // 2. opener echoes "authorizing:github" back
    // 3. popup sends "authorization:github:success:..." using the echo's origin
    // Fallback: send success directly after 1s if no echo arrives.
    return callbackPage(`
      var successMsg = ${successMsg};
      var done = false;

      function send(origin) {
        if (done) return;
        done = true;
        window.opener.postMessage(successMsg, origin || '*');
        setTimeout(function() { window.close(); }, 300);
      }

      window.addEventListener('message', function(e) {
        if (typeof e.data === 'string' && e.data.indexOf('authorizing:github') === 0) {
          send(e.origin);
        }
      });

      if (window.opener) {
        window.opener.postMessage('authorizing:github', '*');
      }

      // Fallback if opener never echoes
      setTimeout(function() { if (!done && window.opener) send('*'); }, 1000);
    `);
  }

  // Initial request — return a page that sends the handshake THEN redirects to GitHub.
  // (Avoids losing the opener reference through a bare 302.)
  const redirectUri = `${url.origin}/api/auth`;
  const scope = url.searchParams.get('scope') || 'repo,user';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  const safeAuthUrl = JSON.stringify(authUrl);

  return callbackPage(`window.location.href = ${safeAuthUrl};`);
}

function callbackPage(script) {
  return new Response(`<!DOCTYPE html><html><body><script>${script}<\/script></body></html>`, {
    headers: { 'Content-Type': 'text/html' }
  });
}
