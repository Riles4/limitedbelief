'use client';

import { cn } from "@/lib/utils";

interface Response {
  agent: string;
  output: string;
}

interface ResponseDisplayProps {
  responses: Response[];
}

const ResponseDisplay = ({ responses }: ResponseDisplayProps) => {
  if (!responses || responses.length === 0) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        No responses yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-md">
      {responses.map((response, index) => (
        <div 
          key={index} 
          className={cn(
            "p-4 rounded-lg border border-input bg-background shadow-sm",
            "transition-all hover:shadow-md"
          )}
        >
          <h3 className="text-sm font-medium mb-2">{response.agent}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{response.output}</p>
        </div>
      ))}
    </div>
  );
};

export default ResponseDisplay;