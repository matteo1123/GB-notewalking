import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, Bot, User, Play, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';
import { useRoutines } from '@/hooks/useRoutines';
import { toast } from 'sonner';

interface ModuleConfig {
    module_type: 'scale' | 'arpeggio';
    priority_scale_shape_ids: string[];
    group_by_shape: boolean;
    order_by: string;
    current_index: number;
    progression_mode: 'cycle' | 'sequential' | 'focus';
    focus_target_bpm?: number;
}

interface ToolCallResult {
    tool: string;
    input: any;
    result: {
        success?: boolean;
        name?: string;
        description?: string;
        module_config?: ModuleConfig;
        shape_count?: number;
        message?: string;
    };
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: ToolCallResult[];
}

const SUGGESTION_CHIPS = [
    { label: 'C# minor routine', prompt: 'Create a module for practicing C# minor in all positions' },
    { label: 'Analyze my progress', prompt: 'Analyze my practice progress over the last month' },
    { label: 'What should I practice?', prompt: 'Based on my history, what should I focus on next?' },
    { label: 'Position 1 scales', prompt: 'Find all scales in position 1 and create a practice module' },
];

export function CoachChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { startSessionWithPlan } = useSession();
    const { createRoutine } = useRoutines();

    // Extract module config from tool calls if present
    const getModuleConfigFromToolCalls = (toolCalls?: ToolCallResult[]): { name: string; config: ModuleConfig } | null => {
        if (!toolCalls) return null;
        const createCall = toolCalls.find(t => t.tool === 'create_module_config' && t.result?.success);
        if (createCall?.result?.module_config) {
            return {
                name: createCall.result.name || 'AI Created Module',
                config: createCall.result.module_config,
            };
        }
        return null;
    };

    // Start practicing with the AI-created module config
    const handleStartPractice = (name: string, config: ModuleConfig) => {
        const sessionBlock = {
            module_type: config.module_type as 'scale' | 'arpeggio',
            config: {
                ...config,
            },
            duration_minutes: 10, // 10 minutes default
            order: 0,
            conceptId: `ai-coach-${crypto.randomUUID()}`,
        };

        startSessionWithPlan(name, [sessionBlock]);
    };

    // Save the AI-created module as a routine
    const handleSaveAsRoutine = async (name: string, config: ModuleConfig, description?: string) => {
        const sessionBlock = {
            module_type: config.module_type as 'scale' | 'arpeggio',
            config: { ...config },
            duration_minutes: 10,
            order: 0,
            conceptId: `ai-coach-${crypto.randomUUID()}`,
        };

        const routine = await createRoutine({
            name,
            description: description || `Created by AI Coach`,
            icon: config.module_type === 'scale' ? '🎸' : '🎵',
            session_plan: [sessionBlock],
            progression_mode: config.progression_mode,
            is_favorite: false,
            created_by_ai: true,
        });

        if (routine) {
            toast.success(`Saved routine: ${name}`);
        } else {
            toast.error('Failed to save routine');
        }
    };

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async (messageText?: string) => {
        const text = messageText || input.trim();
        if (!text || loading) return;

        setInput('');
        setError(null);

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setLoading(true);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('ai-coach', {
                body: {
                    message: text,
                    conversationHistory: messages.map(m => ({
                        role: m.role,
                        content: m.content,
                    })),
                },
            });

            if (fnError) throw fnError;

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data.response || 'I apologize, but I encountered an issue processing your request.',
                timestamp: new Date(),
                toolCalls: data.toolCalls,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err: any) {
            console.error('Coach error:', err);
            setError(err.message || 'Failed to get response from coach');

            // Add error message
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleSuggestionClick = (prompt: string) => {
        sendMessage(prompt);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages Area */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                {messages.length === 0 ? (
                    /* Welcome State */
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Guitar Brain Coach</h2>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            I can help you create practice modules, analyze your progress,
                            and find the right exercises for your goals.
                        </p>

                        <div className="flex flex-wrap gap-2 justify-center max-w-md">
                            {SUGGESTION_CHIPS.map((chip, i) => (
                                <Button
                                    key={i}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full"
                                    onClick={() => handleSuggestionClick(chip.prompt)}
                                >
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    {chip.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Message List */
                    <div className="space-y-4">
                        {messages.map(message => (
                            <div
                                key={message.id}
                                className={cn(
                                    'flex gap-3',
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                )}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-white" />
                                    </div>
                                )}

                                <div
                                    className={cn(
                                        'rounded-lg px-4 py-2 max-w-[80%]',
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted'
                                    )}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                    {/* Show tool calls if any */}
                                    {message.toolCalls && message.toolCalls.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-border/50">
                                            <p className="text-xs text-muted-foreground">
                                                Used: {message.toolCalls.map(t => t.tool).join(', ')}
                                            </p>
                                        </div>
                                    )}

                                    {/* Show action buttons for created module configs */}
                                    {(() => {
                                        const moduleData = getModuleConfigFromToolCalls(message.toolCalls);
                                        if (!moduleData) return null;
                                        return (
                                            <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleStartPractice(moduleData.name, moduleData.config)}
                                                    className="gap-1"
                                                >
                                                    <Play className="w-3 h-3" />
                                                    Start Practice
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleSaveAsRoutine(
                                                        moduleData.name,
                                                        moduleData.config,
                                                        message.toolCalls?.find(t => t.tool === 'create_module_config')?.result?.description
                                                    )}
                                                    className="gap-1"
                                                >
                                                    <Save className="w-3 h-3" />
                                                    Save as Routine
                                                </Button>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="bg-muted rounded-lg px-4 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Error display */}
            {error && (
                <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* Input Area */}
            <div className="border-t p-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage();
                    }}
                    className="flex gap-2"
                >
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me about your practice..."
                        disabled={loading}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={loading || !input.trim()}>
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
