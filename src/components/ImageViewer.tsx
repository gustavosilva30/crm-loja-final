import { motion, AnimatePresence } from "framer-motion"
import { X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface ImageViewerProps {
    src: string | null
    alt?: string
    isOpen: boolean
    onClose: () => void
}

export function ImageViewer({ src, alt, isOpen, onClose }: ImageViewerProps) {
    const [scale, setScale] = useState(1)

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        if (isOpen) {
            document.body.style.overflow = "hidden"
            window.addEventListener("keydown", handleEscape)
            setScale(1) // Reset scale on open
        }
        return () => {
            document.body.style.overflow = "unset"
            window.removeEventListener("keydown", handleEscape)
        }
    }, [isOpen, onClose])

    if (!src) return null

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 cursor-zoom-out"
                        onClick={onClose}
                    />

                    <div className="absolute top-4 right-4 z-[110] flex gap-2">
                        <button
                            onClick={() => setScale(s => Math.min(s + 0.5, 3))}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                            title="Aumentar Zoom"
                        >
                            <ZoomIn className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => setScale(s => Math.max(s - 0.5, 0.5))}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                            title="Diminuir Zoom"
                        >
                            <ZoomOut className="w-6 h-6" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                            title="Fechar"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative z-[105] max-w-full max-h-full flex items-center justify-center pointer-events-none"
                    >
                        <motion.img
                            src={src}
                            alt={alt || "Imagem selecionada"}
                            style={{ scale }}
                            className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg pointer-events-auto transition-transform duration-200"
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            dragElastic={0.1}
                        />
                    </motion.div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] text-white/50 text-xs font-medium pointer-events-none">
                        Clique fora ou pressione ESC para fechar • Role para zoom (em breve) ou use os botões
                    </div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
