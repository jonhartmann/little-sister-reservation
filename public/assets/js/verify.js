/* Little Sister — Magic link verification */
'use strict';

(async function () {
  const token = new URLSearchParams(window.location.search).get('token');
  const content = document.getElementById('verify-content');

  if (!token) {
    content.innerHTML = `
      <div class="verify-icon">&#x274C;</div>
      <h3>Invalid Link</h3>
      <p>This sign-in link is missing a token. Please request a new one.</p>
      <p><a href="/" class="button primary small">Back to Home</a></p>`;
    return;
  }

  try {
    const { user } = await API.post('/api/auth/verify', { token });
    content.innerHTML = `
      <div class="verify-icon">&#x2705;</div>
      <h3>Signed in!</h3>
      <p>Redirecting you now&hellip;</p>`;
    setTimeout(() => {
      window.location.href = user.isAdmin ? '/admin.html' : '/dashboard.html';
    }, 800);
  } catch (err) {
    const messages = {
      'Token has already been used': 'This sign-in link has already been used. Please request a new one.',
      'Token has expired':           'This sign-in link has expired (links are valid for 15 minutes). Please request a new one.',
      'Invalid or expired token':    'This sign-in link is invalid. Please request a new one.',
    };
    const msg = messages[err.message] || err.message;
    content.innerHTML = `
      <div class="verify-icon">&#x274C;</div>
      <h3>Sign-In Failed</h3>
      <p>${msg}</p>
      <p><a href="/" class="button primary small">Back to Home</a></p>`;
  }
})();
