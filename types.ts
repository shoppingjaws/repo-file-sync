export interface RepoSource {
  repo: string;
  ref: string;
  files: string[];
}

export interface Config {
  sources: RepoSource[];
}