from typing import List, TypedDict


class RepoSource(TypedDict):
    repo: str
    ref: str
    files: List[str]


class Config(TypedDict):
    sources: List[RepoSource]