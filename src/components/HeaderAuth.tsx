'use client';
import { useState, useEffect } from 'react';
import { getCurrentUser, signInWithEmail, signOut } from '@/lib/supabase/auth';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSound } from '@/hooks/useSound';
import { Volume2, VolumeX, Vibrate, VibrateOff } from 'lucide-react';

export default function HeaderAuth() {
  const [user, setUser] = useState<User | null>(null);
  const { soundOn, hapticsOn, toggleSound, toggleHaptics } = useSound();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">...</div>;

  const controls = (
    <div className="flex items-center gap-1 mr-2">
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={toggleSound} title="Toggle Sound">
        {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={toggleHaptics} title="Toggle Haptics">
        {hapticsOn ? <Vibrate className="h-4 w-4" /> : <VibrateOff className="h-4 w-4" />}
      </Button>
    </div>
  );

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {controls}
        <a href="/me" className="text-sm font-medium hover:underline">Profile</a>
        <Button variant="outline" size="sm" onClick={() => signOut().then(() => window.location.reload())}>Sign out</Button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex items-center gap-3">
        {controls}
        <span className="text-sm text-muted-foreground">Check your email!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {controls}
      <Input 
        type="email" 
        placeholder="Email" 
        className="w-32 h-8 text-sm" 
        value={email} 
        onChange={e => setEmail(e.target.value)} 
      />
      <Button 
        size="sm" 
        onClick={() => {
          if (!email) return;
          signInWithEmail(email, window.location.origin).then(() => setSent(true)).catch(console.error);
        }}
      >
        Sign in
      </Button>
    </div>
  );
}
