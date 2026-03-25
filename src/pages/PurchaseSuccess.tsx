import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const PurchaseSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8 text-center">
      <CheckCircle className="h-16 w-16 text-green-500" />
      <h1 className="text-3xl font-bold">You're in!</h1>
      <p className="text-muted-foreground text-lg max-w-sm">
        Welcome to GB Notewalking. Taking you to the app now…
      </p>
    </div>
  );
};

export default PurchaseSuccess;
