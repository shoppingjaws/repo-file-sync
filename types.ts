export interface TemplateVar {
  key: string;
  value: string;
}

export interface RepoSource {
  repo: string;
  ref: string;
  files: string[];
  vars?: TemplateVar[];
}

export interface Config {
  sources: RepoSource[];
}