import React, { useState, useEffect, useRef } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirebaseAuth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Phone,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Edit2,
  Lock,
} from 'lucide-react';

export default function PhoneVerificationModal({ isOpen, onClose, onSuccess, initialPhone = '' }) {
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState('INPUT'); // 'INPUT' | 'OTP' | 'SUCCESS'
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Verification mode: 'firebase' or 'backend'
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);

  const otpInputRef = useRef(null);

  // Initialize phone number from props or user
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMessage('');
      setOtp('');
      const defaultVal = initialPhone || user?.phone || user?.phoneNumber || '';
      // Strip +91 if present
      const clean = defaultVal.replace(/^(\+91|91)/, '').replace(/\D/g, '').slice(0, 10);
      setPhoneNumber(clean);
      setStep('INPUT');
    }
  }, [isOpen, initialPhone, user]);

  // Resend cooldown timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Focus OTP input when switching to OTP step
  useEffect(() => {
    if (step === 'OTP' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  // Cleanup recaptcha on unmount or close
  useEffect(() => {
    return () => {
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {}
      }
    };
  }, [recaptchaVerifier]);

  if (!isOpen) return null;

  const validatePhone = (num) => {
    return /^[6-9]\d{9}$/.test(num);
  };

  /**
   * Handle sending OTP: Attempts Firebase Phone Auth first,
   * with seamless fallback to backend SMS OTP provider.
   */
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const cleanNumber = phoneNumber.trim().replace(/\D/g, '');
    if (!validatePhone(cleanNumber)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    const fullNumber = `${countryCode}${cleanNumber}`;
    setLoading(true);

    const auth = getFirebaseAuth();
    let sentViaFirebase = false;

    // 1. Try Firebase Phone Authentication if Firebase Web Auth is configured
    if (auth) {
      try {
        let verifier = recaptchaVerifier;
        if (!verifier) {
          verifier = new RecaptchaVerifier(auth, 'recaptcha-verifier-container', {
            size: 'invisible',
            callback: () => {
              console.log('[Firebase Recaptcha] Verified');
            },
            'expired-callback': () => {
              console.warn('[Firebase Recaptcha] Expired');
            },
          });
          setRecaptchaVerifier(verifier);
        }

        const confirmation = await signInWithPhoneNumber(auth, fullNumber, verifier);
        setConfirmationResult(confirmation);
        sentViaFirebase = true;
        console.log('[Phone Verification] OTP dispatched via Firebase Phone Auth');
      } catch (fbErr) {
        console.warn('[Phone Verification] Firebase Phone Auth notice (using backend SMS gateway):', fbErr.message);
        setConfirmationResult(null);
      }
    }

    // 2. Fallback to NearCart Backend SMS OTP
    if (!sentViaFirebase) {
      try {
        const res = await api.post('/auth/phone/send-otp', { phone: fullNumber });
        if (!res.success) {
          setError(res.message || 'Failed to send OTP. Please try again.');
          setLoading(false);
          return;
        }
        console.log('[Phone Verification] OTP dispatched via backend SMS service');
      } catch (apiErr) {
        setError(apiErr.message || 'Failed to send OTP. Please try again.');
        setLoading(false);
        return;
      }
    }

    setResendCooldown(60);
    setStep('OTP');
    setLoading(false);
  };

  /**
   * Handle OTP Verification:
   * Confirms Firebase credential if verified via Firebase,
   * then submits cryptographic token or OTP to NearCart backend.
   */
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const cleanOtp = otp.trim().replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      let updatedUser = null;

      if (confirmationResult) {
        // Firebase Phone Auth confirmation
        const userCredential = await confirmationResult.confirm(cleanOtp);
        const idToken = await userCredential.user.getIdToken();

        const res = await api.post('/auth/phone/verify-firebase', { idToken });
        if (!res.success) {
          throw new Error(res.message || 'Verification failed on server.');
        }
        updatedUser = res.user;
      } else {
        // NearCart Backend OTP verification
        const fullNumber = `${countryCode}${phoneNumber.trim()}`;
        const res = await api.post('/auth/phone/verify-otp', {
          phone: fullNumber,
          otp: cleanOtp,
        });
        if (!res.success) {
          throw new Error(res.message || 'Verification failed.');
        }
        updatedUser = res.user;
      }

      // Success! Refresh user context
      await refreshUser();
      setStep('SUCCESS');
      setSuccessMessage('Phone number verified successfully!');

      setTimeout(() => {
        if (onSuccess) onSuccess(updatedUser);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Phone verification error:', err);
      setError(err.message || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const maskedDisplayNumber = () => {
    const clean = phoneNumber.trim();
    if (clean.length < 10) return `${countryCode} ${clean}`;
    return `${countryCode} ${clean.slice(0, 2)}****${clean.slice(6)}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="recaptcha-verifier-container"></div>

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '1.25rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.6rem',
                backgroundColor: 'rgba(13, 110, 253, 0.15)',
                border: '1px solid rgba(13, 110, 253, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                Phone Verification
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                Mandatory for fast & safe delivery orders
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '0.35rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.65rem',
                padding: '0.75rem 0.9rem',
                marginBottom: '1.2rem',
                color: '#b91c1c',
                fontSize: '0.84rem',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          {step === 'INPUT' && (
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.5rem',
                  }}
                >
                  Enter Mobile Number
                </label>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
                  We will send a 6-digit OTP to verify your mobile number.
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    transition: 'border-color 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div
                    style={{
                      padding: '0.75rem 0.85rem',
                      backgroundColor: '#f8fafc',
                      borderRight: '1px solid #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: '#1e293b',
                    }}
                  >
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="Enter 10-digit number"
                    value={phoneNumber}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setPhoneNumber(digits);
                      if (error) setError('');
                    }}
                    autoFocus
                    required
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      padding: '0.75rem 1rem',
                      fontSize: '1rem',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '0.6rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.75rem',
                  color: '#0369a1',
                }}
              >
                <Lock size={15} style={{ flexShrink: 0 }} />
                <span>Your number is strictly used for order delivery updates and driver contact.</span>
              </div>

              <button
                type="submit"
                disabled={loading || phoneNumber.length !== 10}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background:
                    phoneNumber.length === 10 && !loading
                      ? 'linear-gradient(135deg, #0D6EFD 0%, #0b5ed7 100%)'
                      : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: phoneNumber.length === 10 && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow:
                    phoneNumber.length === 10 && !loading
                      ? '0 4px 12px rgba(13, 110, 253, 0.35)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Enter the 6-digit code sent to
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '9999px',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  <span>{maskedDisplayNumber()}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('INPUT');
                      setError('');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0D6EFD',
                      cursor: 'pointer',
                      padding: '0 0.2rem',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    <Edit2 size={13} style={{ marginRight: '3px' }} />
                    Edit
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(clean);
                    if (error) setError('');
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    textAlign: 'center',
                    letterSpacing: '0.45em',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    border: '2px solid #0D6EFD',
                    borderRadius: '0.75rem',
                    outline: 'none',
                    boxShadow: '0 0 0 3px rgba(13, 110, 253, 0.15)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: '#64748b' }}>Didn't receive the code?</span>
                {resendCooldown > 0 ? (
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0D6EFD',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <RefreshCw size={13} />
                    Resend Code
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background:
                    otp.length === 6 && !loading
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: otp.length === 6 && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow:
                    otp.length === 6 && !loading
                      ? '0 4px 12px rgba(16, 185, 129, 0.35)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Verify & Continue</span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'SUCCESS' && (
            <div
              style={{
                textAlign: 'center',
                padding: '1rem 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  boxShadow: '0 0 0 8px rgba(34, 197, 94, 0.15)',
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                Verified Successfully!
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Your phone number is now linked. You can proceed with placing your delivery order.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
