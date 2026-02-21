import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { DailyMinutes } from '@/hooks/useProgressStats';

interface FrequencyChartProps {
    data: DailyMinutes[];
    className?: string;
}

export function FrequencyChart({ data, className }: FrequencyChartProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className={`w-full h-[250px] ${className}`}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                    />
                    <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        contentStyle={{
                            backgroundColor: 'hsl(var(--popover))',
                            borderColor: 'hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--popover-foreground))'
                        }}
                        formatter={(value: number) => [`${value} min`, 'Practice Time']}
                    />
                    <Bar
                        dataKey="minutes"
                        radius={[4, 4, 0, 0]}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.minutes > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
