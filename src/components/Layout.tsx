import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { CommandMenu } from "./CommandMenu"
import { NotificationsCenter } from "./NotificationsCenter"
import { motion } from "framer-motion"
import { useUIStore } from "@/store/uiStore"
import { cn } from "@/lib/utils"

export function Layout() {
  const { sidebarOpen } = useUIStore()
  const location = useLocation()
  const isAtendimento = location.pathname.startsWith('/atendimento')
  const isFunil = location.pathname.startsWith('/funil')
  const isFullScreen = isAtendimento || isFunil

  return (
    <div className="h-screen bg-background text-foreground overflow-hidden flex">
      <CommandMenu />
      {!isAtendimento && <NotificationsCenter />}
      <div className={cn(
        "transition-all duration-300 ease-in-out shrink-0 h-full",
        sidebarOpen ? "w-64" : "w-0 overflow-hidden"
      )}>
        <Sidebar />
      </div>
      <main className="flex-1 overflow-hidden relative flex flex-col h-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex-1 transition-all duration-300 h-full",
            isAtendimento ? "p-0 max-w-none" : "p-6 max-w-7xl mx-auto w-full"
          )}
        >
          <div className={cn("h-full", !isFullScreen && "overflow-y-auto custom-scrollbar")}>
            <Outlet />
          </div>
        </motion.div>
      </main>
    </div>
  )
}
