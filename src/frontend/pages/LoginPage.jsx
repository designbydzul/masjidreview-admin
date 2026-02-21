import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { requestOTP, verifyOTP } from '../api';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('wa'); // 'wa' | 'otp'
  const [waNumber, setWaNumber] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
