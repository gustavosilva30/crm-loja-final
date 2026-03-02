import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { Login } from "./pages/Login"
import { Layout } from "./components/Layout"
import { Dashboard } from "./pages/Dashboard"
import { Produtos } from "./pages/Produtos"
import { Orcamentos } from "./pages/Orcamentos"
import { Vendas } from "./pages/Vendas"
import { Financeiro } from "./pages/Financeiro"
import { Clientes } from "./pages/Clientes"
import { Entregas } from "./pages/Entregas"
import { Configuracoes } from "./pages/Configuracoes"
import { Lembretes } from "./pages/Lembretes"
import { Relatorios } from "./pages/Relatorios"
import { Caixa } from "./pages/Caixa"
import { Fiscal } from "./pages/Fiscal"
import { ThemeProvider } from "./components/ThemeProvider"
import { supabase } from "./lib/supabase"

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null

  return (
    <ThemeProvider defaultTheme="dark" storageKey="erp-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />

          <Route path="/" element={session ? <Layout /> : <Navigate to="/login" />}>
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="orcamentos" element={<Orcamentos />} />
            <Route path="vendas" element={<Vendas />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="entregas" element={<Entregas />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="lembretes" element={<Lembretes />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="caixa" element={<Caixa />} />
            <Route path="fiscal" element={<Fiscal />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
