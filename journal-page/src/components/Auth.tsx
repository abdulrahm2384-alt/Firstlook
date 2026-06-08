import React, { useState } from 'react';

interface AuthProps {
  onLogin: (email: string, pass: string) => void;
  onSignUp: (email: string, pass: string) => void;
}

export default function Auth({ onLogin, onSignUp }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (isLogin) {
        await onLogin(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full max-w-[320px] text-center space-y-10 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="border border-black p-2 text-[10px] uppercase text-red-600 bg-red-50">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="email" className="text-[10px] block uppercase opacity-60 tracking-widest text-left">email address</label>
            <input
              id="email"
              type="email"
              required
              placeholder="USER@EXAMPLE.COM"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black px-2 py-1 text-sm focus:outline-none placeholder:opacity-20 uppercase"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-[10px] block uppercase opacity-60 tracking-widest text-left">password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-black px-2 py-1 text-sm focus:outline-none placeholder:opacity-20"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] uppercase opacity-40 hover:opacity-100 transition-opacity"
              >
                {showPassword ? "hide" : "show"}
              </button>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full border border-black bg-[#efefef] px-4 py-1.5 text-xs uppercase tracking-widest hover:bg-[#e5e5e5] transition-colors disabled:opacity-50 font-bold"
            >
              {isLoading ? 'processing...' : (isLogin ? 'login' : 'signup')}
            </button>
          </div>
        </form>
        
        <div className="pt-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setIsLogin(!isLogin)}
            className="text-[10px] underline opacity-50 hover:opacity-100 transition-opacity disabled:opacity-30 uppercase tracking-widest"
          >
            {isLogin ? "create account" : "back to login"}
          </button>
        </div>
      </div>
    </div>
  );
}
