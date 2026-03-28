import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: 'admin@pulsoai.cl', password: 'admin123' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Demo Login Mode
      if (form.email === 'admin@pulsoai.cl' && form.password === 'admin123') {
        const user = { id: '1', name: 'Raúl Díaz', email: 'admin@pulsoai.cl', role: 'ADMIN', tenantId: 'pulso-ai' };
        login('demo-jwt-token', 'demo-refresh-token', user);
        toast.success(`Bienvenido, ${user.name}`);
        navigate('/dashboard');
        return;
      }

      const response = await apiClient.post('/auth/login', form);
      const { accessToken, refreshToken, user } = response.data;
      login(accessToken, refreshToken, user);
      navigate('/dashboard');
      toast.success(`Bienvenido, ${user.name}`);
    } catch (err: any) {
      toast.error('Credenciales incorrectas (Usa admin@pulsoai.cl / admin123)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-purple-950/80 to-slate-950 p-4 relative overflow-hidden">
      {/* Decorative blurred circles for modern AI look */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2rem] shadow-[0_0_50px_-12px_rgba(147,51,234,0.3)] border border-white/10 p-8 sm:p-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-48 h-auto mb-6 relative">
              <div className="absolute inset-0 bg-purple-500/10 blur-2xl rounded-full"></div>
              <img 
                src="/pulso-ai-logo.jpeg" 
                alt="Pulso AI" 
                className="w-full h-auto object-contain relative z-10 mix-blend-screen brightness-110 contrast-125" 
              />
            </div>
            <div className="p-3 bg-purple-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">LicitApp Chile</h1>
            <p className="text-sm text-slate-400 mt-1">Sistema Unificado de Licitaciones</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm placeholder:text-slate-600 transition-all"
                placeholder="tu@empresa.cl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm placeholder:text-slate-600 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
