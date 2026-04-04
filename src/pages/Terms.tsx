import { useEffect, useState } from "react";
import { getTerms } from "@/services/api";

const Terms = () => {
  const [terms, setTerms] = useState<string | null>(null);

  useEffect(() => {
    getTerms().then(setTerms);
  }, []);

  return (
    <div dir="rtl" lang="he" className="min-h-screen py-10">
      <div className="container mx-auto max-w-2xl px-4">
        <h1 className="mb-6 text-3xl font-bold">תקנון ומדיניות</h1>
        {terms === null ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : terms.trim() === "" ? (
          <p className="text-muted-foreground">לא הוגדר תקנון עדיין.</p>
        ) : (
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
            {terms}
          </div>
        )}
      </div>
    </div>
  );
};

export default Terms;

