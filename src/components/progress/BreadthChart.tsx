import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryData } from '@/hooks/useProgressStats';

interface BreadthChartProps {
    data: CategoryData[];
    className?: string;
}

export function BreadthChart({ data, className }: BreadthChartProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className={`w-full h-[300px] ${className}`}>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} tick={false} axisLine={false} />
                    <Radar
                        name="Practice Minutes"
                        dataKey="minutes"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.4}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--popover-foreground))'
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
