import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Прод запускается через `next start` на порту 3002, проксируется Nginx с app.infoseledka.ru.
  // Указываем явный workspace root, чтобы Next не путался с lockfile в корне монорепо.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
