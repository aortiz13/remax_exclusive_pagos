import React from 'react'

export default function Header() {
    return (
        <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
            <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-start gap-4">
                <img
                    src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1765974550/ChatGPT_Image_11_dic_2025_03_45_43_p.m._oajwry.png"
                    alt="RE/MAX Exclusive"
                    className="h-12 w-auto object-contain"
                />
                <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">
                    Generador de Solicitudes de Pago
                </h1>
            </div>
        </header>
    )
}
