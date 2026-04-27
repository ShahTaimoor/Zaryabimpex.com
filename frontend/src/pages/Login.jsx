import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { Package, MessageCircle, Mail, Globe, Lock, User, ArrowRight, MapPin, Smartphone } from 'lucide-react';
import { LoadingButton } from '../components/LoadingSpinner';

const TAB_PASSWORD = 'password';
const TAB_2FA = '2fa';

export const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorChannel, setTwoFactorChannel] = useState('email');
  const [activeTab, setActiveTab] = useState(TAB_PASSWORD);
  const [standalone2faEmail, setStandalone2faEmail] = useState('');
  const [standalone2faPhone, setStandalone2faPhone] = useState('');
  const { login, verifyTwoFactor, requestTwoFactorCode, isAuthenticated } = useAuth();
  const { register, handleSubmit, formState: { errors }, getValues } = useForm({
    shouldUnregister: false
  });

  const emailLooksValid = (value) =>
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(value || '').trim());
  const phoneLooksValid = (value) => String(value || '').replace(/\D/g, '').length >= 10;

  useEffect(() => {
    if (twoFactorToken) {
      setActiveTab(TAB_2FA);
    }
  }, [twoFactorToken]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const resetTwoFactor = () => {
    setTwoFactorToken('');
    setTwoFactorCode('');
    setTwoFactorChannel('email');
    setStandalone2faEmail('');
    setStandalone2faPhone('');
    setActiveTab(TAB_PASSWORD);
  };

  const onSubmitPasswordTab = async (data) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
    } finally {
      setIsLoading(false);
    }
  };

  const submitTwoFactorTab = async () => {
    if (!twoFactorToken || twoFactorCode.length !== 6) return;
    setIsLoading(true);
    try {
      await verifyTwoFactor(twoFactorToken, twoFactorCode);
    } finally {
      setIsLoading(false);
    }
  };

  const sendTwoFactorToEmail = async () => {
    const email = standalone2faEmail.trim();
    const phone = standalone2faPhone.trim();
    if (twoFactorChannel === 'email' && !emailLooksValid(email)) return;
    if (twoFactorChannel === 'sms' && !phoneLooksValid(phone)) return;
    setIsLoading(true);
    try {
      const result = await requestTwoFactorCode({
        channel: twoFactorChannel,
        email,
        phone
      });
      if (result?.success && result.tempToken) {
        setTwoFactorToken(result.tempToken);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onFormSubmit = (e) => {
    e.preventDefault();
    if (activeTab === TAB_2FA) {
      if (twoFactorToken) {
        void submitTwoFactorTab();
      } else {
        void sendTwoFactorToEmail();
      }
      return;
    }
    handleSubmit(onSubmitPasswordTab)(e);
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex overflow-hidden">
      {/* Left Side - Image Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden min-h-0">
        <img
          src="/images/Purple and Blue Modern Company Meeting Zoom Virtual Background.webp"
          alt="Login Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-white z-10">
          <div className="max-w-md">
            <div className="mb-8">
              <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm mb-6">
                <Package className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-4">Welcome Back</h1>
              <p className="text-xl text-white/90 leading-relaxed">
                Manage your wholesale and retail business with our comprehensive POS system
              </p>
            </div>
            <div className="space-y-4 mt-12">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Inventory Management</p>
                  <p className="text-sm text-white/80">Track products in real-time</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Customer Relations</p>
                  <p className="text-sm text-white/80">Build lasting relationships</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto h-14 w-14 flex items-center justify-center rounded-2xl bg-gray-800 shadow-lg mb-4">
              <Package className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">POS System</h2>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 lg:p-10 border border-gray-100">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Sign in to your account
              </h2>
              <p className="text-gray-600">
                Enter your credentials to access your dashboard
              </p>
            </div>

            <div
              className="flex rounded-xl border border-gray-200 bg-gray-50 p-1 mb-6"
              role="tablist"
              aria-label="Login method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === TAB_PASSWORD}
                onClick={() => {
                  if (twoFactorToken) resetTwoFactor();
                  setActiveTab(TAB_PASSWORD);
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === TAB_PASSWORD
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Email &amp; password
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === TAB_2FA}
                onClick={() => {
                  setActiveTab(TAB_2FA);
                  const fromPasswordTab = getValues('email');
                  if (fromPasswordTab && !standalone2faEmail.trim()) {
                    setStandalone2faEmail(String(fromPasswordTab).trim());
                  }
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  activeTab === TAB_2FA
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Two-factor code
              </button>
            </div>

            <form className="space-y-6" onSubmit={onFormSubmit}>
              {activeTab === TAB_PASSWORD && (
                <>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        {...register('email', {
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address'
                          }
                        })}
                        type="email"
                        autoComplete="email"
                        id="email"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 text-sm placeholder-gray-400"
                        placeholder="Enter your email"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <span className="mr-1">⚠</span> {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        {...register('password', {
                          required: 'Password is required',
                          minLength: {
                            value: 6,
                            message: 'Password must be at least 6 characters'
                          }
                        })}
                        type="password"
                        autoComplete="current-password"
                        id="password"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 text-sm placeholder-gray-400"
                        placeholder="Enter your password"
                      />
                    </div>
                    {errors.password && (
                      <p className="mt-2 text-sm text-red-600 flex items-center">
                        <span className="mr-1">⚠</span> {errors.password.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {activeTab === TAB_2FA && (
                <>
                  {!twoFactorToken ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1">
                        <button
                          type="button"
                          onClick={() => setTwoFactorChannel('email')}
                          className={`rounded-md py-2 text-sm font-medium ${twoFactorChannel === 'email' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                        >
                          Email
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTwoFactorChannel('sms');
                            toast.info('Phone authentication coming soon.');
                          }}
                          className={`rounded-md py-2 text-sm font-medium ${twoFactorChannel === 'sms' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
                        >
                          Mobile
                        </button>
                      </div>

                      {twoFactorChannel === 'email' ? (
                        <div>
                          <label htmlFor="standalone2faEmail" className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                              type="email"
                              autoComplete="email"
                              id="standalone2faEmail"
                              value={standalone2faEmail}
                              onChange={(e) => setStandalone2faEmail(e.target.value)}
                              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 text-sm placeholder-gray-400"
                              placeholder="Your registered email"
                            />
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Verification code will be sent to this email.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label htmlFor="standalone2faPhone" className="block text-sm font-medium text-gray-700 mb-2">
                            Mobile Number
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Smartphone className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                              type="tel"
                              autoComplete="tel"
                              id="standalone2faPhone"
                              value={standalone2faPhone}
                              onChange={(e) => setStandalone2faPhone(e.target.value)}
                              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 text-sm placeholder-gray-400"
                              placeholder="Your registered mobile number"
                            />
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Verification code will be sent to this mobile number.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-2">
                        Verification code
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          id="twoFactorCode"
                          autoComplete="one-time-code"
                          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 transition-all duration-200 text-sm placeholder-gray-400 tracking-[0.25em]"
                          placeholder="Enter 6-digit code"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTwoFactorToken('');
                          setTwoFactorCode('');
                        }}
                        className="mt-3 w-full text-sm text-gray-600 hover:text-gray-900 underline"
                      >
                        Use a different email
                      </button>
                    </div>
                  )}
                </>
              )}

              <div>
                <LoadingButton
                  type="submit"
                  isLoading={isLoading}
                  disabled={
                    (activeTab === TAB_2FA &&
                      !twoFactorToken &&
                      ((twoFactorChannel === 'email' && !emailLooksValid(standalone2faEmail)) ||
                        (twoFactorChannel === 'sms' && !phoneLooksValid(standalone2faPhone)))) ||
                    (activeTab === TAB_2FA && twoFactorToken && twoFactorCode.length !== 6)
                  }
                  className="group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-base font-semibold rounded-lg text-white bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    activeTab === TAB_2FA
                      ? twoFactorToken
                        ? 'Verifying...'
                        : 'Sending code...'
                      : 'Signing in...'
                  ) : (
                    <>
                      {activeTab === TAB_2FA
                        ? twoFactorToken
                          ? 'Verify code'
                          : 'Send verification code'
                        : 'Sign in'}
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </LoadingButton>
              </div>
              {twoFactorToken && activeTab === TAB_2FA && (
                <button
                  type="button"
                  onClick={resetTwoFactor}
                  className="w-full text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Back to email &amp; password
                </button>
              )}
            </form>

            {/* Support Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-center text-sm font-medium text-gray-600 mb-4">
                Need Help?
              </p>
              <div className="flex flex-col items-start gap-2">
                <a
                  href="mailto:wiserconsulting.info@gmail.com"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  <Mail className="w-4 h-4 shrink-0 text-gray-500" />
                  <span>wiserconsulting.info@gmail.com</span>
                </a>
                <a
                  href="https://wa.me/923130922988"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#25D366] transition-colors duration-200"
                >
                  <MessageCircle className="w-4 h-4 shrink-0 text-[#25D366]" />
                  <span>WhatsApp: +92 313 0922988</span>
                </a>
                <a
                  href="https://www.wiserconsulting.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
                >
                  <Globe className="w-4 h-4 shrink-0 text-gray-500" />
                  <span>www.wiserconsulting.info</span>
                </a>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 shrink-0 text-gray-500" />
                  <span>UG 390, Deans Trade Center, Cantt Peshawar</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-500">
            © 2024 POS System. All rights reserved.
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};
