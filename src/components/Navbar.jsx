import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AuthModal from './AuthModal'

export default function Navbar({ user, onAuthChange }) {
  const [showAuth, setShowAuth] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onAuthChange(null)
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-heading font-bold text-white">
              ClipFlow{' '}
              <span className="text-cyan">⚡</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user && (
              <Link
                to="/history"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                History
              </Link>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 text-sm rounded-lg bg-accent hover:bg-accent/80 text-white transition-all font-medium"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuthChange={onAuthChange}
        />
      )}
    </>
  )
}
