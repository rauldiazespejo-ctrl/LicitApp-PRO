import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 transition-opacity duration-1000">
      {/* Background Decorative Glow */}
      <div className="absolute w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse"></div>
      
      <div className={`relative transition-all duration-1000 transform ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}>
        <img 
          src="/pulso-ai-logo.jpeg" 
          alt="Pulso AI" 
          className="w-64 h-auto object-contain mix-blend-screen brightness-125 contrast-125 drop-shadow-[0_0_30px_rgba(168,85,247,0.4)]" 
        />
        <div className="mt-8 flex flex-col items-center">
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 to-indigo-600 animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
          <p className="mt-4 text-purple-400/60 text-xs font-medium tracking-[0.3em] uppercase animate-pulse">
            Cargando Inteligencia
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
