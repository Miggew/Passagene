import { ChevronRight } from 'lucide-react';

export interface QuickActionCardProps {
    title: string;
    icon: React.ElementType;
    description: string;
    onClick: () => void;
    color: 'blue' | 'green' | 'violet' | 'cyan' | 'amber' | 'slate';
}

const colorStyles: Record<QuickActionCardProps['color'], string> = {
    blue: 'border-blue-500/20 text-blue-500 bg-blue-500/10',
    green: 'border-green-500/20 text-green-500 bg-green-500/10',
    violet: 'border-violet-500/20 text-violet-500 bg-violet-500/10',
    cyan: 'border-cyan-500/20 text-cyan-500 bg-cyan-500/10',
    amber: 'border-amber-500/20 text-amber-500 bg-amber-500/10',
    slate: 'border-slate-500/20 text-slate-500 bg-slate-500/10',
};

export function QuickActionCard({ title, icon: Icon, description, onClick, color }: QuickActionCardProps) {
    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col justify-between p-5 rounded-2xl border-2 shadow-brutal-sm glass-panel text-foreground transition-all duration-300 hover:translate-y-0.5 hover:shadow-none cursor-pointer overflow-hidden ${colorStyles[color].split(' ')[0]}`}
        >
            <div className="absolute top-4 right-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
            </div>
            <div className="space-y-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-border shadow-sm ${colorStyles[color].split(' ')[2]}`}>
                    <Icon className={`w-6 h-6 ${colorStyles[color].split(' ')[1]}`} />
                </div>
                <div>
                    <h3 className="font-bold text-lg tracking-tight mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground font-medium">{description}</p>
                </div>
            </div>
        </div>
    );
}
