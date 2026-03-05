import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Login } from "./pages/Login"
import { Layout } from "./components/Layout"
import { Dashboard } from "./pages/Dashboard"
import { Produtos } from "./pages/Produtos"
import { Orcamentos } from "./pages/Orcamentos"
import { Vendas } from "./pages/Vendas_v2"
import { VendasConcluidas } from "./pages/VendasConcluidas"
import { Financeiro } from "./pages/Financeiro"
import { Clientes } from "./pages/Clientes"
import { Entregas } from "./pages/Entregas"
import { Configuracoes } from "./pages/Configuracoes"
import { Lembretes } from "./pages/Lembretes"
import { Relatorios } from "./pages/Relatorios"
import { Caixa } from "./pages/Caixa"
import { Fiscal } from "./pages/Fiscal"
import { Atendimento } from "./pages/Atendimento"
import { Leiloes } from "./pages/Leiloes"
import { Agenda } from "./pages/Agenda"
import { MetasVendedores } from "./pages/MetasVendedores"
import { Devolucoes } from "./pages/Devolucoes"
import { Indicacoes } from "./pages/Indicacoes"
import { QrScanner } from "./pages/QrScanner"
import { Sucatas } from "./pages/Sucatas"
import { Catalogo } from "./pages/Catalogo"
import { ThemeProvider } from "./components/ThemeProvider"
import { supabase } from "./lib/supabase"
import { useAuthStore } from "./store/authStore"

import { Legal } from "./pages/Legal"

export default function App() {
  const { user, loading, signIn } = useAuthStore()

  useEffect(() => {
    signIn()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      signIn()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="erp-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/legal/:type" element={<Legal />} />
          <Route path="/terms" element={<Navigate to="/legal/terms" />} />
          <Route path="/privacy" element={<Navigate to="/legal/privacy" />} />
          <Route path="/deletion" element={<Navigate to="/legal/deletion" />} />

          {loading ? (
            <Route path="*" element={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>} />
          ) : (
            <>
              <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
              <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
                <Route index element={<Dashboard />} />
                <Route path="produtos" element={<Produtos />} />
                <Route path="orcamentos" element={<Orcamentos />} />
                <Route path="vendas" element={<Vendas />} />
                <Route path="vendas-concluidas" element={<VendasConcluidas />} />
                <Route path="financeiro" element={<Financeiro />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="entregas" element={<Entregas />} />
                <Route path="configuracoes" element={<Configuracoes />} />
                <Route path="lembretes" element={<Lembretes />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="caixa" element={<Caixa />} />
                <Route path="fiscal" element={<Fiscal />} />
                <Route path="atendimento" element={<Atendimento />} />
                <Route path="leiloes" element={<Leiloes />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="metas" element={<MetasVendedores />} />
                <Route path="devolucoes" element={<Devolucoes />} />
                <Route path="indicacoes" element={<Indicacoes />} />
                <Route path="qrcode" element={<QrScanner />} />
                <Route path="sucatas" element={<Sucatas />} />
                <Route path="catalogo" element={<Catalogo />} />
              </Route>
            </>
          )}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
