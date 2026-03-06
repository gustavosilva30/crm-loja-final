import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { CommandMenu } from "./CommandMenu"
import { motion } from "framer-motion"
import { useUIStore } from "@/store/uiStore"
import { cn } from "@/lib/utils"

export function Layout() {
  const { sidebarOpen } = useUIStore()
  const location = useLocation()
  const isAtendimento = location.pathname.startsWith('/atendimento')

  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
      <CommandMenu />
      <div className={cn(
        "transition-all duration-300 ease-in-out shrink-0",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto relative">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "transition-all duration-300",
            isAtendimento ? "p-0 max-w-none h-screen" : "p-8 max-w-7xl mx-auto"
          )}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
