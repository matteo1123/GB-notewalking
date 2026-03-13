import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, GripVertical, Trash2, Pencil } from 'lucide-react';

interface CourseVideo {
    id: string;
    title: string;
    description: string | null;
    video_url: string;
    duration: string | null;
    order_index: number;
    locked: boolean;
    unlock_cost: number;
    grid_row: number;
    grid_column: number;
    prerequisite_ids: string[];
    category: string | null;
}

export default function CourseEditor() {
    const { toast } = useToast();
    const [videos, setVideos] = useState<CourseVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    
    // Categories constant
    const categories = ['Rhythm', 'Chord Tones', 'Fretboard Mastery', 'Ear', 'Technique'];

    // Form state
    const [formData, setFormData] = useState<Partial<CourseVideo>>({
        title: '',
        description: '',
        video_url: '',
        duration: '',
        locked: true,
        order_index: 0,
        unlock_cost: 0,
        grid_row: 0,
        grid_column: 0,
        prerequisite_ids: [],
        category: 'Rhythm'
    });

    const loadVideos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('course_videos')
            .select('*')
            .order('order_index', { ascending: true });

        if (error) {
            toast({ title: 'Error fetching videos', description: error.message, variant: 'destructive' });
        } else {
            setVideos(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadVideos();
    }, []);

    const resetForm = () => {
        setIsEditing(null);
        setFormData({
            title: '',
            description: '',
            video_url: '',
            duration: '',
            locked: true,
            order_index: videos.length, // Default to end of list
            unlock_cost: 0,
            grid_row: 0,
            grid_column: 0,
            prerequisite_ids: [],
            category: 'Rhythm'
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.video_url) {
            toast({ title: 'Validation Error', description: 'Title and Video URL are required.', variant: 'destructive' });
            return;
        }

        setFormLoading(true);
        try {
            if (isEditing) {
                const { error } = await supabase
                    .from('course_videos')
                    .update(formData)
                    .eq('id', isEditing);
                if (error) throw error;
                toast({ title: 'Video Updated', description: 'The video has been successfully updated.' });
            } else {
                const { error } = await supabase
                    .from('course_videos')
                    .insert([{
                        ...formData,
                        title: formData.title!,
                        video_url: formData.video_url!
                    }]);
                if (error) throw error;
                toast({ title: 'Video Added', description: 'The new video has been added to the course.' });
            }
            loadVideos();
            resetForm();
        } catch (err) {
            const error = err as Error;
            toast({ title: 'Database Error', description: error.message, variant: 'destructive' });
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (video: CourseVideo) => {
        setIsEditing(video.id);
        setFormData({
            title: video.title,
            description: video.description || '',
            video_url: video.video_url,
            duration: video.duration || '',
            locked: video.locked,
            order_index: video.order_index,
            unlock_cost: video.unlock_cost || 0,
            grid_row: video.grid_row || 0,
            grid_column: video.grid_column || 0,
            prerequisite_ids: video.prerequisite_ids || [],
            category: video.category || 'Rhythm'
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;

        try {
            const { error } = await supabase
                .from('course_videos')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast({ title: 'Video Deleted', description: 'The video was permanently removed.' });
            setVideos(prev => prev.filter(v => v.id !== id));
        } catch (err: any) {
            toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
        }
    };

    const moveVideo = async (index: number, direction: 'up' | 'down') => {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === videos.length - 1)
        ) return;

        const newVideos = [...videos];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap array positions
        const temp = newVideos[index];
        newVideos[index] = newVideos[targetIndex];
        newVideos[targetIndex] = temp;

        // Update order_index for ALL to be safe
        const updates = newVideos.map((v, i) => ({
            ...v,
            order_index: i
        }));

        setVideos(updates);

        // Save to DB
        try {
            const { error } = await supabase
                .from('course_videos')
                .upsert(updates);

            if (error) throw error;
            toast({ title: 'Order saved', description: 'The course curriculum has been reordered.' });
        } catch (err: any) {
            toast({ title: 'ReorderFailed', description: err.message, variant: 'destructive' });
            loadVideos(); // Revert on failure
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;

    return (
        <div className="container max-w-5xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Editor Form */}
            <div className="lg:col-span-1 space-y-6">
                <Card className="sticky top-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {isEditing ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {isEditing ? 'Edit Video' : 'Add New Video'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title <span className="text-red-500">*</span></Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="video_url">Video Embed URL <span className="text-red-500">*</span></Label>
                                <Input
                                    id="video_url"
                                    placeholder="e.g. https://www.youtube.com/embed/..."
                                    value={formData.video_url}
                                    onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">Always use the embed URL format, not the direct watch link.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="duration">Length</Label>
                                    <Input
                                        id="duration"
                                        placeholder="e.g. 5:20"
                                        value={formData.duration || ''}
                                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="order_index">Order Index</Label>
                                    <Input
                                        id="order_index"
                                        type="number"
                                        value={formData.order_index}
                                        onChange={e => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="category">Pillar Category</Label>
                                <select
                                    id="category"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4 border p-4 bg-muted/10 rounded-lg">
                                <div className="space-y-2">
                                    <Label htmlFor="unlock_cost">Unlock Cost (XP)</Label>
                                    <Input
                                        id="unlock_cost"
                                        type="number"
                                        value={formData.unlock_cost}
                                        onChange={e => setFormData({ ...formData, unlock_cost: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="grid_row">Grid Row (Y)</Label>
                                    <Input
                                        id="grid_row"
                                        type="number"
                                        value={formData.grid_row}
                                        onChange={e => setFormData({ ...formData, grid_row: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="grid_column">Grid Column (X)</Label>
                                    <Input
                                        id="grid_column"
                                        type="number"
                                        value={formData.grid_column}
                                        onChange={e => setFormData({ ...formData, grid_column: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 p-4 border rounded-lg bg-muted/10">
                                <Label>Prerequisites</Label>
                                <p className="text-xs text-muted-foreground mb-2">Select the videos that must be completed/unlocked before this one.</p>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {videos.filter(v => v.id !== isEditing).map(video => (
                                        <div key={video.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`prereq-${video.id}`}
                                                checked={formData.prerequisite_ids?.includes(video.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setFormData(prev => {
                                                        const current = prev.prerequisite_ids || [];
                                                        return {
                                                            ...prev,
                                                            prerequisite_ids: checked 
                                                                ? [...current, video.id]
                                                                : current.filter(id => id !== video.id)
                                                        };
                                                    })
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                            />
                                            <Label htmlFor={`prereq-${video.id}`} className="text-sm font-normal truncate">
                                                {video.title} <span className="text-muted-foreground text-xs">({video.grid_column}, {video.grid_row})</span>
                                            </Label>
                                        </div>
                                    ))}
                                    {videos.length <= 1 && <span className="text-xs text-muted-foreground italic">Add more videos first.</span>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                                <div className="space-y-1">
                                    <Label className="cursor-pointer" htmlFor="locked">Premium Lock</Label>
                                    <p className="text-xs text-muted-foreground">If disabled, any free user can watch this.</p>
                                </div>
                                <Switch
                                    id="locked"
                                    checked={formData.locked}
                                    onCheckedChange={c => setFormData({ ...formData, locked: c })}
                                />
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button type="submit" disabled={formLoading} className="flex-1">
                                    {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {isEditing ? 'Save Changes' : 'Add Video'}
                                </Button>
                                {isEditing && (
                                    <Button type="button" variant="outline" onClick={resetForm} disabled={formLoading}>
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* Video List */}
            <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold">Curriculum ({videos.length})</h2>
                    <p className="text-sm text-muted-foreground">Drag handles coming soon. Use arrows to reorder.</p>
                </div>

                {videos.length === 0 ? (
                    <div className="p-8 text-center border rounded-xl bg-muted/30 text-muted-foreground">
                        No videos in the course yet. Add your first one!
                    </div>
                ) : (
                    videos.map((video, idx) => (
                        <Card key={video.id} className={`transition-all ${isEditing === video.id ? 'border-primary ring-1 ring-primary' : ''}`}>
                            <CardContent className="p-4 flex items-center gap-4">
                                {/* Order Controls */}
                                <div className="flex flex-col items-center gap-1 text-muted-foreground border-r pr-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={idx === 0}
                                        onClick={() => moveVideo(idx, 'up')}
                                    >
                                        <span className="text-lg leading-none">▲</span>
                                    </Button>
                                    <span className="text-xs font-bold">{video.order_index}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        disabled={idx === videos.length - 1}
                                        onClick={() => moveVideo(idx, 'down')}
                                    >
                                        <span className="text-lg leading-none">▼</span>
                                    </Button>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold truncate">{video.title}</h3>
                                        {!video.locked && <span className="bg-green-500/10 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Free Preview</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{video.video_url}</p>
                                    <div className="flex gap-4 mt-2 text-xs">
                                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded font-bold">{video.category || 'Rhythm'}</span>
                                        <span className="bg-muted px-2 py-1 rounded">Duration: {video.duration || 'N/A'}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 border-l pl-4">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(video)}>
                                        <Pencil className="w-4 h-4 mr-1" /> Edit
                                    </Button>
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(video.id, video.title)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
