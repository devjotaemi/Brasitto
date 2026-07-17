import { Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isSupabaseMissingProductionConfig } from '../infrastructure/supabase/supabaseClient';
import { AdminApp } from './admin/AdminApp';
import { CustomerApp } from './customer/CustomerApp';

type AppView = 'customer' | 'admin';

const getViewFromPath = (): AppView =>
  window.location.pathname.startsWith('/admin') ? 'admin' : 'customer';

export function App() {
  const [view, setView] = useState<AppView>(getViewFromPath);

  useEffect(() => {
    function syncViewWithPath() {
      setView(getViewFromPath());
    }

    window.addEventListener('popstate', syncViewWithPath);

    return () => {
      window.removeEventListener('popstate', syncViewWithPath);
    };
  }, []);

  function navigateTo(nextView: AppView) {
    const path = nextView === 'admin' ? '/admin' : '/';

    window.history.pushState(null, '', path);
    setView(nextView);
  }

  if (isSupabaseMissingProductionConfig) {
    return (
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-3xl border border-line bg-surface p-6 text-espresso-body shadow-soft">
            <h1 className="font-display text-xl font-semibold text-espresso-ink">
              Configuracao de producao incompleta
            </h1>
            <p className="mt-2 text-sm leading-6">
              Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de
              publicar o aplicativo.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (view === 'admin') {
    return (
      <>
        <nav className="border-b border-zinc-200 bg-zinc-950">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm font-semibold text-white">Brasitto</span>
            <div className="flex items-center gap-2">
              <button
                className="flex h-9 items-center gap-2 rounded px-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
                type="button"
                onClick={() => navigateTo('customer')}
              >
                <Store className="h-4 w-4" />
                Cliente
              </button>
            </div>
          </div>
        </nav>

        <AdminApp />
      </>
    );
  }

  return <CustomerApp />;
}
