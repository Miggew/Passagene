import { ChevronRight } from 'lucide-react';

export interface QuickActionCardProps {
    title: string;
    icon: React.ElementType;
    description: string;
    onClick: () => void;
    color: 'blue' | 'green' | 'violet' | 'cyan' | 'amber' | 'slate';
}

const colorStyles: Record<QuickActionCardProps['color'], string> = {
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-600',
    violet: 'bg-violet-500/10 text-violet-600',
    cyan: 'bg-cyan-500/10 text-cyan-600',
    amber: 'bg-amber-500/10 text-amber-600',
    slate: 'bg-slate-500/10 text-slate-600',
};

export function QuickActionCard({ title, icon: Icon, description, onClick, color }: QuickActionCardProps) {
    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col justify-between p-6 rounded-xl transition-all duration-200 hover:shadow-md cursor-pointer ${colorStyles[color]} hover:bg-opacity-20`}
        >
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-5 h-5" />
            </div>
            <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/70 dark:bg-black/20 backdrop-blur-sm">
                    <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg">{title}</h3>
            </div>
            <p className="text-sm opacity-80 mt-2">{description}</p>
        </div>
    );
}
