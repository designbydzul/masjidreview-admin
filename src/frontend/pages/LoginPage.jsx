import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { requestOTP, verifyOTP, googleSignIn } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

const GOOGLE_CLIENT_ID = '682648630709-juloro49ulu1h0dh5od5ksf8koitl0bv.apps.googleusercontent.com';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('wa'); // 'wa' | 'otp'
  const [waNumber, setWaNumber] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const gisInitialized = useRef(false);
  const googleBtnRef = useRef(null);

  // Initialize Google Identity Services + render button
  useEffect(() => {
    if (gisInitialized.current) return;
    const initGis = () => {
      if (typeof google === 'undefined' || !google.accounts) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        auto_select: false,
      });
      gisInitialized.current = true;
      if (googleBtnRef.current) {
        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: googleBtnRef.current.offsetWidth, text: 'continue_with', locale: 'id',
        });
      }
    };
    if (typeof google !== 'undefined' && google.accounts) {
      initGis();
    } else {
      const interval = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          initGis();
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleGoogleCallback = async (response) => {
    setError('');
    try {
      const data = await googleSignIn(response.credential);
      login(data.admin);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestOTP(waNumber);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyOTP(waNumber, code);
      login(data.admin);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const backToWaStep = () => {
    setStep('wa');
    setCode('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-[400px]">
        <CardContent className="p-8">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>

          {step === 'wa' ? (
            <>
              <form onSubmit={handleRequestOTP}>
                <Label className="text-sm mb-1.5">Nomor WhatsApp</Label>
                <Input
                  type="tel"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="h-10"
                  required
                />
                {error && <p className="text-red text-xs mt-2">{error}</p>}
                <Button type="submit" disabled={loading} className="w-full mt-4 h-10 font-semibold">
                  {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
                </Button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-2">atau</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Google Sign-in Button (rendered by GIS) */}
              <div ref={googleBtnRef} className="w-full" />
            </>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <p className="text-sm text-text-2 mb-4">
                Kode OTP telah dikirim ke <strong>{waNumber}</strong>
              </p>
              <Label className="text-sm mb-1.5">Kode OTP</Label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="h-10 text-center tracking-[0.3em] font-heading text-lg"
                required
              />
              {error && <p className="text-red text-xs mt-2">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full mt-4 h-10 font-semibold">
                {loading ? 'Memverifikasi...' : 'Verifikasi'}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={backToWaStep}
                className="w-full mt-2"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Ubah nomor WhatsApp
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
