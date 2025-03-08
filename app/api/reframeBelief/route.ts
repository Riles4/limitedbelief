import { NextResponse } from 'next/server';
import { createSupabaseServerSide } from '@/lib/supabase/supabase-server-side';

// Define type for the response from n8n
interface AIResponse {
  agent: string;
  output: string;
}

export async function POST(request: Request) {
  try {
    // Initialize Supabase client
    const supabase = await createSupabaseServerSide();
    
    // Get the current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Parse the request body
    const body = await request.json();
    const { belief } = body;

    if (!belief) {
      return NextResponse.json(
        { error: 'Limiting belief is required' },
        { status: 400 }
      );
    }

    // Send the belief to the n8n workflow
    const n8nUrl = 'https://n8n-l60w.onrender.com/webhook/decision-matrix';
    
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limiting_belief: belief }),
    });

    if (!response.ok) {
      throw new Error(`N8n workflow responded with status: ${response.status}`);
    }

    const data: { responses?: AIResponse[] } = await response.json();
    
    // Extract reframed belief and supporting evidence from the responses
    let reframedBelief = '';
    let supportingEvidence = '';
    
    if (data.responses && Array.isArray(data.responses)) {
      // Find the reframed belief (from ReframingAI)
      const reframingResponse = data.responses.find(
        (resp: AIResponse) => resp.agent === 'ReframingAI'
      );
      
      // Find the supporting evidence (from EvidenceAI)
      const evidenceResponse = data.responses.find(
        (resp: AIResponse) => resp.agent === 'EvidenceAI'
      );
      
      if (reframingResponse) {
        reframedBelief = reframingResponse.output;
      }
      
      if (evidenceResponse) {
        supportingEvidence = evidenceResponse.output;
      }
      
      // Store the belief and responses in Supabase
      const { error: insertError } = await supabase
        .from('belief_transformations')
        .insert({
          user_id: user?.id, // Will be null for unauthenticated users
          limiting_belief: belief,
          reframed_belief: reframedBelief,
          supporting_evidence: supportingEvidence
        });
      
      if (insertError) {
        console.error('Error storing belief in Supabase:', insertError);
        // Continue anyway to return the responses to the user
      }
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing limiting belief:', error);
    return NextResponse.json(
      { error: 'Failed to process limiting belief' },
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}