declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export const createClient: any;
}

declare module 'https://deno.land/x/zod@v3.23.8/mod.ts' {
  export const z: any;
}
