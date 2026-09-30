"use client";
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import {
  loginStart,
  loginSuccess,
  loginFailure,
  clearError,
} from "@/store/slices/authSlice";
import authService from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { validateEmail, validatePassword } from "../../utils/validation";
type RootState = any;

const Login: React.FC = () => {
  const dispatch = useDispatch();
  const { refreshUser } = useAuth();

  const searchParams = useSearchParams();
  // Mobile entry points can arrive with the legacy `/onboarding` redirect.
  // Keep genuine deep links intact, but route that legacy destination to the
  // mobile-ready advanced search experience.
  // Same-site paths only: `?redirect_url=https://evil` (or `//evil`, `/\\evil`)
  // must not turn the login page into an open redirect. Control characters
  // are rejected too — browsers strip a tab from '/\t/evil', leaving '//evil'.
  const rawRedirect = searchParams.get('redirect_url') || '';
  const requestedRedirectUrl = /^\/(?![/\\])[^\x00-\x20]*$/.test(rawRedirect) ? rawRedirect : '/onboarding/advanced-search-ai';
  const isLegacyOnboardingRedirect = requestedRedirectUrl === '/onboarding' || requestedRedirectUrl.startsWith('/onboarding?');
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const auth = useSelector((state: RootState) => state.auth);
  const { loading, error } = auth || { loading: false, error: null };

  useEffect(() => {
    // "Remember me" keeps the email only. Older builds also stored the password
    // in plain text under `savedPassword` - purge it so it can't be read by any
    // script on this origin. Saving the password is left to the browser's own
    // password manager (see the autocomplete attributes on the inputs).
    try {
      localStorage.removeItem('savedPassword');
      const savedEmail = localStorage.getItem('savedEmail');
      if (savedEmail) {
        setFormData((prev) => ({ ...prev, email: savedEmail }));
        setRememberMe(true);
      }
    } catch { /* storage unavailable (private mode / blocked) - nothing to restore */ }
  }, []);

  useEffect(() => {
    if (error) {
      setFormErrors((prev) => ({ ...prev, submit: error }));
    }
    return () => {
      if (error) dispatch(clearError());
    };
  }, [error, dispatch]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const emailError = validateEmail(formData.email);
    if (emailError) errors.email = emailError;
    const passwordError = validatePassword(formData.password);
    if (passwordError) errors.password = passwordError;
    return errors;
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "", submit: "" }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) return setFormErrors(errors);
    dispatch(loginStart());
    try {
      // The login response already carries the user (id/name/role/tenant/
      // capabilities) - navigate on it immediately instead of blocking on a
      // second /api/auth/me round trip that re-fetches the same data.
      const loginResp = await authService.login(formData);
      try {
        if (rememberMe) localStorage.setItem('savedEmail', formData.email);
        else localStorage.removeItem('savedEmail');
      } catch { /* storage unavailable - remembering the email is best-effort */ }
      const user = (loginResp?.user || {}) as any;
      dispatch(loginSuccess(user));
      // AuthContext otherwise stays null until a full page refresh, leaving the
      // sidebar empty (nav items + display name) on the first post-login render.
      refreshUser(user);
      // Honour redirect_url param (e.g. /tenant/onboard/new for super-admin)
      // Fall back to default dashboard for all other users
      const destination = window.matchMedia('(max-width: 768px)').matches && isLegacyOnboardingRedirect
        ? '/onboarding/advanced-search-ai'
        : requestedRedirectUrl;
      // A full navigation, not router.push. Every app page is behind the auth
      // proxy, so anything the router fetched or cached while signed out (a
      // prefetch, the RSC payload) is the proxy's redirect to /login. Reusing
      // it after sign-in left users on the login screen until they refreshed.
      // replace() also keeps Back from returning to the login form.
      // No /me backfill here: the page is unloading, and AuthContext fetches
      // the full /me payload (tenants, feature flags) on the next page's mount.
      window.location.replace(destination);
    } catch (err: any) {
      console.error('[Login] Login failed:', err);
      dispatch(loginFailure(err.message));
    }
  };

  return (
      <div className="w-full max-w-[400px] sm:max-w-[420px] p-6 sm:p-7 rounded-2xl shadow-2xl border backdrop-blur-xl bg-gradient-to-b from-white to-gray-50 dark:from-[#071131] dark:to-[#071131] border-gray-200 dark:border-gray-700 mx-auto">
        {/* Logo - driven by the app theme (.dark class), not OS prefers-color-scheme */}
        <img
          src="/MrLAD-logo.svg"
          className="w-20 sm:w-24 mx-auto mb-2 opacity-100 drop-shadow-md block dark:hidden"
          alt="logo"
        />
        <img
          src="/MrLAD-logo-white.svg"
          className="w-20 sm:w-24 mx-auto mb-2 opacity-100 drop-shadow-md hidden dark:block"
          alt=""
          aria-hidden="true"
        />
        {/* Title */}
        <h2 className="text-center text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1">
          👋 Welcome Back!
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-200 mb-4 sm:mb-6 text-xs sm:text-sm">
          We&apos;re happy to see you again. Please sign in.
        </p>
        {formErrors.submit && (
          <div className="mb-3 rounded-md border border-red-300 dark:border-red-600 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-3 py-2">
            ❗ {formErrors.submit}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Email Input */}
          <div>
            <label className="text-gray-900 dark:text-white text-sm font-semibold">Email</label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={20} />
              <input
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                className="
                  w-full rounded-xl pl-10 pr-3 py-2.5 sm:py-3
                  bg-white/80 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-600
                  text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                  transition shadow-sm

                    /* ── FIXES FOR DARK MODE AUTOFILL ── */
                    dark:autofill:bg-[#0e1a3a]
                    dark:autofill:text-white
                    dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_#0e1a3a_inset]
                    dark:[&:-webkit-autofill]:[text-fill-color:white]
                    dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white]
                  "
              />
            </div>
            {formErrors.email && (
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">⚠️ {formErrors.email}</p>
            )}
          </div>
          {/* Password Input */}
          <div>
            <label className="text-gray-900 dark:text-white text-sm font-semibold">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" size={20} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                placeholder="•••••••••"
                className="
                  w-full rounded-xl pl-10 pr-10 py-2.5 sm:py-3
                  bg-white/80 dark:bg-gray-800/40 border border-gray-300 dark:border-gray-600
                  text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
                  transition shadow-sm
                  /* ── FIXES FOR DARK MODE AUTOFILL ── */
                    dark:autofill:bg-[#0e1a3a]
                    dark:autofill:text-white
                    dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_#0e1a3a_inset]
                    dark:[&:-webkit-autofill]:[text-fill-color:white]
                    dark:[&:-webkit-autofill]:[-webkit-text-fill-color:white]
                  "
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 max-lg:right-0 max-lg:flex max-lg:h-11 max-lg:w-11 max-lg:items-center max-lg:justify-center"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formErrors.password && (
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                🔐 {formErrors.password}
              </p>
            )}
          </div>
          {/* Remember Me Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="
                h-4 w-4 rounded-md
                border-gray-300 dark:border-gray-600
                bg-white/80 dark:bg-gray-800/40
                data-[state=checked]:bg-blue-600 dark:data-[state=checked]:bg-blue-500
                data-[state=checked]:border-blue-600 dark:data-[state=checked]:border-blue-500
                data-[state=checked]:text-white
                focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400
                hover:border-blue-500 dark:hover:border-blue-400
                transition-colors cursor-pointer
              "
            />
            <label
              htmlFor="rememberMe"
              className="text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer select-none max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center max-lg:pr-2"
            >
              Remember
            </label>
          </div>
          {/* Login Button */}
          <Button
            type="submit"
            className="
              w-full p-2.5 sm:p-3 max-lg:min-h-11 rounded-lg text-sm sm:text-base font-semibold
              bg-primary dark:bg-blue-600 dark:hover:bg-blue-500 text-[#ffffff]
              hover:shadow-lg hover:shadow-primary/50 transition-all duration-300
              transform hover:scale-105 active:scale-95
              uppercase tracking-wide border border-white/20 cursor-pointer
            "
          >
            {loading ? "⏳ Signing in..." : "Sign In"}
          </Button>
        </form>
        {/* Footer */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-5">
          New to Mr LAD?{' '}
          <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:underline font-medium max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">
            Create an account
          </Link>
        </p>
      </div>
    
  );
};
export default Login;
