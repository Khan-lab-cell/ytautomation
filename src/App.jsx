import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import History from './pages/History'
import Login from './pages/Login'

export default function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <BrowserRouter>
      <Navbar user={user} onAuthChange={setUser} />
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/history" element={<History user={user} />} />
        <Route path="/login" element={<Login onAuthChange={setUser} />} />
      </Routes>
    </BrowserRouter>
  )
}
