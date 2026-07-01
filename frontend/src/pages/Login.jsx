import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageCircle,
  Mail,
  Globe,
  Lock,
  ArrowRight,
  MapPin,
  Smartphone,
  ShoppingCart,
  BarChart3,
  Package,
} from 'lucide-react';
import { LoadingButton } from '../components/LoadingSpinner';
import { usePageTitle, DEFAULT_FAVICON } from '../hooks/usePageTitle';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { InputWithIcon } from '@/components/ui/input-with-icon';
import { cn } from '@/lib/utils';

const TAB_PASSWORD = 'password';
const TAB_2FA = '2fa';
const BRAND_NAME = 'Tech Wiser Consulting';

const FEATURES = [
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Track products in real-time',
  },
  {
    icon: ShoppingCart,
    title: 'Sales & Billing',
    description: 'Fast checkout and invoicing',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Insights for smarter decisions',
  },
];

const LoginHelpSection = ({ variant = 'light', compact = false, className = '' }) => {
  const isDark = variant === 'dark';

  return (
    <div className={className}>
      <p
        className={cn(
          'font-semibold',
          compact ? 'text-xs mb-2' : 'text-sm mb-4',
          isDark ? 'text-white' : 'text-gray-700'
        )}
      >
        Need help?
      </p>
      <div className={cn('flex flex-col items-start', compact ? 'gap-1.5' : 'gap-2.5')}>
        <a
          href="mailto:wiserconsulting.info@gmail.com"
          className={cn(
            'flex items-center gap-2 transition-colors',
            compact ? 'text-xs' : 'text-sm',
            isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-primary-700'
          )}
        >
          <Mail className={cn('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <span>wiserconsulting.info@gmail.com</span>
        </a>
        <a
          href="https://wa.me/923130922988"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 transition-colors',
            compact ? 'text-xs' : 'text-sm',
            isDark ? 'text-gray-400 hover:text-[#25D366]' : 'text-gray-600 hover:text-[#25D366]'
          )}
        >
          <MessageCircle className={cn('shrink-0 text-[#25D366]', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          <span>WhatsApp: +92 313 0922988</span>
        </a>
        <a
          href="https://tech.wiserconsulting.info"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 transition-colors',
            compact ? 'text-xs' : 'text-sm',
            isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-primary-700'
          )}
        >
          <Globe className={cn('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <span>tech.wiserconsulting.info</span>
        </a>
        <div
          className={cn(
            'flex items-start gap-2',
            compact ? 'text-xs' : 'text-sm',
            isDark ? 'text-gray-400' : 'text-gray-600'
          )}
        >
          <MapPin className={cn('shrink-0 mt-0.5', compact ? 'w-3.5 h-3.5' : 'w-4 h-4', isDark ? 'text-gray-500' : 'text-gray-400')} />
          <span>UG 390, Deans Trade Center, Cantt Peshawar</span>
        </div>
      </div>
    </div>
  );
};

export const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorChannel, setTwoFactorChannel] = useState('email');
  const [activeTab, setActiveTab] = useState(TAB_PASSWORD);
  const [standalone2faEmail, setStandalone2faEmail] = useState('');
  const [standalone2faPhone, setStandalone2faPhone] = useState('');
  const { login, verifyTwoFactor, requestTwoFactorCode, isAuthenticated } = useAuth();
  const { companyInfo } = useCompanyInfo({ skip: isAuthenticated });
  const companyLogo = companyInfo?.logo || DEFAULT_FAVICON;

  usePageTitle({ title: 'Login', companyName: BRAND_NAME, favicon: companyLogo });

  const { register, handleSubmit, formState: { errors }, getValues } = useForm({
    shouldUnregister: false,
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
        phone,
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

  const tabButtonClass = (isActive) =>
    cn(
      'flex-1 rounded-md py-2.5 text-sm font-semibold transition-colors border',
      isActive
        ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-sm'
        : 'bg-white text-gray-600 border-transparent hover:bg-gray-50 hover:text-gray-900'
    );

  const channelButtonClass = (isActive) =>
    cn(
      'rounded-md py-2 text-sm font-medium transition-colors border',
      isActive
        ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-sm'
        : 'bg-white text-gray-600 border-transparent hover:bg-gray-50'
    );

  return (
    <div className="h-[100dvh] min-h-[100dvh] flex overflow-hidden bg-gray-50">
      {/* Brand panel — solid POS black, no gradients */}
      <aside className="hidden lg:flex lg:w-[42%] xl:w-1/2 h-full min-h-0 overflow-hidden bg-black text-white">
        <div className="flex flex-col justify-between h-full w-full overflow-hidden px-10 py-10 xl:px-14 xl:py-12 2xl:px-16">
          <div className="shrink-0 w-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 flex items-center justify-center rounded-xl bg-white p-2 shrink-0">
                <img
                  src={companyLogo}
                  alt={BRAND_NAME}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_FAVICON;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Wholesale &amp; Retail
                </p>
                <h1 className="text-xl xl:text-2xl font-bold leading-tight">{BRAND_NAME}</h1>
              </div>
            </div>

            <h2 className="text-3xl xl:text-4xl font-bold mb-3">Welcome back</h2>
            <p className="text-sm xl:text-base text-gray-300 leading-relaxed w-full">
              Sign in to manage inventory, sales, purchases, and reports from one place.
            </p>
          </div>

          <ul className="shrink-0 w-full space-y-4 xl:space-y-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-4 w-full">
                <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm xl:text-base font-semibold text-white leading-tight">{title}</p>
                  <p className="text-xs xl:text-sm text-gray-400 leading-snug mt-0.5">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="shrink-0 w-full pt-6 border-t border-white/10">
            <LoginHelpSection variant="dark" compact />
          </div>
        </div>
      </aside>

      {/* Login form */}
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="flex-1 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-10 lg:py-4">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="lg:hidden text-center mb-8">
              <div className="mx-auto h-14 w-14 flex items-center justify-center rounded-lg bg-white border border-gray-200 shadow-soft p-2 mb-4">
                <img
                  src={companyLogo}
                  alt={BRAND_NAME}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_FAVICON;
                  }}
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{BRAND_NAME}</h2>
              <p className="text-sm text-gray-500 mt-1">Wholesale &amp; Retail POS</p>
            </div>

            <div className="card p-5 sm:p-6 lg:p-7">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">Sign in</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enter your credentials to access your dashboard
                </p>
              </div>

              <div
                className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 mb-4"
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
                  className={tabButtonClass(activeTab === TAB_PASSWORD)}
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
                  className={tabButtonClass(activeTab === TAB_2FA)}
                >
                  Two-factor code
                </button>
              </div>

              <form className="space-y-4" onSubmit={onFormSubmit}>
                {activeTab === TAB_PASSWORD && (
                  <>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email address
                      </label>
                      <InputWithIcon
                        {...register('email', {
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address',
                          },
                        })}
                        icon={Mail}
                        iconPosition="left"
                        type="email"
                        autoComplete="email"
                        id="email"
                        placeholder="Enter your email"
                      />
                      {errors.email && (
                        <p className="mt-1.5 text-sm text-danger-600">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password
                      </label>
                      <InputWithIcon
                        {...register('password', {
                          required: 'Password is required',
                          minLength: {
                            value: 6,
                            message: 'Password must be at least 6 characters',
                          },
                        })}
                        icon={Lock}
                        iconPosition="left"
                        type="password"
                        autoComplete="current-password"
                        id="password"
                        placeholder="Enter your password"
                      />
                      {errors.password && (
                        <p className="mt-1.5 text-sm text-danger-600">{errors.password.message}</p>
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
                            className={channelButtonClass(twoFactorChannel === 'email')}
                          >
                            Email
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTwoFactorChannel('sms');
                              toast.info('Phone authentication coming soon.');
                            }}
                            className={channelButtonClass(twoFactorChannel === 'sms')}
                          >
                            Mobile
                          </button>
                        </div>

                        {twoFactorChannel === 'email' ? (
                          <div>
                            <label htmlFor="standalone2faEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                              Email address
                            </label>
                            <InputWithIcon
                              icon={Mail}
                              iconPosition="left"
                              type="email"
                              autoComplete="email"
                              id="standalone2faEmail"
                              value={standalone2faEmail}
                              onChange={(e) => setStandalone2faEmail(e.target.value)}
                              placeholder="Your registered email"
                            />
                            <p className="mt-1.5 text-xs text-gray-500">
                              Verification code will be sent to this email.
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label htmlFor="standalone2faPhone" className="block text-sm font-medium text-gray-700 mb-1.5">
                              Mobile number
                            </label>
                            <InputWithIcon
                              icon={Smartphone}
                              iconPosition="left"
                              type="tel"
                              autoComplete="tel"
                              id="standalone2faPhone"
                              value={standalone2faPhone}
                              onChange={(e) => setStandalone2faPhone(e.target.value)}
                              placeholder="Your registered mobile number"
                            />
                            <p className="mt-1.5 text-xs text-gray-500">
                              Verification code will be sent to this mobile number.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>
                        <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Verification code
                        </label>
                        <InputWithIcon
                          icon={Lock}
                          iconPosition="left"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          id="twoFactorCode"
                          autoComplete="one-time-code"
                          className="tracking-[0.25em]"
                          placeholder="Enter 6-digit code"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setTwoFactorToken('');
                            setTwoFactorCode('');
                          }}
                          className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Use a different email
                        </button>
                      </div>
                    )}
                  </>
                )}

                <LoadingButton
                  type="submit"
                  isLoading={isLoading}
                  size="lg"
                  disabled={
                    (activeTab === TAB_2FA &&
                      !twoFactorToken &&
                      ((twoFactorChannel === 'email' && !emailLooksValid(standalone2faEmail)) ||
                        (twoFactorChannel === 'sms' && !phoneLooksValid(standalone2faPhone)))) ||
                    (activeTab === TAB_2FA && twoFactorToken && twoFactorCode.length !== 6)
                  }
                  loadingText={
                    activeTab === TAB_2FA
                      ? twoFactorToken
                        ? 'Verifying...'
                        : 'Sending code...'
                      : 'Signing in...'
                  }
                  className="w-full h-11 bg-black text-white hover:bg-gray-800 focus-visible:ring-gray-900"
                >
                  {!isLoading && (
                    <>
                      {activeTab === TAB_2FA
                        ? twoFactorToken
                          ? 'Verify code'
                          : 'Send verification code'
                        : 'Sign in'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </LoadingButton>

                {twoFactorToken && activeTab === TAB_2FA && (
                  <button
                    type="button"
                    onClick={resetTwoFactor}
                    className="w-full text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Back to email &amp; password
                  </button>
                )}
              </form>

              <LoginHelpSection className="mt-8 pt-6 border-t border-gray-200 lg:hidden" />
            </div>

            <p className="mt-4 text-center text-xs text-gray-500 lg:mt-3">
              &copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
