import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function Vendas() {
    useEffect(() => {
        console.log("Vendas component mounted")
    }, [])

    return (
        <div className="p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Vendas Pendentes (Teste)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Se você está vendo esta mensagem, o componente está renderizando corretamente.</p>
                </CardContent>
            </Card>
        </div>
    )
}
