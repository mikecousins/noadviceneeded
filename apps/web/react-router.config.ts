import type { Config } from "@react-router/dev/config";

export default {
  // Server-side rendered on Netlify's serverless (Node) target.
  ssr: true,
  future: {
    v8_middleware: true,
  },
} satisfies Config;
