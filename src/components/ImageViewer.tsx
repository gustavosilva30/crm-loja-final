import { motion, AnimatePresence } from "framer-motion"
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface ImageViewerProps {
    images: string[]
    initialIndex?: number
    alt?: string
    isOpen: boolean
    onClose: () => void
}

export function ImageViewer({ images, initialIndex = 0, alt, isOpen, onClose }: ImageViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const [scale, setScale] = useState(1)

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex)
            setScale(1)
        }
    }, [isOpen, initialIndex])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
            if (e.key === "ArrowRight") handleNext()
            if (e.key === "ArrowLeft") handlePrev()
        }
        if (isOpen) {
            document.body.style.overflow = "hidden"
            window.addEventListener("keydown", handleKeyDown)
        }
        return () => {
            document.body.style.overflow = "unset"
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen, currentIndex, onClose])

    const handleNext = () => {
        if (images.length <= 1) return
        setCurrentIndex((prev) => (prev + 1) % images.length)
        setScale(1)
    }

    const handlePrev = () => {
        if (images.length <= 1) return
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
        setScale(1)
    }

    if (!images || images.length === 0) return null
    const currentSrc = images[currentIndex]

    return createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 cursor-zoom-out"
                        onClick={onClose}
                    />

                    {/* Controls */}
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

                    {/* Navigation Arrows */}
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                className="absolute left-4 md:left-10 z-[110] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                className="absolute right-4 md:right-10 z-[110] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                            >
                                <ChevronRight className="w-8 h-8" />
                            </button>

                            {/* Pagination Indicator */}
                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[110] flex gap-2 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                                {images.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? "bg-white scale-125 w-3" : "bg-white/30"}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    <motion.div
                        key={currentSrc}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-[105] max-w-full max-h-full flex items-center justify-center pointer-events-none"
                    >
                        <motion.img
                            src={currentSrc}
                            alt={alt || `Imagem ${currentIndex + 1}`}
                            style={{ scale }}
                            className="max-w-[95vw] max-h-[85vh] object-contain shadow-2xl rounded-lg pointer-events-auto transition-transform duration-200"
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                            dragElastic={0.1}
                        />
                    </motion.div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] text-white/50 text-[10px] font-medium pointer-events-none uppercase tracking-widest bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                        {currentIndex + 1} / {images.length} • ESC para fechar • Seta para navegar
                    </div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
