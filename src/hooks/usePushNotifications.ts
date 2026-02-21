import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export function usePushNotifications() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        // Check if push messaging is supported
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        setIsSupported(supported);

        if (supported) {
            setPermission(Notification.permission);

            // Check active subscription
            navigator.serviceWorker.ready.then(registration => {
                registration.pushManager.getSubscription().then(subscription => {
                    setIsSubscribed(!!subscription);
                });
            });
        }
    }, []);

    const subscribeToPush = async () => {
        if (!isSupported) {
            toast({ title: "Push notifications not supported in this browser.", variant: "destructive" });
            return;
        }

        if (!user) {
            toast({ title: "Please log in to enable notifications.", variant: "destructive" });
            return;
        }

        setIsRegistering(true);

        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== 'granted') {
                throw new Error("Permission not granted for Notification");
            }

            // Ensure service worker is registered
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            // Get VAPID key from env
            const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!publicVapidKey) {
                throw new Error("Missing VITE_VAPID_PUBLIC_KEY environment variable");
            }

            // Subscribe to PushManager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });

            // Send subscription to backend
            const { error } = await supabase.functions.invoke('register-push', {
                body: { subscription }
            });

            if (error) throw error;

            setIsSubscribed(true);
            toast({ title: "Successfully enabled Sprint notifications!" });

        } catch (error: any) {
            console.error("Push registration error:", error);
            toast({
                title: "Failed to enable notifications.",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setIsRegistering(false);
        }
    };

    return {
        isSupported,
        permission,
        isSubscribed,
        isRegistering,
        subscribeToPush
    };
}

// Utility function to convert base64 to Uint8Array required by PushManager
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
