function getSessionCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/firstlook_session_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setSessionCookie(token: string) {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const domain = host.includes('.') ? `.${host.split('.').slice(-2).join('.')}` : '';
  document.cookie = `firstlook_session_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax; Secure` + (domain ? `; domain=${domain}` : '');
}

function removeSessionCookie() {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const domain = host.includes('.') ? `.${host.split('.').slice(-2).join('.')}` : '';
  document.cookie = `firstlook_session_token=; path=/; max-age=0; SameSite=Lax; Secure` + (domain ? `; domain=${domain}` : '');
}

const listeners = new Set<(event: string, session: any) => void>();

export const isSupabasePlaceholder = false;

// Custom Express Auth adapter for journal subdomain authentication
export const supabase = {
  auth: {
    async getSession() {
      let token = localStorage.getItem('firstlook_session_token') || getSessionCookie();
      const userStr = localStorage.getItem('firstlook_session_user');
      
      if (!token) {
        return { data: { session: null }, error: null };
      }

      if (token && !localStorage.getItem('firstlook_session_token')) {
        localStorage.setItem('firstlook_session_token', token);
      }

      try {
        const response = await fetch('/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const res = await response.json();
          if (res?.data?.session) {
            localStorage.setItem('firstlook_session_user', JSON.stringify(res.data.session.user));
            setSessionCookie(token);
            return { data: { session: res.data.session }, error: null };
          }
        }
      } catch (err) {
        console.warn('[Session] Failed to connect to backend, using cached session', err);
      }

      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          return { data: { session: { access_token: token, user } }, error: null };
        } catch {
          return { data: { session: null }, error: null };
        }
      }
      return { data: { session: null }, error: null };
    },

    async getUser() {
      const { data, error } = await this.getSession();
      return { data: { user: data?.session?.user || null }, error };
    },

    async signUp({ email, password }: any) {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const res = await response.json();
        if (!response.ok || res.error) {
          throw new Error(res.error?.message || 'Failed to sign up');
        }

        const session = res.data.session;
        localStorage.setItem('firstlook_session_token', session.access_token);
        localStorage.setItem('firstlook_session_user', JSON.stringify(session.user));
        setSessionCookie(session.access_token);

        listeners.forEach(cb => cb('SIGNED_IN', session));
        return { data: { user: session?.user || null, session }, error: null };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    async signInWithPassword({ email, password }: any) {
      try {
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const res = await response.json();
        if (!response.ok || res.error) {
          throw new Error(res.error?.message || 'Invalid email or password');
        }

        const session = res.data.session;
        localStorage.setItem('firstlook_session_token', session.access_token);
        localStorage.setItem('firstlook_session_user', JSON.stringify(session.user));
        setSessionCookie(session.access_token);

        listeners.forEach(cb => cb('SIGNED_IN', session));
        return { data: { user: session?.user || null, session }, error: null };
      } catch (err: any) {
        return { data: { user: null, session: null }, error: err };
      }
    },

    async signOut() {
      try {
        await fetch('/api/auth/signout', { method: 'POST' });
      } catch (err) {
        console.warn('[Session] Signout request failed', err);
      }
      localStorage.removeItem('firstlook_session_token');
      localStorage.removeItem('firstlook_session_user');
      removeSessionCookie();
      listeners.forEach(cb => cb('SIGNED_OUT', null));
      return { error: null };
    },

    async resend({ type, email, options }: any) {
      // Stub for resending confirmation
      console.log('Resending confirmation', { type, email, options });
      return { data: {}, error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      listeners.add(callback);
      this.getSession().then(({ data }) => {
        if (data?.session) {
          callback('SIGNED_IN', data.session);
        } else {
          callback('SIGNED_OUT', null);
        }
      });

      return {
        data: {
          subscription: {
            unsubscribe() {
              listeners.delete(callback);
            }
          }
        }
      };
    }
  }
};
