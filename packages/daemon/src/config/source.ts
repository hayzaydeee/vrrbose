import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseYaml } from 'yaml';

type AnyRecord = Record<string, unknown>;

const GLOBAL_CONFIG_PATH = join(homedir(), '.vrrbose', 'config.yaml');

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: AnyRecord, incoming: AnyRecord): AnyRecord {
  const result: AnyRecord = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (isRecord(value) && isRecord(result[key])) {
      result[key] = deepMerge(result[key] as AnyRecord, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function safeParseYaml(content: string, sourceLabel: string): AnyRecord {
  try {
    const parsed = parseYaml(content);
    return isRecord(parsed) ? parsed : {};
  } catch (err) {
    console.warn(`[config] failed to parse ${sourceLabel}: ${(err as Error).message}`);
    return {};
  }
}

function extractYamlBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const re = /```yaml\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = re.exec(markdown);
  while (match) {
    if (match[1]) {
      blocks.push(match[1]);
    }
    match = re.exec(markdown);
  }
  return blocks;
}

function readGlobalConfig(): AnyRecord {
  if (!existsSync(GLOBAL_CONFIG_PATH)) return {};
  return safeParseYaml(readFileSync(GLOBAL_CONFIG_PATH, 'utf8'), GLOBAL_CONFIG_PATH);
}

function readProjectConfig(projectPath: string | undefined): AnyRecord {
  if (!projectPath) return {};

  const projectConfigPath = join(projectPath, 'VRRBOSE.md');
  if (!existsSync(projectConfigPath)) return {};

  const markdown = readFileSync(projectConfigPath, 'utf8');
  const yamlBlocks = extractYamlBlocks(markdown);
  if (yamlBlocks.length === 0) return {};

  let merged: AnyRecord = {};
  for (const block of yamlBlocks) {
    merged = deepMerge(merged, safeParseYaml(block, projectConfigPath));
  }

  return merged;
}

export function loadMergedConfig(projectPath: string | undefined): AnyRecord {
  const globalConfig = readGlobalConfig();
  const projectConfig = readProjectConfig(projectPath);
  return deepMerge(globalConfig, projectConfig);
}

export function getConfigValue<T>(config: AnyRecord, path: string[]): T | undefined {
  let current: unknown = config;
  for (const segment of path) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current as T;
}
