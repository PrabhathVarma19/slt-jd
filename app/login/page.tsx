'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorBar } from '@/components/ui/error-bar';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get redirect URL from query params
  const redirectTo = searchParams.get('redirect') || '/';

  // Check if already logged in
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated || data.authenticated) {
          // Already logged in, redirect to home or intended page
          router.push(redirectTo);
        }
      })
      .catch(() => {
        // Not logged in, stay on login page
      });
  }, [router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      // Add smooth transition
      await new Promise((resolve) => setTimeout(resolve, 150));
      
      // Dispatch custom event with user data to notify UserMenu component
      if (typeof window !== 'undefined') {
        const loginEvent = new CustomEvent('beacon:login-success', {
          detail: {
            user: data.user,
          },
        });
        window.dispatchEvent(loginEvent);
        
        // Also store in localStorage immediately
        try {
          window.localStorage.setItem('beacon:user', JSON.stringify(data.user));
        } catch (error) {
          console.warn('Failed to cache user:', error);
        }
      }
      
      // Redirect to intended page or home
      router.push(redirectTo);
      router.refresh(); // Refresh to update any server components that check auth
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSO = () => {
    // Placeholder - will be enabled when Azure AD SSO is implemented
    setError('SSO login coming soon. Please use email and password for now.');
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Welcome to Beacon</h1>
          <p className="text-sm text-slate-600">
            Sign in to access your internal AI desk for answers and requests
          </p>
        </div>

        {/* Login Card */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Enter your email and password to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <ErrorBar message={error} />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@trianz.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={isLoading || !email || !password}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            {/* SSO Button (Placeholder) */}
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-full"
              onClick={handleSSO}
              disabled={true}
            >
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 23 23"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11.5 0C5.15 0 0 5.15 0 11.5S5.15 23 11.5 23 23 17.85 23 11.5 17.85 0 11.5 0Z"
                  fill="#F25022"
                />
                <path
                  d="M11.5 0C5.15 0 0 5.15 0 11.5S5.15 23 11.5 23 23 17.85 23 11.5 17.85 0 11.5 0Z"
                  fill="#7FBA00"
                />
                <path
                  d="M11.5 0C5.15 0 0 5.15 0 11.5S5.15 23 11.5 23 23 17.85 23 11.5 17.85 0 11.5 0Z"
                  fill="#00A4EF"
                />
                <path
                  d="M11.5 0C5.15 0 0 5.15 0 11.5S5.15 23 11.5 23 23 17.85 23 11.5 17.85 0 11.5 0Z"
                  fill="#FFB900"
                />
                <path
                  d="M11.5 4.6V18.4C8.28 18.4 5.75 15.87 5.75 12.65C5.75 9.43 8.28 6.9 11.5 6.9C14.72 6.9 17.25 9.43 17.25 12.65C17.25 15.87 14.72 18.4 11.5 18.4Z"
                  fill="white"
                />
              </svg>
              Sign in with Microsoft
              <span className="ml-2 text-xs text-gray-400">(Coming soon)</span>
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          Built for Trianz. Forgot your password?{' '}
          <Link href="/" className="text-blue-600 hover:underline">
            Contact IT Support
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
