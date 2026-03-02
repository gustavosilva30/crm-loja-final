import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Mail, Loader2, ShieldCheck, FileText, Trash2 } from "lucide-react"
import { TERMS_OF_USE, PRIVACY_POLICY, DATA_DELETION_TEXT } from "@/constants/legal"

export function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (authError) throw authError
            navigate("/")
        } catch (err: any) {
            setError(err.message || "Erro ao fazer login")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
            <Card className="w-full max-w-md shadow-2xl border-primary/20 backdrop-blur-sm bg-card/50">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                            <Lock className="w-8 h-8" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tighter">Acesso ao CRM</CardTitle>
                    <CardDescription>Entre com suas credenciais para gerenciar sua empresa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    className="pl-10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    className="pl-10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20 animate-in fade-in zoom-in">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full font-bold" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                "Acessar Sistema"
                            )}
                        </Button>

                        <div className="flex items-center justify-center gap-4 pt-2">
                            <Link
                                to="/terms"
                                className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <FileText className="w-3 h-3" />
                                Termos de Uso
                            </Link>
                            <span className="text-muted-foreground/30">•</span>
                            <Link
                                to="/privacy"
                                className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <ShieldCheck className="w-3 h-3" />
                                Privacidade
                            </Link>
                            <span className="text-muted-foreground/30">•</span>
                            <Link
                                to="/deletion"
                                className="text-[10px] uppercase font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3" />
                                Excluir Dados
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
