import { Link, Outlet } from "react-router-dom";
import { InkoLogo } from '../inko';

export const AuthLayout = () => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50/40 text-zinc-900 font-sans">
      {/* Minimized Header */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-zinc-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <Link
          to="/"
          className="flex items-center gap-0.5 font-black text-xl hover:text-primary transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg">
            <InkoLogo color="purple" size={24} />
          </div>
          <span className="py-1 rounded-md">Inko</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/contact"
            className="text-xs font-medium px-4 py-2 border border-zinc-200 rounded-full text-zinc-600 hover:bg-zinc-50 transition-all flex items-center gap-1.5"
          >
            <span>Need help?</span>
          </Link>
        </div>
      </header>

      {/* Main Form Context Body */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Outlet />
      </main>

      {/* Minimized Footer */}
      <footer className="w-full bg-white border-t border-zinc-100 py-8 px-4 flex flex-col items-center justify-center gap-2 text-center text-xs text-zinc-400">
        <div className="flex items-center gap-3 font-medium text-zinc-500 mb-1">
          <Link to="/privacy" className="hover:text-violet-600 transition-colors">
            Privacy
          </Link>
          <span className="text-zinc-200 select-none">•</span>
          <Link to="/terms" className="hover:text-violet-600 transition-colors">
            Terms
          </Link>
          <span className="text-zinc-200 select-none">•</span>
          <Link to="/acceptable-use" className="hover:text-violet-600 transition-colors">
            Acceptable Use
          </Link>
        </div>
        <p>&copy; {new Date().getFullYear()} Inko. All rights reserved.</p>
      </footer>
    </div>
  );
};