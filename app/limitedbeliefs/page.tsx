'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseClientSide } from '@/lib/supabase/supabase-client-side';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import ResponseDisplay from '@/components/ResponseDisplay';

interface Response {
  agent: string;
  output: string;
}

interface LimitingBeliefFormProps {
  onSubmit: (belief: string) => void;
  isLoading: boolean;
}

const LimitingBeliefForm = ({ onSubmit, isLoading }: LimitingBeliefFormProps) => {
  const [belief, setBelief] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(belief);
    // Only clear the form if not in loading state (will be cleared after successful submission)
    if (!isLoading) {
      setBelief('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
      <div className="space-y-2">
        <label 
          htmlFor="belief" 
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Enter your limiting belief:
        </label>
        <textarea
          id="belief"
          value={belief}
          onChange={(e) => setBelief(e.target.value)}
          required
          disabled={isLoading}
          className={cn(
            "border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm min-h-[100px] resize-y",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
          )}
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Submit'}
      </Button>
    </form>
  );
};

// Define type for Supabase session
interface SupabaseSession {
  user: User | null;
}

interface SavedBelief {
  id: number;
  limiting_belief: string;
  reframed_belief: string;
  supporting_evidence: string;
  created_at: string;
}

export default function LimitingBeliefsPage() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBeliefs, setSavedBeliefs] = useState<SavedBelief[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  
  // Initialize Supabase client
  const supabase = createSupabaseClientSide();
  
  // Check for user authentication and fetch saved beliefs
  useEffect(() => {
    const fetchUserAndBeliefs = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Fetch saved beliefs for authenticated user
        const { data, error } = await supabase
          .from('belief_transformations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching saved beliefs:', error);
        } else if (data) {
          setSavedBeliefs(data);
        }
      }
    };
    
    fetchUserAndBeliefs();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session: SupabaseSession | null) => {
        setUser(session?.user || null);
        
        if (session?.user) {
          // Fetch saved beliefs when user logs in
          const { data, error } = await supabase
            .from('belief_transformations')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          
          if (!error && data) {
            setSavedBeliefs(data);
          }
        } else {
          // Clear saved beliefs when user logs out
          setSavedBeliefs([]);
        }
      }
    );
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Load a saved belief into the responses
  const loadSavedBelief = (belief: SavedBelief) => {
    const loadedResponses: Response[] = [];
    
    if (belief.reframed_belief) {
      loadedResponses.push({
        agent: 'ReframingAI',
        output: belief.reframed_belief
      });
    }
    
    if (belief.supporting_evidence) {
      loadedResponses.push({
        agent: 'EvidenceAI',
        output: belief.supporting_evidence
      });
    }
    
    setResponses(loadedResponses);
  };
  
  const handleFormSubmit = async (belief: string) => {
    if (!belief.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the API route
      const response = await fetch('/api/reframeBelief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ belief }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle the expected response format from n8n
      if (data.responses && Array.isArray(data.responses)) {
        // Add all responses from the array
        setResponses(prev => [...prev, ...data.responses]);
      } else {
        // Fallback for unexpected response format
        console.warn('Unexpected response format:', data);
        
        // Create a fallback response
        const fallbackResponse: Response = {
          agent: "System",
          output: "Received response in an unexpected format. Please try again."
        };
        
        setResponses(prev => [...prev, fallbackResponse]);
      }
    } catch (err) {
      console.error('Error submitting belief:', err);
      setError('Failed to process your belief. Please try again.');
      
      // Add an error response
      const errorResponse: Response = {
        agent: "System",
        output: "Sorry, there was an error processing your belief. Please try again later."
      };
      
      setResponses(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid items-center justify-items-center min-h-screen p-8 pb-20 gap-8 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center w-full max-w-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Limiting Beliefs</h1>
          <p className="text-muted-foreground">
            Share your limiting beliefs and take the first step toward overcoming them.
          </p>
        </div>
        
        {user && savedBeliefs.length > 0 && (
          <div className="w-full flex justify-center gap-4">
            <Button 
              variant={!showSaved ? "default" : "outline"} 
              onClick={() => setShowSaved(false)}
            >
              New Belief
            </Button>
            <Button 
              variant={showSaved ? "default" : "outline"} 
              onClick={() => setShowSaved(true)}
            >
              Saved Beliefs ({savedBeliefs.length})
            </Button>
          </div>
        )}
        
        {!showSaved ? (
          <>
            <div className="w-full">
              <LimitingBeliefForm onSubmit={handleFormSubmit} isLoading={isLoading} />
            </div>
            
            {error && (
              <div className="w-full p-4 bg-destructive/10 text-destructive rounded-md">
                {error}
              </div>
            )}
            
            {responses.length > 0 && (
              <div className="w-full mt-8">
                <h2 className="text-xl font-semibold mb-4">AI Responses</h2>
                <ResponseDisplay responses={responses} />
              </div>
            )}
          </>
        ) : (
          <div className="w-full">
            <h2 className="text-xl font-semibold mb-4">Your Saved Beliefs</h2>
            <div className="space-y-4">
              {savedBeliefs.map((belief) => (
                <div 
                  key={belief.id} 
                  className="p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    loadSavedBelief(belief);
                    setShowSaved(false);
                  }}
                >
                  <p className="font-medium">{belief.limiting_belief}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(belief.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}