import { useEffect, useState } from 'react';
import { CloudRain, Sun, Cloud, Droplets, Wind, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { LoadingInline } from '@/components/shared/LoadingScreen';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

export function WeatherWidget({ compact = false }: { compact?: boolean }) {
    // Mock data
    const [current, setCurrent] = useState<any>(null);
    const [forecast, setForecast] = useState<any[]>([]);
    const [insight, setInsight] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const { data, error } = await supabase.functions.invoke('fetch-gemini-insights', {
                    body: { type: 'weather' }
                });
                if (data?.current) {
                    setCurrent(data.current);
                    setForecast(data.forecast || []);
                    setInsight(data.insight || '');
                } else {
                    throw new Error('Dados de clima inválidos ou ausentes');
                }
            } catch (e) {
                console.error('Erro no WeatherWidget:', e);
                // Fallback
                setCurrent({
                    temp: 28, condition: 'Parcialmente Nublado', location: 'Uberaba, MG',
                    humidity: 65, wind: 12, min: 22, max: 31
                });
                setForecast([
                    { day: 'Seg', min: 21, max: 30, icon: 'Sun', condition: 'Sol' },
                    { day: 'Ter', min: 20, max: 28, icon: 'CloudRain', condition: 'Chuva' },
                    { day: 'Qua', min: 19, max: 27, icon: 'Cloud', condition: 'Nublado' },
                ]);
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, []);

    if (loading) {
        return (
            <Card className="h-full bg-card border-border p-5 flex items-center justify-center">
                <LoadingInline text="Lendo atmosfera..." />
            </Card>
        );
    }



    if (compact) {
        // Build a short literary summary of the forecast
        const forecastSummary = forecast && forecast.length > 0
            ? `Próximos dias: ${forecast.map(f => `${f.day} (${f.min}°-${f.max}°)`).join(', ')}.`
            : 'Previsão indisponível no momento.';

        return (
            <Card className="h-full min-h-[160px] bg-card border-border/50 p-4 flex flex-col justify-between shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">

                {/* Top: Location & Current Temp in a structured row */}
                <div className="flex items-start justify-between z-10 shrink-0 mb-4">
                    <div>
                        <span className="text-sm font-semibold text-foreground tracking-wide block mb-1">{current.location}</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-foreground tracking-tighter">{current.temp}°</span>
                            <span className="text-xs text-muted-foreground font-medium capitalize mt-1 block">{current.condition}</span>
                        </div>
                    </div>

                    <Sun className="w-12 h-12 text-yellow-500 drop-shadow-sm mt-1" />
                </div>

                {/* Middle: Details (Min/Max, Humidity) */}
                <div className="flex gap-4 text-xs font-bold mt-auto mb-3 z-10 bg-muted/20 p-2 rounded-lg border border-border/30">
                    <span className="text-blue-500">Min {current.min}°</span>
                    <span className="text-red-500">Max {current.max}°</span>
                    <span className="text-muted-foreground ml-auto">Umid {current.humidity}%</span>
                </div>

                {/* Divisor Elegante */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent mb-3 opacity-60" />

                {/* Bottom: Literary Forecast / Insight */}
                <div className="shrink-0 z-10">
                    <p className="text-xs font-medium text-foreground/80 leading-relaxed group-hover:text-foreground transition-colors">
                        {insight || forecastSummary}
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full bg-card border-border p-6 overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-primary uppercase tracking-wide">Localização</span>
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{current.location}</h3>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-full">
                    <Sun className="w-8 h-8 text-yellow-500" />
                </div>
            </div>

            <div className="flex items-center justify-between mb-8">
                <div>
                    <span className="text-7xl font-bold text-foreground tracking-tighter">{current.temp}°</span>
                    <p className="text-lg text-muted-foreground font-medium mt-1 capitalize">{current.condition}</p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg min-w-[120px]">
                        <span className="text-xs font-bold text-red-400 uppercase">Max</span>
                        <span className="text-lg font-bold text-foreground ml-auto">{current.max}°</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg min-w-[120px]">
                        <span className="text-xs font-bold text-blue-400 uppercase">Min</span>
                        <span className="text-lg font-bold text-foreground ml-auto">{current.min}°</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Droplets className="w-5 h-5 text-blue-500" />
                    <div>
                        <span className="text-xs text-muted-foreground font-bold uppercase">Umidade</span>
                        <p className="text-sm font-bold text-foreground">{current.humidity}%</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Wind className="w-5 h-5 text-slate-500" />
                    <div>
                        <span className="text-xs text-muted-foreground font-bold uppercase">Vento</span>
                        <p className="text-sm font-bold text-foreground">{current.wind} km/h</p>
                    </div>
                </div>
            </div>

            {insight && (
                <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Insight Gemini</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{insight}</p>
                </div>
            )}

            <div className="mt-auto">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Próximos Dias</h4>
                <div className="grid grid-cols-3 gap-3">
                    {forecast.map((day, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/20 border border-border">
                            <span className="text-xs font-bold text-muted-foreground uppercase">{day.day}</span>
                            {/* Simple icon mapping based on condition string or API icon name */}
                            {day.condition.toLowerCase().includes('chuva') || day.icon === 'rain' ? <CloudRain className="w-6 h-6 text-blue-400 my-1" /> :
                                day.condition.toLowerCase().includes('nublado') || day.icon === 'cloud' ? <Cloud className="w-6 h-6 text-gray-400 my-1" /> :
                                    <Sun className="w-6 h-6 text-yellow-500 my-1" />}
                            <div className="flex gap-2 text-xs font-medium">
                                <span className="text-blue-400">{day.min}°</span>
                                <span className="text-red-400">{day.max}°</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
}
