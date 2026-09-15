import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("app", "routes/app-layout.tsx", [
    index("routes/app.tsx"),
    route("invest", "routes/app.invest.tsx"),
    route("withdraw", "routes/app.withdraw.tsx"),
    route("accounts", "routes/app.accounts.tsx"),
    route("etf", "routes/app.etf.tsx"),
    route("room", "routes/app.room.tsx"),
    route("orders", "routes/app.orders.tsx"),
  ]),
  route("auth/snaptrade/start", "routes/auth.snaptrade.start.ts"),
  route("auth/snaptrade/callback", "routes/auth.snaptrade.callback.ts"),
  route("auth/sign-out", "routes/auth.sign-out.ts"),
  route("api/v1/health", "routes/api.v1.health.ts"),
] satisfies RouteConfig;
