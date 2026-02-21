import React, { useState } from 'react';
import { Menu, Plus, Droplet, Activity, Dna, FileText, X, LayoutDashboard, Search, Bell } from 'lucide-react';

export default function DisruptiveExamples() {
    const [mitosisOpen, setMitosisOpen] = useState(false);
    const [dnaOpen, setDnaOpen] = useState(false);

    return (
        <div className="min-h-screen bg-background p-8 font-sans text-foreground">
            <div className="max-w-4xl mx-auto space-y-16">

                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-full mb-4">
                        <Dna className="text-primary-600 w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-primary-800 dark:text-primary-100">
                        PassaGene: Elementos Disruptivos
                    </h1>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        4 experimentações de interface baseadas na filosofia "Biológico e Orgânico" do Design System. O foco é em fluidez, física celular e movimentos anatômicos.
                    </p>
                </div>

                {/* 1. Efeito Mitose */}
                <section className="space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm">1</span>
                            Efeito de "Mitose" (Gooey Menu)
                        </h2>
                        <p className="text-sm text-muted-foreground">Ao clicar, o botão se divide como uma célula se multiplicando. A tensão da membrana é visível na separação.</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 border-2 border-emerald-200/50 rounded-2xl p-12 flex justify-center items-center relative h-[320px] overflow-hidden shadow-sm">

                        {/* Container da Animação CSS-only */}
                        <div className="relative w-full h-full flex justify-center items-center">

                            {/* Membrana conectiva (o elástico verde que estica) - CSS Only */}
                            <div
                                className={`absolute w-16 h-16 bg-emerald-500 rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom
                                ${mitosisOpen ? 'scale-y-[1.8] -translate-y-[40px] opacity-0' : 'scale-y-100 translate-y-0 opacity-100'}`}
                            ></div>

                            <div
                                className={`absolute w-16 h-16 bg-emerald-500 rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-75 origin-left
                                ${mitosisOpen ? 'scale-x-[1.8] translate-x-[40px] translate-y-[20px] opacity-0' : 'scale-x-100 translate-x-0 translate-y-0 opacity-100'}`}
                            ></div>

                            <div
                                className={`absolute w-16 h-16 bg-emerald-500 rounded-full transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-150 origin-right
                                ${mitosisOpen ? 'scale-x-[1.8] -translate-x-[40px] translate-y-[20px] opacity-0' : 'scale-x-100 translate-x-0 translate-y-0 opacity-100'}`}
                            ></div>

                            {/* Botões Filhos (Células menores) */}
                            <button
                                title="Atividades"
                                aria-label="Atividades"
                                className={`absolute w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 ${mitosisOpen ? 'translate-y-[-85px]' : 'translate-y-0 scale-50 opacity-0'
                                    }`}
                            >
                                <Activity size={20} />
                            </button>

                            <button
                                title="Amostras"
                                aria-label="Amostras"
                                className={`absolute w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-75 z-10 ${mitosisOpen ? 'translate-x-[80px] translate-y-[35px]' : 'translate-x-0 translate-y-0 scale-50 opacity-0'
                                    }`}
                            >
                                <Droplet size={20} />
                            </button>

                            <button
                                title="Relatórios"
                                aria-label="Relatórios"
                                className={`absolute w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] delay-150 z-10 ${mitosisOpen ? 'translate-x-[-80px] translate-y-[35px]' : 'translate-x-0 translate-y-0 scale-50 opacity-0'
                                    }`}
                            >
                                <FileText size={20} />
                            </button>

                            {/* Botão Principal Nucleo (Sobreposto no centro) */}
                            <button
                                onClick={() => setMitosisOpen(!mitosisOpen)}
                                className="absolute w-16 h-16 bg-[#09C972] hover:bg-emerald-500 rounded-full flex items-center justify-center text-white z-20 transition-transform active:scale-95 shadow-2xl shadow-emerald-600/40"
                                aria-label={mitosisOpen ? 'Fechar menu' : 'Abrir menu'}
                            >
                                {mitosisOpen ? <X size={28} /> : <Plus size={28} className="animate-pulse" />}
                            </button>
                        </div>
                    </div>
                </section>

                {/* 2. Blob Orgânico */}
                <section className="space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm">2</span>
                            Formas Fluídas ("Blobs") em Fundo Ativo
                        </h2>
                        <p className="text-sm text-muted-foreground">Substituindo o padrão de "quadrados arredondados" em menus por formas assimétricas que respiram constantemente.</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-card border-2 border-primary-200/50 rounded-2xl p-12 flex flex-col md:flex-row justify-center gap-16 items-center shadow-sm">

                        <style>{`
              @keyframes blob-breathe {
                0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
                50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
                100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
              }
              .animate-blob {
                animation: blob-breathe 8s ease-in-out infinite;
              }
              .animate-blob-slow {
                animation: blob-breathe 14s ease-in-out infinite reverse;
              }
            `}</style>

                        {/* Exemplo Blob: Ícone do Menu Ativo */}
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ícone de Menu</p>
                            <div className="relative w-24 h-24 flex items-center justify-center group cursor-pointer">
                                {/* O fundo orgânico que se movimenta lentamente */}
                                <div className="absolute inset-0 bg-emerald-300 animate-blob group-hover:bg-emerald-400 transition-colors shadow-inner shadow-emerald-900/10 scale-125"></div>
                                <LayoutDashboard size={28} className="text-emerald-900 relative z-10" />
                            </div>
                        </div>

                        {/* Exemplo Blob: Avatar ou Indicador de Confiança AI */}
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Indicador AI</p>
                            <div className="relative w-32 h-32 flex items-center justify-center">
                                {/* 2 camadas de blob gerando um efeito de membrana pulsante exterior */}
                                <div className="absolute inset-[-6px] bg-emerald-400 animate-blob opacity-80 blur-[2px]"></div>
                                <div className="absolute inset-0 bg-[#09C972] animate-blob-slow opacity-100 shadow-xl shadow-emerald-900/20"></div>

                                {/* Conteúdo Central */}
                                <div className="absolute inset-1.5 bg-white dark:bg-slate-800 rounded-full flex flex-col items-center justify-center z-10 shadow-inner">
                                    <span className="text-2xl font-black text-[#09C972] tracking-tighter">98%</span>
                                    <span className="text-[9px] font-black text-slate-600 uppercase mt-[-2px]">CERTEZA</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* 3. Máscara de Membrana (Curvatura suave) */}
                <section className="space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm">3</span>
                            Membrana Curva (Sem Restrições Retangulares)
                        </h2>
                        <p className="text-sm text-muted-foreground">Em vez de uma linha de rodapé dura, o invólucro (membrana) do menu se deforma ao redor da ação principal.</p>
                    </div>

                    <div className="bg-slate-200 dark:bg-slate-800 border-[8px] border-slate-400 dark:border-slate-700 rounded-[2.5rem] w-full max-w-[375px] mx-auto h-[500px] relative overflow-hidden flex flex-col shadow-2xl">
                        {/* Header Falso */}
                        <div className="pt-10 px-6 pb-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex justify-between items-center z-10">
                            <div className="w-24 h-5 bg-emerald-400 rounded-full"></div>
                            <div className="w-8 h-8 rounded-full bg-emerald-400"></div>
                        </div>

                        {/* Falso conteúdo da tela mobile scrollando atrás do menu */}
                        <div className="px-6 py-6 space-y-4 flex-1">
                            <div className="h-32 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-300 dark:border-slate-700 w-full"></div>
                            <div className="flex gap-4">
                                <div className="h-24 bg-emerald-200 dark:bg-emerald-900/40 rounded-2xl flex-1"></div>
                                <div className="h-24 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-300 dark:border-slate-700 flex-1"></div>
                            </div>
                            <div className="h-32 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-300 dark:border-slate-700 w-full"></div>
                        </div>

                        {/* BOTTOM NAV COM CURVATURA ORGÂNICA EFEITO TENSÃO */}
                        <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-transparent flex justify-center pb-safe">
                            {/* SVG desenha um fundo que derrete e tensiona como um elástico pressionado para baixo onde a bola azul vai */}
                            <svg
                                className="absolute bottom-0 w-full h-[88px]"
                                preserveAspectRatio="none"
                                viewBox="0 0 375 88"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M0 88V16H115.5C125 16 137.5 16 148 29.5C158.5 43 168.5 56 187.5 56C206.5 56 216.5 43 227 29.5C237.5 16 250 16 259.5 16H375V88H0Z"
                                    className="fill-white dark:fill-slate-900"
                                    style={{ filter: "drop-shadow(0px -8px 12px rgba(0,0,0,0.15))" }}
                                />
                            </svg>

                            <div className="relative z-10 w-full flex justify-between px-6 pt-5 items-start h-full pb-4">
                                <button className="text-slate-400 hover:text-[#09C972] transition-colors flex flex-col items-center gap-1 group" aria-label="Menu">
                                    <Menu size={22} className="group-hover:-translate-y-1 transition-transform" />
                                </button>
                                <button className="text-slate-400 hover:text-[#09C972] transition-colors flex flex-col items-center gap-1 group" aria-label="Pesquisar">
                                    <Search size={22} className="group-hover:-translate-y-1 transition-transform" />
                                </button>

                                {/* Espaço vazio para o botão central que afundou */}
                                <div className="w-[60px]"></div>

                                <button className="text-slate-400 hover:text-[#09C972] transition-colors flex flex-col items-center gap-1 group" aria-label="Notificações">
                                    <Bell size={22} className="group-hover:-translate-y-1 transition-transform" />
                                </button>
                                <button className="text-[#09C972] transition-colors flex flex-col items-center gap-1" aria-label="Genética">
                                    <Dna size={22} className="translate-y-[-2px]" />
                                </button>
                            </div>

                            {/* Botão Central (Encaixado perfeitamente na concavidade Biologica) */}
                            <button className="absolute top-[8px] left-1/2 -translate-x-1/2 w-16 h-16 bg-[#09C972] rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(9,201,114,0.6)] hover:scale-105 hover:bg-emerald-400 transition-all active:scale-95 z-20" aria-label="Adicionar">
                                <Plus size={32} />
                            </button>
                        </div>
                    </div>
                </section>

                {/* 4. Fecho Ecler DNA */}
                <section className="space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm">4</span>
                            Animação "Fecho Ecler de DNA" (Staggered list)
                        </h2>
                        <p className="text-sm text-muted-foreground">Em vez de um slide-down vertical chato, listas cruzam da esquerda e da direita imitando os degraus (bases nitrogenadas) de uma Dupla-Hélice casando-se com tempo defasado.</p>
                    </div>

                    <div className="bg-slate-100 dark:bg-slate-900 border-2 border-emerald-300 rounded-2xl p-12 min-h-[460px] flex flex-col items-center justify-start py-10 relative overflow-hidden shadow-sm">

                        {/* Decoração de fundo sutil */}
                        <Dna className="absolute -right-10 -bottom-10 text-emerald-200 dark:text-emerald-900/40 w-64 h-64 -rotate-12" />

                        <button
                            onClick={() => setDnaOpen(!dnaOpen)}
                            className="relative z-20 bg-emerald-100 dark:bg-emerald-900/60 px-6 py-4 rounded-xl text-emerald-900 dark:text-emerald-100 font-bold mb-10 flex items-center gap-3 hover:bg-emerald-200 transition-all active:scale-95 shadow-md border-2 border-emerald-400 text-lg"
                        >
                            <Dna size={24} className={dnaOpen ? "animate-spin text-[#09C972]" : "text-[#09C972]"} style={{ animationDuration: '4s' }} />
                            {dnaOpen ? 'Fechar Histórico Genético' : 'Montar Histórico Genético'}
                        </button>

                        {/* Container da Lista com a Espinha Dorsal */}
                        <div className="w-full max-w-md space-y-4 relative z-10">

                            {/* Linha vertical brilhante (Espinha dorsal) ligando os pontos */}
                            <div
                                className="absolute left-1/2 top-4 bottom-4 w-1.5 bg-gradient-to-b from-emerald-300 via-[#09C972] to-emerald-300 -translate-x-1/2 transition-all duration-1000 ease-in-out origin-top rounded-full shadow-[0_0_15px_rgba(9,201,114,0.8)]"
                                style={{
                                    transform: dnaOpen ? 'translateX(-50%) scaleY(1)' : 'translateX(-50%) scaleY(0)',
                                    opacity: dnaOpen ? 1 : 0
                                }}
                            ></div>

                            {[
                                { label: 'Fertilização concluída', time: '14:32', icon: <Plus size={14} />, side: 'left' },
                                { label: 'Divisão D2 Confirmada', time: 'Ontem', icon: <Activity size={14} />, side: 'right' },
                                { label: 'Transferência para Estufa', time: '11 Fev', icon: <Droplet size={14} />, side: 'left' },
                                { label: 'Eclosão detectada pelo AI', time: '09 Fev', icon: <Search size={14} />, side: 'right' },
                            ].map((item, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center gap-5 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative
                    ${dnaOpen
                                            ? 'opacity-100 translate-x-0 blur-none'
                                            : 'opacity-0 blur-[2px] pointer-events-none ' + (item.side === 'left' ? '-translate-x-24 rotate-[-5deg]' : 'translate-x-24 rotate-[5deg]')}
                  `}
                                    style={{
                                        transitionDelay: `${index * 120}ms`,
                                        flexDirection: item.side === 'left' ? 'row' : 'row-reverse'
                                    }}
                                >
                                    {/* O Cartão do Histórico */}
                                    <div className={`flex-1 flex ${item.side === 'left' ? 'justify-end' : 'justify-start'}`}>
                                        <div className="bg-white dark:bg-slate-800 border-2 border-emerald-100 dark:border-emerald-900 shadow-lg rounded-xl p-4 w-[200px] hover:-translate-y-1 transition-transform cursor-pointer relative group">
                                            {/* O 'Ponto de Ligação' (hidrogênio) visual esticando até o meio */}
                                            <div
                                                className={`absolute top-1/2 -translate-y-1/2 w-8 h-1 bg-emerald-300 opacity-80 transition-all duration-300 group-hover:bg-[#09C972] group-hover:w-12 rounded-full
                          ${item.side === 'left' ? '-right-10' : '-left-10'}
                        `}
                                            ></div>

                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white bg-[#09C972] rounded-full p-2 shadow-md">
                                                    {item.icon}
                                                </span>
                                                <span className="text-[11px] uppercase font-black text-slate-400">{item.time}</span>
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{item.label}</p>
                                        </div>
                                    </div>

                                    {/* Ponto Genético Central (A bolinha pulsante no meio) */}
                                    <div className="relative flex items-center justify-center">
                                        <div className={`w-6 h-6 rounded-full bg-white border-4 border-[#09C972] z-10 transition-colors duration-500 shadow-[0_0_12px_rgba(9,201,114,0.8)]
                      ${dnaOpen ? 'delay-[500ms] !bg-[#09C972]' : ''}
                    `}></div>
                                        {/* Ring pulsante em volta */}
                                        <div className={`absolute w-12 h-12 rounded-full bg-emerald-400/60 animate-ping z-0 
                       ${dnaOpen ? 'block' : 'hidden'}
                    `} style={{ animationDelay: `${index * 300}ms` }}></div>
                                    </div>

                                    <div className="flex-1"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}
