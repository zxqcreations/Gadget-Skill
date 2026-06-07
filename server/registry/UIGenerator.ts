import { ToolManifest, UIConfig, UIFieldConfig, InputType } from '../../shared/types';

/**
 * Maps a manifest input type to a UI field type.
 * The same type is used for both backend validation and frontend rendering.
 */
const TYPE_MAP: Record<string, InputType> = {
  string: 'string',
  text: 'text',
  number: 'number',
  range: 'range',
  boolean: 'boolean',
  select: 'select',
  file: 'file',
  'file[]': 'file[]',
  folder: 'folder',
  url: 'url',
  json: 'json',
  secret: 'secret',
  color: 'color',
};

/**
 * Generates a UI configuration from a tool manifest.
 * The frontend uses this to dynamically render the tool's operation form.
 */
export function generateUIConfig(manifest: ToolManifest): UIConfig {
  const fields: UIFieldConfig[] = manifest.inputs.map((input) => {
    const fieldType = TYPE_MAP[input.type] || 'string';

    const field: UIFieldConfig = {
      key: input.key,
      label: input.label,
      type: fieldType,
      required: input.required ?? false,
      placeholder: input.placeholder,
      help: input.help,
    };

    // Copy type-specific properties
    if (input.default !== undefined) field.defaultValue = input.default;
    if (input.options) field.options = input.options;
    if (input.min !== undefined) field.min = input.min;
    if (input.max !== undefined) field.max = input.max;
    if (input.step !== undefined) field.step = input.step;
    if (input.accept) field.accept = input.accept;
    if (input.showIf) field.showIf = input.showIf;

    return field;
  });

  return {
    toolId: manifest.id,
    toolName: manifest.name,
    description: manifest.description,
    icon: manifest.ui?.icon || getDefaultIcon(manifest.mode),
    color: manifest.ui?.color || getDefaultColor(manifest.category),
    layout: manifest.ui?.layout || 'form',
    fields,
    previewEnabled: manifest.ui?.preview ?? false,
  };
}

function getDefaultIcon(mode: string): string {
  switch (mode) {
    case 'cli': return 'terminal';
    case 'http': return 'globe';
    case 'web': return 'layout';
    case 'composite': return 'git-merge';
    default: return 'tool';
  }
}

function getDefaultColor(category?: string): string {
  const colors: Record<string, string> = {
    media: '#22c55e',
    data: '#3b82f6',
    text: '#f59e0b',
    network: '#8b5cf6',
    ai: '#ec4899',
    dev: '#06b6d4',
    system: '#64748b',
  };
  return colors[category || ''] || '#6366f1';
}
