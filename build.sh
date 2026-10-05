#!/bin/bash
# Script para generar env.js en Vercel a partir de variables de entorno
echo "export const SUPABASE_URL = '$SUPABASE_URL';" > frontend/env.js
echo "export const SUPABASE_ANON_KEY = '$SUPABASE_ANON_KEY';" >> frontend/env.js
