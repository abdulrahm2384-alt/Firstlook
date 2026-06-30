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

// Adaptive client-side Auth connector
export const supabase = {
  auth: {
    async getSession() {
      let token = localStorage.getItem('firstlook_session_token') || getSessionCookie();
      const userStr = localStorage.getItem('firstlook_session_user');
      
      if (!token) {
        return { data: { session: null }, error: null };
      }

      // Keep localStorage in sync if cookie was present but localStorage was not
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

      // Offline / Connection error fallback
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

    async signUp({ email, password, username, fullName, country, bio, experienceLevel, avatarUrl }: any) {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, username, fullName, country, bio, experienceLevel, avatarUrl })
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

     async updateProfile(details: { username?: string; full_name?: string; country?: string; bio?: string; experience_level?: string; avatar_url?: string; onboarding_dismissed?: boolean; auto_reload?: boolean; autoReload?: boolean }) {
      try {
        const token = localStorage.getItem('firstlook_session_token') || getSessionCookie();
        if (!token) throw new Error('No active session token');

        const response = await fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(details)
        });

        const res = await response.json();
        if (!response.ok || res.error) {
          throw new Error(res.error?.message || 'Failed to update profile');
        }

        // Keep local storage user updated
        const activeUser = res.user;
        localStorage.setItem('firstlook_session_user', JSON.stringify(activeUser));

        // Trigger change to listeners
        const updatedSession = { access_token: token, user: activeUser };
        listeners.forEach(cb => cb('SIGNED_IN', updatedSession));

        return { data: { user: activeUser }, error: null };
      } catch (err: any) {
        return { data: { user: null }, error: err };
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

    async verifyOtp({ email, otp }: { email: string; otp: string }) {
      try {
        const response = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });
        const res = await response.json();
        if (!response.ok || res.error) {
          throw new Error(res.error?.message || 'Verification of security code failed.');
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

    onAuthStateChange(callback: (event: string, session: any) => void) {
      listeners.add(callback);
      // Trigger initial state
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
