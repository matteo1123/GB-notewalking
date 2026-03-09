import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, Bot, User, Play, Save, FlaskConical, Search, Pencil, ListChecks, Undo2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';
import { useRoutines } from '@/hooks/useRoutines';
import { toast } from 'sonner';
import { RoutinePlanView } from './RoutinePlanView';
import type { ModuleType, SessionBlock } from '@/types/practice';

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

interface ModuleConfig {
    module_type: string;
    priority_scale_shape_ids?: string[];
    group_by_shape?: boolean;
    order_by?: string;
    current_index?: number;
    progression_mode?: 'cycle' | 'sequential' | 'focus';
    focus_target_bpm?: number;
    [key: string]: any; // Allow additional config fields for all module types
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
        error?: string;
        // Routine-specific fields
        routine_id?: string;
        routine_name?: string;
        session_plan?: any[];
        updated_session_plan?: any[];
        edits_applied?: string[];
        block_count?: number;
        total_duration_minutes?: number;
        duration_minutes?: number;
        routines?: any[];
        count?: number;
        previous_session_plan?: any[];
        // Duplicate result fields
        original_routine_id?: string;
        original_routine_name?: string;
        new_routine_id?: string;
        new_routine_name?: string;
        // Search result fields
        found?: number;
        shapes?: any[];
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
    { label: 'Show my routines', prompt: 'Show me my practice routines' },
    { label: 'C# minor 3nps', prompt: 'Create a module for practicing C# minor using 3 notes per string shapes' },
    { label: 'Analyze my progress', prompt: 'Analyze my practice progress over the last month' },
    { label: 'What should I practice?', prompt: 'Based on my history, what should I focus on next?' },
];

/** Map tool names to display labels and icons */
const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
    search_scale_shapes: { label: 'Searching exercises...', icon: '🔍' },
    create_module_config: { label: 'Creating module...', icon: '🎵' },
    get_user_routines: { label: 'Loading routines...', icon: '📋' },
    get_routine_details: { label: 'Loading routine details...', icon: '📖' },
    update_routine: { label: 'Updating routine...', icon: '📝' },
    get_practice_history: { label: 'Checking practice history...', icon: '📊' },
    analyze_progress: { label: 'Analyzing progress...', icon: '📈' },
    submit_suggestion: { label: 'Submitting suggestion...', icon: '💡' },
    create_routine: { label: 'Creating routine...', icon: '🎯' },
    duplicate_routine: { label: 'Duplicating routine...', icon: '📋' },
};

export function CoachChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const { startSessionWithPlan } = useSession();
    const { createRoutine, updateRoutine: updateRoutineHook, duplicateRoutine } = useRoutines();

    const getModuleConfigFromToolCalls = (toolCalls?: ToolCallResult[]): { name: string; config: ModuleConfig; description?: string; duration?: number } | null => {
        if (!toolCalls) return null;
        const createCall = toolCalls.find(t => t.tool === 'create_module_config' && t.result?.success);
        if (createCall?.result?.module_config) {
            return {
                name: createCall.result.name || 'AI Created Module',
                config: createCall.result.module_config,
                description: createCall.result.description,
                duration: createCall.result.duration_minutes || 2,
            };
        }
        return null;
    };

    // Extract routine plan view data from tool calls
    const getRoutinePlanFromToolCalls = (toolCalls?: ToolCallResult[]) => {
        if (!toolCalls) return null;

        // Check for update_routine result (priority — shows changes)
        const updateCall = toolCalls.find(t => t.tool === 'update_routine' && t.result?.success);
        if (updateCall?.result?.updated_session_plan) {
            return {
                type: 'update' as const,
                name: updateCall.result.routine_name || 'Routine',
                blocks: updateCall.result.updated_session_plan,
                totalDuration: updateCall.result.total_duration_minutes,
                editLog: updateCall.result.edits_applied,
                routineId: updateCall.result.routine_id,
                previousPlan: updateCall.result.previous_session_plan,
            };
        }

        // Check for create_routine result
        const createCall = toolCalls.find(t => t.tool === 'create_routine' && t.result?.success);
        if (createCall?.result?.session_plan) {
            return {
                type: 'created' as const,
                name: createCall.result.routine_name || 'New Routine',
                blocks: createCall.result.session_plan,
                totalDuration: createCall.result.total_duration_minutes,
                routineId: createCall.result.routine_id,
            };
        }

        // Check for duplicate_routine result
        const dupCall = toolCalls.find(t => t.tool === 'duplicate_routine' && t.result?.success);
        if (dupCall?.result?.session_plan) {
            return {
                type: 'duplicated' as const,
                name: dupCall.result.new_routine_name || 'Duplicated Routine',
                blocks: dupCall.result.session_plan,
                totalDuration: dupCall.result.total_duration_minutes,
                routineId: dupCall.result.new_routine_id,
                originalName: dupCall.result.original_routine_name,
            };
        }

        // Check for get_routine_details result
        const detailCall = toolCalls.find(t => t.tool === 'get_routine_details' && t.result?.session_plan);
        if (detailCall?.result?.session_plan) {
            return {
                type: 'detail' as const,
                name: detailCall.result.name || 'Routine',
                blocks: detailCall.result.session_plan,
                totalDuration: detailCall.result.total_duration_minutes,
                routineId: detailCall.result.routine_id || detailCall.input?.routine_id,
            };
        }

        return null;
    };

    // Start practicing with the AI-created module config
    const handleStartPractice = (name: string, config: ModuleConfig, duration?: number) => {
        const sessionBlock = {
            module_type: config.module_type as ModuleType,
            config: { ...config },
            duration_minutes: duration || 2,
            order: 0,
            conceptId: `ai-coach-${generateId()}`,
        } as SessionBlock;

        startSessionWithPlan(name, [sessionBlock]);
    };

    // Save the AI-created module as a routine
    const handleSaveAsRoutine = async (name: string, config: ModuleConfig, duration?: number, description?: string) => {
        const sessionBlock = {
            module_type: config.module_type as ModuleType,
            config: { ...config },
            duration_minutes: duration || 2,
            order: 0,
            conceptId: `ai-coach-${generateId()}`,
        } as SessionBlock;

        const routine = await createRoutine({
            name,
            description: description || `Created by AI Coach`,
            icon: config.module_type === 'scale' ? '🎸' : '🎵',
            session_plan: [sessionBlock],
            is_favorite: false,
            created_by_ai: true,
        });

        if (routine) {
            toast.success(`Saved routine: ${name}`);
        } else {
            toast.error('Failed to save routine');
        }
    };

    // Undo a routine edit by reverting to previous session plan
    const handleUndoEdit = async (routineId: string, previousPlan: any[]) => {
        const castPlan = previousPlan.map((b: any, i: number) => ({
            module_type: b.module_type as ModuleType,
            config: b.config || { module_type: b.module_type },
            duration_minutes: b.duration_minutes || 10,
            order: i,
            conceptId: b.conceptId,
        }));
        const success = await updateRoutineHook(routineId, {
            session_plan: castPlan,
        });
        if (success) {
            toast.success('Changes undone — routine restored to previous state');
        } else {
            toast.error('Failed to undo changes');
        }
    };

    // Save a modified routine as a new copy
    const handleDuplicateRoutine = async (routineId: string, routineName: string) => {
        const newName = `${routineName} (Copy)`;
        const dup = await duplicateRoutine(routineId, newName);
        if (dup) {
            toast.success(`Saved as "${newName}"`);
        } else {
            toast.error('Failed to duplicate routine');
        }
    };

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const sendMessage = async (messageText?: string) => {
        const text = messageText || input.trim();
        if (!text || loading) return;

        setInput('');
        setError(null);
        setActiveTools([]);

        const userMessage: Message = {
            id: generateId(),
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
                id: generateId(),
                role: 'assistant',
                content: data.response || 'I apologize, but I encountered an issue processing your request.',
                timestamp: new Date(),
                toolCalls: data.toolCalls,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err: any) {
            console.error('Coach error:', err);
            setError(err.message || 'Failed to get response from coach');

            const errorMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
            setActiveTools([]);
            inputRef.current?.focus();
        }
    };

    const handleSuggestionClick = (prompt: string) => {
        sendMessage(prompt);
    };

    /** Render a compact summary of the tools used in a message */
    const renderToolSummary = (toolCalls: ToolCallResult[]) => {
        const uniqueTools = [...new Set(toolCalls.map(t => t.tool))];
        return (
            <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
                {uniqueTools.map(tool => {
                    const label = TOOL_LABELS[tool];
                    const hasError = toolCalls.some(t => t.tool === tool && t.result?.error);
                    return (
                        <span
                            key={tool}
                            className={cn(
                                "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                                hasError
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted-foreground/10 text-muted-foreground"
                            )}
                        >
                            {label?.icon || '🔧'} {label?.label?.replace('...', '') || tool}
                            {hasError && ' ⚠️'}
                        </span>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Experimental Banner */}
            <div className="flex-shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <FlaskConical className="w-4 h-4" />
                    <span className="text-xs font-medium">Experimental Feature</span>
                    <span className="text-xs text-muted-foreground">— AI responses may be inaccurate</span>
                </div>
            </div>

            {/* Messages Area */}
            <ScrollArea ref={scrollRef} className="flex-1 p-4">
                {messages.length === 0 ? (
                    /* Welcome State */
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-4">
                            <Bot className="w-8 h-8 text-white" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-xl font-semibold">Guitar Brain Coach</h2>
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/30">
                                Experimental
                            </span>
                        </div>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            I can help you create practice modules, manage your routines,
                            analyze your progress, and find the right exercises for your goals.
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
                        {messages.map(message => {
                            const moduleData = message.role === 'assistant'
                                ? getModuleConfigFromToolCalls(message.toolCalls)
                                : null;
                            const routinePlan = message.role === 'assistant'
                                ? getRoutinePlanFromToolCalls(message.toolCalls)
                                : null;

                            return (
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
                                            'rounded-lg px-4 py-2 max-w-[85%]',
                                            message.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted'
                                        )}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                                        {/* Routine plan view (for get_routine_details / update_routine) */}
                                        {routinePlan && (
                                            <>
                                                <RoutinePlanView
                                                    routineName={routinePlan.name}
                                                    blocks={routinePlan.blocks}
                                                    totalDuration={routinePlan.totalDuration}
                                                    editLog={routinePlan.editLog}
                                                    compact={routinePlan.blocks.length > 6}
                                                />

                                                {/* Undo / Save As buttons for update results */}
                                                {routinePlan.type === 'update' && routinePlan.routineId && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {routinePlan.previousPlan && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleUndoEdit(
                                                                    routinePlan.routineId!,
                                                                    routinePlan.previousPlan!
                                                                )}
                                                                className="gap-1 text-xs"
                                                            >
                                                                <Undo2 className="w-3 h-3" />
                                                                Undo Changes
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDuplicateRoutine(
                                                                routinePlan.routineId!,
                                                                routinePlan.name
                                                            )}
                                                            className="gap-1 text-xs"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                            Save as New Routine
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* Start practice for newly created routines */}
                                                {routinePlan.type === 'created' && routinePlan.routineId && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => startSessionWithPlan(
                                                                routinePlan.name,
                                                                routinePlan.blocks.map((b: any, i: number) => ({
                                                                    module_type: b.module_type,
                                                                    config: b.config || { module_type: b.module_type },
                                                                    duration_minutes: b.duration_minutes || 10,
                                                                    order: i,
                                                                    conceptId: `ai-routine-${generateId()}`,
                                                                }))
                                                            )}
                                                            className="gap-1"
                                                        >
                                                            <Play className="w-3 h-3" />
                                                            Start Practice
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* Info for duplicated routines */}
                                                {routinePlan.type === 'duplicated' && (
                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                        📋 Copied from "{(routinePlan as any).originalName}" — you can now modify this independently
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Action buttons for created module configs */}
                                        {moduleData && (
                                            <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleStartPractice(moduleData.name, moduleData.config, moduleData.duration)}
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
                                                        moduleData.duration,
                                                        moduleData.description
                                                    )}
                                                    className="gap-1"
                                                >
                                                    <Save className="w-3 h-3" />
                                                    Save as Routine
                                                </Button>
                                            </div>
                                        )}

                                        {/* Tool call summary */}
                                        {message.toolCalls && message.toolCalls.length > 0 && renderToolSummary(message.toolCalls)}
                                    </div>

                                    {message.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Loading indicator with active tool label */}
                        {loading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-xs text-muted-foreground">Thinking...</span>
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
