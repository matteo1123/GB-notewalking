import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';

export default function CourseVerifications() {
    const { toast } = useToast();
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadEnrollments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('course_enrollments' as any)
            .select(`*, profiles:user_id(email, display_name)`)
            .eq('status', 'pending_verification')
            .order('enrolled_at', { ascending: false });

        if (error) {
            toast({ title: 'Error fetching enrollments', description: error.message, variant: 'destructive' });
        } else {
            setEnrollments(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadEnrollments();
    }, []);

    const handleVerify = async (enrollmentId: string, userId: string) => {
        setActionLoading(enrollmentId);
        try {
            // 1. Update enrollment status
            const { error: enrollErr } = await supabase
                .from('course_enrollments' as any)
                .update({ status: 'verified', verified_at: new Date().toISOString() })
                .eq('id', enrollmentId);

            if (enrollErr) throw enrollErr;

            // 2. Bump Premium to 90 days from now
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 90);

            // Get current premium to see if we even need to bump it (maybe they already have a year subscription)
            const { data: profile } = await supabase.from('profiles').select('premium_until').eq('id', userId).single();
            const currentPremium = profile?.premium_until ? new Date(profile.premium_until) : new Date();

            const newDateToSet = currentPremium > targetDate ? currentPremium : targetDate;

            const { error: profileErr } = await supabase
                .from('profiles')
                .update({ premium_until: newDateToSet.toISOString() } as any)
                .eq('id', userId);

            if (profileErr) throw profileErr;

            toast({ title: "Verified!", description: "User granted 90 days of premium access." });
            setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
        } catch (e: any) {
            toast({ title: "Verification Failed", description: e.message, variant: 'destructive' });
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (enrollmentId: string) => {
        setActionLoading(enrollmentId);
        try {
            const { error } = await supabase
                .from('course_enrollments' as any)
                .update({ status: 'rejected', verified_at: new Date().toISOString() })
                .eq('id', enrollmentId);

            if (error) throw error;
            toast({ title: "Rejected", description: "The enrollment request was rejected." });
            setEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
        } catch (e: any) {
            toast({ title: "Rejection Failed", description: e.message, variant: 'destructive' });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Pending Course Verifications</h1>

            {enrollments.length === 0 ? (
                <div className="bg-muted p-8 text-center rounded-lg text-muted-foreground">
                    No pending course verifications right now.
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted">
                            <TableRow>
                                <TableHead>Date Claimed</TableHead>
                                <TableHead>User Email</TableHead>
                                <TableHead>Display Name</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrollments.map((enr) => (
                                <TableRow key={enr.id}>
                                    <TableCell>{new Date(enr.enrolled_at).toLocaleDateString()}</TableCell>
                                    <TableCell>{enr.profiles?.email}</TableCell>
                                    <TableCell>{enr.profiles?.display_name || 'N/A'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleReject(enr.id)}
                                                disabled={actionLoading === enr.id}
                                                className="text-destructive hover:bg-destructive hover:text-white"
                                            >
                                                <X className="w-4 h-4 mr-1" /> Reject
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleVerify(enr.id, enr.user_id)}
                                                disabled={actionLoading === enr.id}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                            >
                                                <Check className="w-4 h-4 mr-1" /> Verify (Grant 90 Days)
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
