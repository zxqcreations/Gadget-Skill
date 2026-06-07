import path from 'path';
import fs from 'fs';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config.json');

interface AppConfig {
  port: number;
  toolsDir: string;
  dataDir: string;
  mcpEnabled: boolean;
  autoStart: boolean;
}

const defaults: AppConfig = {
  port: 3000,
  toolsDir: path.join(process.cwd(), 'tools'),
  dataDir: path.join(process.cwd(), 'data'),
  mcpEnabled: true,
  autoStart: false,
};

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return { ...defaults, ...raw };
    }
  } catch {
    // Use defaults
  }
  // Ensure data directory exists
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  saveConfig(defaults);
  return defaults;
}

function saveConfig(config: AppConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export const config = loadConfig();

export function updateConfig(partial: Partial<AppConfig>): AppConfig {
  Object.assign(config, partial);
  saveConfig(config);
  return config;
}

export function getConfig(): AppConfig {
  return { ...config };
}
