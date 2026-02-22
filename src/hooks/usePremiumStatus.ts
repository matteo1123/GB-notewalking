import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const usePremiumStatus = () => {
    const { user } = useAuth();
    const [isPremium, setIsPremium] = useState<boolean>(false);
    const [isTrialExpiringSoon, setIsTrialExpiringSoon] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;

        const checkStatus = async () => {
            if (!user) {
                if (mounted) {
                    setIsPremium(false);
                    setIsTrialExpiringSoon(false);
                    setLoading(false);
                }
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('premium_until, subscription_status')
                    .eq('id', user.id)
                    .maybeSingle();

                if (error || !data) {
                    if (mounted) {
                        setIsPremium(false);
                        setIsTrialExpiringSoon(false);
                    }
                    return;
                }

                const premiumUntil = data.premium_until ? new Date(data.premium_until) : null;
                const now = new Date();
                const hasPremium = premiumUntil ? premiumUntil > now : false;

                // Define expiring soon: premium is active, they are NOT on an active renewing Stripe subscription,
                // and they have 14 days or less remaining on their current access period.
                let expiringSoon = false;
                if (hasPremium && premiumUntil && data.subscription_status !== 'active') {
                    const daysRemaining = (premiumUntil.getTime() - now.getTime()) / (1000 * 3600 * 24);
                    if (daysRemaining <= 14 && daysRemaining > 0) {
                        expiringSoon = true;
                    }
                }

                if (mounted) {
                    setIsPremium(hasPremium);
                    setIsTrialExpiringSoon(expiringSoon);
                }
            } catch (err) {
                console.error("Error fetching premium status:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        checkStatus();

        return () => {
            mounted = false;
        };
    }, [user]);

    return { isPremium, isTrialExpiringSoon, loading };
};
